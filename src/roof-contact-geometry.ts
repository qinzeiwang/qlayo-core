import {ShapeUtils,Vector2} from 'three';
import {corners,type Obstacle,type Point,type SceneSite} from './domain';
import {flatRoofFootprint,insetRoof} from './flat-roof-shell';
import {gableOuterLoop,gableSlopeTriangles} from './gable-geometry';
import {cross,insidePolygon,segmentDistance,signedArea} from './polygon';
import {roofHeight} from './pitched-roof';
import {gableCopingHeight,gableParapetPlan,pitchSkinOffset} from './gable-parapet';
import {toLocal} from './roof-project';

const EPS=1e-6;
const EDGE_EPS=1e-4; // Float32 host lines can differ slightly from the model coordinates.
type Position=[number,number,number];
const at=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const pos=(p:Point,y:number):Position=>[p.x,y,p.z];
const ring=(a:Point[],fn:(p:Point,q:Point,i:number)=>void)=>a.forEach((p,i)=>fn(p,a[(i+1)%a.length],i));
const rect=(width:number,depth:number)=>corners({x:0,z:0,yaw:0,width,depth});
const onLoop=(p:Point,loop:Point[])=>loop.some((a,i)=>segmentDistance(p,a,loop[(i+1)%loop.length])<EPS);
const unitCuts=(cuts:number[])=>[0,...cuts.filter(t=>t>EPS&&t<1-EPS).sort((a,b)=>a-b),1].filter((v,i,all)=>!i||v-all[i-1]>EPS);

/** Split projected edges at crossings and collinear joins. */
function cutSegment(a:Point,b:Point,loops:Point[][],extra:number[]=[]){
 const cuts=[...extra],dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;
 if(len<EPS*EPS)return [0,1];
 for(const loop of loops)ring(loop,(p,q)=>{
  const sx=q.x-p.x,sz=q.z-p.z,ax=p.x-a.x,az=p.z-a.z,d=dx*sz-dz*sx;
  if(Math.abs(d)>EPS){
   const u=(ax*dz-az*dx)/d;
   if(u>=-EPS&&u<=1+EPS)cuts.push((ax*sz-az*sx)/d);
  }else if(Math.abs(ax*dz-az*dx)<EPS){
   cuts.push((ax*dx+az*dz)/len,((q.x-a.x)*dx+(q.z-a.z)*dz)/len);
  }
 });
 return unitCuts(cuts);
}

export type ContactSolid=Obstacle&{bottom:number;top:number};
type Height=(p:Point)=>number;
type HeightPatch={triangle:Point[];height:Height};
export type RoofContact={outer:Point[];deck:Point[];split:Point[][];surface:Height;occupied:(p:Point)=>Height|undefined;patches:HeightPatch[]};

export function contactSolid(object:Obstacle,site:SceneSite):ContactSolid{
 const bottom=object.baseHeight??0;
 return {...object,...toLocal(object,site),yaw:object.yaw-site.yaw,bottom,top:bottom+object.height};
}

/** Match facade top-edge vertices to the contact sides to avoid cracks at T-junctions. */
export function contactFacadeCuts(outer:Point[],solids:ContactSolid[],top:number){
 const overlaps=solids.filter(solid=>solid.bottom<=top+EPS&&solid.top>top+EPS).map(corners);
 const cuts=outer.map((p,i)=>cutSegment(p,outer[(i+1)%outer.length],overlaps));
 return cuts.some(cut=>cut.length>2)?cuts:undefined;
}

