import {corners,footprint,overlaps,type Obstacle,type PVArray,type Point} from './domain';
import {polygonContains,type Footprint} from './polygon';
import {hitsShadow,type ShadowZone} from './shadow-zones';

function axisBounds(points:Point[],axis:'x'|'z'){
 let min=Infinity,max=-Infinity;
 for(const point of points){min=Math.min(min,point[axis]);max=Math.max(max,point[axis]);}
 return {min,max};
}

// Find the room to move the whole array on either side. Only obstacles in
// the path of a table constrain its travel along that axis.
function centeredOffset(tables:Point[][],obstacles:Point[][],axis:'x'|'z',min:number,max:number){
 const cross=axis==='x'?'z':'x';
 const blockers=obstacles.map(points=>({along:axisBounds(points,axis),across:axisBounds(points,cross)}));
 let lower=-Infinity,upper=Infinity;
 for(const points of tables){
  const along=axisBounds(points,axis),across=axisBounds(points,cross);
  lower=Math.max(lower,min-along.min);
  upper=Math.min(upper,max-along.max);
  for(const blocker of blockers){
   if(blocker.across.max<=across.min||blocker.across.min>=across.max)continue;
   if(blocker.along.max<=along.min)lower=Math.max(lower,blocker.along.max-along.min);
   if(blocker.along.min>=along.max)upper=Math.min(upper,blocker.along.min-along.max);
  }
 }
 return (lower+upper)/2;
}

// Move the whole layout together so panel count and all internal clearances stay unchanged.
export function centerLayout(arrays:PVArray[],roof:Footprint,edge:number,obstacles:Obstacle[],zones:ShadowZone[],area?:Point[],blocked?:(a:PVArray)=>boolean):PVArray[]{
 if(!arrays.length)return arrays;
 const footprints=arrays.map(footprint),tables=footprints.map(corners),blockers=obstacles.map(corners);
 const offsetFor=(axis:'x'|'z',size:number)=>{
  const areaBounds=area?axisBounds(area,axis):undefined;
  const min=Math.max(-size/2+edge,areaBounds?.min??-Infinity);
  const max=Math.min(size/2-edge,areaBounds?.max??Infinity);
  return centeredOffset(tables,blockers,axis,min,max);
 };
 const target={x:offsetFor('x',roof.width),z:offsetFor('z',roof.depth)};
 const valid=(x:number,z:number)=>footprints.every((rect,i)=>{
  const next={...rect,x:rect.x+x,z:rect.z+z},vertices=corners(next);
  return vertices.every(p=>Math.abs(p.x)<=roof.width/2-edge+1e-7&&Math.abs(p.z)<=roof.depth/2-edge+1e-7)
   &&(!roof.outline||polygonContains(roof.outline,vertices,edge))&&(!area||polygonContains(area,vertices))
   &&!obstacles.some(o=>overlaps(next,o))&&(blocked?!blocked({...arrays[i],x:arrays[i].x+x,z:arrays[i].z+z}):!zones.some(zone=>hitsShadow(next,zone)));
 });
 if(Math.hypot(target.x,target.z)<1e-7)return arrays;
 let offset={x:0,z:0};
 if(valid(target.x,target.z))offset=target;
 else{
  // When the ideal centre is blocked, approach it within the available clear space.
  // Test each final position; geometry and shadows always take precedence over alignment.
  if(!valid(0,0))return arrays;
  const approach=(dx:number,dz:number)=>{
   if(Math.hypot(dx,dz)<1e-7)return;
   let low=0,high=1;
   if(valid(offset.x+dx,offset.z+dz))low=1;
   else for(let i=0;i<24;i++){const mid=(low+high)/2;if(valid(offset.x+dx*mid,offset.z+dz*mid))low=mid;else high=mid;}
   offset={x:offset.x+dx*low,z:offset.z+dz*low};
  };
  approach(target.x,target.z);
  approach(target.x-offset.x,0);
  approach(0,target.z-offset.z);
 }
 return arrays.map(a=>({...a,x:a.x+offset.x,z:a.z+offset.z}));
}
