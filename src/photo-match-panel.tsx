import {BaseImageClip} from './base-image-clip';
import {useDialog} from './use-dialog';
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {RoofDesign} from './roof-project';
import {roofRect} from './roof-project';
import {corners} from './domain';
import type {BaseImage} from './base-image';
import {worldToImage} from './drawing-geometry';
import {loadDrawing} from './drawing-import';
import {Icon} from './workbench-ui';
import {defaultPhotoShadowStrength,photoPanelColors,applyEdit,cornerProblem,editOf,usesHeightCalibration,parsePhotoViews,photoRoofSignature,type PhotoEdit,type PhotoView,type PhotoPoint,type PhotoRenderOptions,type SitePoint} from './photo-match';
import {newId} from './ids';
import {solvePhotoCamera,solvePointCamera,type PhotoCamera} from './photo-solve';
import {PointPhotoOverlay,PointPlanOverlay,PointTools,isPointTool,defaultHeight,nearestTarget,nextPoint,snapTargets,roofCornerTargets,type PointTool} from './photo-points';
import {exifLens35,dataUrlBytes} from './photo-exif';
import {LineTools,PhotoInset,PhotoLineOverlay,PlanOverlay,isLineTool,planBox,snapPlan,type LineTool} from './photo-lines';
import type {ImageOverlay} from './image-overlays';
import {PhotoGuide} from './photo-guide';
import './photo-match.css';
import {daylightMinutes,defaultSunSettings,nearestDaylight,sunPosition,timeLabel,validSunSettings,type SunSettings} from './sun-position';
import {renderPhotoPreview} from './photo-preview';
import {coreEdition,tx} from './i18n';
type Props={onSave:(items:PhotoView[],sites:SitePoint[])=>Promise<boolean>;sunSettings?:SunSettings;roofs:RoofDesign[];
 /** Every roof and carport of the project; line views show them all. */
 site:RoofDesign[];initialId:string;base?:BaseImage;
 /** Pictures laid over the drawing; the plan view shows them too. */
 overlays?:ImageOverlay[];items:PhotoView[];
 /** Site points: picked once on the plan, used by every point-method photo. */
 sitePoints:SitePoint[];onApply:(items:PhotoView[],sites:SitePoint[])=>void;onClose:()=>void};