export function roofContact(site:SceneSite):RoofContact{
 const pitch=site.pitch;
 if(pitch){
  if(pitch.kind==='gable'&&(site.outline||pitch.spans)){
   const outer=gableOuterLoop(site);
   const wall=site.wallHeight>0?site.wallHeight:0;
   const deck=wall>0?insetRoof(outer,.2).inner:outer;
   const surface:Height=p=>roofHeight(site,pitch,p.x,p.z)+pitchSkinOffset;
   const copingHeight=gableCopingHeight(site,pitch,wall);
   const coping:Height=()=>copingHeight;
   const slopeTris=gableSlopeTriangles(site,pitch,wall>0).map(item=>item.triangle);
   const split=slopeTris;
   const patches=[
    ...slopeTris.map(triangle=>({triangle,height:surface})),
    ...(wall>0?triangles(outer,[deck]).map(triangle=>({triangle,height:coping})):[]),
   ];
   return {outer,deck,split,surface,patches,occupied:p=>{
    if(!insidePolygon(p,outer)&&!onLoop(p,outer))return;
    return wall>0&&(!insidePolygon(p,deck)||onLoop(p,deck))?coping:surface;
   }};
  }
  if(pitch.kind==='gable'&&site.wallHeight>0){
   const {outer,deck,cells,surface,coping}=gableParapetPlan(site,pitch,site.wallHeight);
   const split=cells.filter(cell=>cell.deck).map(cell=>cell.outline);
   const patches=cells.flatMap(cell=>triangles(cell.outline).map(triangle=>({triangle,height:cell.deck?surface:coping})));
   return {outer,deck,split,surface,patches,occupied:p=>{
    if(!insidePolygon(p,outer)&&!onLoop(p,outer))return;
    return insidePolygon(p,deck)&&!onLoop(p,deck)?surface:coping;
   }};
  }
  const outer=rect(site.width,site.depth);
  const axis=pitch.axis;
  const split=pitch.kind==='gable'?[-1,1].map(sign=>clip(outer,p=>sign*p[axis])):[outer];
  const surface:Height=p=>roofHeight(site,pitch,p.x,p.z)+pitchSkinOffset;
  const patches=split.flatMap(part=>triangles(part).map(triangle=>({triangle,height:surface})));
  return {outer,deck:outer,split,surface,patches,occupied:p=>insidePolygon(p,outer)?surface:undefined};
 }
 const wall=site.carport?0:site.wallHeight;
 const {outer,inner:deck}=flatRoofFootprint(site,wall);
 const surface=()=>site.carport?-3.5:(site.flatHeight??3.5)-3.5;
 const coping=()=>surface()+wall;
 const patches=site.carport?[]:[
  ...triangles(deck).map(triangle=>({triangle,height:surface})),
  ...(wall>0?triangles(outer,[deck]).map(triangle=>({triangle,height:coping})):[]),
 ];
 return {outer,deck,split:[deck],surface,patches,occupied:p=>{
  if(site.carport||!insidePolygon(p,outer)&&!onLoop(p,outer))return;
  return wall>0&&(!insidePolygon(p,deck)||onLoop(p,deck))?coping:surface;
 }};
}

function clip(input:Point[],distance:(p:Point)=>number){
 const output:Point[]=[];
 ring(input,(a,b)=>{
  const da=distance(a),db=distance(b);
  if(da>=0)output.push(a);
  if((da>=0)!==(db>=0))output.push(at(a,b,da/(da-db)));
 });
 return output;
}
function triangles(loop:Point[],holes:Point[][]=[]){
 const vectors=(points:Point[])=>points.map(p=>new Vector2(p.x,p.z));
 const vertices=[...loop,...holes.flat()];
 return ShapeUtils.triangulateShape(vectors(loop),holes.map(vectors))
  .map(list=>list.map(i=>vertices[i]));
}

/** Return the disjoint convex pieces of a polygon left outside a convex mask. */
function subtract(subject:Point[],mask:Point[]){
 const output:Point[][]=[],sign=Math.sign(signedArea(mask));
 let inside=subject;
 ring(mask,(a,b)=>{
  if(inside.length<3||Math.hypot(b.x-a.x,b.z-a.z)<EPS)return;
  const halfPlane=(p:Point)=>sign*cross(a,b,p);
  const outside=clip(inside,p=>-halfPlane(p));
  if(Math.abs(signedArea(outside))>EPS)output.push(outside);
  inside=clip(inside,halfPlane);
 });
 return Math.abs(signedArea(inside))>EPS?output:[subject];
}

