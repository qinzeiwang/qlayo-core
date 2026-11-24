import type {Point} from './domain';
import {snapAxis} from './drawing-geometry';

const vertexRadius=8;
const edgeRadius=6;
type Snap={point:Point;kind:'vertex'|'edge'|'axis'};
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

/** Pixel-sized tolerances are converted to the coordinates of the drawing in use. */
export function snapDrawingPoint(point:Point,outlines:Point[][],unit:number,axisOrigins:Point[]=[]):Snap|undefined{
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

 let x=point.x,z=point.z,xGap=edgeRadius*unit,zGap=edgeRadius*unit;
 for(const origin of axisOrigins){
  const target=snapAxis(origin,point),dx=Math.abs(target.x-point.x),dz=Math.abs(target.z-point.z);
  if(dx>0&&dx<=xGap){x=target.x;xGap=dx;}
  if(dz>0&&dz<=zGap){z=target.z;zGap=dz;}
 }
 return x!==point.x||z!==point.z?{point:{x,z},kind:'axis'}:undefined;
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
