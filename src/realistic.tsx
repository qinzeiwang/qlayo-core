import {SceneReady} from './scene-ready';
import {footprintLines} from './footprint-mesh';
import {maxRoofHeight} from './pitched-roof';
import {sunPosition,type SunSettings} from './sun-position';
import { CarportSupports } from './carport-supports';
import { PitchedMesh } from './pitched-mesh';
import { GroundGrid } from './canvas-grid';
import {MaquetteWallMaterial,MaquetteSunContext} from './maquette-material';
import {baseImageWorldOutline,type BaseImage} from './base-image';
import {DesignGroundMaterial} from './design-ground-material';
import {FlatRoofShellMesh} from './flat-roof-shell-mesh';
import {contactSolid,roofContact,type ContactSolid,type RoofContact} from './roof-contact-geometry';
import {RoofContactMesh} from './roof-contact-mesh';
import {flatFoundationGrid,FLAT_PAD_SIZE} from './flat-foundations';
import { winterSun } from "./solar";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as T from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { referenceCells, referenceGlass } from './pv-material';
import type { RenderQuality } from './render-options';
import type {PanelFinish,MetalRoofFinish} from './render-material-options';
import { defaultModule, geometry, initial, type PVArray,type SceneSite } from "./domain";
import {tx} from './i18n';

// Synthetic material study: no product photograph, remote texture or model required.
export function panelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#282a2d";
  c.fillRect(0, 0, 512, 1024);
  for (let row = 0; row < 12; row++)
    for (let col = 0; col < 6; col++) {
      const x = col * 84 + 5,
        y = row * 84 + 9,
        w = 79,
        h = 78;
      c.fillStyle = `rgb(${25 + ((row + col) % 3)},${27 + ((row + col) % 3)},${29 + ((row + col) % 3)})`;
      c.beginPath();
      c.roundRect(x, y, w, h, 5);
      c.fill();
      c.strokeStyle = "rgba(150,153,157,.32)";
      c.lineWidth = 0.7;
      for (let k = 1; k < 13; k++) {
        c.beginPath();
        c.moveTo(x + 2, y + (k * h) / 13);
        c.lineTo(x + w - 2, y + (k * h) / 13);
        c.stroke();
      }
      c.strokeStyle = "rgba(183,187,191,.60)";
      c.lineWidth = 0.95;
      for (let k = 1; k <= 3; k++) {
        c.beginPath();
        c.moveTo(x + (k * w) / 4, y + 2);
        c.lineTo(x + (k * w) / 4, y + h - 2);
        c.stroke();
      }
    }
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function roofTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!,
    data = ctx.createImageData(512, 512);
  let seed = 47;
  for (let i = 0; i < data.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = ((seed >>> 24) / 255) * 12;
    data.data[i] = 140 + n;
    data.data[i + 1] = 142 + n;
    data.data[i + 2] = 136 + n;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  ctx.strokeStyle = "rgba(90,96,91,.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 510, 510);
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}
export const thousandPanels = (): PVArray[] =>
  Array.from({ length: 10 }, (_, i) => ({
    ...initial,
    id: `stress-${i}`,
    name: tx('测试阵列 {0}',i + 1),
    rows: 10,
    columns: 10,
    x: ((i % 5) - 2) * 19,
    z: (Math.floor(i / 5) - 0.5) * 38,
  }));
export const stressPanels = (count: number): PVArray[] => Array.from({length: count / 100}, (_,i)=>({
  ...initial,id:`stress-${i}`,name:tx('测试阵列 {0}',i+1),rows:10,columns:10,
  x:((i%10)-4.5)*19,z:(Math.floor(i/10)-(count/1000-1)/2)*38,
}));
type Instance = { matrix: T.Matrix4 };
const matrix = (
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  q = new T.Quaternion(),
) =>
  new T.Matrix4().compose(new T.Vector3(x, y, z), q, new T.Vector3(sx, sy, sz));
