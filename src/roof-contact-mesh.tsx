import {useEffect,useMemo} from 'react';
import {BufferGeometry,DoubleSide,Float32BufferAttribute} from 'three';
import {MaquetteWallMaterial} from './maquette-material';
import {roofKeepout,roofObstacle,type ContactSolid,type RoofContact} from './roof-contact-geometry';
import {corners} from './domain';
import {planElementColours} from './canvas-style';

export function RoofContactMesh({contact,object,selected}:{contact:RoofContact;object:ContactSolid;selected:boolean}){
 const keepout=object.kind==='keepout';
 const [faces,edges]=useMemo(()=>{
  const data=keepout?roofKeepout(contact,corners(object)):roofObstacle(contact,object);
  const faces=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(data.faces,3));
  if(!keepout)faces.computeVertexNormals();
  return [faces,new BufferGeometry().setAttribute('position',new Float32BufferAttribute(data.edges,3))];
 },[contact,object,keepout]);
 useEffect(()=>()=>{faces.dispose();edges.dispose();},[faces,edges]);
 return <>
  <mesh geometry={faces} castShadow={!keepout} receiveShadow={!keepout} userData={{objectId:object.id}} renderOrder={keepout?13:0}>
   {keepout?<meshBasicMaterial color={planElementColours.keepout.fill} side={DoubleSide} transparent opacity={selected?.32:.18}
    depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>:<MaquetteWallMaterial/>}
  </mesh>
  <lineSegments geometry={edges} renderOrder={keepout?14:0}>
   <lineBasicMaterial color={selected?'#6b8a94':keepout?planElementColours.keepout.edge:'#969e9c'} transparent
    opacity={keepout?selected?.65:.35:selected?.50:.24} depthWrite={false} toneMapped={false}/>
  </lineSegments>
 </>;
}
