import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {canvasStyle} from './canvas-style';

const vertexShader=`
varying vec2 vWorldXZ;
void main(){
 vec4 wp=modelMatrix*vec4(position,1.0);
 vWorldXZ=wp.xz;
 gl_Position=projectionMatrix*viewMatrix*wp;
}`;

const gridFragment=`
uniform vec3 uMinorColor;
uniform vec3 uMajorColor;
uniform float uMinorOpacity;
uniform float uMajorOpacity;
uniform float uMinorStep;
uniform float uMajorStep;
uniform vec2 uCenter;
uniform float uFadeStart;
uniform float uFadeEnd;
varying vec2 vWorldXZ;

float gridLine(vec2 coord,float stepSize,float width){
 vec2 p=coord/stepSize;
 vec2 grid=abs(fract(p-0.5)-0.5)/max(fwidth(p),vec2(0.00001));
 return 1.0-smoothstep(0.0,width,min(grid.x,grid.y));
}

void main(){
 vec2 df=fwidth(vWorldXZ/uMinorStep);
 float cellPixels=1.0/max(max(df.x,df.y),0.00001);
 // Suppress subpixel cells before they shimmer or alias at low oblique angles.
 float minorVisibility=smoothstep(8.0,18.0,cellPixels);
 float minor=gridLine(vWorldXZ,uMinorStep,0.75)*uMinorOpacity*minorVisibility;
 float major=gridLine(vWorldXZ,uMajorStep,0.95)*uMajorOpacity;
 float minorDistFade=1.0;
 float majorDistFade=1.0;
 if(uFadeEnd>uFadeStart){
  float dist=length(vWorldXZ-uCenter);
  minorDistFade=1.0-smoothstep(uFadeStart*0.6,uFadeEnd*(135.0/190.0),dist);
  majorDistFade=1.0-smoothstep(uFadeStart,uFadeEnd,dist);
 }
 float minorAlpha=minor*minorDistFade;
 float majorAlpha=major*majorDistFade;
 float alpha=max(minorAlpha,majorAlpha);
 if(alpha<=0.002)discard;
 vec3 col=mix(uMinorColor,uMajorColor,clamp(majorAlpha/(max(minorAlpha,majorAlpha)+1e-5),0.0,1.0));
 gl_FragColor=vec4(col,alpha);
 #include <colorspace_fragment>
}`;

function makeGridMaterial(opts:{minorColor:string;majorColor:string;minorOpacity:number;majorOpacity:number;minorStep:number;majorStep:number;fadeStart?:number;fadeEnd?:number}){
 return new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader:gridFragment,
  transparent:true,
  depthWrite:false,
  polygonOffset:true,
  polygonOffsetFactor:-2,
  polygonOffsetUnits:-2,
  toneMapped:false,
  uniforms:{
   uMinorColor:{value:new THREE.Color(opts.minorColor)},
   uMajorColor:{value:new THREE.Color(opts.majorColor)},
   uMinorOpacity:{value:opts.minorOpacity},
   uMajorOpacity:{value:opts.majorOpacity},
   uMinorStep:{value:opts.minorStep},
   uMajorStep:{value:opts.majorStep},
   uCenter:{value:new THREE.Vector2(0,0)},
   uFadeStart:{value:opts.fadeStart??0},
   uFadeEnd:{value:opts.fadeEnd??0},
  },
 });
}

/** Crisp anti-aliased orthographic coordinate grid (2 m minor / 10 m major) for the 2D plan canvas. */
export function PlanGrid({center}:{center:{x:number;z:number}}){
 const material=useMemo(()=>makeGridMaterial({
  minorColor:canvasStyle.minorGrid,
  majorColor:canvasStyle.majorGrid,
  minorOpacity:0.36,
  majorOpacity:0.63,
  minorStep:2,
  majorStep:10,
 }),[]);
 useEffect(()=>()=>material.dispose(),[material]);
 return <mesh position={[center.x,-0.35,center.z]} rotation={[-Math.PI/2,0,0]} renderOrder={-500} material={material}>
  <planeGeometry args={[12000,12000]}/>
 </mesh>;
}

/** Radial-fading 3D grid, blending 2/10/50/... metre levels with camera distance. */
export function GroundGrid({center,radius}:{center:{x:number;z:number};radius:number}){
 const material=useMemo(()=>makeGridMaterial({
  minorColor:canvasStyle.minorGrid,
  majorColor:canvasStyle.majorGrid,
  minorOpacity:0.36,
  majorOpacity:0.48,
  minorStep:2,
  majorStep:10,
  fadeStart:100*Math.max(1,radius/495),
  fadeEnd:190*Math.max(1,radius/495),
 }),[radius]);
 const updateGrid=(renderer:THREE.WebGLRenderer,_scene:THREE.Scene,camera:THREE.Camera)=>{
  // Keep visible cells roughly 32–160 screen pixels apart as the camera zooms.
  const distance=Math.hypot(camera.position.x-center.x,camera.position.y+3.55,camera.position.z-center.z);
  const unitsPerPixel=camera instanceof THREE.PerspectiveCamera
   ? 2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,renderer.domElement.clientHeight)
   : 1;
  const level=Math.max(0,Math.log(Math.max(2,unitsPerPixel*32)/2)/Math.log(5));
  const whole=Math.floor(level),blend=level-whole,step=2*Math.pow(5,whole);
  material.uniforms.uMinorStep.value=step;
  material.uniforms.uMajorStep.value=step*5;
  material.uniforms.uMinorOpacity.value=.42*(1-blend);
  material.uniforms.uMajorOpacity.value=.42*blend;
 };
 useEffect(()=>{material.uniforms.uCenter.value.set(center.x,center.z);},[material,center.x,center.z]);
 useEffect(()=>()=>material.dispose(),[material]);
 return <mesh position={[center.x,-3.55,center.z]} rotation={[-Math.PI/2,0,0]} renderOrder={20} material={material} onBeforeRender={updateGrid}>
  <planeGeometry args={[radius*2.2,radius*2.2]}/>
 </mesh>;
}
