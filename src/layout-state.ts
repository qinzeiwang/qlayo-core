import type {RoofDesign} from './roof-project';
import {carportSpan} from './carport';
import {maxRoofHeight} from './pitched-roof';
import {winterRays} from './solar';
/** Project setbacks: the roof edge, and the ridge (or high side) of pitched roofs. A plain number means both. */
export type Edges=number|{edge:number;ridge:number};
export const edgeOf=(e:Edges)=>typeof e==='number'?e:e.edge;
export const ridgeOf=(e:Edges)=>typeof e==='number'?e:e.ridge;
export const projectEdges=(p:{globalEdge?:number;globalRidgeEdge?:number}):Edges=>({edge:p.globalEdge??.5,ridge:p.globalRidgeEdge??p.globalEdge??.5});
export function roofLayoutEdges(r:RoofDesign,defaults:Edges){
 const edge=r.carport?edgeOf(defaults):r.edgeOverride??edgeOf(defaults);
 const ridgeEdge=r.pitch?r.ridgeEdgeOverride??ridgeOf(defaults):edge;
 return {edge,ridgeEdge};
}
const round4=(v:number)=>Math.round(v*1e4)/1e4;
function neighborSignature(r:RoofDesign,roofs?:readonly RoofDesign[]){
 if(!roofs?.length||r.shadingOnly||r.layoutOptions.shadowIgnored)return;
 const rays=winterRays(r.layoutOptions.shadowLatitude).filter(ray=>ray.y>1e-6);
 if(!rays.length)return;
 const maximumReach=Math.max(...rays.map(ray=>Math.hypot(ray.x,ray.z)/ray.y));
 const ground=-3.5;
 const datum=r.pitch||r.carport?0:(r.flatHeight??3.5)-3.5;
 const minY=r.carport?ground:r.pitch?r.pitch.eave-3.5:datum;
 const canopy=r.carport?carportSpan(r.carport,r.moduleSpec).totalWidth:0;
 const radius=Math.hypot(Math.max(r.roof.width,canopy),Math.max(r.roof.depth,canopy))/2;
 const list=roofs.flatMap(source=>{
  if(source.id===r.id||source.carport)return [];
  const pitch=source.pitch;
  const top=pitch?maxRoofHeight(source.roof,pitch)+.025+source.wallHeight:((source.flatHeight??3.5)-3.5)+source.wallHeight;
  if(top<=minY||Math.hypot(source.x-r.x,source.z-r.z)>radius+Math.hypot(source.roof.width,source.roof.depth)/2+.2+(top-minY)*maximumReach)return [];
  return [{
   x:round4(source.x-r.x),z:round4(source.z-r.z),yaw:round4(source.yaw),
   w:round4(source.roof.width),d:round4(source.roof.depth),
   ...(source.roof.outline?{o:source.roof.outline.map(p=>[round4(p.x),round4(p.z)])}:{}),
   ...(pitch?{p:pitch}:{fh:round4(source.flatHeight??3.5)}),
   wh:round4(source.wallHeight),
  }];
 });
 if(!list.length)return;
 list.sort((a,b)=>a.x-b.x||a.z-b.z||a.w-b.w||a.d-b.d);
 return list;
}
// A ridge setback equal to the edge keeps the old signature, so existing layouts stay current.
export function layoutSignatureFor(r:RoofDesign,edges:Edges,roofs?:readonly RoofDesign[]){
 const {edge,ridgeEdge}=roofLayoutEdges(r,edges);
 const neighbors=neighborSignature(r,roofs);
 return JSON.stringify({
  roof:r.roof,obstacles:r.obstacles,wallHeight:r.wallHeight,layoutOptions:r.layoutOptions,moduleSpec:r.moduleSpec,yaw:r.yaw,
  ...(r.northAngle?{northAngle:r.northAngle}:{}),
  ...(r.pitch?{pitchedShadowRevision:r.pitch.kind==='gable'&&r.wallHeight>0?2:1}:!r.carport?{flatShadowRevision:2}:{}),
  pitch:r.pitch,carport:r.carport&&{...r.carport,frame:undefined},globalEdge:edge,
  ...(r.pitch&&ridgeEdge!==edge?{ridgeEdge}:{}),
  ...(!r.pitch&&r.moduleSpec.kind==='lightweight'?{flatLightweightSetbackRevision:1}:{}),
  ...(neighbors?{neighbors}:{}),
 });
}
export const needsLayoutUpdate=(r:RoofDesign,edge:Edges,roofs?:readonly RoofDesign[])=>r.layoutSignature!==layoutSignatureFor(r,edge,roofs);
