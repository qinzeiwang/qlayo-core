import {ShapeUtils,Vector2} from 'three';
import {corners,type Point} from './domain';
import {insetRoof} from './flat-roof-shell';
import {pitchSkinOffset} from './gable-parapet';
import type {ShadowCaster} from './panel-occlusion';
import {gableSpans,maxRoofHeight,roofHeight,type RoofPitch} from './pitched-roof';
import {cross,signedArea,type Footprint} from './polygon';

const EPS=1e-7;
const GROUND=-3.5;

export function gableOuterLoop(roof:Footprint):Point[]{
 const raw=corners({...roof,x:0,z:0,yaw:0});
 const pts=raw.map(p=>({...p}));
 if(signedArea(pts)<0)pts.reverse();
 return pts;
}

export function clipConvexHalfPlane(poly:readonly Point[],fn:(p:Point)=>number):Point[]{
 if(poly.length<3)return [];
 const out:Point[]=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=fn(a),db=fn(b);
  if(da>=-EPS)out.push(a);
  if((da>EPS&&db<-EPS)||(da<-EPS&&db>EPS)){
   const t=da/(da-db);
   out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
  }
 }
 return out.length>=3?out:[];
}

export type GableSlopeTriangle={
 triangle:[Point,Point,Point];
 spanIndex:number;
 side:-1|1;
 percent:number;
};

/**
 * Triangulate any simple polygon (convex or concave L/T/U-shape) and clip every
 * triangle into planar half-slope strips [start, mid] and [mid, end].
 */
export function gableSlopeTriangles(roof:Footprint,pitch:RoofPitch,insetParapet=false):GableSlopeTriangle[]{
 const outer=gableOuterLoop(roof);
 const deck=insetParapet?insetRoof(outer,.2).inner:outer;
 const faces=ShapeUtils.triangulateShape(deck.map(p=>new Vector2(p.x,p.z)),[]);
 const axis=pitch.axis;
 const spans=gableSpans(roof,pitch);
 const result:GableSlopeTriangle[]=[];
 for(const face of faces){
  const tri:[Point,Point,Point]=[deck[face[0]],deck[face[1]],deck[face[2]]];
  spans.forEach((span,spanIndex)=>{
   const mid=(span.start+span.end)/2;
   const halves:[number,number,-1|1][]=[[span.start,mid,-1],[mid,span.end,1]];
   for(const [lo,hi,side] of halves){
    let piece=clipConvexHalfPlane(tri,p=>p[axis]-lo);
    piece=clipConvexHalfPlane(piece,p=>hi-p[axis]);
    if(piece.length<3)continue;
    for(let i=1;i+1<piece.length;i++){
     const a=piece[0],b=piece[i],c=piece[i+1];
     if(Math.abs(cross(a,b,c))>1e-8){
      result.push({triangle:[a,b,c],spanIndex,side,percent:span.percent});
     }
    }
   }
  });
 }
 return result;
}

/** Intersect line `p[axis] === coord` with any simple polygon, returning sorted interior segments. */
export function clipLineToPolygon(poly:readonly Point[],axis:'x'|'z',coord:number):[Point,Point][]{
 const other=axis==='x'?'z':'x';
 const crossings:number[]=[];
 const eps=1e-7;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length];
  const va=a[axis]-coord,vb=b[axis]-coord;
  if(Math.abs(va)<=eps&&Math.abs(vb)<=eps)continue;
  if((va<=0&&vb>0)||(vb<=0&&va>0)){
   const t=-va/(vb-va);
   crossings.push(a[other]+(b[other]-a[other])*t);
  }
 }
 crossings.sort((a,b)=>a-b);
 const segments:[Point,Point][]=[];
 for(let i=0;i+1<crossings.length;i+=2){
  const p0=crossings[i],p1=crossings[i+1];
  if(p1-p0<=1e-5)continue;
  segments.push(
   axis==='x'?[{x:coord,z:p0},{x:coord,z:p1}]:[{x:p0,z:coord},{x:p1,z:coord}],
  );
 }
 return segments;
}

