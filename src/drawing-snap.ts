import type {Point} from './domain';
import {snapAxis} from './drawing-geometry';

const vertexRadius=8;
const edgeRadius=6;
const guideRadius=8;
type Snap={point:Point;kind:'vertex'|'edge'|'axis'};
export type SnapGuide={from:Point;to:Point;axis:'horizontal'|'vertical'};
export type PolygonSnap={point:Point;guides:SnapGuide[]};
type Segment=[Point,Point];
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
const dot=(a:Point,b:Point)=>a.x*b.x+a.z*b.z;
const subtract=(a:Point,b:Point):Point=>({x:a.x-b.x,z:a.z-b.z});
const add=(a:Point,b:Point):Point=>({x:a.x+b.x,z:a.z+b.z});
const scale=(a:Point,k:number):Point=>({x:a.x*k,z:a.z*k});
function segments(outline:Point[]):Segment[]{
 return outline.map((point,index)=>[point,outline[(index+1)%outline.length]]);
}
function projection(point:Point,[a,b]:Segment){
 const edge=subtract(b,a),length=dot(edge,edge);
 return length?add(a,scale(edge,Math.max(0,Math.min(1,dot(subtract(point,a),edge)/length)))):a;
}
function rotatedBasis(angleRad:number){
 const c=Math.cos(angleRad),s=Math.sin(angleRad);
 return {u:{x:c,z:-s},v:{x:s,z:c}};
}

/** Pixel-sized tolerances are converted to the coordinates of the drawing in use. */
export function snapDrawingPoint(point:Point,outlines:Point[][],unit:number,axisOrigins:Point[]=[],angleRad=0):Snap|undefined{
 let vertex:Point|undefined,best=vertexRadius*unit;
 for(const outline of outlines)for(const target of outline){
  const gap=distance(point,target);
  if(gap<=best){vertex=target;best=gap;}
 }
 if(vertex)return {point:vertex,kind:'vertex'};
 let edge:Point|undefined;
 best=edgeRadius*unit;
 for(const outline of outlines)for(const segment of segments(outline)){
  const target=projection(point,segment),gap=distance(point,target);
  if(gap<=best){edge=target;best=gap;}
 }
 if(edge)return {point:edge,kind:'edge'};

 if(Math.abs(angleRad)<1e-9){
  let x=point.x,z=point.z,xGap=edgeRadius*unit,zGap=edgeRadius*unit;
  for(const origin of axisOrigins){
   const target=snapAxis(origin,point),dx=Math.abs(target.x-point.x),dz=Math.abs(target.z-point.z);
   if(dx>0&&dx<=xGap){x=target.x;xGap=dx;}
   if(dz>0&&dz<=zGap){z=target.z;zGap=dz;}
  }
  return x!==point.x||z!==point.z?{point:{x,z},kind:'axis'}:undefined;
 }
 const {u,v}=rotatedBasis(angleRad);
 const pu=dot(point,u),pv=dot(point,v);
 let snappedU=pu,snappedV=pv,uGap=edgeRadius*unit,vGap=edgeRadius*unit;
 for(const origin of axisOrigins){
  const ou=dot(origin,u),ov=dot(origin,v);
  const target=snapAxis({x:ou,z:ov},{x:pu,z:pv});
  const du=Math.abs(target.x-pu),dv=Math.abs(target.z-pv);
  if(du>0&&du<=uGap){snappedU=target.x;uGap=du;}
  if(dv>0&&dv<=vGap){snappedV=target.z;vGap=dv;}
 }
 if(snappedU===pu&&snappedV===pv)return;
 return {point:add(scale(u,snappedU),scale(v,snappedV)),kind:'axis'};
}

/**
 * Align a polygon vertex against ONLY the vertices of the same polygon,
 * along screen horizontal/vertical axes (respecting canvas rotation `angleRad`).
 * Supports dual-axis intersection snapping and optional orthogonal lock (`orthoFrom`).
 */