/** Create a roof decal from the same projected region for fill and outline, without subdivision outlines. */
export function roofKeepout(contact:RoofContact,outline:Point[]){
 const faces:number[]=[],edges:number[]=[];
 for(const part of contact.split)for(const triangle of triangles(part)){
  const sign=Math.sign(signedArea(triangle));
  let patch=outline;
  ring(triangle,(a,b)=>{patch=clip(patch,p=>sign*cross(a,b,p));});
  if(Math.abs(signedArea(patch))<=EPS)continue;
  for(let i=1;i<patch.length-1;i++){
   if(Math.abs(cross(patch[0],patch[i],patch[i+1]))<=EPS)continue;
   for(const p of [patch[0],patch[i],patch[i+1]])faces.push(...pos(p,contact.surface(p)+.006));
  }
 }
 const known=new Set<string>();
 const emitBoundary=(boundary:Point[],against:Point[])=>ring(boundary,(a,b)=>{
  const cuts=cutSegment(a,b,[against,...contact.split]);
  for(let i=1;i<cuts.length;i++){
   const start=at(a,b,cuts[i-1]),end=at(a,b,cuts[i]);
   if(!insidePolygon(at(start,end,.5),against)||Math.hypot(end.x-start.x,end.z-start.z)<EPS)continue;
   // An edge exactly at the outer facade would look like part of that wall.
   if(onLoop(at(start,end,.5),contact.outer))continue;
   const key=[start,end].map(p=>p.x.toFixed(6)+','+p.z.toFixed(6)).sort().join('/');
   if(known.has(key))continue;
   known.add(key);
   edges.push(...pos(start,contact.surface(start)+.011),...pos(end,contact.surface(end)+.011));
  }
 });
 emitBoundary(outline,contact.deck);
 emitBoundary(contact.deck,outline);
 return {faces,edges};
}

/** Exposed obstacle sides and edges. The host owns the lower part of each contact face. */
export function roofObstacle(contact:RoofContact,solid:ContactSolid){
 const outline=corners(solid),faces:number[]=[],edges:number[]=[],loops=[contact.outer,...contact.split];
 let exposedTop=[outline];
 for(const {triangle,height} of contact.patches){
  const covered=clip(triangle,p=>height(p)-solid.top+EPS);
  if(Math.abs(signedArea(covered))>EPS)exposedTop=exposedTop.flatMap(patch=>subtract(patch,covered));
 }
 for(const patch of exposedTop){
  const top=signedArea(patch)>0?[...patch].reverse():patch;
  for(let i=1;i<top.length-1;i++){
   if(Math.abs(cross(top[0],top[i],top[i+1]))>EPS)faces.push(...pos(top[0],solid.top),...pos(top[i],solid.top),...pos(top[i+1],solid.top));
  }
 }
 ring(outline,(a,b)=>{
  const steps=cutSegment(a,b,loops);
  for(let i=1;i<steps.length;i++){
   const start=at(a,b,steps[i-1]),end=at(a,b,steps[i]);
   const midpoint=at(start,end,.5),height=contact.occupied(midpoint);
   const low:Height=p=>Math.max(solid.bottom,height?.(p)??solid.bottom);
   // Split wherever the sloped surface meets the top or base of the box.
   const crossings:number[]=[];
   const ha=height?.(start),hb=height?.(end);
   if(ha!==undefined&&hb!==undefined&&Math.abs(hb-ha)>EPS)for(const y of [solid.bottom,solid.top])crossings.push((y-ha)/(hb-ha));
   const cuts=unitCuts(crossings);
   for(let j=1;j<cuts.length;j++){
    const p=at(start,end,cuts[j-1]),q=at(start,end,cuts[j]);
    if(low(at(p,q,.5))>=solid.top-EPS)continue;
    const pa=pos(p,Math.min(solid.top,low(p))),qa=pos(q,Math.min(solid.top,low(q))),pb=pos(p,solid.top),qb=pos(q,solid.top);
    if(solid.top-pa[1]>EPS)faces.push(...pa,...pb,...qb);
    if(solid.top-qa[1]>EPS)faces.push(...pa,...qb,...qa);
    edges.push(...pb,...qb);
    if(!onLoop(at(p,q,.5),contact.outer))edges.push(...pa,...qa);
   }
  }
  const low=Math.max(solid.bottom,contact.occupied(a)?.(a)??solid.bottom);
  if(low<solid.top-EPS)edges.push(...pos(a,low),...pos(a,solid.top));
 });
 return {faces,edges};
}

