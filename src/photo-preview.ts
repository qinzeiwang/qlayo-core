import * as T from 'three';
import {photoGlassRoughness} from './photo-material';
import {drawPictureMark} from './picture-mark';
import {photoOutputSize} from './photo-output';
import {Sky} from 'three/addons/objects/Sky.js';
import {channelGeometry,instanceData,panelTexture} from './realistic';
import {referenceCells,referenceGlass} from './pv-material';
import {sunPosition} from './sun-position';
import {photoRoofVertices,photoRoofArrays,photoRoofObjects} from './photo-roof';
import {gableCustomShell} from './gable-geometry';
import {fitPhotoCamera} from './photo-camera';
import {GROUND,solvePhotoCamera,solvePointCamera,type PhotoCamera} from './photo-solve';
import {carportMeshes} from './carport-parts';
import {defaultPhotoShadowStrength,editOf,photoPanelColors,type PhotoView,type PhotoRenderOptions,type SitePoint} from './photo-match';
import {corners,type PVArray} from './domain';
import {projectBounds,roofRect,sceneData,worldObstacle,type RoofDesign} from './roof-project';
import {tx} from './i18n';
/** What a photo render puts in the scene: hidden photo surfaces (they only hide panels and catch shadows), panels, and carport steel. */
type Stage={surface:(geometry:T.BufferGeometry,position?:T.Vector3,yaw?:number,receiveShadow?:boolean)=>void;arrays:(arrays:PVArray[])=>void;carport:(arrays:PVArray[])=>void};
type Setup={camera:T.PerspectiveCamera;sun:T.Vector3;daylight:boolean;elevation:number;center:T.Vector3;span:number;rmse:number;build:(stage:Stage)=>void};
// Pinhole projection in WebGL convention with an off-centre principal point (docs/PHOTO-CAMERA-MATCHING.md §11).
function projection(camera:T.PerspectiveCamera,f:number,cx:number,cy:number,W:number,H:number,near:number,far:number){
 camera.projectionMatrix.set(2*f/W,0,1-2*cx/W,0,0,2*f/H,2*cy/H-1,0,0,0,-(far+near)/(far-near),-2*far*near/(far-near),0,0,-1,0);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
/** Renders the panels of the selected roof (four-corner views) or of the whole site (point and line views) over the photograph. */
export async function renderPhotoPreview(m:PhotoView,r:RoofDesign,options:PhotoRenderOptions,northAngle=0,roofs:RoofDesign[]=[r],sites:SitePoint[]=[],renderAtTargetSize=false){
 return renderOverPhoto(m,options,m.method==='lines'||m.method==='points'?siteSetup(m,roofs,options,northAngle,sites):roofSetup(m,r,options,northAngle),renderAtTargetSize);
}
/** A three.js camera that sees what the solved photo camera sees: OpenCV axes (right, down, forward) flipped to three.js (right, up, back). */
export function threeCamera(c:PhotoCamera,W:number,H:number,near:number,far:number){
 const camera=new T.PerspectiveCamera(),{R,C}=c,t=R.map(row=>-(row[0]*C[0]+row[1]*C[1]+row[2]*C[2]));camera.matrixAutoUpdate=false;
 camera.matrixWorld.set(R[0][0],R[0][1],R[0][2],t[0],-R[1][0],-R[1][1],-R[1][2],-t[1],-R[2][0],-R[2][1],-R[2][2],-t[2],0,0,0,1).invert();camera.matrix.copy(camera.matrixWorld);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
 projection(camera,c.f,c.cx,c.cy,W,H,near,far);return camera;
}
function roofSetup(m:PhotoView,r:RoofDesign,options:PhotoRenderOptions,northAngle:number):Setup{
 if(r.roof.outline)throw Error(tx('多段线屋面请使用点位对应。'));
 if(r.carport)throw Error(tx('车棚请使用线条定位。'));
 if(!r.arrays.length)throw Error(tx('当前屋面还没有组件，请先完成布置。'));
 const fit=fitPhotoCamera(editOf(m),r.roof.width,r.roof.depth,r.pitch);
 const camera=new T.PerspectiveCamera(),{R,t,f,principal:[cx,cy]}=fit;camera.matrixAutoUpdate=false;
 camera.matrixWorld.set(R[0][0],R[0][2],-R[0][1],t[0],-R[1][0],-R[1][2],R[1][1],-t[1],-R[2][0],-R[2][2],R[2][1],-t[2],0,0,0,1).invert();camera.matrix.copy(camera.matrixWorld);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
 const objects=photoRoofObjects(r),objectTop=Math.max(0,...objects.map(o=>o.baseHeight+o.height));
 const distance=Math.hypot(...t),extent=Math.max(r.roof.width,r.roof.depth,objectTop)*2;projection(camera,f,cx,cy,m.width,m.height,Math.max(.1,distance-extent),distance+extent*2);
 const sunVector=sunPosition(options.sun),sun=new T.Vector3(sunVector.x,sunVector.y,sunVector.z).applyAxisAngle(new T.Vector3(0,1,0),-northAngle*Math.PI/180-r.yaw);
 return {camera,sun,daylight:sunVector.daylight,elevation:sunVector.elevation,center:new T.Vector3(),span:Math.max(r.roof.width,r.roof.depth,objectTop),rmse:fit.rmse,build:stage=>{
  const roof=new T.BufferGeometry();roof.setAttribute('position',new T.BufferAttribute(photoRoofVertices(r.roof.width,r.roof.depth,r.pitch),3));roof.computeVertexNormals();stage.surface(roof);
  for(const o of objects)stage.surface(new T.BoxGeometry(o.width,o.height,o.depth),new T.Vector3(o.x,o.baseHeight+o.height/2,o.z),o.yaw);
  stage.arrays(photoRoofArrays(r));
 }};
}
// A horizontal receiver at `top`, or vertical occluders from `bottom` to `top`.
function footprintSurface(points:{x:number;z:number}[],top:number,bottom?:number){
 const position:number[]=[];
 if(bottom===undefined)for(const tri of T.ShapeUtils.triangulateShape(points.map(p=>new T.Vector2(p.x,p.z)),[]))for(const i of tri)position.push(points[i].x,top,points[i].z);
 if(bottom!==undefined)points.forEach((p,i)=>{const q=points[(i+1)%points.length];position.push(p.x,bottom,p.z,q.x,bottom,q.z,q.x,top,q.z,p.x,bottom,p.z,q.x,top,q.z,p.x,top,p.z);});
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.computeVertexNormals();return geometry;
}
/** Point and line views: one camera for the whole site in world coordinates, so every roof and carport appears where the plan puts it. */
function siteSetup(m:PhotoView,roofs:RoofDesign[],options:PhotoRenderOptions,northAngle:number,sites:SitePoint[]):Setup{
 const {camera:solved,missing}=m.method==='points'?solvePointCamera(m,sites):solvePhotoCamera(m);if(!solved)throw Error(missing[0]??tx('相机尚未确定'));
 const {arrays}=sceneData(roofs);if(!arrays.length)throw Error(tx('当前屋面还没有组件，请先完成布置。'));
 const bounds=projectBounds(roofs),center=new T.Vector3(bounds.x,GROUND,bounds.z),span=Math.max(bounds.width,bounds.depth)/2+15,ground=Math.max(1000,span*8);
 const camera=threeCamera(solved,m.width,m.height,.3,Math.hypot(solved.C[0]-center.x,solved.C[1]-center.y,solved.C[2]-center.z)+ground);
 const sunVector=sunPosition(options.sun,northAngle);
 return {camera,sun:new T.Vector3(sunVector.x,sunVector.y,sunVector.z),daylight:sunVector.daylight,elevation:sunVector.elevation,center,span,rmse:solved.rmse,build:stage=>{
  const carportsOnly=roofs.every(r=>r.carport);
  if(carportsOnly){
   const plane=new T.PlaneGeometry(ground,ground);
   plane.rotateX(-Math.PI/2);
   stage.surface(plane,center.clone());
  }
  for(const r of roofs){
   const outline=corners(roofRect(r));
   if(r.carport){
    if(!carportsOnly&&r.arrays.length)stage.surface(footprintSurface(outline,GROUND));
   }else{
    const top=r.pitch?r.pitch.eave-3.5:(r.flatHeight??3.5)-3.5;
    // Keep the walls for depth occlusion. The actual roof is the receiver.
    if(r.pitch?.kind==='gable'&&(r.pitch.spans||r.roof.outline)){
     const walls=new T.BufferGeometry();
     walls.setAttribute('position',new T.Float32BufferAttribute(gableCustomShell(r.roof,r.pitch,0).walls,3));
     walls.computeVertexNormals();
     stage.surface(walls,new T.Vector3(r.x,0,r.z),r.yaw,false);
    }else stage.surface(footprintSurface(outline,top,GROUND),undefined,0,false);
    if(r.pitch){
     const roof=new T.BufferGeometry();
     roof.setAttribute('position',new T.BufferAttribute(photoRoofVertices(r.roof.width,r.roof.depth,r.pitch,r.roof.outline),3));
     roof.computeVertexNormals();
     stage.surface(roof,new T.Vector3(r.x,top,r.z),r.yaw);
    }else stage.surface(footprintSurface(outline,top));
   }
   for(const o of r.obstacles){if(o.kind==='keepout')continue;const w=worldObstacle(o,r),base=w.baseHeight??GROUND;stage.surface(new T.BoxGeometry(w.width,w.height,w.depth),new T.Vector3(w.x,base+w.height/2,w.z),w.yaw);}
  }
  stage.arrays(arrays);stage.carport(arrays);
 }};
}
async function renderOverPhoto(m:PhotoView,options:PhotoRenderOptions,setup:Setup,renderAtTargetSize:boolean){
 const simple=options.quality==='simple',fine=options.quality==='fine',overcast=options.weather==='overcast',{camera,center,span}=setup;
 const photo=new Image();photo.src=m.url;await photo.decode();
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true}),scene=new T.Scene();let environment:T.WebGLRenderTarget|undefined;const textures:T.Texture[]=[];
 try{
 const gl=renderer.getContext(),deviceLimit=Math.min(renderer.capabilities.maxTextureSize,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),...Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array));
 const {width:W,height:H}=photoOutputSize(m.width,m.height,options,deviceLimit,renderAtTargetSize);
 renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.shadowMap.enabled=!simple&&!overcast;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;
 const direction=setup.sun;
 scene.add(new T.HemisphereLight(0xf2f2ef,0xaaa9a5,overcast?2.5:1.15));const sun=new T.DirectionalLight(0xfff0db,overcast||!setup.daylight?0:2.6);sun.position.copy(center).addScaledVector(direction,span*2);sun.target.position.copy(center);scene.add(sun.target);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:.1,far:span*5});sun.shadow.mapSize.set(fine?4096:2048,fine?4096:2048);sun.shadow.normalBias=.008;scene.add(sun);
 const sky=new Sky();sky.material.uniforms.sunPosition.value.copy(direction);sky.material.uniforms.turbidity.value=5;sky.scale.setScalar(1000);const env=new T.Scene();if(overcast)env.background=new T.Color(0xc8cdd2);else env.add(sky);const pmrem=new T.PMREMGenerator(renderer);environment=pmrem.fromScene(env);scene.environment=environment.texture;scene.environmentIntensity=overcast?1.1:.35;pmrem.dispose();sky.geometry.dispose();sky.material.dispose();
 // Existing geometry occludes the overlay and receives module shadows. Its own shadows are already in the photo.
 function surface(geometry:T.BufferGeometry,position=new T.Vector3(),yaw=0,receiveShadow=true){
  const depth=new T.Mesh(geometry,new T.MeshBasicMaterial({colorWrite:false,side:T.DoubleSide}));
  depth.position.copy(position);depth.rotation.y=yaw;depth.renderOrder=-1;scene.add(depth);
  if(receiveShadow&&!simple&&!overcast){
   const receiver=new T.Mesh(geometry.clone(),new T.ShadowMaterial({color:0x202020,opacity:options.shadowStrength??defaultPhotoShadowStrength,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
   receiver.position.copy(position);receiver.rotation.y=yaw;receiver.receiveShadow=true;scene.add(receiver);
  }
 }
 const roughness=fine?photoGlassRoughness():undefined;if(roughness)textures.push(roughness);
 function add(items:{matrix:T.Matrix4}[],material:T.Material,{plane=false,castShadow=false,profile}:{plane?:boolean;castShadow?:boolean;profile?:T.BufferGeometry}={}){if(!items.length){material.dispose();profile?.dispose();return;}const mesh=new T.InstancedMesh(profile??(plane?new T.PlaneGeometry():new T.BoxGeometry()),material,items.length);items.forEach((v,i)=>mesh.setMatrixAt(i,v.matrix));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=castShadow;mesh.receiveShadow=true;scene.add(mesh);}
 function arrays(list:PVArray[]){
  const data=instanceData(list),map=fine?referenceCells(options.panelFinish):panelTexture(),horizontal=map.clone();horizontal.center.set(.5,.5);horizontal.rotation=Math.PI/2;horizontal.needsUpdate=true;textures.push(map,horizontal);map.anisotropy=horizontal.anisotropy=renderer.capabilities.getMaxAnisotropy();
  add(data.frames,new T.MeshStandardMaterial({color:0xaeb8bf,metalness:.82,roughness:.3}),{castShadow:true});const glass=(texture:T.Texture)=>{const material=simple?new T.MeshLambertMaterial({color:0x242424}):fine?referenceGlass(texture):new T.MeshPhysicalMaterial({map:texture,color:0xaaa9a6,roughness:.3,metalness:0,clearcoat:.35,clearcoatRoughness:.25,envMapIntensity:.3});material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;if(fine&&material instanceof T.MeshPhysicalMaterial){material.color.set(0xaaa9a6);material.roughness=.28;material.roughnessMap=roughness!;material.clearcoatRoughnessMap=roughness!;material.envMapIntensity=.4;material.clearcoat=.6;material.clearcoatRoughness=.15;}if(options.panelFinish==='charcoal'&&!fine&&!options.panelColor)material.color.multiplyScalar(.78);
  if(options.panelColor){
   const tint=new T.Color(photoPanelColors[options.panelColor].tint);
   if(simple&&options.panelColor==='blueBlack')tint.set('#242424');
   else if(simple)tint.multiply(new T.Color('#242424'));
   material.color.copy(tint);
  }
  material.color.multiplyScalar(options.brightness??1);
  if(options.reflection!==undefined&&material instanceof T.MeshPhysicalMaterial){
   const strength=options.reflection*2;
   material.envMapIntensity*=strength;
   material.clearcoat=Math.min(1,material.clearcoat*strength);
   material.specularIntensity=strength;
  }
  return material;};add(data.portrait,glass(map),{plane:true});add(data.landscape,glass(horizontal),{plane:true});const steel=()=>new T.MeshStandardMaterial({color:0x8e9caa,metalness:.72,roughness:.42});
  add(data.steel,steel());
  add(data.purlins,steel(),{profile:channelGeometry(.041)});
  add(data.rafters,steel(),{profile:channelGeometry(.052)});
  add(data.channels,steel(),{profile:channelGeometry(.052)});
  add(data.pads,new T.MeshStandardMaterial({color:0x716f69,roughness:.97,envMapIntensity:.15}));
 }
 setup.build({surface,arrays,carport:list=>carportMeshes(list).forEach(mesh=>{mesh.castShadow=false;scene.add(mesh);})});
 renderer.render(scene,camera);const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d')!;ctx.imageSmoothingQuality='high';ctx.drawImage(photo,0,0,W,H);ctx.drawImage(renderer.domElement,0,0);for(const polygon of m.occlusions??[]){ctx.save();ctx.beginPath();polygon.forEach((p,i)=>{const x=p.x*W/m.width,y=p.y*H/m.height;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.clip();ctx.drawImage(photo,0,0,W,H);ctx.restore();}drawPictureMark(ctx,W,H);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error(tx('图片导出失败'))),'image/png'));sun.shadow.dispose();return {url:URL.createObjectURL(blob),rmse:setup.rmse,width:W,height:H,settingsKey:JSON.stringify(options),sunElevation:setup.elevation};
 }finally{scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});textures.forEach(texture=>texture.dispose());environment?.dispose();renderer.dispose();renderer.forceContextLoss();}
}
