import {useEffect,useMemo} from 'react';
import type {Point} from './domain';
import * as THREE from 'three';

/** One opaque surface: work-area tint is shading, never a second almost-coplanar mesh. */
export function DesignGroundMaterial({background,ground,width,depth,outline,centerX=0,centerZ=0}:{background:string;ground:string;width:number;depth:number;outline?:Point[];centerX?:number;centerZ?:number}){
 const material=useMemo(()=>{
  const m=new THREE.MeshBasicMaterial({color:background,toneMapped:false});
  m.onBeforeCompile=shader=>{
   shader.uniforms.workColor={value:new THREE.Color(ground)};
   shader.uniforms.workHalfSize={value:new THREE.Vector2(width/2,depth/2)};
   shader.uniforms.workVertices={value:Array.from({length:64},(_,i)=>{
    const point=outline?.[i];
    return point?new THREE.Vector2(point.x-centerX,centerZ-point.z):new THREE.Vector2();
   })};
   shader.uniforms.workVertexCount={value:outline?.length??0};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vGroundLocal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundLocal=position.xy;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vGroundLocal;\nuniform vec3 workColor;\nuniform vec2 workHalfSize;\nuniform vec2 workVertices[64];\nuniform int workVertexCount;').replace('#include <color_fragment>',`#include <color_fragment>
    vec2 edgeDistance=workHalfSize-abs(vGroundLocal);
    float coverage=smoothstep(-fwidth(vGroundLocal.x),fwidth(vGroundLocal.x),edgeDistance.x)*smoothstep(-fwidth(vGroundLocal.y),fwidth(vGroundLocal.y),edgeDistance.y);
    if(workVertexCount>=3){
     bool inside=false;
     float edge=1e10;
     vec2 previous=workVertices[workVertexCount-1];
     for(int i=0;i<64;i++){
      if(i>=workVertexCount)break;
      vec2 next=workVertices[i],vector=next-previous,delta=vGroundLocal-previous;
      float t=clamp(dot(delta,vector)/max(dot(vector,vector),1e-12),0.0,1.0);
      edge=min(edge,length(delta-t*vector));
      if((previous.y>vGroundLocal.y)!=(next.y>vGroundLocal.y)&&vGroundLocal.x<previous.x+(vGroundLocal.y-previous.y)*vector.x/vector.y)inside=!inside;
      previous=next;
     }
     float stroke=max(max(fwidth(vGroundLocal.x),fwidth(vGroundLocal.y)),1e-5);
     coverage=smoothstep(-stroke,stroke,inside?edge:-edge);
    }
    diffuseColor.rgb=mix(diffuseColor.rgb,workColor,coverage);
   `);
  };
  m.customProgramCacheKey=()=> 'pvlane-single-design-ground-v2';
  return m;
 },[background,ground,width,depth,outline,centerX,centerZ]);
 useEffect(()=>()=>material.dispose(),[material]);
 return <primitive object={material} attach="material"/>;
}
