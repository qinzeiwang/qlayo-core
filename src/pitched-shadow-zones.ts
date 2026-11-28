import {corners,type Obstacle} from './domain';
import {gableSpans,roofHeight,roofGradient,type RoofPitch} from './pitched-roof';
import type {Footprint} from './polygon';
import {clipRoof,convexHull,parapets,type ShadowZone} from './shadow-zones';
import {winterRays,type SunRay} from './solar';
import {tx} from './i18n';
import {gableCopingHeight} from './gable-parapet';

export function pitchedParapetCasters(roof:Footprint,pitch:RoofPitch,wallHeight:number){
 if(pitch.kind!=='gable'||wallHeight<=0)return [];
 const top=gableCopingHeight(roof,pitch,wallHeight),baseHeight=-3.5;
 return parapets(roof,wallHeight).map(wall=>({...wall,baseHeight,height:top-baseHeight}));
}

// Winter 9–15 true-solar-time envelope, sampled every 15 minutes.
// Top faces are horizontal; rays intersect the first valid roof half-plane.
export function pitchedShadowZones(roof:Footprint,objects:Obstacle[],pitch:RoofPitch,yaw=0,rays:readonly SunRay[]=winterRays(),referenceHeight=0,wallHeight=0):ShadowZone[]{
 const daylight=rays.filter(s=>s.y>1e-6);if(!daylight.length)return [];
 const axis=pitch.axis;
 const spans=pitch.kind==='gable'?gableSpans(roof,pitch):undefined;
 const casters=objects.filter(o=>o.kind!=='keepout'&&o.height>0).map(o=>{
  const base=corners(o);
  const coords=base.map(p=>p[axis]),minC=Math.min(...coords),maxC=Math.max(...coords);
  const ridgeHeights=spans?spans.flatMap(sp=>{const mid=(sp.start+sp.end)/2;return minC<=mid&&maxC>=mid?[roofHeight(roof,pitch,axis==='x'?mid:0,axis==='z'?mid:0)]:[];}):[];
  const top=Math.max(...base.map(p=>roofHeight(roof,pitch,p.x,p.z)),...ridgeHeights)+o.height;
  return {id:o.id,name:o.name,base,top};
 });
 for(const wall of pitchedParapetCasters(roof,pitch,wallHeight)){
  casters.push({id:wall.id,name:wall.name,base:corners(wall),top:wall.baseHeight+wall.height});
 }
 const planes=spans
  ?spans.flatMap(sp=>{
   const mid=(sp.start+sp.end)/2,ridgeH=roofHeight(roof,pitch,axis==='x'?mid:0,axis==='z'?mid:0)+referenceHeight;
   const slope=sp.percent/100;
   return ([-1,1] as const).map(side=>{
    const s=-side*slope,sx=axis==='x'?s:0,sz=axis==='z'?s:0;
    const h0=ridgeH-s*mid;
    return {sx,sz,h0,lo:side<0?sp.start:mid,hi:side<0?mid:sp.end};
   });
  })
  :[(()=>{
   const g=roofGradient(pitch,0,0),h0=roofHeight(roof,pitch,0,0)+referenceHeight;
   return {sx:g.sx,sz:g.sz,h0,lo:-Infinity,hi:Infinity};
  })()];
 return casters.flatMap(({id,name,base,top})=>{
  if(referenceHeight>0&&base.every(p=>top<=roofHeight(roof,pitch,p.x,p.z)+referenceHeight))return [];
  const projected=daylight.flatMap(s=>{
   const c=Math.cos(yaw),sn=Math.sin(yaw),sun={x:s.x*c-s.z*sn,y:s.y,z:s.x*sn+s.z*c};
   return base.map(p=>{
    const candidates=planes.flatMap(pl=>{
     const den=sun.y-pl.sx*sun.x-pl.sz*sun.z;
     if(den<=1e-9)return [];
     const t=(top-pl.h0-pl.sx*p.x-pl.sz*p.z)/den;
     if(t<0)return [];
     const q={x:p.x-t*sun.x,z:p.z-t*sun.z};
     return q[axis]>=pl.lo-1e-7&&q[axis]<=pl.hi+1e-7?[{...q,t}]:[];
    }).sort((a,b)=>a.t-b.t);
    return candidates[0]??(referenceHeight>0&&top<=roofHeight(roof,pitch,p.x,p.z)+referenceHeight?p:{x:p.x-sun.x*Math.hypot(roof.width,roof.depth)*100,z:p.z-sun.z*Math.hypot(roof.width,roof.depth)*100});
   });
  });
  const points=clipRoof(convexHull([...base,...projected]),roof);
  return points.length<3?[]:[{id:`shadow-${id}`,name:`${name}${rays.length===1?tx('坡面当前时刻阴影'):tx('坡面冬至时段阴影包络')}`,points}];
 });
}