/** Clipped 2D ridge lines and interior gutter/cut lines for any rectangular, polygonal, or multi-span gable roof. */
export function gablePlanLines(roof:Footprint,pitch:RoofPitch){
 const outer=gableOuterLoop(roof);
 const spans=gableSpans(roof,pitch);
 const ridges:[Point,Point][]=[];
 const gutters:[Point,Point][]=[];
 spans.forEach((span,i)=>{
  const mid=(span.start+span.end)/2;
  ridges.push(...clipLineToPolygon(outer,pitch.axis,mid));
  if(i>0){
   // Probe slightly on both sides of the cut line so an L-step sitting exactly on the cut line still clips cleanly.
   const direct=clipLineToPolygon(outer,pitch.axis,span.start);
   if(direct.length){
    gutters.push(...direct);
   }else{
    const a=clipLineToPolygon(outer,pitch.axis,span.start-1e-4);
    const b=clipLineToPolygon(outer,pitch.axis,span.start+1e-4);
    const source=a.length&&b.length?(a.reduce((s,[p,q])=>s+Math.hypot(q.x-p.x,q.z-p.z),0)<=b.reduce((s,[p,q])=>s+Math.hypot(q.x-p.x,q.z-p.z),0)?a:b):a.length?a:b;
    gutters.push(...source.map(([p,q]):[Point,Point]=>pitch.axis==='x'?[{x:span.start,z:p.z},{x:span.start,z:q.z}]:[{x:p.x,z:span.start},{x:q.x,z:span.start}]));
   }
  }
 });
 return {ridges,gutters};
}

function gableBreakpoints(roof:Footprint,pitch:RoofPitch){
 const values:number[]=[];
 for(const s of gableSpans(roof,pitch)){
  values.push(s.start,(s.start+s.end)/2,s.end);
 }
 values.sort((a,b)=>a-b);
 return values.filter((v,i)=>!i||v-values[i-1]>1e-6);
}

function splitEdgeAtBreakpoints(a:Point,b:Point,axis:'x'|'z',breaks:readonly number[]):Point[]{
 const va=a[axis],vb=b[axis],dv=vb-va;
 if(Math.abs(dv)<1e-8)return [a,b];
 const ts=[0,1];
 for(const br of breaks){
  const t=(br-va)/dv;
  if(t>1e-6&&t<1-1e-6)ts.push(t);
 }
 ts.sort((x,y)=>x-y);
 return ts.map(t=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}));
}

/**
 * Watertight 3D shell for polygonal gable roofs and multi-span connected gable roofs,
 * supporting both plain eaves (wallHeight = 0) and outer-perimeter parapets (wallHeight > 0).
 */