// Unit-length channel, with a 41 mm web and 2 mm material thickness.
export function channelGeometry(depth: number) {
  const web = .002 / .041, lip = .002 / depth;
  const shape = new T.Shape();
  shape.moveTo(-.5, -.5);
  shape.lineTo(.5, -.5);
  shape.lineTo(.5, .5);
  shape.lineTo(.5 - web, .5);
  shape.lineTo(.5 - web, -.5 + lip);
  shape.lineTo(-.5 + web, -.5 + lip);
  shape.lineTo(-.5 + web, .5);
  shape.lineTo(-.5, .5);
  shape.closePath();
  return new T.ExtrudeGeometry(shape, {depth: 1, bevelEnabled: false})
    .rotateX(-Math.PI / 2).translate(0, -.5, 0);
}
// The template runs along +Y and opens toward -Z. Lay the beams in
// the table plane with their openings facing the upper side of that plane.
const slopeChannel = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2);
const crossChannel = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 2).multiply(slopeChannel);
const PURLIN_SIZE = .041;
const RACK_CHANNEL_DEPTH = .052;
const PURLIN_OVERHANG = .15;
const RAFTER_INSET = .10;
const PURLIN_Y = -.035/2-PURLIN_SIZE/2;
const RAFTER_Y = PURLIN_Y-PURLIN_SIZE/2-RACK_CHANNEL_DEPTH/2;
const RAFTER_BOTTOM = RAFTER_Y-RACK_CHANNEL_DEPTH/2;

