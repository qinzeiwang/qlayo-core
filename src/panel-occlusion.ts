import {corners,geometry,type Point,type Params,type Obstacle} from './domain';
import {convexHull,parapets,type ShadowZone} from './shadow-zones';
import type {Footprint} from './polygon';
import type {SunRay} from './solar';

type Vertex=Point&{y:number};
export type ShadowCaster={id:string;name:string;vertices:Vertex[]};
type Plane={sx:number;sz:number;h:number};
type Bounds={minX:number;maxX:number;minZ:number;maxZ:number};
type Projection=Bounds&{id:string;name:string;points:Point[]};
const EPS=1e-9;
const bounds=(p:Point[]):Bounds=>({minX:Math.min(...p.map(p=>p.x)),maxX:Math.max(...p.map(p=>p.x)),minZ:Math.min(...p.map(p=>p.z)),maxZ:Math.max(...p.map(p=>p.z))});
const cross=(a:Point,b:Point,p:Point)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
export const polygonArea=(p:Point[])=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.z-b.x*a.z;},0))/2;
function overlap(a:Bounds,b:Bounds){return a.minX<b.maxX-EPS&&b.minX<a.maxX-EPS&&a.minZ<b.maxZ-EPS&&b.minZ<a.maxZ-EPS;}
function clipConvex(subject:Point[],clip:Point[]){
 let points=subject;
 for(let i=0;i<clip.length&&points.length;i++){
  const a=clip[i],b=clip[(i+1)%clip.length],result:Point[]=[];
  points.forEach((p,j)=>{const q=points[(j+1)%points.length],d=cross(a,b,p),e=cross(a,b,q);if(d>=-EPS)result.push(p);if((d>=0)!==(e>=0)){const t=d/(d-e);result.push({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t});}});points=result;
 }
 return points.length>=3&&polygonArea(points)>1e-8?convexHull(points):[];
}
// Clip the opaque prism to the sunward side of the actual panel plane, then
// parallel-project it along the sun ray. No roof-plane shadow mask is involved.
function projectCaster(vertices:Vertex[],plane:Plane,sun:SunRay):Point[]{
 const d=sun.y-plane.sx*sun.x-plane.sz*sun.z;
 if(d<=EPS)return []; // No direct sun reaches the front of this panel plane.
 const distances=vertices.map(p=>p.y-plane.sx*p.x-plane.sz*p.z-plane.h);
 const clipped=vertices.filter((_,i)=>distances[i]>=0);
 const n=vertices.length/2;
 const clipEdge=(i:number,j:number)=>{
  if((distances[i]>0)===(distances[j]>0))return;
  const a=vertices[i],b=vertices[j],t=distances[i]/(distances[i]-distances[j]);
  clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
 };
 for(let i=0;i<n;i++){
  const j=(i+1)%n;
  clipEdge(i,j);clipEdge(i+n,j+n);clipEdge(i,i+n);
 }
 return convexHull(clipped.map(p=>{const t=Math.max(0,(p.y-plane.sx*p.x-plane.sz*p.z-plane.h)/d);return {x:p.x-t*sun.x,z:p.z-t*sun.z};}));
}

export function createPanelOcclusion(roof:Footprint,objects:Obstacle[],wallHeight:number,roofYaw:number,rays:readonly SunRay[],neighbors:readonly ShadowCaster[]=[]){
 const c=Math.cos(roofYaw),s=Math.sin(roofYaw);
 const sunlight=rays.filter(r=>r.y>1e-6).map(r=>({x:r.x*c-r.z*s,y:r.y,z:r.x*s+r.z*c}));
 const localCasters=[...objects.filter(o=>o.kind!=='keepout'),...parapets(roof,wallHeight)].filter(o=>o.height>0).map(o=>{
  const base=corners(o),bottom=o.baseHeight??0;
  return {id:o.id,name:o.name,vertices:[...base.map(p=>({...p,y:bottom})),...base.map(p=>({...p,y:bottom+o.height}))]};
 });
 const casters=[...localCasters,...neighbors];
 const cache=new Map<string,Projection[]>();
 function projections(plane:Plane):Projection[]{
  const key=[plane.sx,plane.sz,plane.h].map(v=>v.toFixed(9)).join('/'),existing=cache.get(key);if(existing)return existing;
  const result:Projection[]=[];
  for(const caster of casters)for(const sun of sunlight){const points=projectCaster(caster.vertices,plane,sun);if(points.length>=3&&polygonArea(points)>1e-8)result.push({id:caster.id,name:caster.name,points,...bounds(points)});}
  if(cache.size>=64)cache.delete(cache.keys().next().value!);cache.set(key,result);return result;
 }
 function evaluate(a:Params,collect:boolean):ShadowZone[]|boolean{
  if(!casters.length||!sunlight.length)return collect?[]:false;
  const g=geometry(a),ct=Math.cos(g.tilt),st=Math.sin(g.tilt),cr=Math.cos(g.roll),sr=Math.sin(g.roll),cy=Math.cos(g.yaw),sy=Math.sin(g.yaw);
  const ny=ct*cr,sx=-(-sr*cy+st*cr*sy)/ny,sz=-(sr*sy+st*cr*cy)/ny;
  const lift=!a.surface&&!a.mounting&&a.frontHeight===undefined?.15:0;
  const rotate=(x:number,y:number,z:number):Vertex=>{const u=cr*x-sr*y,v=ct*(sr*x+cr*y)-st*z,w=st*(sr*x+cr*y)+ct*z;return {x:u*cy+w*sy,y:v,z:-u*sy+w*cy};};
  const corners3=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>rotate(x*g.w/2,0,z*g.l/2));
  const regions=new Map<string,{name:string;points:Point[]}>();
  for(let i=0;i<g.panels.length;i++){
   const p=g.panels[i],center={x:a.x+p.x*cy+p.z*sy,y:p.y+lift,z:a.z-p.x*sy+p.z*cy};
   const plane={sx,sz,h:center.y-sx*center.x-sz*center.z},module=convexHull(corners3.map(v=>({x:center.x+v.x,z:center.z+v.z}))),box=bounds(module);
   for(const projection of projections(plane)){
    if(!overlap(box,projection))continue;
    const clipped=clipConvex(projection.points,module);if(!clipped.length)continue;
    if(!collect)return true;
    const key=`${projection.id}/${i}`,existing=regions.get(key);if(existing)existing.points.push(...clipped);else regions.set(key,{name:projection.name,points:clipped});
   }
  }
  if(!collect)return false;
  return [...regions].map(([id,region])=>({id:`panel-shadow-${id}`,name:`${region.name} · ${rays.length>1?'冬至采样':'当前'}组件遮挡`,points:convexHull(region.points),topOnly:true}));
 }
 function planeRegions(plane:Plane,boundary:Point[]):ShadowZone[]{
  const clip=convexHull(boundary),box=bounds(clip);
  return projections(plane).flatMap(projection=>{
   if(!overlap(box,projection))return [];
   const points=clipConvex(projection.points,clip);
   return points.length?[{id:projection.id,name:projection.name,points}]:[];
  });
 }
 return {blocked:(a:Params)=>evaluate(a,false) as boolean,regions:(a:Params)=>evaluate(a,true) as ShadowZone[],planeRegions};
}
