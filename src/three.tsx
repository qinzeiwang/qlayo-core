import {clipRoof} from './shadow-zones';
import {sceneReady} from './scene-ready';
import {insidePolygon,segmentDistance} from './polygon';
import {FootprintGeometry,footprintLines} from './footprint-mesh';
import {arrayLocationDimensions} from './array-dimensions';
import { CarportSupports } from './carport-supports';
import {gableRidgeLine,pitchSegments,carportColumnEdge} from './roof-direction';
import {canvasColours,useColourBlind} from './colour-vision';
import {fitOrbitView,fitPlanImage} from './viewport-fit';
import {layoutMarkerBadge,type LayoutMarker} from './layout-direction';
import { PitchedMesh } from './pitched-mesh';
import { Canvas, flushSync, useThree, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  corners,
  bindPointer,
  footprint,
  fittedPlanView,
  geometry,
  obstacles as defaultObstacles,
  roof as defaultRoof,
  viewStart,
  orbitPosition,
  orbit,
  zoomView,
  eyeLevel,
  type ViewProps,
  type LayoutImageOptions,
  type PVArray,
} from "./domain";
import {
  outline,
  direction,
} from "./visuals";
import { RealisticScene, stressPanels } from "./realistic";
import { PlanGrid } from "./canvas-grid";
import {canvasStyle,planElementColours} from "./canvas-style";
import { usePdfPatch, type PdfViewport } from './pdf-patch';
import type { PerformanceTrial } from "./render-options";
import {coreEdition,tx} from './i18n';
import {MeasureLayer,type MeasureControl} from './canvas-measure';
import {placePlanLabels,type LabelSize} from './plan-label-layout';
import type {SceneSite} from './domain';