export function gableCustomShell(roof:Footprint,pitch:RoofPitch,wallHeight:number){
 const outer=gableOuterLoop(roof);
 const hasParapet=wallHeight>0;
 const {inner}=hasParapet?insetRoof(outer,.2):{inner:outer};
 const top:number[]=[],walls:number[]=[],uv:number[]=[];
 const surface=(p:Point)=>roofHeight(roof,pitch,p.x,p.z)+pitchSkinOffset;
 const copingHeight=maxRoofHeight(roof,pitch)+pitchSkinOffset+wallHeight;
 const axis=pitch.axis,other=axis==='x'?'z':'x';
 const spanSize=axis==='x'?roof.width:roof.depth,lengthSize=axis==='x'?roof.depth:roof.width;
 const pushTri=(target:number[],a:[number,number,number],b:[number,number,number],c:[number,number,number],upward=true)=>{
  const ux=b[0]-a[0],uz=b[2]-a[2],vx=c[0]-a[0],vz=c[2]-a[2];
  const ny=uz*vx-ux*vz;
  if(upward?ny<0:ny>0)target.push(...a,...c,...b);else target.push(...a,...b,...c);
 };
 const pushUv=(a:Point,b:Point,c:Point,flip:boolean)=>{
  const pts=flip?[a,c,b]:[a,b,c];
  for(const p of pts){
   uv.push((p[other]+lengthSize/2)/Math.max(1,lengthSize),(p[axis]+spanSize/2)/Math.max(1,spanSize));
  }
 };
 const pushQuad=(target:number[],a:[number,number,number],b:[number,number,number],c:[number,number,number],d:[number,number,number])=>{
  target.push(...a,...b,...c,...a,...c,...d);
 };

 // 1. Roof slope triangles (recessed inside inner loop when parapet exists).
 const tris=gableSlopeTriangles(roof,pitch,hasParapet);
 for(const {triangle:[a,b,c]} of tris){
  const va:[number,number,number]=[a.x,surface(a),a.z];
  const vb:[number,number,number]=[b.x,surface(b),b.z];
  const vc:[number,number,number]=[c.x,surface(c),c.z];
  const ny=(vb[2]-va[2])*(vc[0]-va[0])-(vb[0]-va[0])*(vc[2]-va[2]);
  const flip=ny<0;
  if(flip)top.push(...va,...vc,...vb);else top.push(...va,...vb,...vc);
  pushUv(a,b,c,flip);
 }

 // 2. Bottom cap on ground.
 const bottomFaces=ShapeUtils.triangulateShape(outer.map(p=>new Vector2(p.x,p.z)),[]);
 for(const f of bottomFaces){
  const a=outer[f[0]],b=outer[f[1]],c=outer[f[2]];
  pushTri(walls,[a.x,GROUND,a.z],[b.x,GROUND,b.z],[c.x,GROUND,c.z],false);
 }

 // 3. Exterior vertical walls (and parapet coping + inner parapet walls when wallHeight > 0).
 const breaks=gableBreakpoints(roof,pitch);
 if(hasParapet){
  for(let i=0;i<outer.length;i++){
   const a=outer[i],b=outer[(i+1)%outer.length];
   pushQuad(walls,[a.x,GROUND,a.z],[b.x,GROUND,b.z],[b.x,copingHeight,b.z],[a.x,copingHeight,a.z]);
  }
  const copingPts=[...outer,...inner];
  const copingFaces=ShapeUtils.triangulateShape(outer.map(p=>new Vector2(p.x,p.z)),[inner.map(p=>new Vector2(p.x,p.z))]);
  for(const f of copingFaces){
   const a=copingPts[f[0]],b=copingPts[f[1]],c=copingPts[f[2]];
   pushTri(top,[a.x,copingHeight,a.z],[b.x,copingHeight,b.z],[c.x,copingHeight,c.z],true);
   pushUv(a,b,c,false);
  }
  for(let i=0;i<inner.length;i++){
   const pts=splitEdgeAtBreakpoints(inner[i],inner[(i+1)%inner.length],axis,breaks);
   for(let j=1;j<pts.length;j++){
    const a=pts[j-1],b=pts[j];
    pushQuad(walls,[b.x,surface(b),b.z],[a.x,surface(a),a.z],[a.x,copingHeight,a.z],[b.x,copingHeight,b.z]);
   }
  }
 }else{
  for(let i=0;i<outer.length;i++){
   const pts=splitEdgeAtBreakpoints(outer[i],outer[(i+1)%outer.length],axis,breaks);
   for(let j=1;j<pts.length;j++){
    const a=pts[j-1],b=pts[j];
    pushQuad(walls,[a.x,GROUND,a.z],[b.x,GROUND,b.z],[b.x,surface(b),b.z],[a.x,surface(a),a.z]);
   }
  }
 }
 return {top,walls,uv,length:lengthSize,span:spanSize};
}

/** Self-shadow prisms for multi-span gable roofs so a taller span shades neighboring lower spans. */
export function gableSelfShadowCasters(roof:Footprint,pitch:RoofPitch,name:string):ShadowCaster[]{
 if(pitch.kind!=='gable'||!pitch.spans||pitch.spans.length<2)return [];
 return gableSlopeTriangles(roof,pitch,false).map(({triangle,spanIndex},i)=>({
  id:`self-span-${spanIndex}-${i}`,
  name,
  vertices:[
   ...triangle.map(p=>({...p,y:GROUND})),
   ...triangle.map(p=>({...p,y:roofHeight(roof,pitch,p.x,p.z)})),
  ],
 }));
}

/** Exact total sloped surface area across all spans of a rectangular, polygonal, or multi-span gable roof. */
export function gableSlopeArea(roof:Footprint,pitch:RoofPitch):number{
 if(pitch.kind!=='gable')return 0;
 let total=0;
 for(const {triangle:[a,b,c],percent} of gableSlopeTriangles(roof,pitch,false)){
  const planArea=Math.abs(cross(a,b,c))/2;
  total+=planArea*Math.sqrt(1+(percent/100)**2);
 }
 return total;
}

/** Flat x,y,z triangle list for highlighting one span of a multi-span gable roof in 2D. */
export function gableSpanHighlightPositions(roof:Footprint,pitch:RoofPitch,spanIndex:number,y=.055):number[]{
 const positions:number[]=[];
 for(const item of gableSlopeTriangles(roof,pitch,false)){
  if(item.spanIndex!==spanIndex)continue;
  for(const p of item.triangle)positions.push(p.x,y,p.z);
 }
 return positions;
}