/** Remove host edge intervals covered by solids, retaining all exposed intervals of the edge. */
export function trimHostEdges(points:ArrayLike<number>,solids:ContactSolid[],yOffset=0){
 const output:number[]=[];
 for(let i=0;i<points.length;i+=6){
  const a={x:points[i],z:points[i+2]},b={x:points[i+3],z:points[i+5]},y=points[i+1],dy=points[i+4]-y;
  let remaining:[number,number][]=[[0,1]];
  for(const solid of solids){
   const p=toLocal(a,solid),q=toLocal(b,solid);
   let lo=0,hi=1;
   const slabs=[
    [p.x,q.x,-solid.width/2,solid.width/2],
    [p.z,q.z,-solid.depth/2,solid.depth/2],
    [y+yOffset,y+yOffset+dy,solid.bottom,solid.top],
   ];
   for(const [start,end,min,max] of slabs){
    const delta=end-start;
    if(Math.abs(delta)<EPS){if(start<min-EDGE_EPS||start>max+EDGE_EPS){lo=1;hi=0;}continue;}
    const s=(min-start)/delta,t=(max-start)/delta;
    lo=Math.max(lo,Math.min(s,t));hi=Math.min(hi,Math.max(s,t));
   }
   if(hi-lo<=EPS)continue;
   remaining=remaining.flatMap(([s,t])=>hi<=s||lo>=t?[[s,t]]:[
    ...(lo-s>EPS?[[s,lo] as [number,number]]:[]),...(t-hi>EPS?[[hi,t] as [number,number]]:[]),
   ]);
  }
  for(const [s,t] of remaining)output.push(...pos(at(a,b,s),y+dy*s),...pos(at(a,b,t),y+dy*t));
 }
 return output;
}

/** The object owns its contact footprint at this height; remove the hidden roof or coping surface. */
export function trimHostTop(points:ArrayLike<number>,solids:ContactSolid[],yOffset=0){
 const output:number[]=[];
 const masks=solids.map(solid=>({solid,outline:corners(solid)}));
 for(let i=0;i<points.length;i+=9){
  const a={x:points[i],z:points[i+2]},b={x:points[i+3],z:points[i+5]},c={x:points[i+6],z:points[i+8]};
  const side=cross(a,b,c);
  if(side>=-EPS){
   for(let j=0;j<9;j++)output.push(points[i+j]);
   continue;
  }
  const y=points[i+1],dy=points[i+4]-y,dz=points[i+7]-y;
  const height=(p:Point)=>y+(cross(a,p,c)*dy+cross(a,b,p)*dz)/side;
  let pieces=[[a,b,c]];
  for(const {solid,outline} of masks){
   const aboveBase=clip(outline,p=>height(p)+yOffset-solid.bottom+EDGE_EPS);
   // For a coplanar top, keep the original roof face as its sole owner.
   const covered=clip(aboveBase,p=>solid.top-height(p)-yOffset-EDGE_EPS);
   if(Math.abs(signedArea(covered))<=EPS)continue;
   pieces=pieces.flatMap(piece=>subtract(piece,covered));
  }
  for(const piece of pieces)for(let j=1;j<piece.length-1;j++){
   const p=piece[0],q=piece[j],r=piece[j+1];
   if(Math.abs(cross(p,q,r))>EPS)output.push(...pos(p,height(p)),...pos(q,height(q)),...pos(r,height(r)));
  }
 }
 return output;
}