/** Pick four widely separated vertices, keeping their original outline order. */
function spreadVertices<T extends {x:number;z:number}>(vertices:T[]){
 const picked:number[]=[0];
 while(picked.length<4){
  let next=-1,best=-1;
  vertices.forEach((point,index)=>{
   const separation=Math.min(...picked.map(i=>Math.hypot(point.x-vertices[i].x,point.z-vertices[i].z)));
   if(separation>best&&!picked.includes(index)){next=index;best=separation;}
  });
  picked.push(next);
 }
 return picked.sort((a,b)=>a-b).map(i=>vertices[i]);
}
export function PhotoMatchPanel({roofs,site,initialId,base,overlays,items,sitePoints,onApply,onClose,sunSettings,onSave}:Props){
 const [all,setAll]=useState(()=>structuredClone(items)),[id,setId]=useState(()=>roofs.some(r=>r.id===initialId)?initialId:roofs[0]?.id),[viewId,setViewId]=useState(''),[tool,setTool]=useState<'corners'|'height'|'pan'|'mask'|LineTool|PointTool>('corners'),[sites,setSites]=useState(()=>structuredClone(sitePoints)),[active,setActive]=useState<string>(),[dragging,setDragging]=useState(false),[pending,setPending]=useState<PhotoPoint>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0});
 const [referenceMode,setReferenceMode]=useState<'corners'|'custom'>('corners');
 const [markingView,setMarkingView]=useState<string>();
 const [confirmed,setConfirmed]=useState<string>();
 const [defaultPointIds,setDefaultPointIds]=useState<string[]>([]);
 const [customDraft,setCustomDraft]=useState<SitePoint[]|null>(null);
 const [draftUndo,setDraftUndo]=useState<SitePoint[][]>([]);
 const [views,setViews]=useState({plan:{zoom:1,x:0,y:0},photo:{zoom:1,x:0,y:0}});
 const [previewZoom,setPreviewZoom]=useState(1);
 const [previewOffset,setPreviewOffset]=useState({x:0,y:0});
 const [previewPan,setPreviewPan]=useState(false);
 const [renderWholeSite,setRenderWholeSite]=useState(false);
 const previewDrag=useRef<{pointerId:number;x:number;y:number}|null>(null);
 const fitPreview=()=>{setPreviewZoom(1);setPreviewOffset({x:0,y:0});};
 const zoomPreview=(factor:number)=>setPreviewZoom(value=>Math.max(1,Math.min(4,value*factor)));
 const [preview,setPreview]=useState<{url:string;rmse:number;width:number;height:number;settingsKey:string;sunElevation:number}|null>(null);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
 const [maskDraft,setMaskDraft]=useState<PhotoPoint[]>([]),[drawingMask,setDrawingMask]=useState(false),[selectedMask,setSelectedMask]=useState<number|null>(null);
 const [undo,setUndo]=useState<{views:PhotoView[];sites:SitePoint[]}[]>([]),[guide,setGuide]=useState<number|null>(null),[planHover,setPlanHover]=useState<{x:number;z:number}>();
 const file=useRef<HTMLInputElement>(null),alive=useRef(true),opened=useRef({all,sites}),lastCamera=useRef<PhotoCamera>(undefined);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const drag=useRef<{kind:'corner'|'height'|'pan'|'mask'|'line'|'ref'|'plan'|'site'|'pmark';index:number;point?:string;end?:'a'|'b';mask?:number;start:PhotoPoint;offset:PhotoPoint}|null>(null);
 // A roof can have several photos; the strip picks one. `m` adds the classic corner and height form to the selected view.
 const r=roofs.find(r=>r.id===id)??roofs[0],own=all.filter(v=>v.roofId===id),savedView=own.find(v=>v.id===viewId)??own[0];
 const legacyInCore=coreEdition&&!!savedView&&savedView.method!=='points';
 const view=useMemo(()=>legacyInCore?{...savedView!,method:'points' as const}:savedView,[savedView,legacyInCore]);
 const m=view&&{...view,...editOf(view)};
 useEffect(()=>{setMaskDraft([]);setDrawingMask(false);setSelectedMask(null);},[id,view?.id]);
 // Line views find the camera from drawn lines and show the whole site; older views mark four corners of one roof.
 const lines=view?.method==='lines',points=view?.method==='points',northAngle=base?.northAngle??r.northAngle??0,targets=useMemo(()=>snapTargets(site),[site]);
 // Point views solve again on every change; while a point is dragged they start from the last camera so it stays smooth.
 const pointSolve=useMemo(()=>points?solvePointCamera(view!,sites,dragging?lastCamera.current:undefined):undefined,[view,sites,dragging,points]);
 const solve=useMemo(()=>lines?solvePhotoCamera(view!):pointSolve,[view,lines,pointSolve]);
 useEffect(()=>{if(pointSolve?.camera)lastCamera.current=pointSolve.camera;},[pointSolve]);
 const legacyPolygon=!!r.roof.outline&&!!view&&!lines&&!points;
 const pointKey=view?JSON.stringify([view.id,view.marks,sites]):'';
 const marking=!!view&&markingView===view.id;
 const markIds=view?.marks.flatMap(mark=>mark.anchor.kind==='site'?[mark.anchor.pointId]:[])??[];
 const selectedIds=referenceMode==='corners'&&!r.carport?defaultPointIds:(view?.referencePointIds??markIds);
 const visibleSites=coreEdition?selectedIds.flatMap(id=>sites.filter(point=>point.id===id)):sites;
 const selectingCustom=coreEdition&&customDraft!==null;
 const planMode=coreEdition?selectingCustom:lines&&tool==='plan'||points&&tool==='pointPlan';
 useEffect(()=>setPending(undefined),[tool,view?.id]);
 const firstTool=(v?:PhotoView)=>v&&(coreEdition||v.method==='points')?(sites.length>=4?'pointPhoto':'pointPlan'):v?.method==='lines'?'reference':'corners';
 // An opened view starts on the first tool of its own method.
 useEffect(()=>{if(points&&(tool==='corners'||isLineTool(tool)))setTool(firstTool(view));else if(lines&&(tool==='corners'||isPointTool(tool)))setTool('reference');else if(!lines&&!points&&(isLineTool(tool)||isPointTool(tool)))setTool('corners');},[lines,points,tool]);
 useEffect(()=>{if(points&&tool==='pointPhoto'&&(!active||!sites.some(p=>p.id===active)))setActive(nextPoint(view!,sites)?.id);},[view?.id,tool]);
 const projectSun=sunSettings??defaultSunSettings();
 const savedOptions:PhotoRenderOptions=m?.renderOptions??{quality:'fine',weather:'sunny',sun:projectSun};
 const options:PhotoRenderOptions=coreEdition?{
  ...savedOptions,quality:'fine',maxEdge:4096,
  sun:{...projectSun,date:savedOptions.sun.date,time:savedOptions.sun.time},
 }:savedOptions;
 const wholeSite=coreEdition&&renderWholeSite&&site.length>1;
 const renderRoofs=coreEdition&&!wholeSite?[r]:site;
 const hasRenderArrays=renderRoofs.some(roof=>roof.arrays.length>0);
 const settingsKey=JSON.stringify([options,wholeSite]);
 const checkpoint=()=>setUndo(v=>[...v.slice(-29),{views:structuredClone(all),sites:structuredClone(sites)}]);
 const update=(patch:Partial<PhotoEdit>)=>setAll(v=>v.map(x=>x.id===view?.id?applyEdit(x,{...editOf(x),...patch}):x));
 const updateView=(patch:Partial<PhotoView>)=>setAll(v=>v.map(x=>x.id===view?.id?{...x,...(coreEdition?{method:'points' as const}:{}),...patch}:x));
 const paneKey=planMode?'plan':'photo';
 const changeZoom=(scale:(zoom:number)=>number,key:keyof typeof views=paneKey)=>coreEdition
  ?setViews(v=>({...v,[key]:{...v[key],zoom:scale(v[key].zoom)}})):setZoom(scale);
 const fit=()=>{setZoom(1);setOffset({x:0,y:0});setViews({plan:{zoom:1,x:0,y:0},photo:{zoom:1,x:0,y:0}});};
 // Closing keeps the work in the project (undo can take it back); only saving writes the file.
 const close=()=>{alive.current=false;if(all!==opened.current.all||sites!==opened.current.sites)try{onApply(parsePhotoViews(all,sites),sites)}catch{/* An unfinished view is dropped. */}onClose();};
 useDialog('.photo-match-dialog[role="dialog"]',true,close);
 async function importPhoto(f?:File){if(!f||busy||coreEdition&&own.length)return;setBusy(true);setError('');try{if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>8*1024*1024)throw new Error(tx('请选择不超过8MB的 JPG、PNG 或 WebP 图片'));const photo=await loadDrawing(f);if(!alive.current)return;const lens35=f.type==='image/jpeg'?exifLens35(dataUrlBytes(photo.url)):undefined;const next:PhotoView={id:newId(),roofId:id,name:f.name,url:photo.url,width:photo.width,height:photo.height,marks:[],roofSignature:photoRoofSignature(r),method:'points',...(lens35?{lens35,lensFromFile:true}:{})};const list=all.concat(next);parsePhotoViews(list,sites);checkpoint();setAll(list);setViewId(next.id);fit();setTool(firstTool(next));setActive(sites[0]?.id);}catch(e){setError((e as Error).message);}finally{if(alive.current)setBusy(false);}}
 async function saveAnnotations(){setBusy(true);setError('');try{const next=parsePhotoViews(all.map(x=>x.id===view?.id?{...x,...(coreEdition?{method:'points' as const}:{}),renderOptions:options,roofSignature:photoRoofSignature(r)}:x),sites);onApply(next,sites);const saved=await onSave(next,sites);if(alive.current)setError(saved?tx('已保存到项目 JSON'):tx('未写入文件：保存已取消或失败，请重试。'));}catch(e){setError((e as Error).message);}finally{if(alive.current)setBusy(false);}}
 async function generate(){if(!m||!view)return;setBusy(true);setError('');try{await new Promise(resolve=>setTimeout(resolve,30));const result=await renderPhotoPreview(view,r,{...options,maxEdge:options.maxEdge??(options.quality==='fine'?4096:2048)},northAngle,renderRoofs,sites,coreEdition);if(!alive.current){URL.revokeObjectURL(result.url);return;}onApply(parsePhotoViews(all.map(x=>x.id===view.id?{...x,...(coreEdition?{method:'points' as const}:{}),renderOptions:options,roofSignature:photoRoofSignature(r)}:x),sites),sites);setPreview({...result,settingsKey});}catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setBusy(false);}}
 const heightEnabled=m?usesHeightCalibration(m):false;
 useEffect(()=>{if(!heightEnabled&&tool==='height')setTool('corners');},[heightEnabled,tool]);
 const planBounds=coreEdition?planBox(selectingCustom?site:[r],undefined,undefined):m?planBox(site,base,view,solve):{x:0,y:0,w:1,h:1};
 const thumbPoints=visibleSites.map(({x,z})=>({x,z}));
 const left=Math.min(planBounds.x-planBounds.w*.10,...thumbPoints.map(point=>point.x-planBounds.w*.06));
 const top=Math.min(planBounds.y-planBounds.h*.18,...thumbPoints.map(point=>point.z-planBounds.h*.06));
 const thumbWidth=Math.max(planBounds.x+planBounds.w*1.10,...thumbPoints.map(point=>point.x+planBounds.w*.06))-left;
 const thumbHeight=Math.max(planBounds.y+planBounds.h*1.18,...thumbPoints.map(point=>point.z+planBounds.h*.06))-top;
 const photoBounds={x:0,y:0,w:m?.width??1,h:m?.height??1};
 const box=!m?{x:0,y:0,w:1,h:1}:planMode?planBounds:photoBounds,vb={x:box.x+(box.w-box.w/zoom)/2+offset.x,y:box.y+(box.h-box.h/zoom)/2+offset.y,w:box.w/zoom,h:box.h/zoom};
 useEffect(()=>{if(!coreEdition){setZoom(1);setOffset({x:0,y:0});}},[planMode]);
 function point(e:React.PointerEvent<SVGSVGElement>){const matrix=e.currentTarget.getScreenCTM();if(!matrix)return {x:0,y:0};const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return {x:p.x,y:p.y};}
 function down(e:React.PointerEvent<SVGSVGElement>,isPlan:boolean,canvasUnit:number){if(!m||(e.button!==0&&e.button!==1)||isPlan&&points&&(drawingMask||tool==='mask'))return;const p=point(e);if(e.button===1){e.preventDefault();drag.current={kind:'pan',index:0,start:p,offset};e.currentTarget.setPointerCapture(e.pointerId);return;}const target=e.target as SVGElement;const kind=target.dataset.kind as 'corner'|'height'|'mask'|undefined;const index=Number(target.dataset.index??0);if(drawingMask){if(p.x>=0&&p.y>=0&&p.x<=m.width&&p.y<=m.height&&maskDraft.length<200)setMaskDraft(v=>[...v,p]);return;}if(isPlan&&customDraft&&tool!=='pan'){
  const target=nearestTarget({x:p.x,z:p.y},targets,canvasUnit*14);
  const q=target??{x:p.x,z:p.y},h=defaultHeight(target);
  const selected=customDraft.find(point=>Math.hypot(point.x-q.x,point.z-q.z)<.05);
  if(!selected&&customDraft.length>=300)return;
  const existing=sites.find(point=>Math.hypot(point.x-q.x,point.z-q.z)<.05&&Math.abs(point.h-h)<.05);
  setDraftUndo(previous=>[...previous,customDraft]);
  setCustomDraft(selected?customDraft.filter(point=>point!==selected):[...customDraft,existing??{id:newId(),name:'',x:q.x,z:q.z,h,source:'measured'}]);
  return;
 }if(points&&view&&!drawingMask&&isPointTool(tool)){
  if(coreEdition&&!marking)return;
  pointDown(e,p,target,isPlan,canvasUnit);return;
 }if(lines&&view&&isLineTool(tool)){lineDown(e,p,target,canvasUnit);return;}const activeKind=kind==='corner'?tool==='corners':kind==='height'?tool==='height':kind==='mask'?tool==='mask':false;if(activeKind||tool==='pan'){checkpoint();drag.current={kind:tool==='pan'?'pan':kind!,index,mask:Number(target.dataset.mask??0),start:p,offset};e.currentTarget.setPointerCapture(e.pointerId);return;}
 if(p.x<0||p.y<0||p.x>m.width||p.y>m.height)return;
 checkpoint();if(tool==='corners'){if(m.corners.length<4)update({corners:[...m.corners,p],heightPoints:[]});}else if(tool==='height'&&heightEnabled){if(m.heightMode==='below'){const a=m.corners[m.anchor];if(a)update({heightPoints:[a,p]});}else if(m.heightPoints.length<2)update({heightPoints:[...m.heightPoints,p]});}}
 // Point tools: on the plan a click picks a model corner or post (or selects a picked one); in the photo it places the selected point, then moves on.
 function pointDown(e:React.PointerEvent<SVGSVGElement>,p:PhotoPoint,target:SVGElement,isPlan:boolean,canvasUnit:number){
  const paneTool=isPlan?'pointPlan':'pointPhoto';
  const v=view!,id=target.dataset.point,start=(kind:'site'|'pmark',point:string)=>{checkpoint();setActive(point);drag.current={kind,index:0,point,start:p,offset};if(kind==='pmark')setDragging(true);e.currentTarget.setPointerCapture(e.pointerId);};
  // A click on a picked point selects it, unless another corner or post is closer to the click: then that one is added.
  if(tool!==paneTool){
   setTool(paneTool);
   // Existing numbered points are draggable after their pane is active.
   if(target.dataset.point){setActive(target.dataset.point);return;}
  }
  const nearby=isPlan?nearestTarget({x:p.x,z:p.y},targets,canvasUnit*14):undefined,own=sites.find(s=>s.id===id);
  if(id&&own&&target.dataset.kind==='site'&&isPlan&&!(nearby&&Math.hypot(nearby.x-own.x,nearby.z-own.z)>.05&&Math.hypot(nearby.x-p.x,nearby.z-p.y)<Math.hypot(own.x-p.x,own.z-p.y))){start('site',id);return;}
  if(id&&target.dataset.kind==='pmark'&&!isPlan){start('pmark',id);return;}
  if(isPlan){
   const t=nearestTarget({x:p.x,z:p.y},targets,canvasUnit*14),q=t??{x:p.x,z:p.y},same=sites.find(s=>Math.hypot(s.x-q.x,s.z-q.z)<.05);
   if(same){setActive(same.id);return;}
   const point:SitePoint={id:newId(),name:'',x:q.x,z:q.z,h:defaultHeight(t),source:'measured'};checkpoint();setSites(list=>[...list,point]);setActive(point.id);return;
  }
  if(p.x<0||p.y<0||p.x>v.width||p.y>v.height)return;
  const point=coreEdition?nextPoint(v,visibleSites)?.id:active&&visibleSites.some(s=>s.id===active)?active:nextPoint(v,visibleSites)?.id;if(!point)return;
  const marks=[...v.marks.filter(k=>!(k.anchor.kind==='site'&&k.anchor.pointId===point)),{id:`site-${point}`,anchor:{kind:'site' as const,pointId:point},at:p,role:'fit' as const}];
  checkpoint();updateView({marks});setActive(nextPoint({...v,marks},visibleSites,point)?.id??point);
 }
 // Line tools: drag an end of the active kind, or click twice to draw; the reference line restarts after both ends are set.
 function lineDown(e:React.PointerEvent<SVGSVGElement>,p:PhotoPoint,target:SVGElement,unit:number){
  const v=view!,kind=target.dataset.kind,end=target.dataset.end as 'a'|'b'|undefined,ref=v.reference??{};
  if(end&&(kind==='plan'?tool==='plan':kind==='ref'?tool==='reference':kind==='line'&&v.lines?.[Number(target.dataset.index)]?.kind===tool)){checkpoint();drag.current={kind:kind as 'line'|'ref'|'plan',index:Number(target.dataset.index??0),end,start:p,offset};e.currentTarget.setPointerCapture(e.pointerId);return;}
  if(tool==='plan'){const q=snapPlan({x:p.x,z:p.y},site,unit*10);checkpoint();updateView({reference:ref.planA&&!ref.planB?{...ref,planB:q}:{...ref,planA:q,planB:undefined}});if(ref.planA&&!ref.planB)setTool('vertical');return;}
  if(p.x<0||p.y<0||p.x>v.width||p.y>v.height)return;
  if(tool==='reference'){checkpoint();updateView({reference:ref.a&&!ref.b?{...ref,b:p}:{...ref,a:p,b:undefined}});if(ref.a&&!ref.b&&!(ref.planA&&ref.planB))setTool('plan');return;}
  if(!pending){setPending(p);return;}
  if(Math.hypot(p.x-pending.x,p.y-pending.y)<3)return;
  checkpoint();updateView({lines:[...(v.lines??[]),{id:newId(),kind:tool as 'vertical'|'along'|'across'|'measure',a:pending,b:p}]});setPending(undefined);
 }
 function move(e:React.PointerEvent<SVGSVGElement>,isPlan:boolean,canvasUnit:number){const d=drag.current;if(isPlan&&d?.kind!=='pan'){const p=point(e),q=points?nearestTarget({x:p.x,z:p.y},targets,canvasUnit*14)??{x:p.x,z:p.y}:snapPlan({x:p.x,z:p.y},site,canvasUnit*10);setPlanHover(q.x!==p.x||q.z!==p.y?q:undefined);}if(!d||!m)return;const p=point(e);if(d.kind==='pan'){
  const moveBy={x:d.start.x-p.x,y:d.start.y-p.y};
  if(coreEdition){const key=isPlan?'plan':'photo';setViews(v=>({...v,[key]:{...v[key],x:v[key].x+moveBy.x,y:v[key].y+moveBy.y}}));}
  else setOffset(o=>({x:o.x+moveBy.x,y:o.y+moveBy.y}));
  return;
 }const q={x:Math.max(0,Math.min(m.width,p.x)),y:Math.max(0,Math.min(m.height,p.y))};
 if(d.kind==='site'){const t=nearestTarget({x:p.x,z:p.y},targets,canvasUnit*14);setSites(list=>list.map(s=>s.id!==d.point?s:{...s,x:t?.x??p.x,z:t?.z??p.y,h:s.h===0||!t?s.h:t.top}));return;}
 if(d.kind==='pmark'){updateView({marks:m.marks.map(k=>k.anchor.kind==='site'&&k.anchor.pointId===d.point?{...k,at:q}:k)});return;}
 if(d.kind==='plan'){updateView({reference:{...m.reference,[d.end==='a'?'planA':'planB']:snapPlan({x:p.x,z:p.y},site,canvasUnit*10)}});return;}
 if(d.kind==='ref'){updateView({reference:{...m.reference,[d.end!]:q}});return;}
 if(d.kind==='line'){updateView({lines:(m.lines??[]).map((l,i)=>i===d.index?{...l,[d.end!]:q}:l)});return;}if(d.kind==='corner'){const next=m.corners.map((p,i)=>i===d.index?q:p);update({corners:next,...(m.heightMode==='below'&&m.heightPoints.length&&d.index===m.anchor?{heightPoints:[q,...m.heightPoints.slice(1)]}:{})});}else if(d.kind==='mask'){updateView({occlusions:(m.occlusions??[]).map((polygon,i)=>i===d.mask?polygon.map((v,j)=>j===d.index?q:v):polygon)});}else{if(m.heightMode==='below'&&d.index===0)return;update({heightPoints:m.heightPoints.map((p,i)=>i===d.index?q:p)});}}
 useEffect(()=>{drag.current=null;},[tool,drawingMask,id,view?.id]);
 const refPoints=corners(roofRect(r));const reference=base?.metersPerPixel?refPoints.map(p=>{const q=worldToImage(p,base);return {x:q.x,y:q.z};}):[{x:0,y:0},{x:r.roof.width,y:0},{x:r.roof.width,y:r.roof.depth},{x:0,y:r.roof.depth}];
 const xs=reference.map(p=>p.x),ys=reference.map(p=>p.y),rw=Math.max(...xs)-Math.min(...xs),rh=Math.max(...ys)-Math.min(...ys),pad=Math.max(rw,rh)*.15;
 const problem=m&&!points&&!lines&&!legacyPolygon?cornerProblem(m.corners):'';
 function finishMask(){if(!m||maskDraft.length<3)return;checkpoint();updateView({occlusions:[...(m.occlusions??[]),maskDraft]});setSelectedMask((m.occlusions??[]).length);setMaskDraft([]);setDrawingMask(false);}
 function useRoofCorners(switchMethod=false){
  const vertices=roofCornerTargets(r);
  const selected=coreEdition&&vertices.length>4?spreadVertices(vertices):vertices;
  const picked=selected.map(({x,z,top})=>sites.find(p=>Math.hypot(p.x-x,p.z-z)<.05&&Math.abs(p.h-top)<.05)??{id:newId(),name:'',x,z,h:top,source:'measured' as const});
  const added=picked.filter(p=>!sites.some(existing=>existing.id===p.id));
  if(sites.length+added.length>500){setError(tx('现场测量点无效'));return;}
  setError('');
  if(added.length){checkpoint();setSites([...sites,...added]);}
  const ids=picked.map(p=>p.id);
  setDefaultPointIds(ids);
  if(switchMethod){
   if(!added.length)checkpoint();
   updateView({pointMode:'corners',referencePointIds:undefined,marks:view!.marks.filter(mark=>mark.anchor.kind==='site'&&ids.includes(mark.anchor.pointId))});
   setConfirmed(undefined);setMarkingView(undefined);setCustomDraft(null);
  }
  setActive(nextPoint(view!,picked)?.id??picked[0]?.id);
  setTool('pointPhoto');
 }
 function startCustom(){
  setDraftUndo([]);setCustomDraft(referenceMode==='custom'?visibleSites:[]);
  setTool('pointPlan');
 }
 function finishCustom(){
  if(!view||!customDraft||customDraft.length<4)return;
  const added=customDraft.filter(point=>!sites.some(site=>site.id===point.id));
  if(sites.length+added.length>500){setError(tx('现场测量点无效'));return;}
  const ids=customDraft.map(point=>point.id);
  checkpoint();
  setSites([...sites,...added]);
  updateView({pointMode:'custom',referencePointIds:ids,marks:view.marks.filter(mark=>mark.anchor.kind==='site'&&ids.includes(mark.anchor.pointId))});
  setReferenceMode('custom');setCustomDraft(null);setConfirmed(undefined);setMarkingView(undefined);
  setError('');setTool('pointPhoto');
 }
 useEffect(()=>{
  setMarkingView(undefined);setCustomDraft(null);
  if(!coreEdition||!view)return;
  const mode=view.pointMode??(r.carport||markIds.length?'custom':'corners');
  setReferenceMode(mode);
  if(mode==='corners')useRoofCorners();
 },[view?.id,r.id]);
 const activeNumber=visibleSites.findIndex(s=>s.id===active)+1;
 const status=points&&planMode?tx('点选屋角、车棚组件角或立柱（会吸附）；可拖动已选的点'):points&&tool==='pointPhoto'?(activeNumber?tx('在照片中点出点 {0}；可拖动已点的点调整',activeNumber):tx('全部点已完成，可拖动调整')):planMode?tx('在平面图上点出参考线的两端，可拖动调整'):lines&&isLineTool(tool)?(pending?tx('再点一下完成这条线'):solve?.camera?tx('相机已确定：线框为平面图中的屋面和车棚，应与照片对齐'):tx('按左侧提示画线，可拖动端点调整')):drawingMask?tx('沿遮挡物轮廓逐点圈选，至少三点后点击完成'):tool==='mask'?tx('选择遮挡区域，拖动角点调整'):!m?tx('导入现场照片'):tool==='pan'?tx('拖动平移，滚轮缩放'):tool==='corners'?(m.corners.length<4?tx('点选照片中的角 {0}',m.corners.length+1):tx('四角已标注，可拖动圆点调整')):m.heightMode==='below'?tx('点选角 {0} 正下方的墙脚',m.anchor+1):(m.heightPoints.length===0?tx('点选设备在屋面上的底点'):m.heightPoints.length===1?tx('点选设备顶部对应点'):tx('高度线已标注，可拖动端点调整'));
 const next=points&&view?nextPoint(view,visibleSites):undefined;
 const savedMarks=view&&opened.current.all.find(item=>item.id===view.id)?.marks;
 const savedReady=!!view&&view.roofSignature===photoRoofSignature(r)&&visibleSites.length>=4&&!next
  &&savedMarks!==undefined&&JSON.stringify(savedMarks)===JSON.stringify(view.marks)
  &&visibleSites.every(point=>opened.current.sites.some(saved=>saved.id===point.id&&saved.x===point.x&&saved.z===point.z&&saved.h===point.h));
 const ready=!!view&&!marking&&!!solve?.camera&&(confirmed===pointKey||savedReady);
 const changeOptions=(patch:Partial<PhotoRenderOptions>)=>updateView({renderOptions:{...options,...patch}});
 const sun=options.sun;
 const {date,latitude,longitude,utcOffset}=sun;
 const daylight=useMemo(()=>daylightMinutes({date,latitude,longitude,utcOffset}),[date,latitude,longitude,utcOffset]);
 const daylightIndex=nearestDaylight(daylight,sun.time),lastDaylight=daylight.length-1;
 const validSun=validSunSettings(sun),solar=validSun?sunPosition(sun):null,dirty=preview?.settingsKey!==settingsKey;
 const renderScope=coreEdition&&site.length>1&&<section className="photo-render-group">
  <h3>{tx('渲染范围')}</h3>
  <div className="photo-pair-actions seg-track" role="group" aria-label={tx('渲染范围')}>
   <button className="seg-btn" type="button" disabled={busy} aria-pressed={!wholeSite} onClick={()=>setRenderWholeSite(false)}>{tx('当前屋面')}</button>
   <button className="seg-btn" type="button" disabled={busy} aria-pressed={wholeSite} onClick={()=>setRenderWholeSite(true)}>{tx('整个项目')}</button>
  </div>
 </section>;
 const shadowAvailable=options.quality!=='simple'&&options.weather==='sunny'&&!!solar?.daylight;
 const adjustment=(label:string,value:number,min:number,max:number,step:number,change:(n:number)=>void,disabled=false)=>
  <label className="photo-appearance-slider"><span>{label}</span><output>{Math.round(value*100)}%</output>
   <input type="range" min={min} max={max} step={step} value={Math.round(value*100)} style={{'--photo-slider-progress':`${(value*100-min)/(max-min)*100}%`} as CSSProperties} disabled={disabled} aria-label={label} onChange={e=>change(Number(e.target.value)/100)}/>
  </label>;
 const currentColor=options.panelColor??(options.panelFinish==='charcoal'?'black':options.panelFinish==='blue-grey'?'grayBlue':'blueBlack');
 const settings=<div className="photo-render-settings" inert={busy}>
  <section className="photo-render-group">
   <h3>{tx('组件外观')}</h3>
   <div className="seg-track photo-color-options" role="group" aria-label={tx('组件颜色')}>
    {([['blueBlack',tx('蓝黑')],['deepBlue',tx('深蓝')],['black',tx('纯黑')],['grayBlue',tx('灰蓝')]] as const).map(([key,label])=>
     <button key={key} className="seg-btn" type="button" aria-pressed={currentColor===key} onClick={()=>changeOptions({panelColor:key,panelFinish:undefined})}>
      <i aria-hidden="true" style={{background:photoPanelColors[key].swatch}}/>{label}
     </button>
    )}
   </div>
   {adjustment(tx('表面亮度'),options.brightness??1,40,180,5,v=>changeOptions({brightness:v}))}
   {adjustment(tx('反光'),options.reflection??.5,0,100,5,v=>changeOptions({reflection:v}),options.quality==='simple')}
  </section>
  <section className="photo-render-group">
   <h3>{tx('光照与阴影')}</h3>
   {adjustment(tx('阴影强度'),options.shadowStrength??defaultPhotoShadowStrength,0,100,1,v=>changeOptions({shadowStrength:v}),!shadowAvailable)}
  <label>{tx('天气')}<select value={options.weather} onChange={e=>changeOptions({weather:e.target.value as PhotoRenderOptions['weather']})}><option value="sunny">{tx('晴天')}</option><option value="overcast">{tx('阴天')}</option></select></label><label>{tx('日期')}<input data-1p-ignore type="date" value={sun.date} onInput={e=>changeOptions({sun:{...sun,date:e.currentTarget.value}})}/></label>
   <label className="photo-appearance-slider photo-time-slider"><span>{tx('当地时间')}</span><output>{sun.time}</output>
    <input type="range" aria-label={tx('光照时间')} aria-valuetext={sun.time} min={0} max={Math.max(0,lastDaylight)} value={daylightIndex}
     style={{'--photo-slider-progress':(lastDaylight>0?daylightIndex/lastDaylight*100:0)+"%"} as CSSProperties}
     disabled={lastDaylight<=0} onChange={e=>changeOptions({sun:{...sun,time:timeLabel(daylight[e.target.valueAsNumber])}})}/>
    {lastDaylight>=0&&<small className="photo-time-edges"><span>{timeLabel(daylight[0])}</span><span>{timeLabel(daylight[lastDaylight])}</span></small>}
   </label>{!coreEdition&&<details className="photo-render-location"><summary>{tx('光照地点')}</summary><label>{tx('纬度 °')}<input data-1p-ignore type="number" min="-90" max="90" step=".01" value={sun.latitude} onChange={e=>changeOptions({sun:{...sun,latitude:Number(e.target.value)}})}/></label><label>{tx('经度 °')}<input data-1p-ignore type="number" min="-180" max="180" step=".01" value={sun.longitude} onChange={e=>changeOptions({sun:{...sun,longitude:Number(e.target.value)}})}/></label><label>{tx('时区 UTC')}<input data-1p-ignore type="number" min="-12" max="14" step=".5" value={sun.utcOffset} onChange={e=>changeOptions({sun:{...sun,utcOffset:Number(e.target.value)}})}/></label></details>}<small>{solar?tx('太阳方位 {0}° · 高度 {1}°',solar.azimuth.toFixed(1),solar.elevation.toFixed(1)):tx('请填写有效地点和时间')}</small>{solar&&!solar.daylight&&<small>{tx('太阳在地平线以下，不产生直射光与日照阴影。')}</small>}</section>
  {!coreEdition&&<section className="photo-render-group photo-output-group">
   <h3>{tx('渲染设置')}</h3>
 <label>{tx('品质')}<select value={options.quality} onChange={e=>changeOptions({quality:e.target.value as PhotoRenderOptions['quality']})}><option value="simple">{tx('简单')}</option><option value="standard">{tx('标准')}</option><option value="fine">{tx('精细')}</option></select></label><label>{tx('出图尺寸')}<select value={options.maxEdge??(options.quality==='fine'?4096:2048)} onChange={e=>changeOptions({maxEdge:Number(e.target.value) as PhotoRenderOptions['maxEdge']})}><option value="2048">{tx('2K · 快速')}</option><option value="4096">{tx('4K · 推荐')}</option><option value="8192">{tx('8K · 高分辨率')}</option></select></label></section>}
{!coreEdition&&<button className="photo-save" disabled={!validSun||busy||!dirty} onClick={()=>void generate()}>{busy?tx('正在生成…'):tx('更新预览')}</button>}</div>;
 const undoButton=<button className="icon-button" title={tx('撤回实景标注')} aria-label={tx('撤回实景标注')} disabled={selectingCustom?!draftUndo.length:!undo.length} onClick={()=>{if(selectingCustom){setCustomDraft(draftUndo.at(-1)??[]);setDraftUndo(previous=>previous.slice(0,-1));return;}const last=undo[undo.length-1];setAll(last.views);setSites(last.sites);if(coreEdition){
  const restored=last.views.find(photo=>photo.id===view?.id);
  setReferenceMode(restored?.pointMode??(restored?.marks.some(mark=>mark.anchor.kind==='site')?'custom':'corners'));
 }setUndo(v=>v.slice(0,-1));}}><Icon name="reset"/></button>;
 const pointTools=points&&<PointTools view={view!} sites={visibleSites} tool={tool} setTool={setTool} active={active} setActive={setActive} solve={pointSolve} northAngle={northAngle} targets={targets} change={patch=>{checkpoint();updateView(patch);}} changeSites={(list,marks)=>{checkpoint();setSites(coreEdition?current=>[...current.filter(p=>!visibleSites.some(v=>v.id===p.id)),...list]:list);if(marks)setAll(v=>v.map(x=>({...x,marks:marks(x)})));}}/>;
 const drawCanvas=(isPlan:boolean)=>{
  if(!m)return null;
  const pane=isPlan?'plan':'photo';
  const bounds=isPlan?planBounds:photoBounds;
  const frame=views[pane];
  const canvasBox=coreEdition?{x:bounds.x+(bounds.w-bounds.w/frame.zoom)/2+frame.x,y:bounds.y+(bounds.h-bounds.h/frame.zoom)/2+frame.y,w:bounds.w/frame.zoom,h:bounds.h/frame.zoom}:isPlan===planMode?vb:bounds;
  const unit=Math.max(canvasBox.w/900,canvasBox.h/650);
  return <svg className="photo-canvas" aria-label={isPlan?tx('平面图中的点位'):tx('实景照片标注画布')} viewBox={`${canvasBox.x} ${canvasBox.y} ${canvasBox.w} ${canvasBox.h}`} onAuxClick={e=>e.preventDefault()} onPointerDown={e=>down(e,isPlan,unit)} onPointerMove={e=>move(e,isPlan,unit)} onPointerUp={()=>{drag.current=null;setDragging(false);}} onPointerCancel={()=>{drag.current=null;setDragging(false);}} onPointerLeave={()=>setPlanHover(undefined)} onWheel={e=>{if(coreEdition||isPlan===planMode)changeZoom(z=>Math.max(1,Math.min(isPlan?40:12,z*(e.deltaY<0?1.15:1/1.15))),pane);}}>
 {isPlan?<><PlanOverlay transparent={coreEdition} roofs={site} base={base} overlays={overlays} view={view!} solve={solve} unit={unit} hover={points?undefined:planHover}/>{points&&<PointPlanOverlay sites={customDraft??visibleSites} numbered={!selectingCustom} targets={targets} unit={unit} active={active} hover={planHover}/>}</>:<>
 <image href={m.url} width={m.width} height={m.height}/>{lines&&<PhotoLineOverlay view={view!} tool={tool} unit={unit} solve={solve} roofs={site} pending={pending}/>}{points&&<PointPhotoOverlay compact={coreEdition} view={view!} sites={visibleSites} solve={pointSolve} roofs={site} unit={unit} active={active} tool={tool}/>}{!points&&!lines&&!legacyPolygon&&<polygon points={m.corners.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#43bdff" strokeWidth={unit*2}/>}
 {(m.occlusions??[]).map((polygon,i)=><g key={`mask-${i}`}><polygon points={polygon.map(p=>`${p.x},${p.y}`).join(' ')} fill="#efaa4422" stroke="#efaa44" strokeWidth={unit*2} pointerEvents={tool==='mask'&&!drawingMask?'auto':'none'} onPointerDown={e=>{if(e.button!==0||drawingMask||tool!=='mask')return;e.stopPropagation();setSelectedMask(i);}}/>{selectedMask===i&&tool==='mask'&&!drawingMask&&polygon.map((p,j)=><circle key={j} data-kind="mask" data-mask={i} data-index={j} cx={p.x} cy={p.y} r={unit*7} fill="#9e610d" stroke="white" strokeWidth={unit*2}/>)}</g>)}
 {drawingMask&&<g pointerEvents="none"><polyline points={maskDraft.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#efaa44" strokeWidth={unit*2}/>{maskDraft.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={unit*5} fill="#efaa44"/>)}</g>}
 {heightEnabled&&<polyline points={m.heightPoints.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#ffc35a" strokeWidth={unit*2}/> }
 {!legacyPolygon&&(['corner','height'] as const).flatMap(kind=>(kind==='corner'?(tool==='corners'&&!drawingMask?m.corners:[]):heightEnabled&&tool==='height'&&!drawingMask?m.heightPoints:[]).map((p,i)=>kind==='height'&&m.heightMode==='below'&&i===0?null:<g key={kind+i}><circle data-kind={kind} data-index={i} cx={p.x} cy={p.y} r={unit*8} fill={kind==='corner'?'#176b96':'#a55d00'} stroke="white" strokeWidth={unit*2}/><text pointerEvents="none" x={p.x+unit*12} y={p.y-unit*10} fill="white" stroke="#153344" paintOrder="stroke" strokeWidth={unit*3} fontSize={unit*15}>{kind==='corner'?i+1:i===0?tx('起点'):tx('终点')}</text></g>))}</>}
 </svg>;
 };
 if(preview&&coreEdition)return <div className="photo-match-backdrop"><section className="photo-match-dialog photo-workspace" data-edition="core" role="dialog" aria-modal="true" aria-label={tx('实景匹配预览')}>
  <div className="photo-match-body">
   <aside>
    <div className="photo-operation-heading"><button onClick={()=>setPreview(null)}><Icon name="back"/>{tx('返回标注')}</button><button className="icon-button" aria-label={tx('关闭预览')} title={tx('关闭预览')} onClick={close}><Icon name="close"/></button></div>
    {renderScope}
    {settings}
    <div className="photo-operation-actions">
     {error&&<small role="alert">{error}</small>}
     {dirty&&!busy&&<small role="status">{tx('设置已更改，请更新渲染后下载。')}</small>}
     <small className="photo-export-size">{preview.width} × {preview.height} px</small>
     <button className="photo-save" disabled={!validSun||busy||!dirty} onClick={()=>void generate()}>
      <Icon name="refresh"/>{busy?tx('正在生成…'):tx('更新渲染')}
     </button>
     {!dirty&&!busy
      ?<a className="photo-download" href={preview.url} download={tx('{0}-实景效果.png',wholeSite?tx('整个项目'):r.name)}><Icon name="download"/>{tx('下载 PNG')}</a>
      :<button className="photo-download" disabled><Icon name="download"/>{tx('下载 PNG')}</button>}
    </div>
   </aside>
   <main className="photo-result-canvas">
    <div className="photo-view-tools photo-centered-tools" role="toolbar" aria-label={tx('画布工具')}>
     <button aria-label={tx('平移实景照片')} title={tx('平移实景照片')} aria-pressed={previewPan} onClick={()=>setPreviewPan(value=>!value)}><Icon name="pan"/></button>
     <button aria-label={tx('放大实景照片')} title={tx('放大实景照片')} disabled={previewZoom>=4} onClick={()=>zoomPreview(1.4)}><Icon name="zoom-in"/></button>
     <button aria-label={tx('缩小实景照片')} title={tx('缩小实景照片')} disabled={previewZoom<=1} onClick={()=>zoomPreview(1/1.4)}><Icon name="zoom-out"/></button>
     <button aria-label={tx('适应照片窗口')} title={tx('适应窗口')} onClick={fitPreview}><Icon name="frame"/></button>
    </div>
    <div className="photo-preview-image" data-pan={previewPan} onWheel={e=>zoomPreview(e.deltaY<0?1.15:1/1.15)}
     onPointerDown={e=>{
      if(e.button!==1&&!(previewPan&&e.button===0))return;
      e.preventDefault();
      previewDrag.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY};
      e.currentTarget.setPointerCapture(e.pointerId);
     }}
     onPointerMove={e=>{
      const previous=previewDrag.current;
      if(!previous||previous.pointerId!==e.pointerId)return;
      const dx=e.clientX-previous.x,dy=e.clientY-previous.y;
      previewDrag.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY};
      setPreviewOffset(value=>({x:value.x+dx,y:value.y+dy}));
     }}
     onLostPointerCapture={()=>{previewDrag.current=null;}}>
     <img draggable={false} style={{transform:`translate(${previewOffset.x}px,${previewOffset.y}px) scale(${previewZoom})`}} src={preview.url} alt={tx('光伏组件实景叠加效果')}/>
    </div>
   </main>
  </div>
 </section></div>;
 if(preview)return <div className="photo-match-backdrop"><section className={coreEdition?'photo-match-dialog photo-workspace':'photo-match-dialog'} data-edition={coreEdition?'core':undefined} role="dialog" aria-modal="true" aria-label={tx('实景匹配预览')}><header><h2>{tx('实景匹配 · 预览')}</h2><span>{tx('重投影误差')} {preview.rmse.toFixed(1)} px · {preview.width} × {preview.height}</span><button className="icon-button" aria-label={tx('关闭预览')} title={tx('关闭预览')} onClick={close}><Icon name="close"/></button></header><div className="photo-match-body"><aside>{settings}</aside><div className="photo-preview-image"><img src={preview.url} alt={tx('光伏组件实景叠加效果')}/></div></div><footer><span role="alert">{error||(dirty?tx('设置已更改，请更新预览后导出。'):preview.rmse>5?tx('匹配误差较大，请检查对应点。'):'')}</span><button disabled={busy} onClick={()=>void saveAnnotations()}><Icon name="save"/>{tx('保存项目')}</button><button disabled={busy} onClick={()=>setPreview(null)}>{tx('返回标注')}</button>{!dirty&&!busy&&<a className="photo-save photo-download" href={preview.url} download={tx('{0}-实景效果.png',own.length>1?`${r.name}-${own.indexOf(view!)+1}`:r.name)}><Icon name="download"/>{tx('下载 PNG')}</a>}</footer></section></div>;
 return <div className="photo-match-backdrop"><section className={coreEdition?'photo-match-dialog photo-workspace':'photo-match-dialog'} data-edition={coreEdition?'core':undefined} role="dialog" aria-modal="true" aria-label={tx('实景匹配标注')}>{!coreEdition&&<header><h2>{coreEdition?tx('实景匹配'):tx('实景匹配 · 标注')}</h2><button className="icon-button" aria-label={tx('取消实景标注')} title={tx('取消实景标注')} onClick={close}><Icon name="close"/></button></header>}<div className="photo-match-body"><aside inert={busy}>
 {coreEdition&&<div className="photo-operation-heading"><h2>{tx('实景匹配')}</h2><div>{undoButton}<button className="icon-button" aria-label={tx('取消实景标注')} title={tx('取消实景标注')} onClick={close}><Icon name="close"/></button></div></div>}
 <label className={coreEdition?'workbench-select-row':undefined}><span>{tx('对应屋面')}</span><select aria-label={tx('实景对应屋面')} value={id} disabled={busy} onChange={e=>{setId(e.target.value);setViewId('');setRenderWholeSite(false);fit();setTool(firstTool(all.find(v=>v.roofId===e.target.value)));}}>{roofs.map(r=>{const n=all.filter(v=>v.roofId===r.id).length;return <option value={r.id} key={r.id}>{!coreEdition&&n?tx('{0}（{1} 张照片）',r.name,n):r.name}</option>;})}</select></label>
 {m&&!lines&&!points&&!legacyPolygon&&<div className="photo-reference"><svg viewBox={`${Math.min(...xs)-pad} ${Math.min(...ys)-pad} ${rw+2*pad} ${rh+2*pad}`} aria-label={tx('图纸四角对应参考')}>{base?.metersPerPixel&&!base.blank&&base.visible!==false&&<BaseImageClip crop={base.crop} opacity={base.opacity}><image href={base.url} width={base.width} height={base.height}/></BaseImageClip>}<polygon points={reference.map(p=>`${p.x},${p.y}`).join(' ')} fill="#458fb929" stroke="#2484b5" strokeWidth={pad*.09}/>{reference.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r={pad*.36} fill="#176b96"/><text x={p.x} y={p.y} dy=".35em" textAnchor="middle" fill="white" fontSize={pad*.5}>{i+1}</text></g>)}</svg><small>{tx('图纸角点编号 ·')} {r.roof.width.toFixed(2)} × {r.roof.depth.toFixed(2)} m</small>{r.pitch&&<small>{tx('标屋面外轮廓四角，勿标屋脊。预览沿用当前屋面的坡度与屋脊方向。')}</small>}</div>}
 {!coreEdition&&own.length>0&&<div className="photo-views" aria-label={tx('本屋面照片')}>{own.map((v,i)=><button key={v.id} aria-label={tx('照片 {0}',i+1)} title={v.name} aria-pressed={v.id===view?.id} disabled={busy||drawingMask} onClick={()=>{setViewId(v.id);fit();setTool(firstTool(v));}}><img src={v.url} alt=""/><span>{i+1}</span></button>)}</div>}
 <div className="photo-file-row">
  {coreEdition&&m&&(own.length>1?<select aria-label={tx('现场照片')} value={view?.id} onChange={e=>{const next=own.find(photo=>photo.id===e.target.value);setViewId(e.target.value);fit();setTool(firstTool(next));}}>
   {own.map(photo=><option key={photo.id} value={photo.id}>{photo.name}</option>)}
  </select>:<span className="photo-file-name" title={m.name}>{m.name}</span>)}
  {(!coreEdition||!m)&&<button disabled={busy||drawingMask} onClick={()=>file.current?.click()}><Icon name="image"/>{m?tx('添加照片'):tx('导入现场照片')}</button>}
  {m&&<button type="button" className="icon-button" aria-label={tx('删除照片与标注')} title={tx('删除照片与标注')} disabled={busy||drawingMask||selectingCustom} onClick={()=>{checkpoint();setAll(v=>v.filter(x=>x.id!==view?.id));setViewId('');}}><Icon name="trash"/></button>}
 </div><input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label={tx('导入实景照片')} onChange={e=>{void importPhoto(e.target.files?.[0]);e.target.value='';}}/>
 {m&&<>
 {!coreEdition&&<label>{tx('相机定位方式')}<select value={points?'points':lines?'lines':'corners'} disabled={drawingMask} onChange={e=>{checkpoint();const method=e.target.value as 'points'|'lines'|'corners';updateView({method});setTool(firstTool({...view!,method}));}}><option value="points">{tx('点位对应（推荐，屋面和车棚）')}</option><option value="lines">{tx('线条定位（找不到角点时）')}</option><option value="corners" disabled={!!r.roof.outline}>{tx('屋面四角（旧方法）')}</option></select></label>}
 {legacyInCore&&<small role="status">{tx('旧版照片可重新配点。')}</small>}
 {legacyPolygon&&<small role="status">{tx('多段线屋面请使用点位对应。')}</small>}
 {coreEdition&&!selectingCustom&&<svg className="photo-plan-thumbnail" viewBox={`${left} ${top} ${thumbWidth} ${thumbHeight}`} aria-label={tx('平面图中的点位')}>
  <PlanOverlay roofs={[r]} base={base} overlays={overlays} unit={planBounds.w/180}/>
  <PointPlanOverlay sites={visibleSites} targets={[]} unit={Math.max(thumbWidth/210,thumbHeight/136)} active={marking?next?.id:undefined}/>
 </svg>}
 {points&&<><div className="photo-pair-actions seg-track" role="group" aria-label={tx('参考点选择')}><button className="seg-btn" type="button" disabled={drawingMask||selectingCustom||!!r.carport} aria-pressed={coreEdition&&referenceMode==='corners'&&!r.carport&&!selectingCustom} onClick={()=>{if(coreEdition)setReferenceMode('corners');useRoofCorners(coreEdition);}}>{tx('屋面角点')}</button><button className="seg-btn" type="button" disabled={drawingMask||selectingCustom} aria-pressed={coreEdition&&(selectingCustom||referenceMode==='custom'||!!r.carport)} onClick={()=>{if(coreEdition)startCustom();else setTool('pointPlan');}}>{tx('自定义点')}</button></div>{!coreEdition&&pointTools}</>}
 {lines&&<LineTools view={view!} tool={tool} setTool={setTool} solve={solve} northAngle={northAngle} change={patch=>{checkpoint();updateView(patch);}} openGuide={setGuide}/>}
 {!lines&&!points&&!legacyPolygon&&<><div className="photo-step"><button disabled={drawingMask} aria-pressed={tool==='corners'} onClick={()=>setTool('corners')}>{tx('标四角 ·')} {m.corners.length}/4</button><button disabled={drawingMask||!m.corners.length} onClick={()=>{checkpoint();update({corners:[],heightPoints:[]});setTool('corners');}}>{tx('重标')}</button></div>
 <label className="photo-height-toggle"><input type="checkbox" disabled={drawingMask} checked={heightEnabled} onChange={e=>{checkpoint();update({heightCalibration:e.target.checked});if(!e.target.checked)setTool('corners');}}/>{tx('高度校准')}</label>
 {!heightEnabled&&<small>{tx('按照片中心估算相机；照片有裁剪或立体透视不准时，可启用高度校准。')}</small>}
 {heightEnabled&&<><div className="photo-step"><button disabled={drawingMask||m.corners.length!==4||!!problem} aria-pressed={tool==='height'} onClick={()=>setTool('height')}>{tx('标高度线 ·')} {m.heightPoints.length}/2</button><button onClick={()=>{checkpoint();update({heightPoints:[]});}}>{tx('重标')}</button></div>
 <label>{tx('高度参考')}<select aria-label={tx('高度参考类型')} value={m.heightMode} onChange={e=>{checkpoint();update({heightMode:e.target.value as 'below'|'above',heightPoints:[]});}}><option value="below">{tx('屋角 → 墙脚')}</option><option value="above">{tx('设备底点 → 顶点')}</option></select></label>
 {m.heightMode==='below'&&<label>{tx('对应屋角')}<select aria-label={tx('高度线对应屋角')} value={m.anchor} onChange={e=>{checkpoint();update({anchor:Number(e.target.value),heightPoints:[]});}}>{[0,1,2,3].map(i=><option key={i} value={i}>{tx('角')} {i+1}</option>)}</select></label>}
 <label>{tx('实际高差 m')}<input aria-label={tx('实际高差 m')} data-1p-ignore type="number" min="0.1" max="500" step="0.1" value={m.heightMeters} onChange={e=>{const h=Number(e.target.value);if(h>0&&h<=500)update({heightMeters:h});}}/></label>
 <small>{m.heightMode==='below'?tx('墙脚必须位于所选屋角正下方。'):tx('设备底点必须位于所选屋面平面上。')}</small></>}</>}
 {!selectingCustom&&<section className="photo-mask-section">
  <div className="photo-mask-heading"><h3>{tx('前景遮挡')}{!!m.occlusions?.length&&<small>{m.occlusions.length}</small>}</h3><button className="icon-button" aria-label={tx('新增遮挡区域')} title={tx('新增遮挡区域')} disabled={drawingMask||(m.occlusions?.length??0)>=100} onClick={()=>{setTool('mask');setDrawingMask(true);setMaskDraft([]);setSelectedMask(null);}}><Icon name="plus"/></button></div><div className="photo-masks">
 {drawingMask&&<><div className="photo-step"><button disabled={maskDraft.length<3} onClick={finishMask}>{tx('完成圈选')}</button><button onClick={()=>{setDrawingMask(false);setMaskDraft([]);}}>{tx('取消圈选')}</button></div><button disabled={!maskDraft.length} onClick={()=>setMaskDraft(v=>v.slice(0,-1))}>{tx('撤回一个点')}</button></>}
 {(m.occlusions??[]).map((_,i)=><div className="photo-step" key={i}><button aria-pressed={selectedMask===i} disabled={drawingMask} onClick={()=>{setSelectedMask(i);setTool('mask');}}>{tx('遮挡区域')} {i+1}</button><button disabled={drawingMask} aria-label={tx('删除遮挡区域 {0}',i+1)} onClick={()=>{checkpoint();updateView({occlusions:m.occlusions!.filter((_,j)=>j!==i)});setSelectedMask(null);}}><Icon name="trash"/></button></div>)}</div></section>}
 {m.roofSignature!==photoRoofSignature(r)&&<p role="alert">{tx('屋面尺寸或轮廓已改变，请核对标注后重新保存。')}</p>}
 </>}
 {ready&&!selectingCustom&&renderScope}
 {coreEdition&&<div className="photo-operation-actions">
  {selectingCustom?<>
   <small>{tx('已选 {0} 个点',customDraft.length)}</small>
   <button className="photo-save" disabled={customDraft.length<4} onClick={finishCustom}>{tx('完成选点')}</button>
   <button onClick={()=>{setCustomDraft(null);setTool('pointPhoto');}}>{tx('取消')}</button>
  </>:<>
  {error&&<small role="alert">{error}</small>}
  {ready&&!hasRenderArrays&&<small role="status">{tx('当前屋面还没有组件，请先完成布置。')}</small>}
  {marking&&!solve?.camera&&<small>{tx('至少配对 4 个点')}</small>}
  <button className="photo-save" disabled={!view||busy||drawingMask||(ready&&!hasRenderArrays)||(marking&&(!solve?.camera||!!next))} onClick={()=>{
   if(ready){fitPreview();setPreviewPan(false);void generate();return;}
   if(marking){setConfirmed(pointKey);setMarkingView(undefined);return;}
   if(visibleSites.length<4){startCustom();return;}
   if(referenceMode==='corners')updateView({pointMode:'corners'});
   setMarkingView(view?.id);setActive(next?.id);setTool('pointPhoto');
  }}>{ready&&<Icon name="camera"/>}{ready?tx('开始渲染'):marking?tx('完成标注'):tx('开始标注')}</button>
  {ready&&<button disabled={busy||drawingMask} onClick={()=>{setConfirmed(undefined);setMarkingView(view?.id);setTool('pointPhoto');}}>{tx('重新标注')}</button>}
  {m&&<button disabled={busy||drawingMask} onClick={()=>void saveAnnotations()}><Icon name="save"/>{tx('保存项目')}</button>}
 </>}
 </div>}
 </aside><main inert={busy}><nav role={coreEdition?'toolbar':undefined} aria-label={coreEdition?tx('画布工具'):undefined} className={coreEdition?'photo-view-tools photo-centered-tools':undefined}>{!coreEdition&&<span role="status">{status}</span>}{!coreEdition&&undoButton}<button disabled={!m||drawingMask} aria-label={tx('平移实景照片')} title={tx('平移 · 也可按住中键')} aria-pressed={tool==='pan'} onClick={()=>setTool('pan')}><Icon name="pan"/></button><button disabled={!m} aria-label={tx('放大实景照片')} onClick={()=>changeZoom(z=>Math.min(12,z*1.4))}><Icon name="zoom-in"/></button><button disabled={!m} aria-label={tx('缩小实景照片')} onClick={()=>changeZoom(z=>Math.max(1,z/1.4))}><Icon name="zoom-out"/></button><button disabled={!m} aria-label={tx('适应照片窗口')} title={tx('适应窗口')} onClick={fit}><Icon name="frame"/></button></nav>
 {coreEdition?<div className="photo-main-canvas">
  {m?drawCanvas(selectingCustom):<div className="photo-empty" aria-hidden="true"><Icon name="image"/></div>}
  {selectingCustom&&<small className="photo-canvas-hint" role="status">{tx('在平面图上选点')}</small>}
  {!selectingCustom&&marking&&next&&!drawingMask&&<small className="photo-canvas-hint" role="status">{tx('在照片上标记点 {0}',visibleSites.indexOf(next)+1)}</small>}
  {!selectingCustom&&drawingMask&&<small className="photo-canvas-hint" role="status">{tx('沿遮挡轮廓选点')}</small>}
 </div>:m?(points?<div className="photo-pair">
  <section data-active={planMode}><h3>{tx('平面图')}</h3>{drawCanvas(true)}</section>
  <section data-active={!planMode}><h3>{tx('现场照片')}</h3>{drawCanvas(false)}</section>
 </div>:drawCanvas(planMode)):<div className="photo-empty" aria-hidden="true"><Icon name="image"/></div>}
 </main></div>{!coreEdition&&<footer><span role="alert">{error||problem}</span><button disabled={busy||drawingMask||!!problem||!m} onClick={()=>void saveAnnotations()}><Icon name="save"/>{tx('保存项目')}</button><button className="photo-save" disabled={busy||drawingMask||!m||legacyPolygon||(lines||points?!solve?.camera:m.corners.length!==4||!!problem||(heightEnabled&&m.heightPoints.length!==2))} onClick={()=>void generate()}>{busy?tx('正在生成…'):tx('生成实景预览')}</button></footer>}</section>{guide!==null&&<PhotoGuide step={guide} setStep={setGuide} onClose={()=>setGuide(null)}/>}</div>;
}
