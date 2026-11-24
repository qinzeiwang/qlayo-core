import {useEffect,useMemo} from 'react';
import {BufferGeometry,EdgesGeometry,Float32BufferAttribute} from 'three';
import type {SceneSite} from './domain';
import {flatRoofShell} from './flat-roof-shell';
import {MaquetteWallMaterial} from './maquette-material';
import {contactFacadeCuts,trimHostEdges,trimHostTop,type ContactSolid} from './roof-contact-geometry';

export function FlatRoofShellMesh({site,selected,showShadows,attached}:{site:SceneSite;selected:boolean;showShadows:boolean;attached?:ContactSolid[]}){
 const shell=useMemo(()=>flatRoofShell(site,site.flatHeight??3.5,site.wallHeight),[site.width,site.depth,site.outline,site.flatHeight,site.wallHeight]);
 const contactGeometry=useMemo(()=>{
  if(!attached?.length)return;
  const cuts=contactFacadeCuts(shell.outer,attached,shell.top-3.5);
  const split=cuts?flatRoofShell(site,shell.height,site.wallHeight,cuts):undefined;
  const faces=trimHostTop((split?.geometry??shell.geometry).getAttribute('position').array,attached,-3.5);
  split?.geometry.dispose();split?.roofGeometry.dispose();
  const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(faces,3));
  geometry.computeVertexNormals();
  return geometry;
 },[shell,attached,site]);
 const edges=useMemo(()=>{
  const original=new EdgesGeometry(shell.geometry,28);
  if(!attached?.length)return original;
  const trimmed=trimHostEdges(original.getAttribute('position').array,attached,-3.5);
  original.dispose();
  return new BufferGeometry().setAttribute('position',new Float32BufferAttribute(trimmed,3));
 },[shell,attached]);
 useEffect(()=>()=>{shell.geometry.dispose();shell.roofGeometry.dispose();},[shell]);
 useEffect(()=>()=>contactGeometry?.dispose(),[contactGeometry]);
 useEffect(()=>()=>edges.dispose(),[edges]);
 return <group position={[0,-3.5,0]}>
  <mesh geometry={contactGeometry??shell.geometry} castShadow receiveShadow userData={{siteId:site.id}}><MaquetteWallMaterial/></mesh>
  <lineSegments geometry={edges}><lineBasicMaterial color={selected?'#6b8a94':'#969e9c'} transparent opacity={selected?.40:.22} depthWrite={false} toneMapped={false}/></lineSegments>
  {showShadows&&<mesh geometry={shell.roofGeometry} receiveShadow renderOrder={12}>
   <shadowMaterial color="#777d79" opacity={.20} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
  </mesh>}
 </group>;
}
