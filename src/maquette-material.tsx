import {createContext,useContext,useEffect,useMemo} from 'react';
import * as THREE from 'three';
export const MaquetteSunContext=createContext({x:-.5,y:.8,z:-.4});
/** Stable, neutral face shading used only by the design canvas, not delivery rendering.
 * Works for boxes, pitched walls and extruded footprints without changing geometry groups.
 */
export function MaquetteWallMaterial({doubleSide=false}:{doubleSide?:boolean}) {
 const sun=useContext(MaquetteSunContext);
 const material=useMemo(()=>{
  const m=new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,side:doubleSide?THREE.DoubleSide:THREE.FrontSide});
  m.onBeforeCompile=shader=>{
   shader.uniforms.studySun={value:new THREE.Vector3(sun.x,sun.y,sun.z).normalize()};
   shader.uniforms.studyLight={value:new THREE.Color('#dededb')};
   shader.uniforms.studyDark={value:new THREE.Color('#a2a4a2')};
   shader.uniforms.studyTop={value:new THREE.Color('#fafbf9')};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStudyNormal;').replace('void main() {','void main() {\nvStudyNormal=mat3(modelMatrix)*normal;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vStudyNormal;\nuniform vec3 studySun;\nuniform vec3 studyLight;\nuniform vec3 studyDark;\nuniform vec3 studyTop;').replace('#include <color_fragment>',`#include <color_fragment>
    vec3 studyNormal=normalize(vStudyNormal);
    #ifdef DOUBLE_SIDED
     studyNormal*=gl_FrontFacing?1.0:-1.0;
    #endif
    float studyExposure=clamp(0.5+0.5*dot(studyNormal,studySun),0.0,1.0);
    vec3 studyColor=mix(studyDark,studyLight,studyExposure);
    studyColor=mix(studyColor,studyTop,smoothstep(0.55,0.95,studyNormal.y));
    diffuseColor.rgb=studyColor;
   `);
  };
  m.customProgramCacheKey=()=> 'pvlane-sun-maquette-v2';
  return m;
 },[doubleSide,sun.x,sun.y,sun.z]);
 useEffect(()=>()=>material.dispose(),[material]);
 return <primitive object={material} attach="material"/>;
}
