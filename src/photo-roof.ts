import {worldObstacle,type RoofDesign} from './roof-project';
import {gableSpans,roofHeight,type RoofPitch} from './pitched-roof';
import {gableSlopeTriangles} from './gable-geometry';
import {cross,type Footprint} from './polygon';

// Photo matching uses the eave plane as elevation zero (rather than the scene's -3.5 datum).
export function photoRoofHeight(width:number,depth:number,pitch:RoofPitch|undefined,x:number,z:number){
 return pitch?roofHeight({width,depth},pitch,x,z)-(pitch.eave-3.5):0;
}
export function photoRoofVertices(width:number,depth:number,pitch?:RoofPitch,outline?:Footprint['outline']){
 const point=(x:number,z:number)=>[x,photoRoofHeight(width,depth,pitch,x,z),z];
 if(pitch?.kind==='gable'&&(outline||pitch.spans)){
  return new Float32Array(gableSlopeTriangles({width,depth,outline},pitch).flatMap(({triangle:[a,b,c]})=>
   (cross(a,b,c)>0?[a,c,b]:[a,b,c]).flatMap(p=>point(p.x,p.z))));
 }
 const xs=pitch?.kind==='gable'&&pitch.axis==='x'?[-width/2,0,width/2]:[-width/2,width/2];
 const zs=pitch?.kind==='gable'&&pitch.axis==='z'?[-depth/2,0,depth/2]:[-depth/2,depth/2];
 const result:number[]=[];
 for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
  const a=point(xs[i-1],zs[j-1]),b=point(xs[i-1],zs[j]),c=point(xs[i],zs[j]),d=point(xs[i],zs[j-1]);
  result.push(...a,...b,...c,...a,...c,...d);
 }
 return new Float32Array(result);
}
export function photoRoofArrays(r:RoofDesign){
 const datum=r.pitch?r.pitch.eave-3.5:0;
 return r.arrays.map(a=>({...a,elevation:r.pitch?(a.elevation??0)-datum:(a.elevation??0),...(a.surface?{surface:{...a.surface,height:a.surface.height-datum}}:{})}));
}
// Intersection is in solver axes: X along 1->2, Y toward 2 from 3, Z up.
// Each gable facet is intersected separately so equipment height starts on the actual slope.
export function photoRoofRay(origin:number[],ray:number[],width:number,depth:number,pitch?:RoofPitch){
 const span=pitch?.axis==='x'?width:depth,slope=(pitch?.percent??0)/100;
 const facets=pitch?.kind==='gable'?gableSpans({width,depth},pitch).flatMap(({start,end,percent})=>{
  const mid=(start+end)/2,gradient=percent/100;
  return [{low:start,high:mid,gradient,offset:-start*gradient},{low:mid,high:end,gradient:-gradient,offset:end*gradient}];
 }):[{low:-Infinity,high:Infinity,gradient:(pitch?.high??0)*slope,offset:span*slope/2}];
 const candidates=facets.flatMap(({low,high,gradient,offset:c})=>{
  const a=pitch?.axis==='x'?gradient:0,b=pitch?.axis==='z'?-gradient:0;
  const denominator=ray[2]-a*ray[0]-b*ray[1];if(Math.abs(denominator)<1e-10)return [];
  const t=(a*origin[0]+b*origin[1]+c-origin[2])/denominator;if(t<=0)return [];
  const q=origin.map((v,i)=>v+t*ray[i]),coordinate=pitch?.axis==='x'?q[0]:-q[1];
  if(coordinate<low-1e-7||coordinate>high+1e-7)return [];
  return [{q,t}];
 });
 candidates.sort((a,b)=>a.t-b.t);return candidates[0]?.q;
}

// Keep obstacle geometry in roof-local coordinates and the photo's eave datum.
export function photoRoofObjects(r:RoofDesign){
 const datum=r.pitch?r.pitch.eave-3.5:(r.flatHeight??3.5)-3.5;
 return r.obstacles.filter(o=>o.kind!=='keepout').map(o=>{
  const world=worldObstacle(o,r);
  return {...o,height:world.height,baseHeight:(world.baseHeight??0)-datum};
 });
}
