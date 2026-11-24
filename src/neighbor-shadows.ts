import {ShapeUtils,Vector2} from 'three';
import {corners,type Point} from './domain';
import {carportSpan} from './carport';
import {gableParapetPlan} from './gable-parapet';
import {roofHeight,roofGradient} from './pitched-roof';
import {createPanelOcclusion,type ShadowCaster} from './panel-occlusion';
import {geographicYaw,toLocal,toWorld,type RoofDesign} from './roof-project';
import {parapets} from './shadow-zones';
import {winterRays,type SunRay} from './solar';

const ground=-3.5;
export const roofShadowDatum=(r:RoofDesign)=>r.pitch||r.carport?0:(r.flatHeight??3.5)-3.5;
const rectangle=(left:number,top:number,right:number,bottom:number)=>[
 {x:left,z:top},{x:right,z:top},{x:right,z:bottom},{x:left,z:bottom},
];
function roofPlanes(r:RoofDesign,trimParapet=false){
 const {width,depth,outline}=r.roof,x=width/2,z=depth/2;
 let faces=outline?ShapeUtils.triangulateShape(outline.map(p=>new Vector2(p.x,p.z)),[]).map(face=>face.map(i=>outline[i])):[rectangle(-x,-z,x,z)];
 if(r.pitch?.kind==='gable'){
  const a=x-(trimParapet&&r.wallHeight>0?.2:0),b=z-(trimParapet&&r.wallHeight>0?.2:0);
  faces=r.pitch.axis==='x'?[rectangle(-a,-b,0,b),rectangle(0,-b,a,b)]:[rectangle(-a,-b,a,0),rectangle(-a,0,a,b)];
 }
 return faces;
}

/** Adjacent building prisms, transformed to the receiver's panel coordinates. */
export function neighborShadowCasters(receiver:RoofDesign,roofs:readonly RoofDesign[],rays:readonly SunRay[]=winterRays(receiver.layoutOptions.shadowLatitude)):ShadowCaster[]{
 const daylight=rays.filter(ray=>ray.y>1e-6);
 if(!daylight.length)return [];
 const maximumReach=Math.max(...daylight.map(ray=>Math.hypot(ray.x,ray.z)/ray.y));
 const datum=roofShadowDatum(receiver);
 const minimumY=receiver.carport?ground:receiver.pitch?receiver.pitch.eave-3.5:datum;
 const canopy=receiver.carport?carportSpan(receiver.carport,receiver.moduleSpec).totalWidth:0;
 const radius=Math.hypot(Math.max(receiver.roof.width,canopy),Math.max(receiver.roof.depth,canopy))/2;
 return roofs.flatMap(source=>{
  if(source.id===receiver.id||source.carport)return [];
  const pitch=source.pitch;
  const top=pitch?Math.max(...corners({x:0,z:0,yaw:0,...source.roof}).map(p=>roofHeight(source.roof,pitch,p.x,p.z)),roofHeight(source.roof,pitch,0,0))+.025+source.wallHeight:roofShadowDatum(source)+source.wallHeight;
  // A full-height shadow ray cannot reach a receiver outside this conservative bound.
  if(top<=minimumY||Math.hypot(source.x-receiver.x,source.z-receiver.z)>radius+Math.hypot(source.roof.width,source.roof.depth)/2+.2+(top-minimumY)*maximumReach)return [];
  const solid=(ring:Point[],height:(p:Point)=>number):ShadowCaster=>{
   const plan=ring.map(p=>toLocal(toWorld(p,source),receiver));
   return {id:`neighbor-${source.id}`,name:source.name,vertices:[
    ...plan.map(p=>({...p,y:ground-datum})),...plan.map((p,i)=>({...p,y:height(ring[i])-datum})),
   ]};
  };
  if(pitch?.kind==='gable'&&source.wallHeight>0){
   const {cells,surface,coping}=gableParapetPlan(source.roof,pitch,source.wallHeight);
   return cells.map(cell=>solid(cell.outline,cell.deck?surface:coping));
  }
  const faces=roofPlanes(source).map(face=>solid(face,p=>pitch?roofHeight(source.roof,pitch,p.x,p.z):roofShadowDatum(source)));
  if(!pitch)for(const wall of parapets(source.roof,source.wallHeight)){
   faces.push(solid(corners(wall),()=>roofShadowDatum(source)+wall.height));
  }
  return faces;
 });
}

export function neighborRoofShadowZones(r:RoofDesign,casters:readonly ShadowCaster[],rays:readonly SunRay[],referenceHeight:number){
 if(r.carport||!casters.length)return [];
 const model=createPanelOcclusion(r.roof,[],0,geographicYaw(r),rays,casters);
 return roofPlanes(r,true).flatMap(face=>{
  const origin=face[0],center=face.reduce((p,v)=>({x:p.x+v.x/face.length,z:p.z+v.z/face.length}),{x:0,z:0});
  const pitch=r.pitch;
  const {sx,sz}=pitch?roofGradient(pitch,center.x,center.z):{sx:0,sz:0};
  const y=pitch?roofHeight(r.roof,pitch,origin.x,origin.z):0;
  return model.planeRegions({sx,sz,h:y-sx*origin.x-sz*origin.z+referenceHeight},face);
 });
}
