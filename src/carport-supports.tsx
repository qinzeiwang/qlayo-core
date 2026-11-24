import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import * as T from 'three';
import type {PVArray} from './domain';
import {carportMaterials,carportParts,disposeCarportParts} from './carport-parts';
function Parts({geometry:g,material,matrices,shadow=true}:{geometry:T.BufferGeometry;material:T.Material;matrices:T.Matrix4[];shadow?:boolean}){
 const ref=useRef<T.InstancedMesh>(null);
 useLayoutEffect(()=>{if(!ref.current)return;matrices.forEach((m,i)=>ref.current!.setMatrixAt(i,m));ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();},[matrices]);
 if(!matrices.length)return null;
 return <instancedMesh ref={ref} args={[g,material,matrices.length]} castShadow={shadow} receiveShadow/>;
}
/** Carport steel as seen from the ground: white H frames, C purlins, water channels, gutters, tie rods, tubes, base plates and panel junction boxes. */
export function CarportSupports({arrays}:{arrays:PVArray[]}){
 const parts=useMemo(()=>carportParts(arrays),[arrays]);
 useEffect(()=>()=>disposeCarportParts(parts),[parts]);
 const materials=useMemo(carportMaterials,[]);
 useEffect(()=>()=>Object.values(materials).forEach(m=>m.dispose()),[materials]);
 if(!parts.length)return null;
 return <group>{parts.map(p=><Parts key={p.name} geometry={p.geometry} material={materials[p.finish]} matrices={p.matrices} shadow={p.shadow}/>)}</group>;
}
