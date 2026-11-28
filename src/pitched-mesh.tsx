import {useMemo,useEffect} from 'react';
import {BufferAttribute,BufferGeometry,DoubleSide,EdgesGeometry,Float32BufferAttribute} from 'three';
import type {SceneSite} from './domain';
import {factorySpec,factoryDoorSide} from './factory-spec';
import {factoryRoofTexture} from './factory-material';
import type {MetalRoofFinish} from './render-material-options';
import {MaquetteWallMaterial} from './maquette-material';
import {canvasStyle} from './canvas-style';
import {gableParapetShell,pitchSkinOffset} from './gable-parapet';
import {gableCustomShell,gableOuterLoop,gablePlanLines} from './gable-geometry';
import {insetRoof} from './flat-roof-shell';
import {roofHeight} from './pitched-roof';
import {trimHostEdges,trimHostTop,type ContactSolid} from './roof-contact-geometry';
const colors={wall:'#f6f7f8',frame:'#475569',glass:'#334155',door:'#cbd5e1',canopy:'#cbd5e1',steel:'#94a3b8'};
const maquetteColors={wall:'#d4d8de',frame:'#64748b',glass:'#999f9e',door:'#e2e5ea',canopy:'#e5e8ec',steel:'#969c9c'};
export function PitchedMesh({site:r,northAngle=0,roofFinish='varied',maquette=false,showShadows=false,selected=false,siteId,attached}:{site:SceneSite;northAngle?:number;roofFinish?:MetalRoofFinish;maquette?:boolean;showShadows?:boolean;selected?:boolean;siteId?:string;attached?:ContactSolid[]}){
 const customGable=r.pitch?.kind==='gable'&&(!!r.outline||!!r.pitch.spans);
 const hasParapet=maquette&&r.pitch?.kind==='gable'&&r.wallHeight>0;
 const spec=useMemo(()=>{
  if(customGable){
   const {top,walls,uv,length,span}=gableCustomShell(r,r.pitch!,maquette?r.wallHeight:0);
   return {roof:top,walls,uv,boxes:[],length,span};
  }
  if(hasParapet){
   const {top,walls}=gableParapetShell(r,r.pitch!,r.wallHeight);
   return {roof:top,walls,uv:[],boxes:[],length:r.width,span:r.depth};
  }
  return factorySpec(r.width,r.depth,r.pitch!,factoryDoorSide(r.pitch!.axis,r.yaw,northAngle),{openings:!maquette});
 },[r.width,r.depth,r.outline,r.pitch,r.wallHeight,r.yaw,northAngle,maquette,hasParapet,customGable]);
 const texture=useMemo(()=>maquette?null:factoryRoofTexture(spec.length,spec.span,roofFinish,false),[spec.length,spec.span,roofFinish,maquette]);
 useEffect(()=>()=>texture?.dispose(),[texture]);

  const {roofGeo,wallGeo,roofEdges,wallEdges,gableRidges,gableGutters}=useMemo(()=>{
  const rg=new BufferGeometry();
  rg.setAttribute('position',new Float32BufferAttribute(spec.roof,3));
  if(spec.uv.length)rg.setAttribute('uv',new BufferAttribute(new Float32Array(spec.uv),2));
  rg.computeVertexNormals();
  const wg=new BufferGeometry();
  wg.setAttribute('position',new Float32BufferAttribute(spec.walls,3));
  wg.computeVertexNormals();
  const outline=(mesh:BufferGeometry,angle=28)=>{
   if(!maquette)return null;
   const edges=new EdgesGeometry(mesh,angle);
   if(!attached?.length)return edges;
   const trimmed=trimHostEdges(edges.getAttribute('position').array,attached);
   edges.dispose();
   return new BufferGeometry().setAttribute('position',new Float32BufferAttribute(trimmed,3));
  };
  let re:BufferGeometry|null,we:BufferGeometry|null;
  if(hasParapet){
   const shell=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([...spec.roof,...spec.walls],3));
   re=outline(shell,5);we=null;
   shell.dispose();
  }else{re=outline(rg);we=outline(wg);}
  // Explicit 3D ridge and interior gutter crease lines for all gable and multi-span roofs (independent of low slope angle).
  let ridgeGeo:BufferGeometry|null=null,gutterGeo:BufferGeometry|null=null;
  if(maquette&&r.pitch?.kind==='gable'){
   const planFootprint=hasParapet
    ?{width:r.width,depth:r.depth,outline:insetRoof(gableOuterLoop(r),.2).inner}
    :!customGable
     ?{width:r.pitch.axis==='z'?r.width+.5:r.width,depth:r.pitch.axis==='x'?r.depth+.5:r.depth}
     :r;
   const {ridges,gutters}=gablePlanLines(planFootprint,r.pitch);
   const lift=(p:{x:number;z:number}):[number,number,number]=>[p.x,roofHeight(r,r.pitch!,p.x,p.z)+pitchSkinOffset+.015,p.z];
   const makeLine=(segs:[{x:number;z:number},{x:number;z:number}][])=>{
    if(!segs.length)return null;
    const raw=new Float32Array(segs.flatMap(([a,b])=>[...lift(a),...lift(b)]));
    const pts=attached?.length?trimHostEdges(raw,attached):raw;
    return pts.length?new BufferGeometry().setAttribute('position',new Float32BufferAttribute(pts,3)):null;
   };
   ridgeGeo=makeLine(ridges);
   gutterGeo=makeLine(gutters);
  }
  if(maquette&&attached?.length){
   rg.setAttribute('position',new Float32BufferAttribute(trimHostTop(spec.roof,attached),3));
   rg.deleteAttribute('uv');
   rg.deleteAttribute('normal');
   rg.computeVertexNormals();
  }
  return {roofGeo:rg,wallGeo:wg,roofEdges:re,wallEdges:we,gableRidges:ridgeGeo,gableGutters:gutterGeo};
 },[spec.roof,spec.uv,spec.walls,maquette,attached,hasParapet,customGable,r]);

 useEffect(()=>()=>{roofGeo.dispose();wallGeo.dispose();roofEdges?.dispose();wallEdges?.dispose();gableRidges?.dispose();gableGutters?.dispose();},[roofGeo,wallGeo,roofEdges,wallEdges,gableRidges,gableGutters]);

 const palette=maquette?maquetteColors:colors;
 const edgeColor=selected?'#6b8a94':'#969e9c';
 const edgeOpacity=selected?0.48:0.24;
 const ridgeColor=selected?'#567985':'#7b848e';
 const gutterColor=selected?'#567985':'#88929c';
 const pickData=siteId?{siteId}:undefined;

 return <group>
  <mesh geometry={roofGeo} castShadow receiveShadow userData={pickData}>
   {maquette?<meshBasicMaterial color={r.shadingOnly?canvasStyle.maquetteShadingRoof:canvasStyle.roof} toneMapped={false} side={DoubleSide}/>:<meshPhysicalMaterial map={texture} color={r.shadingOnly?'#9aa3ad':'#ffffff'} roughness={.39} metalness={.12} clearcoat={.22} clearcoatRoughness={.27} side={DoubleSide}/>}
  </mesh>
  {maquette&&showShadows&&<mesh geometry={roofGeo} receiveShadow renderOrder={12}>
   <shadowMaterial color="#777d79" opacity={0.20} depthWrite={false} side={DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
  </mesh>}
  <mesh geometry={wallGeo} castShadow receiveShadow userData={pickData}>
   {maquette?<MaquetteWallMaterial doubleSide shading={!!r.shadingOnly}/>:<meshStandardMaterial color={r.shadingOnly?'#adb5be':palette.wall} roughness={.88} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} side={DoubleSide}/>}
  </mesh>
  {maquette&&roofEdges&&<lineSegments geometry={roofEdges}><lineBasicMaterial color={edgeColor} transparent opacity={edgeOpacity} toneMapped={false} depthWrite={false}/></lineSegments>}
  {maquette&&wallEdges&&<lineSegments geometry={wallEdges}><lineBasicMaterial color={edgeColor} transparent opacity={edgeOpacity} toneMapped={false} depthWrite={false}/></lineSegments>}
  {maquette&&gableRidges&&<lineSegments geometry={gableRidges} renderOrder={4}><lineBasicMaterial color={ridgeColor} transparent opacity={selected?.60:.46} toneMapped={false} depthWrite={false}/></lineSegments>}
  {maquette&&gableGutters&&<lineSegments geometry={gableGutters} renderOrder={4}><lineBasicMaterial color={gutterColor} transparent opacity={selected?.54:.40} toneMapped={false} depthWrite={false}/></lineSegments>}
  {spec.boxes.map((b,i)=><mesh key={i} position={b.position} castShadow receiveShadow userData={pickData}>
   <boxGeometry args={b.size}/>
   {maquette?<meshBasicMaterial color={palette[b.material]} toneMapped={false}/>:<meshStandardMaterial color={palette[b.material]} roughness={b.material==='glass'?.35:b.material==='canopy'?.72:.85} metalness={b.material==='steel'?.65:0}/>}
  </mesh>)}
 </group>;
}