export function snapPolygonPoint(
 point:Point,
 vertices:readonly Point[],
 unit:number,
 angleRad=0,
 orthoFrom?:Point,
):PolygonSnap|undefined{
 const {u,v}=rotatedBasis(angleRad);
 const toUV=(p:Point)=>({u:dot(p,u),v:dot(p,v)});
 const fromUV=(cu:number,cv:number):Point=>add(scale(u,cu),scale(v,cv));
 const {u:pu,v:pv}=toUV(point);
 const tol=guideRadius*unit;

 if(orthoFrom){
  const prev=toUV(orthoFrom);
  const horizontal=Math.abs(pu-prev.u)>=Math.abs(pv-prev.v);
  let targetU=horizontal?pu:prev.u;
  let targetV=horizontal?prev.v:pv;
  let match:Point|undefined,bestGap=tol,bestDist=Infinity;
  for(const vertex of vertices){
   if(distance(vertex,orthoFrom)<1e-8)continue;
   const uv=toUV(vertex);
   const gap=horizontal?Math.abs(uv.u-targetU):Math.abs(uv.v-targetV);
   const dist=distance(vertex,point);
   if(gap<=tol&&(gap<bestGap-1e-9||(Math.abs(gap-bestGap)<=1e-9&&dist<bestDist))){
    match=vertex;bestGap=gap;bestDist=dist;
   }
  }
  const guides:SnapGuide[]=[];
  if(match){
   const uv=toUV(match);
   if(horizontal)targetU=uv.u;else targetV=uv.v;
  }
  const snapped=fromUV(targetU,targetV);
  if(match)guides.push({from:match,to:snapped,axis:horizontal?'vertical':'horizontal'});
  return {point:snapped,guides};
 }

 if(!vertices.length)return;
 let uMatch:Point|undefined,uGap=tol,uDist=Infinity;
 let vMatch:Point|undefined,vGap=tol,vDist=Infinity;
 for(const vertex of vertices){
  const uv=toUV(vertex),du=Math.abs(uv.u-pu),dv=Math.abs(uv.v-pv),dist=distance(vertex,point);
  if(du<=tol&&(du<uGap-1e-9||(Math.abs(du-uGap)<=1e-9&&dist<uDist))){uMatch=vertex;uGap=du;uDist=dist;}
  if(dv<=tol&&(dv<vGap-1e-9||(Math.abs(dv-vGap)<=1e-9&&dist<vDist))){vMatch=vertex;vGap=dv;vDist=dist;}
 }
 if(!uMatch&&!vMatch)return;
 const snappedU=uMatch?toUV(uMatch).u:pu;
 const snappedV=vMatch?toUV(vMatch).v:pv;
 const snapped=fromUV(snappedU,snappedV);
 const guides:SnapGuide[]=[];
 if(uMatch)guides.push({from:uMatch,to:snapped,axis:'vertical'});
 if(vMatch)guides.push({from:vMatch,to:snapped,axis:'horizontal'});
 return {point:snapped,guides};
}

/** Adjust a moving edge along its normal so it stays parallel to its starting edge. */
export function snapDrawingEdge(a:Point,b:Point,outlines:Point[][],unit:number):Point|undefined{
 const length=distance(a,b);
 if(!length)return;
 const along=scale(subtract(b,a),1/length),normal={x:-along.z,z:along.x};
 let target:number|undefined,best=edgeRadius*unit;
 const consider=(projection:number)=>{
  if(Math.abs(projection)<=best){target=projection;best=Math.abs(projection);}
 };
 for(const outline of outlines){
  for(const point of outline){
   const relative=subtract(point,a),position=dot(relative,along);
   if(position>=-unit&&position<=length+unit)consider(dot(relative,normal));
  }
  for(const [p,q] of segments(outline)){
   const end=distance(p,q);
   if(!end||Math.abs(dot(subtract(q,p),normal))/end>1e-6)continue;
   const left=dot(subtract(p,a),along),right=dot(subtract(q,a),along);
   if(Math.min(left,right)<=length&&Math.max(left,right)>=0)consider(dot(subtract(p,a),normal));
  }
 }
 return target===undefined?undefined:scale(normal,target);
}

/** Consider every moving corner and edge, then apply a single correction to the group. */
export function snapDrawingMove(moving:Point[][],targets:Point[][],unit:number){
 let best:Point|undefined,bestGap=Infinity,atVertex=false;
 const consider=(delta:Point,vertex:boolean)=>{
  const gap=Math.hypot(delta.x,delta.z);
  if(gap<1e-8&&!vertex)return;
  if((vertex&&!atVertex||vertex===atVertex&&gap<bestGap)){
   best=delta;bestGap=gap;atVertex=vertex;
  }
 };
 for(const outline of moving){
  for(const point of outline){
   const snap=snapDrawingPoint(point,targets,unit);
   if(snap)consider(subtract(snap.point,point),snap.kind==='vertex');
  }
  for(const [a,b] of segments(outline)){
   const snap=snapDrawingEdge(a,b,targets,unit);
   if(snap)consider(snap,false);
  }
 }
 return best;
}
