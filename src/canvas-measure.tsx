import {useEffect,useMemo,useState,type MutableRefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {Point} from './domain';
import {formatArea,formatMeters,pathLength,polygonArea,polygonCentre,snapMeasure,type Measure,type MeasureTool,type Snap} from './measure';
import {tx} from './i18n';
/** The canvas pointer code calls these while a measure tool is on: a click, the cursor moving, and a double or right click to finish. */
export type MeasureControl={down:(p:Point,straight:boolean)=>void;move:(p:Point|null,straight:boolean)=>void;finish:()=>void};
const INK='#e8590c',Y=.7,ORDER=12000;
const gap=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
// A flat strip a few pixels wide: WebGL lines are always 1 px.
function Strip({a,b,unit,color=INK,width=2}:{a:Point;b:Point;unit:number;color?:string;width?:number}){
 const len=gap(a,b);if(len<1e-9)return null;
 return <mesh position={[(a.x+b.x)/2,Y,(a.z+b.z)/2]} rotation={[-Math.PI/2,0,-Math.atan2(b.z-a.z,b.x-a.x)]} renderOrder={ORDER}><planeGeometry args={[len,unit*width]}/><meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false}/></mesh>;
}
function Dot({p,unit,hollow=false,size=4}:{p:Point;unit:number;hollow?:boolean;size?:number}){
 return <group position={[p.x,Y,p.z]} rotation={[-Math.PI/2,0,0]}><mesh renderOrder={ORDER+1}><circleGeometry args={[unit*size,20]}/><meshBasicMaterial color={INK} depthTest={false} depthWrite={false} toneMapped={false}/></mesh>
  <mesh renderOrder={ORDER+2}><circleGeometry args={[unit*(size-1.5),20]}/><meshBasicMaterial color={hollow?'#ffffff':INK} depthTest={false} depthWrite={false} toneMapped={false}/></mesh></group>;
}
/** A white tag with one or two lines of text, a fixed size on screen. */
function Tag({lines,at,unit}:{lines:string[];at:Point;unit:number}){
 const key=lines.join('\n');
 const {texture,width,height}=useMemo(()=>{
  const s=2,c=document.createElement('canvas'),ctx=c.getContext('2d')!,font=`600 ${13*s}px "Noto Sans SC Variable","Microsoft YaHei",sans-serif`;
  ctx.font=font;const w=Math.max(...lines.map(l=>ctx.measureText(l).width));c.width=Math.ceil(w+14*s);c.height=(lines.length*17+8)*s;
  ctx.fillStyle='#ffffffeb';ctx.beginPath();ctx.roundRect(0,0,c.width,c.height,5*s);ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=s;ctx.stroke();
  ctx.font=font;ctx.fillStyle='#7a2e05';ctx.textBaseline='middle';ctx.textAlign='center';lines.forEach((l,i)=>ctx.fillText(l,c.width/2,(4+17*i+9)*s));
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return {texture,width:c.width/s,height:c.height/s};
 },[key]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <sprite position={[at.x,Y+.1,at.z]} scale={[unit*width,unit*height,1]} renderOrder={ORDER+3}><spriteMaterial map={texture} toneMapped={false} transparent depthTest={false} depthWrite={false}/></sprite>;
}
function Fill({points}:{points:Point[]}){
 const geometry=useMemo(()=>{const g=new THREE.BufferGeometry(),out:number[]=[];
  for(const tri of THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(p.x,p.z)),[]))for(const i of tri)out.push(points[i].x,Y-.05,points[i].z);
  g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));return g;},[points]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <mesh geometry={geometry} renderOrder={ORDER-1}><meshBasicMaterial color={INK} transparent opacity={.16} side={THREE.DoubleSide} depthTest={false} depthWrite={false} toneMapped={false}/></mesh>;
}
const distanceTag=(a:Point,b:Point,unit:number)=>({x:(a.x+b.x)/2,z:(a.z+b.z)/2-unit*14});
const areaLines=(points:Point[])=>[formatArea(polygonArea(points)),tx('周长 {0}',formatMeters(pathLength(points,true)))];
function Drawn({m,unit}:{m:Measure;unit:number}){
 const ps=m.points;
 if(m.kind==='distance')return <group><Strip a={ps[0]} b={ps[1]} unit={unit}/>{ps.map((p,i)=><Dot key={i} p={p} unit={unit}/>)}<Tag lines={[formatMeters(gap(ps[0],ps[1]))]} at={distanceTag(ps[0],ps[1],unit)} unit={unit}/></group>;
 return <group><Fill points={ps}/>{ps.map((p,i)=><Strip key={i} a={p} b={ps[(i+1)%ps.length]} unit={unit}/>)}{ps.map((p,i)=><Dot key={'d'+i} p={p} unit={unit} size={3}/>)}<Tag lines={areaLines(ps)} at={polygonCentre(ps)} unit={unit}/></group>;
}
/** Measurements on the 2D canvas. They stay until cleared and are not saved with the project. */
export function MeasureLayer({control,tool,visible,clear,shapes,onCount}:{control:MutableRefObject<MeasureControl|null>;tool:MeasureTool|null;visible:boolean;clear:number;shapes:Point[][];onCount?:(n:number)=>void}){
 const {camera,size}=useThree();
 // Metres per screen pixel, so marks keep their size while zooming.
 const [unit,setUnit]=useState(.05);
 useFrame(()=>{const c=camera as THREE.OrthographicCamera;if(!c.isOrthographicCamera)return;const u=(c.top-c.bottom)/Math.max(1,size.height);if(Math.abs(u-unit)>unit*.01)setUnit(u);});
 const [measures,setMeasures]=useState<Measure[]>([]),[draft,setDraft]=useState<Point[]>([]),[hover,setHover]=useState<Snap|null>(null),[nextId,setNextId]=useState(1);
 useEffect(()=>{setMeasures([]);setDraft([]);},[clear]);
 useEffect(()=>{setDraft([]);setHover(null);},[tool]);
 useEffect(()=>{onCount?.(measures.length);},[measures.length]);
 const reach=unit*10,snap=(p:Point,straight:boolean)=>snapMeasure(p,shapes,measures.flatMap(m=>m.points).concat(draft),reach,draft[draft.length-1],straight);
 const add=(m:Omit<Measure,'id'>)=>{setMeasures(v=>[...v,{...m,id:nextId}]);setNextId(n=>n+1);setDraft([]);};
 const closeArea=(points:Point[])=>{const ps=points.filter((p,i)=>i===0||gap(p,points[i-1])>1e-6);if(ps.length>2&&gap(ps[0],ps[ps.length-1])<1e-6)ps.pop();if(ps.length>=3)add({kind:'area',points:ps});else setDraft([]);};
 control.current=!tool?null:{
  down:(p,straight)=>{const q=snap(p,straight).p;
   if(tool==='distance'){if(!draft.length)setDraft([q]);else if(gap(q,draft[0])>1e-6)add({kind:'distance',points:[draft[0],q]});return;}
   if(draft.length>=3&&gap(q,draft[0])<reach){closeArea(draft);return;}
   if(!draft.length||gap(q,draft[draft.length-1])>1e-6)setDraft([...draft,q]);},
  move:(p,straight)=>setHover(p?snap(p,straight):null),
  finish:()=>{if(tool==='area')closeArea(draft);else setDraft([]);},
 };
 // Escape is handled by the workbench. Backspace takes back the last point.
 useEffect(()=>{
  if(!tool||!draft.length)return;
  const key=(e:KeyboardEvent)=>{if(e.key==='Backspace'&&!(e.target instanceof HTMLInputElement)){e.preventDefault();setDraft(d=>d.slice(0,-1));}};
  window.addEventListener('keydown',key,true);return ()=>window.removeEventListener('keydown',key,true);
 },[tool,draft.length]);
 if(!visible)return null;
 const last=draft[draft.length-1],h=hover?.p;
 return <group>
  {measures.map(m=><Drawn key={m.id} m={m} unit={unit}/>)}
  {draft.length>0&&<group>
   {tool==='area'&&h&&draft.length>=2&&<Fill points={[...draft,h]}/>}
   {draft.slice(1).map((p,i)=><Strip key={i} a={draft[i]} b={p} unit={unit}/>)}
   {draft.map((p,i)=><Dot key={'d'+i} p={p} unit={unit} size={3}/>)}
   {h&&<Strip a={last} b={h} unit={unit} width={1.5} color="#f08c4a"/>}
   {h&&tool==='distance'&&<Tag lines={[formatMeters(gap(last,h))]} at={distanceTag(last,h,unit)} unit={unit}/>}
   {h&&tool==='area'&&draft.length>=2&&<Tag lines={areaLines([...draft,h])} at={polygonCentre([...draft,h])} unit={unit}/>}
  </group>}
  {tool&&hover&&hover.kind!=='free'&&<Dot p={hover.p} unit={unit} size={hover.kind==='corner'?6:5} hollow/>}
 </group>;
}
