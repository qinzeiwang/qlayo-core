import {appendDrawingObject,drawingObjectGeometry,drawingObjectView,invalidateRoofLayoutForElements} from './drawing-object';
import {drawingRegionGeometry} from './drawing-region';
import {layoutAreaProblem} from './layout-area';
import {newId} from './ids';
import {polygonRect} from './polygon';
import {validRoofSize} from './roof-limits';
import {Compass} from './north-compass';
import {isTextEditing} from './use-project-history';
import {reshapeRegion} from './reshape-region';
import {applyRegionForm,initialRegionForm,type RegionForm} from './region-form';
import {carportPortrait,carportSpan,snapCarportEnd,snapCarportLength} from './carport';
import { Icon } from './workbench-ui';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {BaseImageClip} from './base-image-clip';
import {validBaseImageCrop,type BaseImage} from './base-image';
import { corners, overlaps, type Point, type Rect, type Obstacle } from './domain';
import { newRoof, carportFromPrevious, roofFromPrevious, roofRect, toLocal, toWorld, worldObstacle, type RoofDesign, projectBounds } from './roof-project';
import { rectangleFromThree, metricRect, worldToImage, containsRect, imageToWorld, snapAxis } from './drawing-geometry';
import {snapDrawingEdge,snapDrawingPoint} from './drawing-snap';
import { usePdfPatch } from './pdf-patch';
import {coreEdition,tx} from './i18n';
type View={x:number;y:number;width:number;height:number;viewportHeight?:number};
function PdfDetail({base,view,pixels}:{base:BaseImage;view:View;pixels:number}){
 const patch=usePdfPatch(base,view,pixels);
 return patch?<image href={patch.url} {...patch.view} pointerEvents="none"/>:null;
}
export function ImageEditor({toolbarAnchor='roof',layoutArea,draftObject,onDraftObject,onObjectCreated,panMode=false,fitSignal=0,onViewChange,embedded=false,hasExistingRegions,draftRegion,onDraftRegion,building=false,imageOverlays=[],obstacleHeight=1,onObstacleHeight,onUndo,onRedo,canUndo,canRedo,base,roofs,activeId,activeObjectId,onBase,onRoofs,onActive,onClose,initialView,onViewClose,initialTool,initialForm,intent='create'}:{toolbarAnchor?:'roof'|'elements'|'layout-limit';layoutArea?:{apply:(points:Point[])=>void;clear?:()=>void};draftObject?:Obstacle;onDraftObject?:(object:Obstacle)=>void;onObjectCreated?:(id:string)=>void;panMode?:boolean;fitSignal?:number;onViewChange?:(view:View)=>void;embedded?:boolean;hasExistingRegions?:boolean;draftRegion?:RoofDesign;onDraftRegion?:(region:RoofDesign)=>void;building?:boolean;imageOverlays?:import('./image-overlays').ImageOverlay[];obstacleHeight?:number;onObstacleHeight?:(height:number)=>void;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;intent?:'crop'|'create'|'reshape'|'reshape-object'|'obstacle'|'keepout';initialForm?:RegionForm;initialTool?:'roof'|'carport'|'obstacle'|'keepout';initialView?:View;onViewClose?:(v:View)=>void;base:BaseImage;roofs:RoofDesign[];activeId:string;activeObjectId?:string|null;onBase:(b:BaseImage)=>void;onRoofs:(r:RoofDesign[])=>void;onActive:(id:string)=>void;onClose:()=>void}){
 const cropping=intent==='crop';
 // The embedded canvas is centred on the calibrated frame, which can differ from the source raster.
 const frame=embedded&&(intent==='reshape'||intent==='reshape-object')?base.frame:undefined;
 const outlineCoordinates=frame?{...base,width:frame.width+2*frame.x,height:frame.height+2*frame.y}:base;
 const hasContext=hasExistingRegions??!!base.frame;
 const nextName=()=>{const prefix=initialTool==='carport'?tx('车棚'):tx('屋面');let n=1;while((hasContext?roofs:[]).some(r=>r.name===`${prefix} ${n}`))n++;return `${prefix} ${n}`;};
 const [regionName,setRegionName]=useState(nextName),[lastCreatedId,setLastCreatedId]=useState<string|null>(null);
 const [redraw,setRedraw]=useState(false);
 const [polygonMode,setPolygonMode]=useState(cropping||intent==='reshape'&&!!roofs.find(r=>r.id===activeId)?.roof.outline);
 const [edited,setEdited]=useState<Rect>();
 const [dragSnap,setDragSnap]=useState<Point>();
 const [outlineDrag,setOutlineDrag]=useState<{index:number;edge:boolean}>();
 const resize=useRef<{rect:Rect;start:Point;index:number;edge:boolean;before?:Rect}|undefined>(undefined);
 const continuous=!embedded;
 const [pendingRect,setPendingRect]=useState<Rect>();
 const [pendingRedo,setPendingRedo]=useState<Rect>();
 const initialObjectName=useRef(draftObject?.name);
 const drawingTools=useRef<HTMLDivElement>(null);
 const [toolbarTop,setToolbarTop]=useState(72);
 useLayoutEffect(()=>{
  if(!embedded)return;
  const anchor=document.querySelector<HTMLElement>(`.sidebar-drawer [data-drawing-anchor="${toolbarAnchor}"]`);
  const place=()=>{const viewport=drawingTools.current?.closest('.viewport');if(!anchor||!viewport)return;const bounds=viewport.getBoundingClientRect(),height=drawingTools.current?.offsetHeight??110;setToolbarTop(Math.max(8,Math.min(anchor.getBoundingClientRect().top-bounds.top,Math.max(8,bounds.height-height-12))));};
  place();const observer=new ResizeObserver(place);if(anchor)observer.observe(anchor);if(drawingTools.current)observer.observe(drawingTools.current);
  window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[embedded,toolbarAnchor]);
 const finish=()=>{onViewClose?.({...view,viewportHeight:svg.current?.clientHeight});onClose();};
 const [form,setForm]=useState<RegionForm|undefined>(initialForm);
 const [tool,setTool]=useState<'roof'|'carport'|'obstacle'|'keepout'|'select'>(initialTool??'roof');
 const fixedCarport=coreEdition&&tool==='carport'&&intent==='create'&&draftRegion?.carport;
 const carportWidth=fixedCarport&&draftRegion?carportSpan(fixedCarport,draftRegion.moduleSpec).totalWidth:undefined;
 const [points,setPoints]=useState<Point[]>([]),[hover,setHover]=useState<Point>(),[notice,setNotice]=useState(cropping?tx('沿要保留的底图范围逐点圈选'):fixedCarport?tx('点选车棚长边两端，长度按组件间距吸附'):tx('先点一条边的两个端点，再点第三点确定宽度'));
 const [pointRedo,setPointRedo]=useState<Point[]>([]),[editRedo,setEditRedo]=useState<Rect>();
 const undo=()=>{if(pendingRect){setPendingRedo(pendingRect);setPendingRect(undefined);return;}if(points.length){setPointRedo(p=>[...p,points[points.length-1]]);setPoints(p=>p.slice(0,-1));}else if(edited){setEditRedo(edited);resize.current=undefined;setEdited(undefined);}else if(!embedded&&!cropping){onUndo();setNotice(tx('已撤销上一步'));}};
 const redo=()=>{if(pendingRedo){setPendingRect(pendingRedo);setPendingRedo(undefined);return;}if(pointRedo.length){setPoints(p=>[...p,pointRedo[pointRedo.length-1]]);setPointRedo(p=>p.slice(0,-1));}else if(editRedo){setEdited(editRedo);setEditRedo(undefined);}else if(!embedded&&!cropping)onRedo();};
 const cancelEdit=useRef(finish);cancelEdit.current=finish;
 const keyboard=useRef({undo,redo});keyboard.current={undo,redo};
 const svg=useRef<SVGSVGElement>(null),space=useRef(false),pan=useRef<{x:number;y:number;view:View}|undefined>(undefined);
 const [view,setView]=useState<View>(initialView??{x:0,y:0,width:base.width,height:base.height}),[pixels,setPixels]=useState(0);
 const unit=view.width/Math.max(1,pixels),active=draftRegion??roofs.find(r=>r.id===activeId)??roofs[0],activeObject=active.obstacles.find(o=>o.id===activeObjectId);
 const snapTargets=useMemo(()=>{
  if(!hasContext||!base.metersPerPixel)return [];
  if(tool==='obstacle'||tool==='keepout'||layoutArea){
   return [roofRect(active),...active.obstacles.filter(o=>intent!=='reshape-object'||o.id!==activeObjectId).map(o=>worldObstacle(o,active))].map(corners);
  }
  if(tool!=='roof'&&tool!=='carport')return [];
  return roofs.filter(r=>intent!=='reshape'||r.id!==activeId).map(r=>corners(roofRect(r)));
 },[base.metersPerPixel,hasContext,tool,layoutArea,active,activeId,activeObjectId,intent,roofs]);
 const drawingTargets=useMemo(()=>snapTargets.map(outline=>outline.map(p=>worldToImage(p,outlineCoordinates))),[snapTargets,outlineCoordinates]);
 const snapPoint=(prev:Point|undefined,p:Point)=>snapDrawingPoint(p,drawingTargets,unit,prev?[prev]:[])?.point??p;
 const fitCarportEnd=(p:Point)=>fixedCarport&&draftRegion&&base.metersPerPixel&&points.length===1
  ?snapCarportEnd(points[0],p,draftRegion.moduleSpec,base.metersPerPixel):p;
 const [editObjectHeight,setEditObjectHeight]=useState(activeObject?.height??obstacleHeight);
 const fit=()=>{const s=svg.current;if(!s)return;const aspect=s.clientWidth/Math.max(1,s.clientHeight);
  if(embedded&&(draftObject&&intent!=='reshape-object'||layoutArea)&&base.metersPerPixel){setPixels(s.clientWidth);setView(drawingObjectView(active,base,s.clientWidth,s.clientHeight));return;}
  if(embedded&&base.metersPerPixel){const b=projectBounds(hasContext?roofs:[]),k=base.metersPerPixel,height=Math.max(b.depth,b.width/aspect,40)*1.25/k,width=height*aspect,center=worldToImage(b,outlineCoordinates);setPixels(s.clientWidth);setView({x:center.x-width/2,y:center.z-height/2,width,height});return;}
  const height=Math.max(base.height,base.width/aspect)*1.04,width=height*aspect;setPixels(s.clientWidth);setView({x:(base.width-width)/2,y:(base.height-height)/2,width,height});};
 const viewChange=useRef(onViewChange);viewChange.current=onViewChange;
 useEffect(()=>{if(embedded)viewChange.current?.({...view,viewportHeight:svg.current?.clientHeight});},[embedded,view]);
 const previousFitSignal=useRef(fitSignal);
 useEffect(()=>{if(previousFitSignal.current!==fitSignal){previousFitSignal.current=fitSignal;fit();}},[fitSignal]);
 useLayoutEffect(()=>{if(svg.current)setPixels(svg.current.clientWidth);if(embedded&&(draftObject&&intent!=='reshape-object'||layoutArea)||!initialView)fit();else if(svg.current){const h=svg.current.clientHeight,height=initialView.height*h/(initialView.viewportHeight??h),width=height*svg.current.clientWidth/Math.max(1,h);setView({...initialView,x:initialView.x+(initialView.width-width)/2,y:initialView.y+(initialView.height-height)/2,width,height});}const obs=new ResizeObserver(()=>{const s=svg.current;if(!s)return;setPixels(s.clientWidth);setView(v=>{const width=v.height*s.clientWidth/Math.max(1,s.clientHeight);return {...v,x:v.x+(v.width-width)/2,width};});});if(svg.current)obs.observe(svg.current);return()=>obs.disconnect();},[base.width,base.height]);
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if(isTextEditing(e.target))return;if((e.ctrlKey||e.metaKey)&&!e.altKey&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();if(e.shiftKey||e.key.toLowerCase()==='y')keyboard.current.redo();else keyboard.current.undo();return;}if(e.code==='Space'){space.current=true;e.preventDefault();}if(e.key==='Escape'){setPendingRect(undefined);setPendingRedo(undefined);setPointRedo([]);setEditRedo(undefined);resize.current=undefined;setEdited(undefined);setPoints([]);setHover(undefined);setNotice(tx('已取消当前绘制'));if(intent==='reshape'||intent==='reshape-object')cancelEdit.current();}if(e.key==='Backspace'){e.preventDefault();setPoints(p=>p.slice(0,-1));}};const up=()=>{space.current=false;};window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',up);};},[]);
 useEffect(()=>{const s=svg.current;if(!s)return;const wheel=(e:WheelEvent)=>{e.preventDefault();const box=s.getBoundingClientRect(),u=(e.clientX-box.left)/box.width,v=(e.clientY-box.top)/box.height;setView(old=>{const width=Math.max(base.width/80,Math.min(base.width*3,old.width*Math.exp(Math.max(-150,Math.min(150,e.deltaY))*.002)));const factor=width/old.width;return {x:old.x+u*old.width*(1-factor),y:old.y+v*old.height*(1-factor),width,height:old.height*factor};});};s.addEventListener('wheel',wheel,{passive:false});return()=>s.removeEventListener('wheel',wheel);},[base.width]);
 const pos=(e:React.PointerEvent)=>{const m=svg.current?.getScreenCTM();if(!m)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return {x:p.x,z:p.y};};
 function choose(t:typeof tool){setPointRedo([]);if(t==='roof')setForm(active.pitch?.kind??'flat');if(t==='carport')setForm(active.carport?.double?'double-carport':'single-carport');setTool(t);setPoints([]);setHover(undefined);setNotice(t==='select'?tx('点击屋面选择'):tx('先点一条边的两个端点，再点第三点确定宽度'));}
 function point(p:Point){
  if(cropping){
   if(p.x<0||p.z<0||p.x>base.width||p.z>base.height)return;
   if(points.length>=3&&Math.hypot(p.x-points[0].x,p.z-points[0].z)<12*unit){commitCrop();return;}
   if(points.length<64){setPoints(previous=>[...previous,previous.length?snapAxis(previous.at(-1)!,p):p]);setPointRedo([]);}
   return;
  }
if(pendingRect){setPendingRect(undefined);setPendingRedo(undefined);}setEditRedo(undefined);setPointRedo([]);if((intent==='reshape'&&!redraw)||intent==='reshape-object')return;if(p.x<0||p.z<0||p.x>base.width||p.z>base.height)return;
  if(tool==='select'){const w=imageToWorld(p,base);const hit=[...roofs].reverse().find(r=>containsRect(roofRect(r),{...w,width:0,depth:0,yaw:0}));if(hit)onActive(hit.id);return;}
  if(!base.metersPerPixel)return;if(points.length===0&&lastCreatedId){setLastCreatedId(null);setRegionName(nextName());}if(polygonMode&&(layoutArea||tool==='roof')){if(points.length>=3&&Math.hypot(p.x-points[0].x,p.z-points[0].z)<12*unit){completePolygon();return;}if(points.length>=64){setNotice(tx('最多 64 个顶点，请闭合轮廓'));return;}setPoints([...points,snapPoint(points.length?points[points.length-1]:undefined,p)]);setNotice(tx('依次点选转角，点击起点或“闭合屋面”完成'));return;}
  if(points.length<2){
   const next=fitCarportEnd(snapPoint(points[0],p));
   if(fixedCarport&&next===points[0])return;
   setPoints([...points,next]);
   if(points.length===0)setNotice(fixedCarport?tx('点选车棚长边两端，长度按组件间距吸附'):tx('第二点接近水平或垂直时会自动吸附，也可直接画斜线'));
   else setNotice(fixedCarport?tx('在长边任一侧点选，车棚宽度自动计算'):tx('再点第三点确定屋面宽度'));
   return;
  }
  const draft=rectangleFromThree(points[0],points[1],snapPoint(undefined,p),carportWidth===undefined?undefined:carportWidth/base.metersPerPixel);if(!draft){setNotice(tx('宽度太小，请重新选择第三点'));return;}const r=metricRect(draft,base);
  if(corners(draft).some(p=>p.x<0||p.z<0||p.x>base.width||p.z>base.height)){setNotice(tx('轮廓超出图纸，请重新选择第三点'));return;}
  commitRect(r);
 }
 function commitCrop(){
  if(!validBaseImageCrop(points,base)){setNotice(tx('底图修剪轮廓无效'));return;}
  onBase({...base,crop:points});finish();
 }
 function completePolygon(){try{commitRect(polygonRect(points.map(p=>imageToWorld(p,base))));}catch(e){setNotice((e as Error).message);}}
 function commitRect(r:Rect,finalize=false){
  if(layoutArea){
   const outline=corners(r).map(p=>toLocal(p,active));
   const problem=layoutAreaProblem({layoutArea:outline,layoutAreaEnabled:true},active.roof);
   if(problem){setNotice(problem);return;}
   if(finalize){layoutArea.apply(outline);finish();return;}
   setPendingRect(r);setPendingRedo(undefined);setPoints([]);setHover(undefined);setPointRedo([]);return;
  }
  if(tool==='roof'||tool==='carport'){
   if(carportWidth!==undefined&&draftRegion)r={...r,width:snapCarportLength(r.width,draftRegion.moduleSpec),depth:carportWidth};
   if(!validRoofSize(r)){setNotice(tx('屋面边长需在 2–500m 之间'));return;}
   if(intent==='reshape'){try{const next=reshapeRegion(roofs.map(item=>draftRegion&&item.id===activeId?draftRegion:item),activeId,r);onRoofs(next);onActive(activeId);finish();}catch(e){setNotice((e as Error).message);}return;}
   const existing=hasContext?roofs:[];
   if(existing.length>=50){setNotice(tx('当前最多支持 50 个屋面'));return;}
   if(existing.some(o=>overlaps(roofRect(o),r))){setNotice(tx('与已有屋面重叠，请重新圈定'));return;}
   if(embedded&&!finalize&&draftRegion){
    setPendingRect(r);setPendingRedo(undefined);setPoints([]);setHover(undefined);setPointRedo([]);
    onDraftRegion?.(drawingRegionGeometry(draftRegion,r,!!fixedCarport));setNotice(tx('轮廓已绘制，可调整参数后确认'));return;
   }
   const prefix=tool==='carport'?tx('车棚'):tx('屋面');let n=1;while(existing.some(r=>r.name===`${prefix} ${n}`))n++;
   let created:RoofDesign={...(draftRegion??(tool==='carport'?carportFromPrevious(active,`${prefix} ${n}`):roofFromPrevious(active,`${prefix} ${n}`))),x:r.x,z:r.z,yaw:r.yaw,roof:{width:r.width,depth:r.depth,outline:r.outline}};
   created.name=(embedded?draftRegion?.name:regionName)?.trim()||`${prefix} ${n}`;setRegionName(created.name);setLastCreatedId(created.id);
   if(form)created=draftRegion?applyRegionForm(created,form,{creating:true}):initialRegionForm(created,form);else if(r.outline)created=applyRegionForm(created,'flat');
   if(created.carport)created.layoutOptions={...created.layoutOptions,portrait:!fixedCarport&&carportPortrait(created.roof)};
   onRoofs([...existing,created]);onActive(created.id);onBase({...base,frame:{x:0,y:0,width:base.width,height:base.height}});setNotice(tx('{0} 已添加',created.name));if(!continuous){finish();return;}
  }else{
   if(!containsRect(roofRect(active),r)){setNotice(tx('障碍物须位于当前选中屋面内'));return;}
   if(active.obstacles.length>=100){setNotice(tx('当前屋面障碍物已达 100 个'));return;}
   if(r.width<.2||r.depth<.2){setNotice(tx('障碍物边长至少 0.2m'));return;}
   if(embedded&&draftObject&&!finalize){
    try{const staged=drawingObjectGeometry(active,draftObject,r);onDraftObject?.(staged);setPendingRect(r);setPendingRedo(undefined);setPoints([]);setHover(undefined);setPointRedo([]);setNotice(tx('轮廓已绘制，可调整参数后确认'));}catch(error){setNotice((error as Error).message);}return;
   }
   const prefix=tool==='keepout'?tx('禁布区'):building?tx('附属建筑'):tx('障碍物');
   const o=draftObject?{...drawingObjectGeometry(active,draftObject,r),name:draftObject.name.trim()||initialObjectName.current||`${prefix} ${active.obstacles.length+1}`}:{...r,...toLocal(r,active),yaw:r.yaw-active.yaw,id:newId(),kind:tool==='keepout'?'keepout' as const:'obstacle' as const,...(building&&tool==='obstacle'?{topLayout:{enabled:false,tilt:10,edge:.5}}:{}),name:`${prefix} ${active.obstacles.length+1}`,height:tool==='keepout'?0:obstacleHeight};
   onRoofs(roofs.map(s=>s.id===active.id?embedded?appendDrawingObject(s,o):{...s,obstacles:[...s.obstacles,o]}:s));setNotice(tx('已添加到 {0}',active.name));if(embedded){onObjectCreated?.(o.id);finish();return;}
  }
  setPoints([]);
 }
 const editingRoof=intent==='reshape'&&!redraw,editingObject=intent==='reshape-object',editing=editingRoof||editingObject,minimumEditSize=editingObject?.2:2;
 const editRect=editingObject&&activeObject?worldObstacle(activeObject,active):roofRect(active);
 const applyEdit=()=>{
  try{
   const next=edited??editRect;
   if(edited&&!base.blank&&corners(imageRect(next)).some(p=>p.x<0||p.z<0||p.x>base.width||p.z>base.height))throw new Error(tx('轮廓超出图纸'));
   if(editingObject){
    if(!activeObject)throw new Error(tx('未找到所选对象'));
    const draft=draftObject??{...activeObject,height:editObjectHeight};
    if(edited||draft.name!==activeObject.name||draft.height!==activeObject.height||draft.topLayout!==activeObject.topLayout){
     const updated=drawingObjectGeometry(active,draft,next);
     onRoofs(roofs.map(r=>r.id===active.id?invalidateRoofLayoutForElements(r,r.obstacles.map(o=>o.id===updated.id?updated:o)):r));
    }
   }else if(edited){
    const source=roofs.map(item=>draftRegion&&item.id===activeId?draftRegion:item);
    onRoofs(reshapeRegion(source,activeId,next.outline?polygonRect(corners(next)):next));
   }else if(embedded&&draftRegion){
    onRoofs(roofs.map(item=>item.id===activeId?draftRegion:item));
   }
   finish();
  }catch(e){setNotice((e as Error).message);}
 };
 const dragOutline=(point:Point)=>{
  const drag=resize.current;
  if(!drag)return;
  const {rect,start,index,edge}=drag;
  const current=toLocal(imageToWorld(point,outlineCoordinates),rect);
  let dx=current.x-start.x,dz=current.z-start.z;
  if(Math.hypot(dx,dz)<1e-8){setEdited(drag.before);setDragSnap(undefined);return;}
  const worldCorners=corners(rect),a=worldCorners[index],b=worldCorners[(index+1)%worldCorners.length];
  const tolerance=unit*base.metersPerPixel!;
  const translate=(p:Point)=>{
   const local=toLocal(p,rect);
   return toWorld({x:local.x+dx,z:local.z+dz},rect);
  };
  if(edge){
   const from=translate(a),to=translate(b);
   const correction=snapDrawingEdge(from,to,snapTargets,tolerance);
   if(correction){
    const local=toLocal({x:rect.x+correction.x,z:rect.z+correction.z},rect);
    dx+=local.x;dz+=local.z;
    setDragSnap(worldToImage({x:(from.x+to.x)/2+correction.x,z:(from.z+to.z)/2+correction.z},outlineCoordinates));
   }else setDragSnap(undefined);
  }else{
   const previous=worldCorners[(index+worldCorners.length-1)%worldCorners.length];
   const snap=snapDrawingPoint(translate(a),snapTargets,tolerance,rect.outline?[previous,b]:[]);
   if(snap){
    const original=toLocal(a,rect),local=toLocal(snap.point,rect);
    dx=local.x-original.x;dz=local.z-original.z;
   }
   setDragSnap(snap?worldToImage(snap.point,outlineCoordinates):undefined);
  }
  setEditRedo(undefined);
  if(rect.outline){
   const a=rect.outline[index],nextIndex=(index+1)%rect.outline.length,b=rect.outline[nextIndex];
   const length=Math.hypot(b.x-a.x,b.z-a.z);
   if(!length)return;
   const nx=(b.z-a.z)/length,nz=(a.x-b.x)/length,offset=dx*nx+dz*nz;
   setEdited({...rect,outline:rect.outline.map((p,i)=>i===index||edge&&i===nextIndex?{x:p.x+(edge?offset*nx:dx),z:p.z+(edge?offset*nz:dz)}:p)});
   return;
  }

  let left=-rect.width/2,right=rect.width/2,top=-rect.depth/2,bottom=rect.depth/2;
  if(edge?index===3:index===0||index===3)left=Math.min(left+dx,right-minimumEditSize);
  if(edge?index===1:index===1||index===2)right=Math.max(right+dx,left+minimumEditSize);
  if(edge?index===0:index===0||index===1)top=Math.min(top+dz,bottom-minimumEditSize);
  if(edge?index===2:index===2||index===3)bottom=Math.max(bottom+dz,top+minimumEditSize);
  const x=(left+right)/2,z=(top+bottom)/2,c=Math.cos(rect.yaw),s=Math.sin(rect.yaw);
  setEdited({...rect,x:rect.x+x*c+z*s,z:rect.z-x*s+z*c,width:right-left,depth:bottom-top});
 };
 const drawingSnap=!cropping&&!editing&&tool!=='select'&&hover
  ?snapDrawingPoint(hover,drawingTargets,unit,points.length&&(polygonMode||points.length===1)?[points.at(-1)!]:[]):undefined;
 const snappedHover=drawingSnap?.point??hover;
 const previewHover=cropping?(hover&&points.length?snapAxis(points.at(-1)!,hover):hover):snappedHover&&fitCarportEnd(snappedHover);
 const draft=!polygonMode&&points.length===2&&previewHover?rectangleFromThree(points[0],points[1],previewHover,carportWidth===undefined?undefined:carportWidth/base.metersPerPixel!):null;
 const color=cropping||layoutArea?'#307c77':(tool==='obstacle'||tool==='keepout')?'#dc4c26':'#1478db';
 const poly=(r:Rect)=>corners(r).map(p=>`${p.x},${p.z}`).join(' ');
 const imageRect=(r:Rect):Rect=>({...r,...worldToImage(r,outlineCoordinates),width:r.width/base.metersPerPixel!,depth:r.depth/base.metersPerPixel!,outline:r.outline?.map(p=>({x:p.x/base.metersPerPixel!,z:p.z/base.metersPerPixel!}))});
 const marker=(p:Point,i:number)=><g key={i} pointerEvents="none"><circle cx={p.x} cy={p.z} r={6*unit} fill="white" stroke="#162b43" strokeWidth={2} vectorEffect="non-scaling-stroke"/><circle cx={p.x} cy={p.z} r={2*unit} fill={color}/></g>;
 const label=(p:Point,text:string)=><g transform={`translate(${p.x} ${p.z}) scale(${unit})`} pointerEvents="none"><rect x={-text.length*3.5-8} y={-25} width={text.length*7+16} height={21} rx={4} fill="white" stroke="#33465e" strokeWidth={1}/><text y={-11} textAnchor="middle" fontSize={12} fill="#17344a">{text}</text></g>;
 const midpoint=(a:Point,b:Point):Point=>({x:(a.x+b.x)/2,z:(a.z+b.z)/2});
 const sizeLabels=(rect:Rect,width:number,depth:number)=>{const cs=corners(rect);if(rect.outline)return <>{cs.map((a,i)=>{const b=cs[(i+1)%cs.length];return <g key={i}>{label(midpoint(a,b),`${(Math.hypot(a.x-b.x,a.z-b.z)*base.metersPerPixel!).toFixed(2)} m`)}</g>;})}</>;return <>{label(midpoint(cs[0],cs[1]),fixedCarport?tx('长 {0} m',width.toFixed(2)):tx('宽 {0} m',width.toFixed(2)))}{label(midpoint(cs[1],cs[2]),fixedCarport?tx('宽 {0} m',depth.toFixed(2)):tx('长 {0} m',depth.toFixed(2)))}</>;};
 const pendingGeometry=pendingRect&&carportWidth!==undefined?{...pendingRect,depth:carportWidth}:pendingRect;
 // The rectangle preview already draws and labels the measured first edge.
 const lineEnd=draft?undefined:points.length===1?previewHover:points[1];
 const format=(d:number)=>base.metersPerPixel?`${(d*base.metersPerPixel).toFixed(2)} m`:`${d.toFixed(1)} px`;
 const confirmDisabled=embedded&&!editing&&(intent==='create'||!!draftObject||!!layoutArea)?!pendingRect&&!(polygonMode&&points.length>=3):!editing&&polygonMode&&points.length>0&&points.length<3;
 return <div className={`image-editor${embedded?' image-editor-embedded':''}`} data-outline-editing={editing?true:undefined} data-carport-drawing={fixedCarport?true:undefined} role={embedded?'region':'dialog'} aria-label={tx('底图标定与绘制')}>
  <div ref={drawingTools} style={embedded?{top:toolbarTop}:undefined} className="image-tools grouped-drawing-tools" role="toolbar" aria-label={tx('绘制工具')}>{cropping?<>
   <strong>{tx('修剪底图')}</strong>
   <button className="icon-button" title={tx('撤回一个点')} aria-label={tx('撤回一个点')} disabled={!points.length} onClick={undo}><Icon name="reset"/></button>
   <div className="drawing-exit-actions">
    <button className="icon-button" title={tx('完成修剪')} aria-label={tx('完成修剪')} disabled={points.length<3} onClick={commitCrop}><Icon name="check"/></button>
    <button className="icon-button" title={tx('取消')} aria-label={tx('取消')} onClick={finish}><Icon name="close"/></button>
   </div>
  </>:<>
   <div className="drawing-tool-group" hidden={embedded} role="group" aria-label={tx('绘制')}>{([['carport',tx('车棚'),'carport'],['obstacle',tx('障碍物'),'box'],['keepout',tx('禁布区'),'forbidden']] as const).filter(([id])=>!editing&&id===initialTool).map(([id,label,icon])=><button key={id} disabled={id==='carport'?!base.metersPerPixel:!base.frame} className={tool===id?'selected':''} aria-pressed={tool===id} onClick={()=>choose(id)}><Icon name={icon}/>{building&&id==='obstacle'?tx('附属建筑'):label}</button>)}</div>
   {(embedded||tool==='roof'&&!editing&&(form??active.pitch?.kind??'flat')==='flat')&&<div className="drawing-tool-group" role="group" aria-label={tx('屋面圈选方式')}>{(embedded&&draftObject?[false]:[false,true]).map(poly=><button key={String(poly)} disabled={editing||poly&&(!layoutArea&&(tool!=='roof'||(form??active.pitch?.kind??'flat')!=='flat'))} className={polygonMode===poly?'icon-button selected':'icon-button'} title={embedded?undefined:poly?tx('多边形'):tx('矩形')} data-tooltip={embedded?(poly?tx('多边形'):tx('矩形')):undefined} aria-label={poly?tx('多边形'):tx('矩形')} aria-pressed={polygonMode===poly} onClick={()=>{setPolygonMode(poly);setPoints([]);setPointRedo([]);setHover(undefined);setNotice(poly?tx('依次点选屋面转角，点击起点闭合'):tx('先点一条边的两个端点，再点第三点确定宽度'));}}><Icon name={poly?'l-polygon':'rectangle'}/></button>)}</div>}
   {!embedded&&tool==='obstacle'&&<label className="obstacle-height-input">{tx('高度 m')}<input aria-label={editingObject?tx('障碍物高度 m'):tx('新建障碍物高度 m')} type="number" min="0.2" max="30" step="0.1" value={editingObject?editObjectHeight:obstacleHeight} onChange={e=>{const h=Number(e.target.value);if(h>=.2&&h<=30){if(editingObject)setEditObjectHeight(h);else onObstacleHeight?.(h);}}}/></label>}
   {!embedded&&intent==='create'&&(tool==='roof'||tool==='carport')&&<label className="drawing-name">{tx('名称')}<input aria-label={tx('新建区域名称')} value={regionName} onChange={e=>{const name=e.target.value;setRegionName(name);if(lastCreatedId&&name.trim())onRoofs(roofs.map(r=>r.id===lastCreatedId?{...r,name:name.trim()}:r));}}/></label>}

   <div className="drawing-tool-group" hidden={embedded} role="group" aria-label={tx('辅助操作')}><button className="icon-button" hidden={embedded} onClick={fit} title={embedded?undefined:tx('显示全图')} aria-label={tx('显示全图')}><Icon name="frame"/></button><button className="icon-button" disabled={!(!embedded&&canUndo)&&!points.length&&!edited&&!pendingRect} onClick={undo} title={embedded?undefined:tx('撤回上次轮廓操作')} aria-label={tx('撤回轮廓')}><Icon name="reset"/></button><button className="icon-button" disabled={!(!embedded&&canRedo)&&!pointRedo.length&&!editRedo&&!pendingRedo} onClick={redo} title={embedded?undefined:tx('重做 · Ctrl+Shift+Z')} aria-label={tx('重做轮廓')}><Icon name="redo"/></button>
   {points.length>0&&<><button className="icon-button" onClick={()=>setPoints(p=>p.slice(0,-1))} title={embedded?undefined:tx('退一点 · Backspace')} aria-label={tx('退一点')}><Icon name="back"/></button><button className="icon-button" onClick={()=>{setPoints([]);setHover(undefined);}} title={embedded?undefined:tx('取消绘制 · Esc')} aria-label={tx('取消绘制')}><Icon name="close"/></button></>}
   </div>

   {!embedded&&intent==='reshape'&&<><span>{tx('修改：')}{active.name}</span><button onClick={()=>{setRedraw(v=>!v);setEdited(undefined);setPoints([]);setNotice(redraw?tx('拖动角点调整轮廓'):polygonMode?tx('依次点选转角，点击起点闭合'):tx('先点一条边的两个端点，再点第三点确定宽度'));}}>{redraw?tx('返回拖动调整'):tx('重新绘制')}</button><button onClick={finish}>{tx('取消')}</button></>}
   {!embedded&&editingObject&&<><span>{tx('修改：')}{activeObject?.name??tx('所选对象')}</span><button onClick={finish}>{tx('取消')}</button></>}
   <div className="drawing-exit-actions">
    {layoutArea?.clear&&<button className="icon-button" type="button" aria-label={tx('清除范围')} title={embedded?undefined:tx('清除范围')} data-tooltip={embedded?tx('清除范围'):undefined} onClick={()=>{layoutArea.clear?.();finish();}}><Icon name="trash"/></button>}
    {embedded&&(draftObject||layoutArea||intent==='create'||editing)&&!confirmDisabled&&<span className="drawing-right-hint">{tx('右键完成')}</span>}
    <button className="icon-button drawing-confirm" title={embedded?undefined:tx('完成并返回')} data-tooltip={embedded?tx('完成并返回'):undefined} aria-label={tx('完成并返回')} disabled={confirmDisabled} onClick={editing?applyEdit:pendingRect?()=>commitRect(pendingRect,true):embedded&&polygonMode&&points.length>=3?()=>{try{commitRect(polygonRect(points.map(p=>imageToWorld(p,base))),true);}catch(e){setNotice((e as Error).message);}}:polygonMode&&points.length?completePolygon:finish}><Icon name="check"/></button>
    <button className="icon-button" onClick={finish} title={embedded?undefined:tx('返回工作台')} data-tooltip={embedded?tx('取消'):undefined} aria-label={embedded?tx('取消'):tx('返回工作台')}><Icon name={embedded?'close':'back'}/></button>
   </div>
  </>}</div>
  {!embedded&&(['obstacle','keepout','reshape-object'] as string[]).includes(intent)&&<div className="drawing-roof-context">{active.name}</div>}
  {!embedded&&<Compass angle={base.northAngle??0}/>}

  <div className="drawing-status" hidden={embedded&&!layoutArea&&!editing&&!fixedCarport} title={embedded?undefined:tx('滚轮缩放 · 中键 / 空格拖动')}><span role="status">{editing&&notice===tx('先点一条边的两个端点，再点第三点确定宽度')?tx('拖动角点或边调整轮廓，完成后应用'):notice}</span><span>{tx('滚轮缩放 · 中键 / 空格拖动')}</span></div>
  <svg ref={svg} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} aria-label={tx('底图绘制画布')} preserveAspectRatio="none" style={{cursor:embedded&&panMode?"grab":editing?"default":"crosshair",touchAction:"none",background:embedded?'transparent':base.blank?'#f1f3f5':undefined}} onContextMenu={e=>{e.preventDefault();if(cropping&&points.length>=3){commitCrop();return;}if(embedded&&(draftObject||layoutArea||intent==='create'||editing))drawingTools.current?.querySelector<HTMLButtonElement>('.drawing-confirm:not(:disabled)')?.click();}} onPointerDown={e=>{if(e.button===1||e.button===0&&(space.current||embedded&&panMode)){e.preventDefault();pan.current={x:e.clientX,y:e.clientY,view};e.currentTarget.setPointerCapture(e.pointerId);return;}if(e.button===0&&editing)return;if(e.button===0){const p=pos(e);if(p)point(p);}}} onPointerMove={e=>{if(resize.current){const p=pos(e);if(p)dragOutline(p);return;}if(pan.current){const p=pan.current;setView({...p.view,x:p.view.x-(e.clientX-p.x)*p.view.width/e.currentTarget.clientWidth,y:p.view.y-(e.clientY-p.y)*p.view.height/e.currentTarget.clientHeight});}else{const p=pos(e);if(p)setHover(p);}}} onPointerUp={e=>{setOutlineDrag(undefined);setDragSnap(undefined);resize.current=undefined;pan.current=undefined;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{setOutlineDrag(undefined);setDragSnap(undefined);if(resize.current)setEdited(resize.current.before);resize.current=undefined;pan.current=undefined;}}>
   {!embedded&&!base.blank&&(cropping||base.visible!==false)&&<BaseImageClip crop={cropping?undefined:base.crop} opacity={cropping?undefined:base.opacity}>
    <image href={base.url} width={base.width} height={base.height} pointerEvents="none"/>
    {base.pdfSource&&<PdfDetail base={base} view={view} pixels={pixels}/>}
   </BaseImageClip>}
   {!embedded&&base.metersPerPixel&&imageOverlays.filter(o=>o.visible).map(o=>{const p=worldToImage(o,base),k=base.metersPerPixel!;return <image key={o.id} href={o.url} x={p.x-o.width/k/2} y={p.z-o.depth/k/2} width={o.width/k} height={o.depth/k} opacity={o.opacity} transform={`rotate(${-o.yaw*180/Math.PI} ${p.x} ${p.z})`} pointerEvents="none"/>;})}
   <g pointerEvents="none">{!embedded&&hasContext&&base.metersPerPixel&&roofs.map(r=>{const selected=r.id===active.id,worldRect=selected&&editingRoof&&edited?edited:roofRect(r),rect=imageRect(worldRect);return <g key={r.id}><polygon points={poly(rect)} fill={selected?'#1478db15':'#1478db08'} stroke="white" strokeWidth={5} vectorEffect="non-scaling-stroke"/><polygon points={poly(rect)} fill="none" stroke={selected?'#1478db':'#417f8b'} strokeWidth={2} vectorEffect="non-scaling-stroke"/>{!embedded&&selected&&!editingObject&&corners(rect).map(marker)}{!embedded&&label(corners(rect)[0],r.name)}{!embedded&&selected&&!editingObject&&sizeLabels(rect,worldRect.width,worldRect.depth)}{r.obstacles.map(o=>{const objectSelected=selected&&editingObject&&o.id===activeObjectId,objectWorld=objectSelected&&edited?edited:worldObstacle(o,r),objectRect=imageRect(objectWorld);return <g key={o.id}><polygon points={poly(objectRect)} fill={o.kind==='keepout'?"#cc386344":"#df582833"} stroke="white" strokeWidth={5} vectorEffect="non-scaling-stroke"/><polygon points={poly(objectRect)} fill="none" stroke={o.kind==='keepout'?"#b83761":"#dc4c26"} strokeDasharray={o.kind==='keepout'?"6 3":undefined} strokeWidth={2} vectorEffect="non-scaling-stroke"/>{objectSelected&&corners(objectRect).map(marker)}{objectSelected&&label(corners(objectRect)[0],o.name)}{objectSelected&&sizeLabels(objectRect,objectWorld.width,objectWorld.depth)}</g>;})}</g>;})}
   {pendingGeometry&&<g pointerEvents="none"><polygon points={poly(imageRect(pendingGeometry))} fill="#1478db12" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>{corners(imageRect(pendingGeometry)).map(marker)}{sizeLabels(imageRect(pendingGeometry),pendingGeometry.width,pendingGeometry.depth)}</g>}
   {draft&&<><polygon points={poly(draft)} fill="#1478db12" stroke="white" strokeWidth={5} vectorEffect="non-scaling-stroke"/><polygon points={poly(draft)} fill="none" stroke={color} strokeWidth={2} strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/>{sizeLabels(draft,draft.width*base.metersPerPixel!,draft.depth*base.metersPerPixel!)}</>}
   {!polygonMode&&points.length>0&&lineEnd&&<><line x1={points[0].x} y1={points[0].z} x2={lineEnd.x} y2={lineEnd.z} stroke="white" strokeWidth={5} vectorEffect="non-scaling-stroke"/><line x1={points[0].x} y1={points[0].z} x2={lineEnd.x} y2={lineEnd.z} stroke={color} strokeWidth={2} strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/>{label({x:(points[0].x+lineEnd.x)/2,z:(points[0].z+lineEnd.z)/2},format(Math.hypot(points[0].x-lineEnd.x,points[0].z-lineEnd.z)))}</>}
   {polygonMode&&points.length>0&&<><polyline points={[...points,...(previewHover?[previewHover]:[])].map(p=>`${p.x},${p.z}`).join(' ')} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke"/>{points.map((a,i)=>{const b=points[i+1]??previewHover;return b?<g key={i}>{label(midpoint(a,b),format(Math.hypot(a.x-b.x,a.z-b.z)))}</g>:null;})}</>}
   {points.map(marker)}
   </g>
   {(dragSnap||drawingSnap)&&(()=>{
    const target=dragSnap??previewHover??drawingSnap!.point;
    return <circle data-drawing-snap cx={target.x} cy={target.z} r={4*unit} fill="white" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none"/>;
   })()}
   {editing&&base.metersPerPixel&&(()=>{
    const rect=edited??editRect,cs=corners(imageRect(rect));
    const drag=outlineDrag;
    const begin=(e:React.PointerEvent,index:number,edge:boolean)=>{
     if(e.button!==0||space.current||panMode)return;
     const point=pos(e);if(!point)return;
     e.preventDefault();
     e.stopPropagation();
     resize.current={rect,index,edge,start:toLocal(imageToWorld(point,outlineCoordinates),rect),before:edited};
     setOutlineDrag({index,edge});
     svg.current?.setPointerCapture(e.pointerId);
    };
    return <g data-outline-edit>
     <polygon points={poly(imageRect(rect))} fill="none" stroke="white" strokeWidth={4} vectorEffect="non-scaling-stroke" pointerEvents="none"/>
     <polygon points={poly(imageRect(rect))} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none"/>
     {cs.map((p,i)=><line key={'e'+i} data-outline-edge={i} x1={p.x} y1={p.z} x2={cs[(i+1)%cs.length].x} y2={cs[(i+1)%cs.length].z} stroke="transparent" strokeWidth={14} vectorEffect="non-scaling-stroke" style={{cursor:panMode?undefined:'move'}} onPointerDown={e=>begin(e,i,true)}/>)}
     {drag&&cs.map((p,i)=>{
      if(drag.index!==i&&(drag.edge||i!==(drag.index+cs.length-1)%cs.length))return null;
      const next=cs[(i+1)%cs.length];
      return <g key={'size'+i}>{label(midpoint(p,next),format(Math.hypot(p.x-next.x,p.z-next.z)))}</g>;
     })}
     {cs.map((p,i)=><g key={i}>
      <circle data-outline-corner={i} cx={p.x} cy={p.z} r={10*unit} fill="transparent" style={{cursor:panMode?undefined:'move'}} onPointerDown={e=>begin(e,i,false)}/>
      <circle cx={p.x} cy={p.z} r={5*unit} fill="white" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none"/>
      <circle cx={p.x} cy={p.z} r={2*unit} fill={color} pointerEvents="none"/>
     </g>)}
    </g>;
   })()}
  </svg>
 </div>;
}
