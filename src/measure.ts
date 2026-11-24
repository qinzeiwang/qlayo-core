import type {Point} from './domain';
/** A measurement on the 2D canvas, in world metres: a distance between two points, or the area inside a closed outline. */
export type Measure={id:number;kind:'distance'|'area';points:Point[]};
export type MeasureTool=Measure['kind'];
/** What a click snapped to: a corner, the middle of an edge, a point on an edge, or nothing. */
export type Snap={p:Point;kind:'corner'|'mid'|'edge'|'free'};
const gap=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
export const pathLength=(points:Point[],closed=false)=>points.reduce((s,p,i)=>i===0&&!closed?s:s+gap(points[(i-1+points.length)%points.length],p),0);
/** Area of a simple polygon (shoelace), in m². */
export const polygonArea=(points:Point[])=>Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p.x*q.z-q.x*p.z;},0))/2;
/** Area-weighted centre of a polygon; the plain average when it has no area. */
export function polygonCentre(points:Point[]){
 let a=0,x=0,z=0;
 points.forEach((p,i)=>{const q=points[(i+1)%points.length],c=p.x*q.z-q.x*p.z;a+=c;x+=(p.x+q.x)*c;z+=(p.z+q.z)*c;});
 if(Math.abs(a)<1e-9)return {x:points.reduce((s,p)=>s+p.x,0)/points.length,z:points.reduce((s,p)=>s+p.z,0)/points.length};
 return {x:x/(3*a),z:z/(3*a)};
}
/** Pull a click onto the nearest corner (also earlier measure points), else the middle of an edge, else onto an edge, all within `reach` metres.
 * With `from` and `straight`, the result first locks to the closer of the two plan axes through `from`. */
export function snapMeasure(p:Point,shapes:Point[][],points:Point[],reach:number,from?:Point,straight=false):Snap{
 if(from&&straight)p=Math.abs(p.x-from.x)>=Math.abs(p.z-from.z)?{x:p.x,z:from.z}:{x:from.x,z:p.z};
 const best=(list:Point[],r:number)=>list.reduce<{q?:Point;d:number}>((b,q)=>{const d=gap(p,q);return d<b.d?{q,d}:b;},{d:r}).q;
 const lock=(q:Point)=>!(from&&straight)||Math.abs(q.x-from.x)<1e-6||Math.abs(q.z-from.z)<1e-6;
 const corner=best(shapes.flat().concat(points).filter(lock),reach);if(corner)return {p:corner,kind:'corner'};
 const edges=shapes.flatMap(s=>s.map((a,i)=>[a,s[(i+1)%s.length]] as const));
 const mid=best(edges.map(([a,b])=>({x:(a.x+b.x)/2,z:(a.z+b.z)/2})).filter(lock),reach);if(mid)return {p:mid,kind:'mid'};
 if(!(from&&straight)){
  const on=best(edges.map(([a,b])=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return {x:a.x+t*dx,z:a.z+t*dz};}),reach*.7);
  if(on)return {p:on,kind:'edge'};
 }
 return {p,kind:'free'};
}
export const formatMeters=(m:number)=>m>=1000?`${(m/1000).toFixed(3)} km`:`${m.toFixed(2)} m`;
export const formatArea=(m2:number)=>m2>=10000?`${m2.toFixed(0)} m²`:`${m2.toFixed(1)} m²`;