function PitchStroke({length,unit,tone='#18191c',opacity=1}:{length:number;unit:number;tone?:string;opacity?:number}){
 const radius=unit*.875;
 const material={color:tone,opacity,transparent:opacity<1,depthTest:false,depthWrite:false,toneMapped:false};
 return <group><mesh renderOrder={10001}><boxGeometry args={[length,.01,radius*2]}/><meshBasicMaterial {...material}/></mesh>{[-1,1].map(end=><mesh key={end} position={[end*length/2,0,0]} rotation={[-Math.PI/2,0,0]} renderOrder={10001}><circleGeometry args={[radius,16]}/><meshBasicMaterial {...material}/></mesh>)}</group>;
}
function LayoutDirectionMark({marker,unit,tone}:{marker:LayoutMarker;unit:number;tone?:string}){
 const badge=coreEdition?layoutMarkerBadge(marker,unit):undefined;
 const segments=badge?.segments??marker.outline??marker.segments;
 return <group name="layout-direction-mark">
  {badge&&<group name="layout-direction-badge" position={[badge.cx,0,badge.cz]} rotation={[-Math.PI/2,0,0]}>
   <mesh renderOrder={9999}>
    <circleGeometry args={[badge.radius,32]}/><meshBasicMaterial color="#f7f8f9" transparent opacity={.96} depthTest={false} depthWrite={false} toneMapped={false}/>
   </mesh>
   <mesh renderOrder={10000}>
    <ringGeometry args={[badge.radius-Math.min(unit*1.2,badge.radius*.12),badge.radius,32]}/><meshBasicMaterial color="#64748b" transparent opacity={.92} depthTest={false} depthWrite={false} toneMapped={false}/>
   </mesh>
  </group>}
  {segments.map(([x,z,bx,bz],i)=><group key={i} position={[(x+bx)/2,0,(z+bz)/2]} rotation={[0,-Math.atan2(bz-z,bx-x),0]}>
   <PitchStroke length={Math.hypot(bx-x,bz-z)} unit={badge?Math.min(unit,badge.radius/14):unit*.8} tone={badge?'#374151':tone} opacity={badge ? .98 : .58}/>
  </group>)}
 </group>;
}
const PLAN_TAG_HEIGHT=22;
const planNumberFont=(carport:boolean)=>carport?'italic 700 24px Georgia, serif':'600 22px "Inter Variable","Segoe UI",sans-serif';
const planCapacityFont='500 20px "SFMono-Regular",Consolas,monospace';
function tagMetrics(ctx:CanvasRenderingContext2D,capacity:string){
 const numberWidth=PLAN_TAG_HEIGHT;
 ctx.font=planCapacityFont;
 const capacityWidth=capacity?Math.ceil(ctx.measureText(capacity).width/2+10):0;
 return {numberWidth,capacityWidth,width:numberWidth+(capacityWidth?4+capacityWidth:0)};
}
function SiteTag({number,carport,capacity,position,unit,selected,badgeOnLeft}:{
 number:string;carport:boolean;capacity:string;position:[number,number,number];unit:number;selected:boolean;badgeOnLeft:boolean;
}){
 const {texture,width}=useMemo(()=>{
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!;
  const {numberWidth,capacityWidth,width}=tagMetrics(ctx,capacity);
  canvas.width=width*2;canvas.height=PLAN_TAG_HEIGHT*2;
  const numberCenter=numberWidth+(badgeOnLeft&&capacity?(capacityWidth+4)*2:0);
  ctx.strokeStyle=selected?'#7d8791':'#8c959eaa';ctx.lineWidth=1.6;
  ctx.beginPath();ctx.arc(numberCenter,canvas.height/2,PLAN_TAG_HEIGHT-1.5,0,Math.PI*2);ctx.stroke();
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=planNumberFont(carport);
  ctx.fillStyle=selected?'#33383d':'#5c6670';ctx.fillText(number,numberCenter,canvas.height/2+1,numberWidth*2-10);
  if(capacity){
   const start=badgeOnLeft?0:(numberWidth+4)*2;
   ctx.fillStyle='#e9edf0bb';
   ctx.beginPath();ctx.roundRect(start,6,capacityWidth*2,canvas.height-12,7);ctx.fill();
   ctx.font=planCapacityFont;ctx.fillStyle='#5a616a';ctx.fillText(capacity,start+capacityWidth,canvas.height/2+1);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return {texture,width};
 },[number,carport,capacity,selected,badgeOnLeft]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <sprite position={position} scale={[unit*width,unit*PLAN_TAG_HEIGHT,1]} renderOrder={11000}><spriteMaterial map={texture} toneMapped={false} transparent depthTest={false} depthWrite={false}/></sprite>;
}
type PlanView={x:number;z:number;span:number};
function PlanSiteLabels({sites,referenceSites,selectedId,pickedIds,view,fitView,width,height}:{
 sites:SceneSite[];referenceSites:SceneSite[];selectedId?:string;pickedIds?:string[];view:PlanView;fitView:PlanView;width:number;height:number;
}){
 const tags=useMemo(()=>{
  const ctx=document.createElement('canvas').getContext('2d')!;
  return sites.map((site,index)=>{
   const number=String(site.planNumber??index+1).padStart(2,'0');
   const carport=!!site.carport,capacity=site.capacity&&site.capacity>0?site.capacity.toFixed(1)+' kWp':'';
   const selected=selectedId===site.id||!!pickedIds?.includes(site.id);
   const {numberWidth,width}=tagMetrics(ctx,capacity);
   const sizes:LabelSize[]=[{width:numberWidth,height:PLAN_TAG_HEIGHT,minRoofSize:4,withCapacity:false}];
   if(capacity)sizes.unshift({width,height:PLAN_TAG_HEIGHT,minRoofSize:64,withCapacity:true});
   return {id:site.id,number,carport,capacity,selected,sizes,outline:corners(site)};
  });
 },[sites,selectedId,pickedIds]);
 const {x:fitX,z:fitZ,span:fitSpan}=fitView;
 const preferred=useMemo(()=>{
  if(!width||!height)return new Map();
  const unit=fitSpan/height;
  const projected=referenceSites.map(site=>{
   const outline=corners(site).map(p=>({x:(p.x-fitX)/unit+width/2,z:(p.z-fitZ)/unit+height/2}));
   return {id:site.id,outline,selected:false,sizes:[{width:PLAN_TAG_HEIGHT,height:PLAN_TAG_HEIGHT,minRoofSize:4,withCapacity:false}]};
  });
  return new Map(placePlanLabels(projected,width,height).map(label=>[label.id,label.side]));
 },[referenceSites,fitX,fitZ,fitSpan,width,height]);
 if(!width||!height)return null;
 const unit=view.span/height;
 const projected=tags.map(tag=>({...tag,outline:tag.outline.map(p=>({x:(p.x-view.x)/unit+width/2,z:(p.z-view.z)/unit+height/2}))}));
 const byId=new Map(tags.map(tag=>[tag.id,tag]));
 const center={x:(fitX-view.x)/unit+width/2,z:(fitZ-view.z)/unit+height/2};
 return placePlanLabels(projected,width,height,preferred,center).map(label=>{
  const tag=byId.get(label.id)!;
  const world=(p:{x:number;z:number}):[number,number,number]=>[view.x+(p.x-width/2)*unit,.6,view.z+(p.z-height/2)*unit];
  return <group key={tag.id}>
   <Lines points={label.leader.flatMap(world)} color="#737e86" opacity={tag.selected?.52:.35} depthTest={false} order={10980}/>
   <SiteTag number={tag.number} carport={tag.carport} capacity={label.size.withCapacity?tag.capacity:''} selected={tag.selected} position={world(label.center)} unit={unit} badgeOnLeft={label.side==='left'}/>
  </group>;
 });
}
function CadDimensionText({text,position,unit,angle}:{text:string;position:[number,number,number];unit:number;angle:number}){
 const {texture,width}=useMemo(()=>{const c=document.createElement('canvas');const ctx=c.getContext('2d')!;ctx.font='52px Arial';const width=Math.ceil(ctx.measureText(text).width)+8;c.width=width;c.height=72;ctx.font='52px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#27343b';ctx.fillText(text,width/2,36);const texture=new THREE.CanvasTexture(c);return {texture,width};},[text]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 // Keep aligned text readable from the bottom or the right of the drawing.
 let rotation=((angle+Math.PI/2)%Math.PI+Math.PI)%Math.PI-Math.PI/2;
 if(Math.abs(rotation+Math.PI/2)<.001)rotation=Math.PI/2;
 return <sprite position={position} scale={[unit*width/4,unit*18,1]} renderOrder={11000}><spriteMaterial rotation={rotation} map={texture} toneMapped={false} transparent depthTest={false} depthWrite={false}/></sprite>;
}
function ArrayLocationDimensions({array,site,unit}:{array:PVArray;site:import('./domain').SceneSite;unit:number}){
 const {origin:o,anchor:a,x,z}=arrayLocationDimensions(array,site),offset=unit*36,tick=unit*3,top=o.z-offset,left=o.x-offset,gap=unit*3,over=unit*6;
 const segments:number[]=[];
 const line=(x1:number,z1:number,x2:number,z2:number)=>segments.push(x1,.5,z1,x2,.5,z2);
 const shortX=Math.abs(x)<unit*55,shortZ=Math.abs(z)<unit*55;
 const txPos=shortX?Math.max(o.x,a.x)+unit*32:(o.x+a.x)/2,tzPos=shortZ?Math.max(o.z,a.z)+unit*32:(o.z+a.z)/2;
 line(Math.min(o.x,a.x)-over,top,Math.max(o.x,a.x)+(shortX?unit*60:over),top);
 line(left,Math.min(o.z,a.z)-over,left,Math.max(o.z,a.z)+(shortZ?unit*60:over));
 // Extension lines start clear of the measured geometry, and overrun dimension lines.
 line(o.x,o.z-gap,o.x,top-over);line(a.x,a.z-gap,a.x,top-over);
 line(o.x-gap,o.z,left-over,o.z);line(a.x-gap,a.z,left-over,a.z);
 return <group name="array-location-dimensions" position={[site.x,0,site.z]} rotation={[0,site.yaw,0]}>
  <lineSegments renderOrder={10990}><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(segments),3]}/></bufferGeometry><lineBasicMaterial color="#58656c" depthTest={false} depthWrite={false} toneMapped={false}/></lineSegments>
  {[[o.x,top],[a.x,top],[left,o.z],[left,a.z]].map(([cx,cz],i)=><mesh key={i} position={[cx,.55,cz]} rotation={[0,Math.PI/4,0]} renderOrder={10995}><boxGeometry args={[tick*2.83,.01,unit*1.6]}/><meshBasicMaterial color="#27343b" depthTest={false} depthWrite={false} toneMapped={false}/></mesh>)}
  <CadDimensionText text={x.toFixed(2)} position={[txPos,.6,top-unit*12]} unit={unit} angle={site.yaw}/>
  <CadDimensionText text={z.toFixed(2)} position={[left-unit*12,.6,tzPos]} unit={unit} angle={site.yaw+Math.PI/2}/>
 </group>;
}

// Overlay pictures sit on the drawing and under everything drawn: blended but kept in the opaque pass (transparent=false), which three.js
// draws first, ordered after the base drawing (-200) and before all design layers (0 and up). Alpha adds up normally (one, 1-a), so the
// canvas stays opaque over the drawing; with the colour factors on alpha too it let the grey page show through.
function OverlayImage({item,index,selected,unit}:{item:import('./image-overlays').ImageOverlay;index:number;selected:boolean;unit:number}){
 const [texture,setTexture]=useState<THREE.Texture>();const {invalidate}=useThree();
 useEffect(()=>{let disposed=false;const t=new THREE.TextureLoader().load(item.url,()=>{if(disposed)return;t.colorSpace=THREE.SRGBColorSpace;setTexture(t);invalidate();});return()=>{disposed=true;t.dispose();};},[item.url,invalidate]);
 if(!item.visible||!texture)return null;
 return <group position={[item.x,0,item.z]} rotation={[0,item.yaw,0]}><mesh position={[0,.021+index*.0001,0]} rotation={[-Math.PI/2,0,0]} renderOrder={-100+index}><planeGeometry args={[item.width,item.depth]}/><meshBasicMaterial map={texture} opacity={item.opacity} blending={THREE.CustomBlending} blendSrc={THREE.SrcAlphaFactor} blendDst={THREE.OneMinusSrcAlphaFactor} blendSrcAlpha={THREE.OneFactor} blendDstAlpha={THREE.OneMinusSrcAlphaFactor} depthTest={false} depthWrite={false} toneMapped={false}/></mesh>{selected&&<><lineLoop renderOrder={12000}><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(outline(item.width,item.depth,.1)),3]}/></bufferGeometry><lineBasicMaterial color="#387ead" depthTest={false}/></lineLoop>{corners({...item,x:0,z:0,yaw:0}).map((p,i)=><mesh key={i} position={[p.x,.12,p.z]} rotation={[-Math.PI/2,0,0]} renderOrder={12001}><circleGeometry args={[unit*6,16]}/><meshBasicMaterial color="white" depthTest={false}/></mesh>)}</>}</group>;
}
/** Clip the raster in source pixels, keeping the PDF patch and base from blending twice. */
function BaseRasterGeometry({crop,rect,k,cutout}:{crop?:import('./domain').Point[];rect:PdfViewport;k:number;cutout?:PdfViewport}){
 const clipped=useMemo(()=>{
  if(!crop&&!cutout)return;
  const position:number[]=[],uv:number[]=[];
  const {x,y,width,height}=rect,cx=x+width/2,cy=y+height/2;
  const outline=crop??[{x,z:y},{x:x+width,z:y},{x:x+width,z:y+height},{x,z:y+height}];
  const faces=THREE.ShapeUtils.triangulateShape(outline.map(p=>new THREE.Vector2(p.x,p.z)),[]);
  const regions=cutout?[
   {x,y,width:cutout.x-x,height},
   {x:cutout.x+cutout.width,y,width:x+width-cutout.x-cutout.width,height},
   {x:cutout.x,y,width:cutout.width,height:cutout.y-y},
   {x:cutout.x,y:cutout.y+cutout.height,width:cutout.width,height:y+height-cutout.y-cutout.height},
  ]:[rect];
  for(const region of regions){
   if(region.width<=0||region.height<=0)continue;
   const rx=region.x+region.width/2,rz=region.y+region.height/2;
   for(const face of faces){
    const polygon=clipRoof(face.map(i=>({x:outline[i].x-rx,z:outline[i].z-rz})),{width:region.width,depth:region.height});
    for(let i=1;i+1<polygon.length;i++){
     for(const p of [polygon[0],polygon[i],polygon[i+1]]){
      const px=p.x+rx-cx,pz=p.z+rz-cy;
      position.push(px*k,-pz*k,0);uv.push(.5+px/width,.5-pz/height);
     }
    }
   }
  }
  return {position:new Float32Array(position),uv:new Float32Array(uv)};
 },[crop,rect.x,rect.y,rect.width,rect.height,k,cutout]);
 return clipped?<bufferGeometry><bufferAttribute attach="attributes-position" args={[clipped.position,3]}/><bufferAttribute attach="attributes-uv" args={[clipped.uv,2]}/></bufferGeometry>:<planeGeometry args={[rect.width*k,rect.height*k]}/>;
}
function BaseImagePlane({base,view,pixels,visible,opacity}:{base:import('./base-image').BaseImage;view:PdfViewport;pixels:number;visible:boolean;opacity:number}){
 const patch=usePdfPatch(base,view,pixels),{invalidate}=useThree();
 const [loaded,setLoaded]=useState<{url:string;texture:THREE.Texture}>();useEffect(()=>{let disposed=false;const t=new THREE.TextureLoader().load(base.url,()=>{if(disposed){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;setLoaded({url:base.url,texture:t});invalidate();});return()=>{disposed=true;t.dispose();};},[base.url,invalidate]);const texture=loaded?.url===base.url?loaded.texture:undefined;

 const [ready,setReady]=useState<{texture:THREE.Texture;view:PdfViewport}>();
 useEffect(()=>{
  if(!patch){setReady(undefined);return;}
  let cancelled=false;
  new THREE.TextureLoader().load(patch.url,tex=>{
   if(cancelled){tex.dispose();return;}
   tex.colorSpace=THREE.SRGBColorSpace;setReady({texture:tex,view:patch.view});invalidate();
  });
  return()=>{cancelled=true;};
 },[patch,invalidate]);
 useEffect(()=>()=>ready?.texture.dispose(),[ready]);
 const f=base.frame!,k=base.metersPerPixel!;
 const plane=(r:PdfViewport,map:THREE.Texture,order:number,cutout?:PdfViewport)=>
  <mesh position={[(r.x+r.width/2-f.x-f.width/2)*k,.012,(r.y+r.height/2-f.y-f.height/2)*k]} rotation={[-Math.PI/2,0,0]} renderOrder={order}>
   <BaseRasterGeometry crop={base.crop} rect={r} k={k} cutout={cutout}/>
   <meshBasicMaterial map={map} opacity={opacity} toneMapped={false} side={THREE.DoubleSide}
    blending={THREE.CustomBlending} blendSrc={THREE.SrcAlphaFactor} blendDst={THREE.OneMinusSrcAlphaFactor}
    blendSrcAlpha={THREE.OneFactor} blendDstAlpha={THREE.OneMinusSrcAlphaFactor} depthWrite={false}/>
  </mesh>;
 if(!texture)return null;
 return <group name="plan-base-raster" visible={visible}>{plane({x:0,y:0,width:base.width,height:base.height},texture,-200,ready?.view)}
  {ready&&plane(ready.view,ready.texture,-199)}</group>;
}
function Lines({
  points,
  color,
  segments = false,
  opacity = 1,
  depthTest = true,
  order = 0,
}: {
  points: number[];
  color: string;
  segments?: boolean;
  opacity?: number;
  depthTest?: boolean;
  order?: number;
}) {
  const data = useMemo(() => new Float32Array(points), [points]);
  const Tag = segments ? "lineSegments" : "line";
  return (
    <Tag renderOrder={order}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent={opacity<1} opacity={opacity} depthTest={depthTest} depthWrite={false} toneMapped={false}/>
    </Tag>
  );
}
/** A wide line along a top-view polyline (flat x,y,z list). WebGL lines are always 1 px, so a selection outline that
 *  must read without colour is drawn as flat quads instead; each piece runs on by half its width so corners close. */
function Band({points,width,color,order}:{points:number[];width:number;color:string;order:number}){
 const data=useMemo(()=>{const out:number[]=[],h=width/2;
  for(let i=0;i+5<points.length;i+=3){const [x0,y,z0]=points.slice(i,i+3),x1=points[i+3],z1=points[i+5],len=Math.hypot(x1-x0,z1-z0);if(!len)continue;
   const ux=(x1-x0)/len*h,uz=(z1-z0)/len*h,ax=x0-ux,az=z0-uz,bx=x1+ux,bz=z1+uz;
   out.push(ax-uz,y,az+ux,bx-uz,y,bz+ux,bx+uz,y,bz-ux,ax-uz,y,az+ux,bx+uz,y,bz-ux,ax+uz,y,az-ux);}
  return new Float32Array(out);},[points,width]);
 return <mesh renderOrder={order}><bufferGeometry><bufferAttribute attach="attributes-position" args={[data,3]}/></bufferGeometry><meshBasicMaterial color={color} side={THREE.DoubleSide} depthTest={false} depthWrite={false} toneMapped={false}/></mesh>;
}
function WinterCheckOutline({points}:{points:Float32Array}) {
 const line = useRef<THREE.LineSegments>(null);
 useLayoutEffect(()=>{
  line.current?.geometry.computeBoundingSphere();
  line.current?.computeLineDistances();
 },[points]);
 return <lineSegments ref={line} renderOrder={15}>
  <bufferGeometry><bufferAttribute attach="attributes-position" args={[points,3]}/></bufferGeometry>
  <lineDashedMaterial color="#987440" dashSize={0.55} gapSize={0.32} depthWrite={false} toneMapped={false}/>
 </lineSegments>;
}
function ShadowPolygon({ points, elevation=0,overlay=false }: { overlay?:boolean;elevation?:number; points: { x: number; z: number }[] }) {
  const vertices = useMemo(() => {
    const coords: number[] = [];
    for (let i = 1; i < points.length - 1; i++) for (const p of [points[0], points[i], points[i + 1]]) coords.push(p.x, elevation+0.025, p.z);
    return new Float32Array(coords);
  }, [points,elevation]);
  return <mesh renderOrder={overlay?100:0}><bufferGeometry><bufferAttribute attach="attributes-position" args={[vertices, 3]} /></bufferGeometry><meshBasicMaterial color="#777d79" transparent opacity={0.10} depthTest={!overlay} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} /></mesh>;
}
function makeTopCells(){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;
 const c=canvas.getContext('2d')!;c.fillStyle='#64748b';c.fillRect(0,0,512,1024);
 for(let row=0;row<12;row++)for(let col=0;col<6;col++){
  const x=col*85+2,y=row*85+2;
  c.fillStyle='#27303f';c.beginPath();c.roundRect(x,y,83,83,2);c.fill();
 }
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
 return map;
}
function TopArray({a,selected,conflict,map}:{a:PVArray;selected:boolean;conflict:boolean;map:THREE.Texture}) {
 const g=useMemo(()=>geometry(a),[a]),c=canvasColours(useColourBlind());
 const data=useMemo(()=>{
  const fill:number[]=[],edges:number[]=[],uv:number[]=[];
  const w=a.surface?g.w/Math.sqrt(1+a.surface.sx**2):g.w;
  const d=a.surface?g.l/Math.sqrt(1+a.surface.sz**2):g.l*Math.cos(g.tilt);
  for(const p of g.panels){
   const x0=p.x-w/2,x1=p.x+w/2,z0=p.z-d/2,z1=p.z+d/2;
   fill.push(x0,.2,z0,x0,.2,z1,x1,.2,z1,x0,.2,z0,x1,.2,z1,x1,.2,z0);
   const coords=[0,1,0,0,1,0,0,1,1,0,1,1];
   for(let i=0;i<coords.length;i+=2)uv.push(...(a.portrait?[coords[i],coords[i+1]]:[coords[i+1],1-coords[i]]));
   edges.push(x0,.21,z0,x1,.21,z0,x1,.21,z0,x1,.21,z1,x1,.21,z1,x0,.21,z1,x0,.21,z1,x0,.21,z0);
  }
  return {fill:new Float32Array(fill),uv:new Float32Array(uv),edges};
 },[a,g]);
 return <group position={[a.x,0,a.z]} rotation={[0,g.yaw,0]}>
  <mesh userData={{arrayId:a.id}}><bufferGeometry><bufferAttribute attach="attributes-position" args={[data.fill,3]}/><bufferAttribute attach="attributes-uv" args={[data.uv,2]}/></bufferGeometry><meshBasicMaterial map={map} color={conflict?c.conflictFill:selected?'#cbd5e1':'#ffffff'} toneMapped={false}/></mesh>
  <Lines points={data.edges} segments color={conflict?c.conflictEdge:selected?'#475569':'#64748b'}/>
  <Lines points={outline(g.width,g.depth,.22)} color={conflict?c.conflictLine:selected?'#18191c':'#94a3b8'}/>
 </group>;
}
function ArrayMesh({
  a,
  selected,
  conflict,
  mode,
  guides = true,
}: {
  a: PVArray;
  selected: boolean;
  conflict: boolean;
  mode: string;
  guides?: boolean;
}) {
  const g = useMemo(
    () => geometry(a),
    [a],
  );
  const conflictColour = canvasColours(useColourBlind()).conflictModule;
  const color = conflict ? conflictColour : selected ? "#285f80" : "#4b7187";
  return (
    <group position={[a.x, 0, a.z]} rotation={[0, g.yaw, 0]}>
      {g.panels.map((p, i) => (
        <mesh
          key={i}
          position={[p.x, a.surface&&mode==="top"?.2:p.y, p.z]}
          rotation={a.surface&&mode==="top"?[0,0,0]:[g.tilt, 0, g.roll]}
          userData={{ arrayId: a.id }}
        >
          <boxGeometry args={[a.surface&&mode==="top"?g.w/Math.sqrt(1+a.surface.sx**2):g.w, 0.035, a.surface&&mode==="top"?g.l/Math.sqrt(1+a.surface.sz**2):g.l]} />
          {mode === "top" ? (
            <meshBasicMaterial color={color} />
          ) : (
            <meshLambertMaterial color={color} />
          )}
        </mesh>
      ))}
      {guides && (selected || conflict) && (
        <Lines
          points={outline(g.width, g.depth)}
          color={conflict ? "#cc392c" : "#db8b22"}
        />
      )}
      {guides && (
        <Lines
          points={direction(g.depth)}
          color={conflict ? "#cc392c" : "#be7313"}
        />
      )}
    </group>
  );
}
function Scene(input: ViewProps) {
  const [clean,setClean]=useState<LayoutImageOptions&{planView?:PlanView}>();
  const exportSiteId=clean?.siteId;
  const belongsToSite=(item:{id:string})=>item.id.startsWith(exportSiteId+'/');
  const props=clean?{
    ...input,
    sites:exportSiteId?input.sites?.filter(site=>site.id===exportSiteId):input.sites,
    arrays:exportSiteId?input.arrays.filter(belongsToSite):input.arrays,
    obstacles:exportSiteId?input.obstacles?.filter(belongsToSite):input.obstacles,
    showSiteLabels:clean.includeLabels,
    showGrid:clean.includeGrid,
    selectedId:null, selectedSiteId:undefined, pickedSiteIds:undefined,
    selectedObjectId:undefined, pickedObjectIds:undefined, selectedObjectIds:undefined,
    editingOverlay:false,
    showPitchMarker:false, layoutMarker:undefined, winterCheck:undefined, shadowZones:undefined,
  }:input;
  const topCells=useMemo(makeTopCells,[]);
  useEffect(()=>()=>topCells.dispose(),[topCells]);
  const roof = props.roof ?? defaultRoof;
  const obstacles = props.obstacles ?? defaultObstacles;
  const sites=props.sites??[{id:"roof",name:tx('屋面'),x:0,z:0,yaw:0,...roof,wallHeight:props.wallHeight??.32}];
  const latest = useRef(props);
  latest.current = props;
  const measureControl=useRef<MeasureControl|null>(null);
  // What measure clicks snap to: roofs and carports, obstacles and panel fields.
  const measureShapes=useMemo(()=>[...sites.map(corners),...obstacles.map(corners),...props.arrays.map(a=>corners(footprint(a)))],[sites,obstacles,props.arrays]);
  const { gl, size, set, scene, invalidate, get } = useThree();
  const base=props.baseImage;
  const hasRaster=!!(base?.frame&&base.metersPerPixel&&!base.blank);
  const showRaster=hasRaster&&(clean?clean.includeBase:base?.visible!==false&&base?.opacity!==0);
  const showPlanBase=clean?(showRaster||clean.includeBase&&!!props.imageOverlays?.some(item=>item.visible&&item.opacity>0)):!!base&&!base.blank;
  useEffect(()=>{
    input.onCaptureReady?.(options=>{
      if(latest.current.mode==='3d'&&!sceneReady(scene))throw new Error(tx('三维材质正在加载，请稍后再导出'));
      if(!options){
        gl.render(scene,get().camera);
        return gl.domElement.toDataURL('image/png');
      }

      const {x:width,y:height}=gl.getSize(new THREE.Vector2());
      const pixelRatio=gl.getPixelRatio();
      const maxSize=Math.min(3840,...gl.getContext().getParameter(gl.getContext().MAX_VIEWPORT_DIMS));
      if(!width||!height||gl.getContext().isContextLost())throw new Error(tx('画布正在加载，请稍后再试'));
      const current=latest.current;
      const liveCamera=get().camera;
      let captureCamera=liveCamera;
      let exportPlanView:PlanView|undefined;
      if(options.scope!=='screen'){
        const siteId=options.scope==='site'?options.siteId:undefined;
        const exportSites=(current.sites??[]).filter(site=>!siteId||site.id===siteId);
        const exportArrays=current.arrays.filter(item=>!siteId||item.id.startsWith(siteId+'/'));
        const exportObstacles=(current.obstacles??[]).filter(item=>!siteId||item.id.startsWith(siteId+'/'));
        const aspect=width/height;
        if(liveCamera instanceof THREE.OrthographicCamera){
          exportPlanView=fitPlanImage(aspect,exportSites,exportObstacles,exportArrays);
          if(exportPlanView){
            const {x,z,span}=exportPlanView;
            const camera=liveCamera.clone();
            camera.left=-span*aspect/2;camera.right=span*aspect/2;
            camera.top=span/2;camera.bottom=-span/2;
            camera.position.set(x,400,z);camera.lookAt(x,0,z);
            captureCamera=camera;
          }
        }else if(liveCamera instanceof THREE.PerspectiveCamera){
          const fitted={...view.current};
          fitOrbitView(fitted,aspect,liveCamera.fov,exportSites,exportObstacles,exportArrays);
          const camera=liveCamera.clone(),position=orbitPosition(fitted);
          camera.far=Math.max(camera.far,fitted.distance*3);
          camera.position.set(position.x,position.y,position.z);camera.lookAt(fitted.x,fitted.target,fitted.z);
          captureCamera=camera;
        }
        captureCamera.updateProjectionMatrix();
        captureCamera.updateMatrixWorld();
      }
      try{
        flushSync(()=>setClean({...options,planView:exportPlanView}));
        const base=latest.current.baseImage;
        if(latest.current.mode==='top'&&options.includeBase&&base?.frame&&base.metersPerPixel&&!base.blank&&!scene.getObjectByName('plan-base-raster')?.visible){
          throw new Error(tx('底图正在加载，请稍后再试'));
        }
        gl.shadowMap.needsUpdate=true;
        gl.setDrawingBufferSize(width,height,maxSize/Math.max(width,height));
        gl.render(scene,captureCamera);
        const image=gl.domElement.toDataURL('image/png');
        if(!image.startsWith('data:image/png;'))throw new Error(tx('图片导出失败'));
        return image;
      }finally{
        gl.setDrawingBufferSize(width,height,pixelRatio);
        flushSync(()=>setClean(undefined));
        gl.shadowMap.needsUpdate=true;
        invalidate();
      }
    });
    return()=>input.onCaptureReady?.(null);
  },[gl,scene,get,invalidate,input.onCaptureReady]);
  const detailed = props.mode === "3d";
  const stress = props.mode === "3d" && !!props.visual?.stress;
  const showGuides =
    props.mode === "top" || (!!props.visual?.guides && !stress);
  const stressCount = props.visual?.stressCount ?? 3000;
  const testArrays = useMemo(()=>stressPanels(stressCount), [stressCount]);
  const renderArrays = stress ? testArrays : props.arrays;
  const cameras = useMemo(
    () => ({
      top: Object.assign(
        new THREE.OrthographicCamera(-20, 20, 14, -14, 0.1, 500),
        { manual: true },
      ),
      perspective: Object.assign(
        new THREE.PerspectiveCamera(45, 1, 0.1, 1500),
        {
          manual: true,
        },
      ),
    }),
    [],
  );
  const active = props.mode === "top" ? cameras.top : cameras.perspective;
  const view = useRef(viewStart(1.7));
  const lastFitSignal=useRef(props.fitSignal);
  const [planView,setPlanView]=useState<PlanView>(()=>({...view.current}));
  const [pdfView,setPdfView]=useState<PdfViewport>({x:0,y:0,width:1,height:1});
  const fit = () => {
    const v=view.current;
    const {width,height}=get().size;
    if(!width||!height)return;
    const aspect=width/height;
    if (active === cameras.top) {
      const {x,z,span}=v;
      setPlanView(previous=>previous.x===x&&previous.z===z&&previous.span===span?previous:{x,z,span});
      const c = cameras.top;
      c.left = -span*aspect/2;
      c.right = span*aspect/2;
      c.top = v.span / 2;
      c.bottom = -v.span / 2;
      c.position.set(v.x, 400, v.z);
      c.up.set(0, 0, -1);
      latest.current.onScale?.(v.span/height);
      const base=latest.current.baseImage;
      if(base?.frame&&base.metersPerPixel){const f=base.frame,k=base.metersPerPixel;const next={x:(v.x+c.left)/k+f.x+f.width/2,y:(v.z-c.top)/k+f.y+f.height/2,width:(c.right-c.left)/k,height:v.span/k};latest.current.onDrawingView?.({...next,viewportHeight:height});setPdfView(old=>Math.abs(old.x-next.x)+Math.abs(old.y-next.y)+Math.abs(old.width-next.width)+Math.abs(old.height-next.height)<1e-6?old:next);}

    } else {
      cameras.perspective.near = stress ? 2 : latest.current.eyeLevel ? 0.3 : 0.8;
      cameras.perspective.far=Math.max(1500,v.distance*3);
      cameras.perspective.aspect=aspect;
      const p = orbitPosition(v);
      active.position.set(p.x, p.y, p.z);
      active.up.set(0, 1, 0);
    }
    active.lookAt(v.x, active === cameras.top ? 0 : v.target, v.z);
    active.updateProjectionMatrix();
    active.updateMatrixWorld();
    reportNorth();
    invalidate();
  };
  // North on screen: project a one-metre step north from the view centre (north is -z when the drawing is not turned).
  const northOrigin=useRef(new THREE.Vector3()),northStep=useRef(new THREE.Vector3());
  const reportNorth=()=>{
    const v=view.current,n=(latest.current.baseImage?.northAngle??latest.current.visual?.northAngle??0)*Math.PI/180;
    const {width,height}=get().size;
    const a=northOrigin.current.set(v.x,0,v.z).project(active),b=northStep.current.set(v.x+Math.sin(n),0,v.z-Math.cos(n)).project(active);
    latest.current.onNorth?.(Math.atan2((b.x-a.x)*width,(b.y-a.y)*height)*180/Math.PI);
  };
  useEffect(reportNorth,[props.baseImage?.northAngle,props.visual?.northAngle]);
  useLayoutEffect(() => {
    set({ camera: active });
    fit();
  }, [active, size.width, size.height]);
  const framePlan=(aspect:number)=>{
    Object.assign(view.current,fittedPlanView(props.focus,roof,aspect));
    const base=props.baseImage;
    if(base?.metersPerPixel&&!props.sites?.length&&!base.blank){
      const k=base.metersPerPixel,f=base.frame??{x:0,y:0,width:base.width,height:base.height};
      const left=Math.min((-f.x-f.width/2)*k,(props.focus?.x??0)-roof.width/2),right=Math.max((base.width-f.x-f.width/2)*k,(props.focus?.x??0)+roof.width/2);
      const top=Math.min((-f.y-f.height/2)*k,(props.focus?.z??0)-roof.depth/2),bottom=Math.max((base.height-f.y-f.height/2)*k,(props.focus?.z??0)+roof.depth/2);
      view.current.x=(left+right)/2;view.current.z=(top+bottom)/2;
      view.current.span=Math.max((bottom-top)*1.06,(right-left)*1.06/aspect,10);
    }
  };
  useLayoutEffect(() => {
    const {width,height}=get().size;
    const aspect=Math.max(1,width)/Math.max(1,height);
    view.current = viewStart(aspect);
    if (stress) {
      view.current.distance = Math.max(210,stressCount/1000*38+20)*1.7;
      view.current.pitch = 0.88;
    } else if (props.mode === "3d") {
      view.current.distance = 42;
      view.current.pitch = 0.7;
      view.current.yaw = 0.48;
    }
    if (!stress) {
      if(props.mode==='top')framePlan(aspect);
      else Object.assign(view.current,fittedPlanView(props.focus,roof,aspect));
      view.current.distance = Math.max(roof.width, roof.depth) * 1.7;
    }
    if (props.mode === '3d' && props.eyeLevel && !stress) eyeLevel(view.current, true);
    fit();
  }, [props.reset, props.mode, stress,stressCount]);
  useLayoutEffect(()=>{
    if(lastFitSignal.current===props.fitSignal)return;
    lastFitSignal.current=props.fitSignal;
    if(stress)return;
    const {width,height}=get().size;
    if(!width||!height)return;
    if(props.mode==='top')framePlan(width/height);
    else fitOrbitView(view.current,width/height,cameras.perspective.fov,sites,obstacles,props.arrays);
    fit();
  },[props.fitSignal]);
  useLayoutEffect(()=>{
    if(props.mode!=='3d'||stress)return;
    eyeLevel(view.current,!!props.eyeLevel);
    fit();
  },[props.eyeLevel]);
  useLayoutEffect(()=>{
    const r=props.restoreDrawingView,b=props.baseImage;
    if(!r||!b?.frame||!b.metersPerPixel||props.mode!=='top')return;
    const k=b.metersPerPixel,h=Math.max(1,get().size.height);
    view.current.span=r.height*k*h/(r.viewportHeight??h);
    view.current.x=(r.x+r.width/2-b.frame.x-b.frame.width/2)*k;
    view.current.z=(r.y+r.height/2-b.frame.y-b.frame.height/2)*k;
    fit();
  },[props.restoreDrawingView,props.mode]);
  useLayoutEffect(()=>{
    if(!props.viewCommand?.id)return;
    zoomView(view.current,props.viewCommand.factor);
    fit();
  },[props.viewCommand?.id]);
  const benchmark = useRef<{
    start: number;
    last: number;
    measuring: boolean;
    gaps: number[];
    trials: PerformanceTrial[];
  } | null>(null);
  useEffect(() => {
    if (!props.visual?.run || !stress) return;
    benchmark.current = {
      start: performance.now(),
      last: performance.now(),
      measuring: false,
      gaps: [],
      trials: [],
    };
    props.visual.onProgress(tx('第 1/3 轮预热 · 5 秒'));
    invalidate();
    return () => {
      benchmark.current = null;
    };
  }, [props.visual?.run, stress, detailed]);
  useFrame((_, delta) => {
    const b = benchmark.current;
    if (!b) return;
    if (document.hidden) {
      benchmark.current = null;
      latest.current.visual?.onProgress(
        tx('测试已停止：页面进入后台，请保持页面可见后重试。'),
      );
      return;
    }
    view.current.yaw += Math.min(delta, 0.1) * 0.22;
    fit();
    const now = performance.now();
    if (!b.measuring) {
      if (now - b.start >= 5000) {
        b.measuring = true;
        b.start = now;
        b.last = now;
        latest.current.visual?.onProgress(
          tx('第 {0}/3 轮采样 · 20 秒',b.trials.length + 1),
        );
      }
      return;
    }
    b.gaps.push(now - b.last);
    b.last = now;
    if (now - b.start < 20000) return;
    const sorted = [...b.gaps].sort((a, b) => a - b),
      durationMs = now - b.start;
    b.trials.push({
      fps: (1000 * b.gaps.length) / durationMs,
      p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
      frames: b.gaps.length,
      durationMs,
    });
    if (b.trials.length < 3) {
      b.start = now;
      b.measuring = false;
      b.gaps = [];
      latest.current.visual?.onProgress(
        tx('第 {0}/3 轮预热 · 5 秒',b.trials.length + 1),
      );
      return;
    }
    const median = (v: number[]) => v.sort((a, b) => a - b)[1],
      fps = median(b.trials.map((t) => t.fps)),
      p95 = median(b.trials.map((t) => t.p95Ms)),
      context = gl.getContext(),
      ext = context.getExtension("WEBGL_debug_renderer_info"),
      dim = new THREE.Vector2();
    gl.getDrawingBufferSize(dim);
    const report = {
      recordedAt: new Date().toISOString(),
      quality: ({simple:tx('简单'),standard:tx('标准'),fine:tx('精细')} as const)[props.visual?.quality ?? 'standard'],
      panels: stressCount,
      canvas: `${dim.x} × ${dim.y}`,
      renderer: ext
        ? String(context.getParameter(ext.UNMASKED_RENDERER_WEBGL))
        : tx('不可用'),
      webgl: String(context.getParameter(context.VERSION)),
      trials: b.trials,
      medianFps: fps,
      medianP95Ms: p95,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      passed: fps >= 30 && p95 <= 50,
    };
    benchmark.current = null;
    latest.current.visual?.onReport(report);
    latest.current.visual?.onProgress(tx('测试完成 · 3 轮中位数'));
  });
  useEffect(() => {
    const ray = new THREE.Raycaster(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      target = new THREE.Vector3();
    const cast = (x: number, y: number) => {
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((x - r.left) / r.width) * 2 - 1,
          (-(y - r.top) / r.height) * 2 + 1,
        ),
        active,
      );
    };
    return bindPointer(gl.domElement, {
      mode: () => latest.current.mode,
      panMode:()=>latest.current.navigationMode==='pan',
      point: (x, y) => {
        cast(x, y);
        plane.constant = latest.current.mode === 'top' ? 0 : -view.current.target;
        const p = ray.ray.intersectPlane(plane, target);
        return p ? { x: p.x, z: p.z } : null;
      },
      hit: (x, y) => {
        cast(x, y);
        if(latest.current.mode==='top'){
          const w=ray.ray.intersectPlane(plane,target),current=latest.current;if(w){
            if(current.editingOverlay){const tol=(view.current.span/gl.domElement.clientHeight)*10;const chosen=current.imageOverlays?.find(o=>o.id===current.selectedOverlayId&&o.visible);if(chosen){const i=corners(chosen).findIndex(p=>Math.hypot(p.x-w.x,p.z-w.z)<tol);if(i>=0)return '@i/'+chosen.id+'/'+i;}for(const o of [...(current.imageOverlays??[])].reverse()){const dx=w.x-o.x,dz=w.z-o.z,c=Math.cos(o.yaw),s=Math.sin(o.yaw);if(o.visible&&Math.abs(dx*c-dz*s)<=o.width/2&&Math.abs(dx*s+dz*c)<=o.depth/2)return '@i/'+o.id;}return null;}
            const tol=(view.current.span/gl.domElement.clientHeight)*9;
            const local=(r:{x:number;z:number;yaw:number})=>{const dx=w.x-r.x,dz=w.z-r.z,c=Math.cos(r.yaw),sn=Math.sin(r.yaw);return {x:dx*c-dz*sn,z:dx*sn+dz*c};};
            const marker=current.layoutMarker;
            if(marker){
              const badge=coreEdition?layoutMarkerBadge(marker,tol/9):undefined;
              if(badge?Math.hypot(w.x-badge.cx,w.z-badge.cz)<=badge.radius+tol/3:marker.segments.some(([x,z,bx,bz])=>segmentDistance(w,{x,z},{x:bx,z:bz})<tol))return '@d/'+marker.id;
            }
            const marked=current.showPitchMarker&&current.sites?.find(r=>r.id===current.selectedSiteId&&(r.markerPitch||r.pitch?.kind==='single'));
            if(marked&&(marked.markerPitch||marked.pitch)){const p=local(marked);if(pitchSegments(marked.width,marked.depth,(marked.markerPitch??marked.pitch)!).some(([x,z,bx,bz])=>{const dx=bx-x,dz=bz-z,t=Math.max(0,Math.min(1,((p.x-x)*dx+(p.z-z)*dz)/(dx*dx+dz*dz)));return Math.hypot(p.x-x-t*dx,p.z-z-t*dz)<tol;}))return '@p/'+marked.id;}
            const o=[...(current.obstacles??[])].reverse().find(o=>{const p=local(o);return Math.abs(p.x)<=o.width/2&&Math.abs(p.z)<=o.depth/2;});if(o)return '@o/'+o.id;
            const site=current.sites?.find(r=>{const p=local(r);if(r.outline)return r.outline.some((a,i)=>segmentDistance(p,a,r.outline![(i+1)%r.outline!.length])<tol);return Math.abs(p.x)<=r.width/2+tol&&Math.abs(p.z)<=r.depth/2+tol&&(Math.abs(Math.abs(p.x)-r.width/2)<tol||Math.abs(Math.abs(p.z)-r.depth/2)<tol);});if(site)return '@s/'+site.id;
          }
        }
        const hits=ray.intersectObjects(scene.children, true);
        if(latest.current.mode==='3d'){
          for(const h of hits){
            if(!(h.object instanceof THREE.Mesh))continue;
            let cur:THREE.Object3D|null=h.object;
            while(cur){
              if(cur.userData?.objectId)return '@o/'+cur.userData.objectId;
              if(cur.userData?.arrayId)return cur.userData.arrayId;
              if(cur.userData?.siteId)return '@s/'+cur.userData.siteId;
              cur=cur.parent;
            }
          }
          return null;
        }
        const panels=hits.find((h) => h.object instanceof THREE.Mesh && h.object.userData.arrayId)?.object.userData.arrayId ?? null;
        if(panels)return panels;
        // Inside an area (not on its panels): the area itself, so a click picks it and a drag moves it.
        const w=ray.ray.intersectPlane(plane,target);if(!w)return null;
        const inside=[...(latest.current.sites??[])].reverse().find(r=>insidePolygon({x:w.x,z:w.z},corners(r)));
        return inside?'@s/'+inside.id:null;
      },
      position: (id) => {if(id.startsWith('@i/')){const [,key,index]=id.split('/'),o=latest.current.imageOverlays!.find(o=>o.id===key)!;return index===undefined?o:corners(o)[Number(index)];}if(id.startsWith('@s/')||id.startsWith('@p/')||id.startsWith('@d/'))return latest.current.sites?.find(r=>r.id===id.slice(3))??{x:0,z:0};if(id.startsWith('@o/'))return (latest.current.obstacles??[]).find(o=>o.id===id.slice(3))!;return latest.current.arrays.find(a=>a.id===id)!;},
      select: (id,add) => latest.current.onSelect(id,add),
      box:{update:r=>latest.current.onBoxSelect?.update(r),finish:(a,b,add)=>latest.current.onBoxSelect?.finish(a,b,add)},
      edit:id=>latest.current.onEditObject?.(id),
      measure:{active:()=>!!latest.current.measureTool&&latest.current.mode==='top',down:(p,s)=>measureControl.current?.down(p,s),move:(p,s)=>measureControl.current?.move(p,s),finish:()=>measureControl.current?.finish()},
      context:(id,x,y)=>latest.current.onObjectMenu?.(id,x,y),
      move: (id, x, z) => latest.current.onMove(id, x, z),
      pan: (x, z) => {
        if (benchmark.current) return;
        view.current.x += x;
        view.current.z += z;
        fit();
      },
      orbit: (dx, dy) => {
        if (benchmark.current) return;
        orbit(view.current, dx, dy);
        fit();
      },
      zoom: (f) => {
        if (benchmark.current) return;
        zoomView(view.current, f);
        fit();
      },
    });
  }, [active, gl, scene, props.reset, stress]);
  const selectedObjSet=useMemo(()=>new Set([...(props.selectedObjectId?[props.selectedObjectId]:[]),...(props.pickedObjectIds??[]),...(props.selectedObjectIds??[])]),[props.selectedObjectId,props.pickedObjectIds,props.selectedObjectIds]);
  const selectedObjList=useMemo(()=>[...selectedObjSet],[selectedObjSet]);
  return (
    <>
      {detailed ? (
        <Suspense fallback={null}><RealisticScene baseImage={props.baseImage} showRoofShadows={props.showShadows} sunSettings={props.visual?.sunSettings} sunPreviewTime={props.visual?.sunPreviewTime} quality={props.visual?.quality ?? (props.visual?.realistic === false ? 'simple' : 'standard')} northAngle={props.baseImage?.northAngle??props.visual?.northAngle??0} sites={sites} focus={props.focus} backgroundColor={props.visual?.backgroundColor} groundColor={props.visual?.groundColor} showGrid={props.showGrid !== false} selectedSiteId={props.selectedSiteId} pickedSiteIds={props.pickedSiteIds} selectedObjectIds={selectedObjList} arrays={renderArrays} stress={stress} roof={roof} obstacles={obstacles} solarHour={props.solarHour} wallHeight={props.wallHeight} /></Suspense>
      ) : (
        <>
          <color attach="background" args={[props.mode === 'top' && (!props.visual?.backgroundColor || ['#eef1f5','#dce5ec','#f0f1f2'].includes(props.visual.backgroundColor)) ? '#f0f1f2' : (props.visual?.backgroundColor ?? '#f0f1f2')]} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[-10, 25, -15]} intensity={2} />
          {props.mode==='top'&&!stress&&props.showGrid!==false&&<PlanGrid center={{x:props.focus?.x??0,z:props.focus?.z??0}}/>}
          {sites.filter(r=>!r.carport||props.mode==='top'&&!clean).map(r=>r.pitch&&props.mode!=="top"?<group key={r.id} position={[r.x,0,r.z]} rotation={[0,r.yaw,0]}><PitchedMesh site={r} maquette/></group>:<group key={r.id} position={[r.x,0,r.z]} rotation={[0,r.yaw,0]}>{props.mode==='top'&&!showPlanBase&&<mesh position={[0.35,-0.25,0.55]} rotation={[-Math.PI/2,0,0]}><FootprintGeometry roof={r} plane/><meshBasicMaterial color="#d6dbe2" depthWrite={false} toneMapped={false}/></mesh>}<mesh position={[0,props.mode==='top'?-.15:(r.flatHeight??3.5)/2-3.5,0]}><FootprintGeometry roof={r} height={props.mode==='top'?.3:(r.flatHeight??3.5)}/><meshBasicMaterial color={props.mode==='top'?canvasStyle.planRoof:'#e8ecf1'} toneMapped={false}/></mesh></group>)}
        </>
      )}
      {!stress&&props.mode==='top'&&sites.filter(r=>r.id===props.selectedSiteId&&r.layoutArea?.length).map(r=><group key={`layout-area-${r.id}`} position={[r.x,0,r.z]} rotation={[0,r.yaw,0]}><lineLoop renderOrder={10900}><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(r.layoutArea!.flatMap(p=>[p.x,.6,p.z])),3]}/></bufferGeometry><lineBasicMaterial color="#77968b" transparent opacity={.6} depthTest={false} depthWrite={false} toneMapped={false}/></lineLoop></group>)}
      {!stress&&props.mode==='top'&&props.visual?.arrayDimensions&&(()=>{const a=props.arrays.find(a=>a.id===props.selectedId),site=sites.find(r=>a?.id.startsWith(r.id+'/'));return a&&site?<ArrayLocationDimensions array={a} site={site} unit={view.current.span/size.height}/>:null;})()}
      {!stress&&props.mode==='top'&&<>{sites.filter(r=>r.id===props.selectedSiteId||props.pickedSiteIds?.includes(r.id)).map(r=><group key={'selected'+r.id} position={[r.x,0,r.z]} rotation={[0,r.yaw,0]}><Band points={footprintLines(r,.12)} width={view.current.span/size.height*5} color="#ffffff" order={11000}/><Band points={footprintLines(r,.13)} width={view.current.span/size.height*2.4} color="#26292e" order={11001}/></group>)}{obstacles.filter(o=>selectedObjSet.has(o.id)).map(o=><group key={'selected'+o.id} position={[o.x,0,o.z]} rotation={[0,o.yaw,0]}>
        <mesh position={[0,.72,0]} rotation={[-Math.PI/2,0,0]} renderOrder={10950}>
          <planeGeometry args={[o.width,o.depth]}/>
          <meshBasicMaterial color={canvasStyle.planObjectSelectedFill} transparent opacity={.24} depthTest={false} depthWrite={false} toneMapped={false}/>
        </mesh>
        <Band points={outline(o.width,o.depth,.72)} width={view.current.span/size.height*5} color="#ffffff" order={11002}/>
        <Band points={outline(o.width,o.depth,.73)} width={view.current.span/size.height*2.5} color={canvasStyle.planObjectSelectedEdge} order={11003}/>
      </group>)}</>}
      {!stress&&props.mode==='top'&&props.showSiteLabels!==false&&<PlanSiteLabels sites={sites} referenceSites={clean?sites:input.sites??sites} selectedId={props.selectedSiteId} pickedIds={props.pickedSiteIds} view={clean?.planView??planView} fitView={clean?.planView??fittedPlanView(input.focus,roof,size.width/Math.max(1,size.height))} width={size.width} height={size.height}/>}
      {!stress && props.mode === "top" && hasRaster && base && <Suspense fallback={null}><BaseImagePlane base={base} view={pdfView} pixels={base.visible!==false&&base.opacity!==0?size.width:0} visible={showRaster} opacity={(clean&&base.opacity===0?1:base.opacity)??1}/></Suspense>}
      {!stress&&props.mode==='3d'&&!!props.winterCheck?.length&&<WinterCheckOutline points={props.winterCheck}/>}
      {/* Engineering exclusion polygons belong to the plan; 3D receives actual light shadows. */}
      {!stress && props.mode==='top' && props.shadowZones?.map(zone => <ShadowPolygon key={zone.id} overlay points={zone.points} elevation={0} />)}
      {showGuides && (
        <>
          {sites.filter(r=>!clean||!r.carport).map(r=><group key={r.id} position={[r.x,0,r.z]} rotation={[0,r.yaw,0]}>{props.mode==='top'&&(!clean?props.baseImage:showPlanBase)&&<mesh position={[0,.035,0]} rotation={[-Math.PI/2,0,0]}><FootprintGeometry roof={r} plane/><meshBasicMaterial color="#ffffff" transparent opacity={.65} depthWrite={false} toneMapped={false}/></mesh>}<Lines points={footprintLines(r,.025)} color="#94a3b8"/>{r.pitch&&(()=>{
            const p=r.pitch;
            if(p.kind==='gable'){
              const [x,z,bx,bz]=gableRidgeLine(r.width,r.depth,p.axis);
              return <Lines points={[x,.04,z,bx,.04,bz]} color={canvasStyle.planRidge} opacity={.68}/>;
            }
            const t=p.high*(p.axis==='z'?r.depth:r.width)/2;
            return <Lines points={p.axis==='z'?[-r.width/2,.04,t,r.width/2,.04,t]:[t,.04,-r.depth/2,t,.04,r.depth/2]} color="#d97706"/>;
          })()}</group>)}
        </>
      )}
      {!detailed &&
        !stress &&
        obstacles.filter(o=>o.kind!=="keepout").map((o) => {
          const palette=planElementColours[o.topLayout?'annex':'obstacle'];
          return (
          <group key={o.id} position={[o.x, props.mode==="top"?0:o.baseHeight??0, o.z]} rotation={[0, o.yaw, 0]}>
            <mesh position={[0, props.mode==="top"?.09:o.height / 2, 0]}>
              <boxGeometry args={[o.width, props.mode==="top"?.16:o.height, o.depth]} />
              <meshBasicMaterial color={props.mode==='top'?palette.fill:'#f0f2f5'} toneMapped={false}/>
            </mesh>
            <Lines
              points={outline(o.width, o.depth, props.mode==="top"?.18:o.height + 0.01)}
              color={props.mode==='top'?palette.edge:canvasStyle.planEdge}
            />
          </group>
        );})}
      {!stress&&props.mode==='top'&&obstacles.filter(o=>o.kind==='keepout').map(o=><group key={o.id} position={[o.x,0,o.z]} rotation={[0,o.yaw,0]}><mesh position={[0,.24,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[o.width,o.depth]}/><meshBasicMaterial color={planElementColours.keepout.fill} transparent opacity={.20} depthWrite={false} toneMapped={false}/></mesh><Lines points={outline(o.width,o.depth,.25)} color={planElementColours.keepout.edge} opacity={.4}/></group>)}
      {!stress&&props.mode==='top'&&<group visible={!clean||clean.includeBase}>{props.imageOverlays?.map((item,index)=><OverlayImage key={item.id} item={item} index={index} selected={!!props.editingOverlay&&item.id===props.selectedOverlayId} unit={view.current.span/size.height}/>)}</group>}
      {!stress&&props.mode==='top'&&props.layoutMarker&&<LayoutDirectionMark marker={props.layoutMarker} unit={view.current.span/size.height} tone={props.directionMarkerColor}/>}
      {!clean&&!stress&&props.mode==='top'&&sites.filter(r=>r.carport&&!r.carport.double&&r.markerPitch).map(r=>{const [x,z,bx,bz]=carportColumnEdge(r.width,r.depth,r.markerPitch!),u=view.current.span/size.height,cx=(x+bx)/2,cz=(z+bz)/2,n=Math.hypot(cx,cz)||1,out=u*3;/* just outside the edge, so panels never cover it */return <group key={'column-'+r.id} position={[r.x,0,r.z]} rotation={[0,r.yaw,0]}><group position={[cx+cx/n*out,0,cz+cz/n*out]} rotation={[0,-Math.atan2(bz-z,bx-x),0]}><PitchStroke length={Math.hypot(bx-x,bz-z)} unit={u} tone={canvasStyle.planColumnEdge} opacity={.68}/></group></group>;})}
      {!stress&&props.mode==='top'&&props.showPitchMarker&&sites.filter(r=>r.id===props.selectedSiteId&&(r.markerPitch||r.pitch?.kind==='single')).map(r=><group key={'pitch-'+r.id} position={[r.x,0,r.z]} rotation={[0,r.yaw,0]}>{pitchSegments(r.width,r.depth,(r.markerPitch??r.pitch)!).map(([x,z,bx,bz],i)=><group key={i} position={[(x+bx)/2,0,(z+bz)/2]} rotation={[0,-Math.atan2(bz-z,bx-x),0]}><PitchStroke length={Math.hypot(bx-x,bz-z)} unit={view.current.span/size.height} tone={props.directionMarkerColor}/></group>)}</group>)}
      {!stress&&<MeasureLayer control={measureControl} visible={props.mode==='top'&&!clean} tool={props.mode==='top'?props.measureTool??null:null} clear={props.measureClear??0} shapes={measureShapes} onCount={props.onMeasureCount}/>}
      {!detailed&&props.mode!=='top'&&<CarportSupports arrays={renderArrays}/>}
      {!detailed &&
        renderArrays.map((a) => (
          props.mode==='top'?<TopArray map={topCells} key={a.id} a={a} selected={props.selectedId===a.id} conflict={props.issues.some(i=>i.ids.includes(a.id))}/>:<ArrayMesh
            key={a.id}
            a={a}
            selected={props.selectedId === a.id}
            conflict={props.issues.some((i) => i.ids.includes(a.id))}
            mode={props.mode}
            guides={showGuides}
          />
        ))}
      {detailed &&
        showGuides && !clean &&
        props.arrays.map((a) => {
          const g = geometry(a);
          return (
            <group key={a.id} position={[a.x, 0, a.z]} rotation={[0, g.yaw, 0]}>
              <Lines
                points={outline(g.width, g.depth)}
                color={
                  props.issues.some((i) => i.ids.includes(a.id))
                    ? "#cc392c"
                    : "#db8b22"
                }
              />
              <Lines points={direction(g.depth)} color="#be7313" />
            </group>
          );
        })}
    </>
  );
}
export default function ThreeView(props: ViewProps) {
  return (
    <Canvas className="workbench-canvas" dpr={1} shadows frameloop="demand" gl={{ antialias: true }}>
      <Scene {...props} />
    </Canvas>
  );
}
