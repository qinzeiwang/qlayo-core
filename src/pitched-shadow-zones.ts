import {corners,type Obstacle} from './domain';
import {roofHeight,roofGradient,type RoofPitch} from './pitched-roof';
import {clipRoof,convexHull,parapets,type ShadowZone} from './shadow-zones';
import {winterRays,type SunRay} from './solar';
import {tx} from './i18n';
import {gableCopingHeight} from './gable-parapet';

export function pitchedParapetCasters({width,depth}:{width:number;depth:number},pitch:RoofPitch,wallHeight:number){
 if(pitch.kind!=='gable'||wallHeight<=0)return [];
 const roof={width,depth};
 const top=gableCopingHeight(roof,pitch,wallHeight),baseHeight=-3.5;
 return parapets(roof,wallHeight).map(wall=>({...wall,baseHeight,height:top-baseHeight}));
}

// Winter 9–15 true-solar-time envelope, sampled every 15 minutes.
// Top faces are horizontal; rays intersect the first valid roof half-plane.
export function pitchedShadowZones(roof:{width:number;depth:number},objects:Obstacle[],pitch:RoofPitch,yaw=0,rays:readonly SunRay[]=winterRays(),referenceHeight=0,wallHeight=0):ShadowZone[]{
 const daylight=rays.filter(s=>s.y>1e-6);if(!daylight.length)return [];
 const axis=pitch.axis;
 const casters=objects.filter(o=>o.kind!=='keepout'&&o.height>0).map(o=>{
  const base=corners(o);
  const spansRidge=pitch.kind==='gable'&&Math.min(...base.map(p=>axis==='x'?p.x:p.z))<=0&&Math.max(...base.map(p=>axis==='x'?p.x:p.z))>=0;
  const top=Math.max(...base.map(p=>roofHeight(roof,pitch,p.x,p.z)),...(spansRidge?[roofHeight(roof,pitch,0,0)]:[]))+o.height;
  return {id:o.id,name:o.name,base,top};
 });
 for(const wall of pitchedParapetCasters(roof,pitch,wallHeight)){
  casters.push({id:wall.id,name:wall.name,base:corners(wall),top:wall.baseHeight+wall.height});
 }
 const intercept=roofHeight(roof,pitch,0,0)+referenceHeight;
 return casters.flatMap(({id,name,base,top})=>{
  if(referenceHeight>0&&base.every(p=>top<=roofHeight(roof,pitch,p.x,p.z)+referenceHeight))return [];
  const projected=daylight.flatMap(s=>{
   const c=Math.cos(yaw),sn=Math.sin(yaw),sun={x:s.x*c-s.z*sn,y:s.y,z:s.x*sn+s.z*c};
   return base.map(p=>{
    const candidates=(pitch.kind==='gable'?[-1,1]:[1]).flatMap(side=>{
     const g=roofGradient(pitch,axis==='x'?side:0,axis==='z'?side:0);
     const den=sun.y-g.sx*sun.x-g.sz*sun.z;
     if(den<=1e-9)return [];
     const t=(top-intercept-g.sx*p.x-g.sz*p.z)/den;
     const q={x:p.x-t*sun.x,z:p.z-t*sun.z};
     return t>=0&&(pitch.kind!=='gable'||(axis==='x'?q.x:q.z)*side>=-1e-8)?[{...q,t}]:[];
    }).sort((a,b)=>a.t-b.t);
    return candidates[0]??(referenceHeight>0&&top<=roofHeight(roof,pitch,p.x,p.z)+referenceHeight?p:{x:p.x-sun.x*Math.hypot(roof.width,roof.depth)*100,z:p.z-sun.z*Math.hypot(roof.width,roof.depth)*100});
   });
  });
  const points=clipRoof(convexHull([...base,...projected]),roof);
  return points.length<3?[]:[{id:`shadow-${id}`,name:`${name}${rays.length===1?tx('坡面当前时刻阴影'):tx('坡面冬至时段阴影包络')}`,points}];
 });
}