export function instanceData(arrays: PVArray[]) {
  const frames: Instance[] = [],
    portrait: Instance[] = [],
    landscape: Instance[] = [],
    steel: Instance[] = [],
    purlins: Instance[] = [],
    rafters: Instance[] = [],
    channels: Instance[] = [],
    pads: Instance[] = [];
  for (const a of arrays) {
    const g = geometry(a),
      tilt = new T.Quaternion().setFromEuler(new T.Euler(g.tilt,0,g.roll)),
      root = matrix(
        a.x,
        0,
        a.z,
        1,
        1,
        1,
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), g.yaw),
      );
    for (const p of g.panels) {
      const local = new T.Matrix4().compose(
          new T.Vector3(p.x, p.y + (!a.surface && !a.mounting && a.frontHeight===undefined ? .15 : 0), p.z),
          tilt,
          new T.Vector3(1, 1, 1),
        ),
        world = root.clone().multiply(local);
      frames.push({
        matrix: world.clone().multiply(matrix(0, 0, 0, g.w, 0.035, g.l)),
      });
      // Horizontal UVs rotate with orientation instead of stretching the cell pattern.
      const backRotation = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2);
      const glassRotation = new T.Quaternion().setFromAxisAngle(
        new T.Vector3(1, 0, 0),
        -Math.PI / 2,
      );
      const glass = world
        .clone()
        .multiply(
          matrix(0, 0.022, 0, g.w - 0.034, g.l - 0.034, 1, glassRotation),
        );
      (a.portrait ? portrait : landscape).push({ matrix: glass });
      // Carports are seen from below: show the cells through the back glass, as bifacial modules look on site.
      if (a.mounting === 'carport') (a.portrait ? portrait : landscape).push({ matrix: world.clone().multiply(matrix(0, -0.019, 0, g.w - 0.034, g.l - 0.034, 1, backRotation)) });
      if(a.mounting === 'carport' && !a.surface) {
      for (const z of [-g.l * 0.32, g.l * 0.32]) {
        steel.push({matrix: world.clone().multiply(matrix(0, -.054, z, g.w + .018, .045, .065))});
      }
      for (const x of [-g.w * 0.34, g.w * 0.34])
      for (const z of [-g.l * 0.32, g.l * 0.32]) {
          const target = new T.Vector3(x, -0.08, z).applyMatrix4(local),
            h = Math.max(0.08, target.y - (a.elevation??0) - 0.09);
          steel.push({
            matrix: root
              .clone()
              .multiply(
                matrix(target.x, (a.elevation??0) + 0.09 + h / 2, target.z, 0.045, h, 0.045),
              ),
          });
          pads.push({
            matrix: root
              .clone()
              .multiply(matrix(target.x, (a.elevation??0) + 0.045, target.z, 0.24, 0.09, 0.28)),
          });
        }
      }
    }
    if (!a.surface && !a.mounting) {
      const groups = a.connectedRows ? 1 : a.rows;
      const rows = a.connectedRows ? a.rows : 1;
      const gap = (a.module??defaultModule).gap;
      const length = rows * g.l + (rows - 1) * gap;
      const rafterInset = Math.max(RAFTER_INSET, Math.abs(RAFTER_BOTTOM*Math.tan(g.tilt)) + .005);
      const rafterLength = Math.max(0, length - 2*rafterInset);
      const {xs,zs}=flatFoundationGrid(g.width,length*Math.cos(g.tilt),rows);
      for (let group = 0; group < groups; group++) {
        const center = a.connectedRows ? new T.Vector3(0, (a.elevation ?? 0) + (a.frontHeight??.45) + (a.tableHeightOffset??0) + length / 2 * Math.sin(g.tilt), 0)
          : new T.Vector3(0, g.panels[group * a.columns].y + (a.frontHeight===undefined?.15:0), g.panels[group * a.columns].z);
        const padHeight=a.frontHeight===undefined?.3:Math.min(.3,a.frontHeight-.14);
        const table = root.clone().multiply(matrix(center.x, center.y, center.z, 1, 1, 1, tilt));
        for (let row = 0; row < rows; row++) {
          const rowZ = row * (g.l + gap) + (g.l - length)/2;
          for (const offset of [-.32*g.l, .32*g.l]) {
            purlins.push({matrix: table.clone().multiply(matrix(0, PURLIN_Y, rowZ + offset, PURLIN_SIZE, g.width + 2*PURLIN_OVERHANG, PURLIN_SIZE, crossChannel))});
          }
        }
        for (const x of xs) {
          if (rafterLength) {
            rafters.push({matrix: table.clone().multiply(matrix(x, RAFTER_Y, 0, .041, rafterLength, RACK_CHANNEL_DEPTH, slopeChannel))});
          }
        }
        for (const offset of zs) {
          // Intersect the vertical column axis with the bottom of the rafter.
          const z = center.z + offset;
          const y = center.y - offset*Math.tan(g.tilt) + RAFTER_BOTTOM/Math.cos(g.tilt);
          for (const x of xs) {
            const base = a.elevation ?? 0;
            const h = Math.max(.01,y - base - padHeight);
            channels.push({matrix: root.clone().multiply(matrix(x, base + padHeight + h / 2, z, .041, h, .052))});
            pads.push({matrix: root.clone().multiply(matrix(x, base + padHeight/2, z, FLAT_PAD_SIZE, padHeight, FLAT_PAD_SIZE))});
          }
        }
      }
    }
  }
  return { frames, portrait, landscape, steel, purlins, rafters, channels, pads };
}
function Instances({
  data,
  shape = "box",
  profile,
  material,
  shadow = true,
}: {
  data: Instance[];
  shape?: "box" | "plane";
  profile?: T.BufferGeometry;
  material: T.Material;
  shadow?: boolean;
}) {
  const ref = useRef<T.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    data.forEach((v, i) => ref.current!.setMatrixAt(i, v.matrix));
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [data]);
  if (!data.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, data.length]}
      material={material}
      castShadow={shadow}
      receiveShadow
    >
      {profile ? <primitive object={profile} attach="geometry" /> : shape === "box" ? (
        <boxGeometry args={[1, 1, 1]} />
      ) : (
        <planeGeometry args={[1, 1]} />
      )}
    </instancedMesh>
  );
}
function BoxEdges({width,height,depth,color,opacity}:{width:number;height:number;depth:number;color:string;opacity:number}){
 const geo=useMemo(()=>{const b=new T.BoxGeometry(width,height,depth),e=new T.EdgesGeometry(b,28);b.dispose();return e;},[width,height,depth]);
 useEffect(()=>()=>geo.dispose(),[geo]);
 return <lineSegments geometry={geo}><lineBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} depthWrite={false}/></lineSegments>;
}
export function RealisticScene({
  quality = 'standard',
  delivery = false,
  panelFinish, metalRoofFinish = 'varied',
  arrays,
  stress,
  solarHour = 11, northAngle=0, sunSettings,sunPreviewTime,
  backgroundColor = "#f0f1f2",
  groundColor = "#e4e6e7",
  wallHeight = 0.32,
  showGrid = true,
  showRoofShadows = true,
  baseImage,
  selectedSiteId,
  pickedSiteIds,
  selectedObjectIds,
  roof,
  obstacles,
  sites,
  focus = {x:0,z:0},
}: {
  quality?: RenderQuality;
  delivery?:boolean;panelFinish?:PanelFinish;metalRoofFinish?:MetalRoofFinish;
  sites?: import("./domain").SceneSite[];
  focus?: {x:number;z:number};
  arrays: PVArray[];
  stress: boolean;
  solarHour?: number; northAngle?:number; sunSettings?:SunSettings; sunPreviewTime?:string|null;
  backgroundColor?: string;
  groundColor?: string;
  wallHeight?: number;
  showGrid?: boolean;
  showRoofShadows?: boolean;
  baseImage?:BaseImage;
  selectedSiteId?: string;
  pickedSiteIds?: string[];
  selectedObjectIds?: string[];
  roof: { width: number; depth: number };
  obstacles: import("./domain").Obstacle[];
}) {
  const { gl, scene, invalidate } = useThree();
  const span = stress ? 210 : roof.width,
    depth = stress ? Math.ceil(arrays.length/10)*38+20 : roof.depth;
  const environmentSun=useMemo(()=>{
    if(sunSettings)return sunPosition(sunSettings,northAngle);
    const source=winterSun(solarHour),north=northAngle*Math.PI/180;
    return {...source,x:source.x*Math.cos(north)-source.z*Math.sin(north),z:source.x*Math.sin(north)+source.z*Math.cos(north)};
  },[solarHour,sunSettings,northAngle]);
  // The direct light moves during playback. Keep the environment map cached until the user settles on a time.
  const sun=sunSettings&&sunPreviewTime?sunPosition({...sunSettings,time:sunPreviewTime},northAngle):environmentSun;
  const center=stress?{x:0,z:0}:focus;
  const sunLight=useRef<T.DirectionalLight>(null);
  const lightTarget=useMemo(()=>new T.Object3D(),[]);

  const surfaces:import("./domain").SceneSite[]=stress||!sites?[{id:"roof",name:tx('屋面'),x:0,z:0,yaw:0,width:span,depth,wallHeight}]:sites;
  const contacts=useMemo(()=>{
    const hosts=new Map<string,{site:SceneSite;contact:RoofContact;objects:ContactSolid[];solids:ContactSolid[]}>();
    if(delivery||stress||!sites)return hosts;
    for(const site of sites){
      const objects=obstacles.filter(object=>object.id.startsWith(site.id+'/')).map(object=>contactSolid(object,site));
      if(objects.length)hosts.set(site.id,{site,contact:roofContact(site),objects,solids:objects.filter(object=>object.kind!=='keepout')});
    }
    return hosts;
  },[sites,obstacles,delivery,stress]);
  const attachedIds=useMemo(()=>new Set([...contacts.values()].flatMap(contact=>contact.objects.map(object=>object.id))),[contacts]);
  const maxHeight=Math.max(0,...surfaces.map(r=>r.pitch?maxRoofHeight(r,r.pitch)+(r.pitch.kind==='gable'&&!delivery?r.wallHeight:0):(r.flatHeight??3.5)-3.5+r.wallHeight),...obstacles.map(o=>(o.baseHeight??0)+o.height));
  const targetHeight=(maxHeight-3.5)/2;
  lightTarget.position.set(center.x,targetHeight,center.z);
  const data = useMemo(() => instanceData(arrays), [arrays]);
  const resources = useMemo(() => {
    const cells = quality === 'fine' ? referenceCells(panelFinish) : panelTexture(),
      horizontal = cells.clone();
    horizontal.needsUpdate = true;
    horizontal.center.set(0.5, 0.5);
    horizontal.rotation = Math.PI / 2;
    const roofMap = roofTexture();
    const glass = (map: T.Texture) =>
      quality === 'simple' ? new T.MeshLambertMaterial({color:'#282a2d'}) : quality === 'fine' ? referenceGlass(map) : new T.MeshPhysicalMaterial({
        map,
        color: "#d5d5d5",
        roughness: 0.28,
        metalness: 0.16,
        clearcoat: 0.45,
        clearcoatRoughness: 0.25,
        envMapIntensity: 0.45,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
    return {
      cells,
      horizontal,
      roofMap,
      glass: glass(cells),
      glassHorizontal: glass(horizontal),
      aluminum: new T.MeshStandardMaterial({
        color: "#aeb8bf",
        metalness: 0.82,
        roughness: 0.3,
      }),
      steel: new T.MeshStandardMaterial({
        color: "#8e9caa",
        metalness: 0.72,
        roughness: 0.42,
      }),
      purlinProfile: channelGeometry(.041),
      channelProfile: channelGeometry(.052),
      pad: new T.MeshStandardMaterial({ color: "#a6a39b", roughness: 0.97, metalness: 0 }),
    };
  }, [quality,delivery,span,depth,panelFinish]);
  useEffect(
    () => () => {
      Object.values(resources).forEach((v) => v?.dispose());
    },
    [resources],
  );
  useLayoutEffect(() => {
    resources.roofMap.repeat.set(span / 4, depth / (delivery?6:4));
  }, [resources, span, depth]);
  useEffect(() => {
    if (quality === 'simple') {
      const old = scene.environment;
      scene.environment = null;
      invalidate();
      return () => { scene.environment = old; };
    }
    const sky = new Sky(),
      envScene = new T.Scene();
    sky.scale.setScalar(450);
    const u = sky.material.uniforms;
    u.turbidity.value = 5;
    u.rayleigh.value = 1.5;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.set(environmentSun.x, environmentSun.y, environmentSun.z);
    envScene.add(sky);
    const generator = new T.PMREMGenerator(gl),
      target = generator.fromScene(envScene, 0.04, 0.1, 1000);
    const old = scene.environment;
    scene.environment = target.texture;
    scene.environmentIntensity = 0.35;
    let cancelled = false;
    let hdrTarget: T.WebGLRenderTarget | undefined;
    scene.userData.deliveryEnvironmentReady = quality !== 'fine';
    if (quality === 'fine') {
      new RGBELoader().load(`${import.meta.env.BASE_URL}textures/outdoor-sky-2k.hdr`, texture => {
        if (cancelled) { texture.dispose(); return; }
        hdrTarget = generator.fromEquirectangular(texture);
        texture.dispose();
        scene.environment = hdrTarget.texture;
        scene.environmentIntensity = .5;
        scene.userData.deliveryEnvironmentReady = true;
        gl.shadowMap.needsUpdate = true;
        invalidate();
      }, undefined, () => { scene.userData.deliveryEnvironmentReady = true; invalidate(); });
    }
    invalidate();
    return () => {
      cancelled = true;
      hdrTarget?.dispose();
      scene.environment = old;
      scene.environmentIntensity = 1;
      target.dispose();
      generator.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
    };
  }, [gl, scene, invalidate, environmentSun,quality]);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    invalidate();
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl, invalidate, arrays, stress, obstacles, span, depth, solarHour,sunSettings,northAngle, wallHeight, sites,quality]);
  useLayoutEffect(()=>{const light=sunLight.current;if(light){light.shadow.camera.updateProjectionMatrix();lightTarget.updateMatrixWorld(true);light.updateMatrixWorld(true);gl.shadowMap.needsUpdate=true;invalidate();}},[span,depth,maxHeight,quality,lightTarget,gl,invalidate,environmentSun,sunPreviewTime,showRoofShadows]);
  useEffect(() => { invalidate(); }, [backgroundColor, groundColor, invalidate]);
  const workOutline=useMemo(()=>baseImageWorldOutline(baseImage),[baseImage]);
  const workSpan=workOutline?.reduce((size,point)=>Math.max(size,2*Math.abs(point.x-center.x),2*Math.abs(point.z-center.z)),0)??0;
  const extent = Math.max(Math.hypot(span,depth,maxHeight+3.5)*.6,10),
    lightScale = Math.max(1, Math.max(span, depth,maxHeight+3.5) / 30);
  return (
    <MaquetteSunContext.Provider value={sun}>
      <SceneReady/>
      <color attach="background" args={[backgroundColor]} />
      <fog
        attach="fog"
        args={[backgroundColor, Math.max(span,depth)*2.2, Math.max(span,depth)*6.5]}
      />
      <hemisphereLight args={["#ffffff", delivery?"#94a3b8":"#bac7dc", delivery?0.72:1.2]} />
      <primitive object={lightTarget}/>
      <directionalLight
        ref={sunLight}
        target={lightTarget}
        color={delivery?"#fff6e8":"#ffffff"}
        intensity={sun.y>0?(delivery?2.4:1.6):0}
        position={[center.x + sun.x * 60 * lightScale, targetHeight+sun.y * 60 * lightScale, center.z + sun.z * 60 * lightScale]}
        key={quality}
        castShadow={showRoofShadows && quality !== 'simple' && sun.y>0}
        shadow-mapSize={quality === 'fine' ? [4096,4096] : [2048,2048]}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={100 * lightScale}
        shadow-bias={-0.00015}
        shadow-normalBias={0.025}
      />
      <mesh
        position={[center.x, delivery?-3.7:-3.55, center.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow={delivery}
      >
        {/* Reaches past the fog's far end (8 x size) so the ground edge never shows. */}
        <planeGeometry args={[Math.max(600,workSpan+1,Math.max(span,depth)*24), Math.max(600,workSpan+1,Math.max(span,depth)*24)]} />
        {delivery?<meshBasicMaterial color="#f5f5f5" toneMapped={false}/>:<DesignGroundMaterial background={backgroundColor} ground={groundColor} width={span+40} depth={depth+40} outline={workOutline} centerX={center.x} centerZ={center.z}/>}
      </mesh>
      {!delivery&&<mesh position={[center.x,-3.55,center.z]} rotation={[-Math.PI/2,0,0]} receiveShadow renderOrder={10}>
        <planeGeometry args={[Math.max(600,workSpan+1,Math.max(span,depth)*24), Math.max(600,workSpan+1,Math.max(span,depth)*24)]} />
        <shadowMaterial color="#777d79" opacity={0.22} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
      </mesh>}
      {!delivery&&!stress&&showGrid&&<GroundGrid center={center} radius={Math.max(120,Math.max(span,depth)*4.5)}/>}
      {surfaces.filter(r=>!r.carport).map(r=>{
        const siteSel=!delivery&&!stress&&(r.id===selectedSiteId||!!pickedSiteIds?.includes(r.id));

        return <group key={r.id} position={[r.x,0,r.z]} rotation={[0,r.yaw,0]}>
        {r.pitch?<PitchedMesh site={r} northAngle={northAngle} roofFinish={metalRoofFinish} maquette={!delivery} showShadows={showRoofShadows} selected={siteSel} siteId={r.id} attached={contacts.get(r.id)?.solids}/>:<FlatRoofShellMesh site={r} selected={siteSel} showShadows={showRoofShadows} attached={contacts.get(r.id)?.solids}/>}
       {siteSel&&<lineLoop><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(footprintLines({...r,width:r.width+0.8,depth:r.depth+0.8},-3.495)),3]}/></bufferGeometry><lineBasicMaterial color="#2d7f9f" transparent opacity={0.85} toneMapped={false}/></lineLoop>}
      </group>;})}
      {!delivery&&!stress&&surfaces.filter(r=>r.carport).map(r=>{
        const siteSel=r.id===selectedSiteId||!!pickedSiteIds?.includes(r.id);
        return <group key={'carport-pick-'+r.id} position={[r.x,0,r.z]} rotation={[0,r.yaw,0]}>
         <mesh position={[0,-3.5+r.carport!.clearance+0.25,0]} rotation={[-Math.PI/2,0,0]} userData={{siteId:r.id}}>
          <planeGeometry args={[r.width,r.depth]}/>
          <meshBasicMaterial transparent opacity={0} depthWrite={false}/>
         </mesh>
         {siteSel&&<lineLoop><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(footprintLines({...r,width:r.width+0.8,depth:r.depth+0.8},-3.495)),3]}/></bufferGeometry><lineBasicMaterial color="#2d7f9f" transparent opacity={0.85} toneMapped={false}/></lineLoop>}
        </group>;
      })}
      <CarportSupports arrays={arrays}/>
      {/* Frames are full thin module slabs: they already provide the complete panel
          silhouette with a single instanced shadow draw. No extra shadow mesh/map. */}
      <Instances data={data.frames} material={resources.aluminum} shadow={quality!=='simple'}/>
      <Instances
        data={data.portrait}
        shape="plane"
        material={resources.glass}
        shadow={false}
      />
      <Instances
        data={data.landscape}
        shape="plane"
        material={resources.glassHorizontal}
        shadow={false}
      />
      <Instances data={data.steel} material={resources.steel} shadow={delivery}/>
      <Instances data={data.purlins} material={resources.steel} profile={resources.purlinProfile} shadow={delivery}/>
      <Instances data={data.rafters} material={resources.steel} profile={resources.channelProfile} shadow={delivery}/>
      <Instances data={data.channels} material={resources.steel} profile={resources.channelProfile} shadow={delivery}/>
      <Instances data={data.pads} material={resources.pad} shadow={delivery}/>
      {[...contacts.values()].map(({site,contact,objects})=><group key={site.id} position={[site.x,0,site.z]} rotation={[0,site.yaw,0]}>
        {objects.map(object=><RoofContactMesh key={object.id} object={object} contact={contact} selected={!!selectedObjectIds?.includes(object.id)}/>)}
      </group>)}
      {!stress &&
        obstacles.filter(o=>o.kind!=="keepout"&&!attachedIds.has(o.id)).map((o) => {
          const objSel=!delivery&&!!selectedObjectIds?.includes(o.id);
          return <group key={o.id} position={[o.x, o.baseHeight??0, o.z]} rotation={[0, o.yaw, 0]}>
            <mesh position={[0, o.height / 2, 0]} castShadow receiveShadow userData={{objectId:o.id}}>
              <boxGeometry args={[o.width, o.height, o.depth]} />
              {delivery?<meshStandardMaterial color="#e3e6eb" metalness={0} roughness={0.84}/>:<MaquetteWallMaterial/>}
            </mesh>
            {!delivery&&<group position={[0,o.height/2,0]}><BoxEdges width={o.width} height={o.height} depth={o.depth} color={objSel?'#6b8a94':'#969e9c'} opacity={objSel?0.50:0.24}/></group>}
          </group>;
        })}
      {!delivery&&!stress&&obstacles.filter(o=>o.kind==="keepout"&&!attachedIds.has(o.id)).map(o=>{
        const objSel=!!selectedObjectIds?.includes(o.id);
        return <group key={o.id} position={[o.x,(o.baseHeight??0)+0.035,o.z]} rotation={[0,o.yaw,0]}>
          <mesh rotation={[-Math.PI/2,0,0]} userData={{objectId:o.id}}>
            <planeGeometry args={[o.width,o.depth]}/>
            <meshBasicMaterial color="#c9bda5" transparent opacity={objSel?0.32:0.18} depthWrite={false} toneMapped={false}/>
          </mesh>
          <lineLoop><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([-o.width/2,0.005,-o.depth/2,o.width/2,0.005,-o.depth/2,o.width/2,0.005,o.depth/2,-o.width/2,0.005,o.depth/2]),3]}/></bufferGeometry><lineBasicMaterial color={objSel?'#6b8a94':'#a79b84'} transparent opacity={objSel?.65:.35} depthWrite={false} toneMapped={false}/></lineLoop>
        </group>;
      })}
    </MaquetteSunContext.Provider>
  );
}
