import {newId} from './ids';
import {invalidateRoofLayoutForElements} from './drawing-object';
import {useDialog} from './use-dialog';
import {shadowNotice,LocationMismatchNotice} from './shadow-notice';
import {locationFromAddress,locationResolved,ignoresShadows} from './location-presets';
import {initialLayoutDefaults} from './project-layout-defaults';
import type {WorkspaceSaveTarget} from './workspace-file';
import {directionMarkerColors,type DirectionMarkerStyle} from './direction-marker-style';
import {TopBar} from './top-bar';
import {parseCanvasId,targetRoofId} from './canvas-target';
import {blankDocument,documentFromWorkspace,useProjectDocument,workspaceFromDocument} from './project-document';
import type {ProjectExtras} from './project-extras';
import {workbenchAddons,type AddonContext} from './workbench-addons';
import './capacity-report';
import './photo-tool';
import {currentProjectId,listRecent,newProjectId,readRecent,removeRecent,resolveProjectName,saveRecent,setCurrentProjectId,type RecentProject} from './recent-projects';
import {activeRoofIssues,worldIssues,worldPanelShadowZones,winterCheckLines} from './roof-shadows';
import {neighborShadowCasters} from './neighbor-shadows';
import {activeLayoutArea} from './layout-area';
import {LayoutStatus} from './layout-status';
import {CanvasLegend} from './canvas-overlay';
import {SelectBox} from './canvas-selection';
import {PatternButton} from './area-arrange';
import {usePhone} from './use-phone';
import {RegionBar} from './region-bar';
import {useWorkspaceMenus} from './use-workspace-menus';
import {ViewportTools,TopRightCluster} from './viewport-tools';
import {sunPosition} from './sun-position';
import { GlobalSettingsDialog, type GlobalSettingsTab } from './system-settings';
import type {ElementArrayPreview,ElementArraySpec} from './element-list';
import { MAX_FLAT_TABLE_ROWS, MAX_PROJECT_PANELS } from './project-limits';
import {carportPitch,flipCarportSlope} from './roof-direction';
import {ImageOverlayPanel} from './image-overlay-panel';
import {resizeOverlay} from './image-overlays';
import {containsRect} from './drawing-geometry';
import {snapDrawingMove} from './drawing-snap';
import {geographicYaw} from './roof-project';
import {CanvasCompass,createNorthStore} from './north-compass';
import type {MeasureTool} from './measure';
import {layoutMarker} from './layout-direction';
import {DEFAULT_WORKBENCH_ALIGNMENT,layoutDirection} from './auto-layout';
import {isTextEditing,useProjectHistory} from './use-project-history';

import {ProjectStart} from './project-start';
import {reportReadiness} from './scheme-report';
import {LayoutReport} from './layout-report';
import {layoutSignatureFor} from './layout-state';
import {applyRegionForm,initialRegionForm,type RegionForm} from './region-form';
import {DisplayPopover,SunPopover} from './display-popover';
import type { CarportOptions } from './carport';
import {RegionPanel} from './region-panel';
import {logout} from './account';
import {turnPitch} from './roof-direction';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  corners,
  defaultModule, validModule, DEFAULT_FRONT_HEIGHT,
  overlaps,
  type Point,
  type Mode,
  type LayoutImageOptions,
  type Obstacle,
} from "./domain";
import "./style.css";
import "./design-system.css";
import "./panel.css";
import "./region-panel.css";
import "./brand.css";
import "./theme/install";
import {ModulePicker} from './module-library-panel';
import {NewProjectDialog,CanvasObjectMenu} from './workspace-dialogs';
import {defaultModuleCatalog,sameModule,type ModuleCatalogItem} from './module-library';
import {readModuleLibrary} from './saved-module-library';
import { ImageEditor } from './image-editor';
import {CalibrationWorkspace} from './calibration-workspace';
import {recalibrateDrawing} from './drawing-calibration';
import {blankDrawing,blankDrawingInitialView,type BaseImage} from './base-image';
import { parseWorkspace, downloadWorkspace, type WorkspaceFile } from './workspace-file';
import { carportFromPrevious, roofFromPrevious, type RoofDesign, roofRect, toLocal, toWorld, worldArray, worldObstacle, projectBounds, totals } from './roof-project';
import { loadDrawing } from './drawing-import';
import { Icon } from "./workbench-ui";
import { winterRays } from "./solar";
import { autoLayout, type LayoutOptions } from "./auto-layout";
import { AutoPanel } from "./auto-panel";
import type { PerformanceReport } from "./render-options";
import {coreEdition,tx,startsWithText,setLanguage} from './i18n';
import {otherLanguage} from './language-switch';
import {alignRect,alignRoof,cleanupBrokenArrayGroups,createOrUpdateObstacleArrayGroup,pasteObstacle,pasteRoof,patternObstacle,patternRoof,ungroupObstacleArray,type AlignEdge,type PatternOptions} from './area-tools';
const Three = lazy(() => import("./three"));
function prepareElementArray(roof:RoofDesign,targetId:string,spec:ElementArraySpec,idFor?:(index:number)=>string){
  const {properties,...arraySpec}=spec;
  const source=properties?{...roof,obstacles:roof.obstacles.map(object=>object.id!==targetId?object:{
    ...object,...properties,height:object.kind==='keepout'?0:properties.height??object.height,
    topLayout:object.topLayout&&properties.topLayout?properties.topLayout:object.topLayout,
  })}:roof;
  return createOrUpdateObstacleArrayGroup(source,targetId,arraySpec,idFor);
}
function App() {
  const engine = "three";
  const [historyEpoch,setHistoryEpoch]=useState(0);
  const {roofs,setRoofs,active,setActiveId,roof,moduleSpec,layoutOptions,setLayoutOptions,wallHeight,obstacles,setObstacles,arrays,setArrays,layoutSignature,setLayoutSignature,layoutMessage,setLayoutMessage,setPrevious,
    projectDocument,loadDocument,projectName,setProjectName,projectAddress,setProjectAddress,hasSelection,setHasSelection,globalEdge,setGlobalEdge,globalRidgeEdge,setGlobalRidgeEdge,sunSettings,setSunSettings,moduleCatalog,setModuleCatalog,baseImage,setBaseImage,imageOverlays,setImageOverlays,setExtra,clearForNewBase,solarHour,backgroundColor,setBackgroundColor,groundColor,setGroundColor}=useProjectDocument(defaultModuleCatalog);
  const inspector=useRef<HTMLDivElement>(null);

  const [canvasMenu,setCanvasMenu]=useState<{id:string;x:number;y:number}|null>(null);
  const [deletedRoof,setDeletedRoof]=useState<{roof:RoofDesign;index:number;placeholder?:RoofDesign}>();
  const [importing,setImporting]=useState(false);
  const [showGrid,setShowGrid]=useState(true);
  const [displayOpen,setDisplayOpen]=useState(false),[sunOpen,setSunOpen]=useState(false);
  const [navigationMode,setNavigationMode]=useState<'select'|'pan'>('select');
  const [viewCommand,setViewCommand]=useState<{id:number;factor:number}>({id:0,factor:1});
  const [directionMarkerStyle,setDirectionMarkerStyle]=useState<DirectionMarkerStyle>(()=>{try{const v=localStorage.getItem('pv.directionMarkerStyle');return v==='light'||v==='hidden'?v:'dark';}catch{return 'dark';}});
  const changeDirectionMarkerStyle=(value:DirectionMarkerStyle)=>{setDirectionMarkerStyle(value);try{localStorage.setItem('pv.directionMarkerStyle',value);}catch{/* Browser storage may be unavailable. */}};

  useWorkspaceMenus(()=>{setDisplayOpen(false);setSunOpen(false);});
  const [saving,setSaving]=useState(false),[newProjectOpen,setNewProjectOpen]=useState(false);
  const [overlayOpen,setOverlayOpen]=useState(false),[selectedOverlay,setSelectedOverlay]=useState<string|null>(null);
  const drawingView=useRef<{x:number;y:number;width:number;height:number;viewportHeight?:number}|undefined>(undefined);
  const [restoredDrawingView,setRestoredDrawingView]=useState<{x:number;y:number;width:number;height:number;viewportHeight?:number}>();
  const [creating,setCreating]=useState(false);
  const [obstacleHeight,setObstacleHeight]=useState(1);
  const [creatingBuilding,setCreatingBuilding]=useState(false);
  const [drawingForm,setDrawingForm]=useState<RegionForm>();
  const [drawingDraft,setDrawingDraft]=useState<RoofDesign|null>(null);
  const [objectDraft,setObjectDraft]=useState<Obstacle|null>(null);
  const [elementEditRequest,setElementEditRequest]=useState<{roofId:string;objectId:string;serial:number;mode?:'properties'|'array'}|null>(null);
  const [elementArrayPreview,setElementArrayPreview]=useState<ElementArrayPreview|null>(null);
  const [drawingFitSignal,setDrawingFitSignal]=useState(0);
  const [settingsTab,setSettingsTab]=useState<GlobalSettingsTab|null>(null);
  const [activeSelected,setActiveSelected]=useState(true);
  useDialog('[aria-labelledby="new-project-title"]',newProjectOpen,()=>{if(!saving)setNewProjectOpen(false);});
  const captureScene=useRef<((options?:LayoutImageOptions)=>string)|null>(null);
  const setSceneCapture=useCallback((capture:typeof captureScene.current)=>{captureScene.current=capture;},[]);
  const [captureError,setCaptureError]=useState('');
  useEffect(()=>{
    if(!captureError)return;
    const timer=setTimeout(()=>setCaptureError(''),5000);
    return()=>clearTimeout(timer);
  },[captureError]);

  /** The add-on panel shown over the workbench (scheme, drawing sheet, rendering, photo match, electrical…). */
  const [addonOpen,setAddonOpen]=useState<string|null>(null);
  const [drawingTool,setDrawingTool]=useState<'roof'|'carport'|'obstacle'|'keepout'>('roof');
  const [drawingIntent,setDrawingIntent]=useState<'crop'|'create'|'reshape'|'reshape-object'|'obstacle'|'keepout'>('create');
  const [calibration,setCalibration]=useState<{mode:'import'|'rescale';base:BaseImage}|null>(null);
  const cancelCalibration=useCallback(()=>setCalibration(null),[]);
  const [imageOpen,setImageOpen] = useState(false);
  const areaDrawing=imageOpen&&!!baseImage&&((drawingIntent==='create'&&(drawingTool==='roof'||drawingTool==='carport'))||drawingIntent==='reshape');
  const [layoutAreaOpen,setLayoutAreaOpen]=useState(false);
  const objectDrawing=imageOpen&&!!baseImage&&!!objectDraft&&(drawingIntent==='obstacle'||drawingIntent==='keepout'||drawingIntent==='reshape-object');
  const inlineDrawing=areaDrawing||objectDrawing||layoutAreaOpen;
  const [fileMessage,setFileMessage] = useState('');
  // Save result next to the save button: shown on every tab and with the panel folded. A new id per save restarts the timer.
  const [saveNotice,setSaveNotice]=useState<{text:string;error?:boolean;id:number}|null>(null);
  useEffect(()=>{if(!saveNotice||saveNotice.error)return;const timer=setTimeout(()=>setSaveNotice(null),3000);return()=>clearTimeout(timer);},[saveNotice]);
  const [autosaveError,setAutosaveError]=useState('');
  const fileInput=useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState('roof');
  const [layoutReportOpen,setLayoutReportOpen]=useState(false);
  const [entry,setEntry]=useState<'welcome'|'new'|'workspace'>('welcome');
  const metersPerPixel=useRef(0),northStore=useMemo(createNorthStore,[]);
  // 2D measuring: on screen only, never saved. A new or opened project clears it.
  const [measureTool,setMeasureTool]=useState<MeasureTool|null>(null),[measureClear,setMeasureClear]=useState(0),[measureCount,setMeasureCount]=useState(0);
  useEffect(()=>{if(!measureTool)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!e.defaultPrevented&&!isTextEditing(e.target)){e.preventDefault();setMeasureTool(null);}};window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);},[measureTool]);
  useEffect(()=>{setMeasureTool(null);setMeasureClear(n=>n+1);},[historyEpoch]);
  // Phones are view-only: only ③ 交付 in the panel, nothing on the canvas can be moved or edited.
  const phone=usePhone(),viewOnly=phone&&entry==='workspace';
  // Auto-save: the open project is kept in this browser, so F5 reopens it and the home page lists it.
  const projectId=useRef<string>(undefined);
  const [restoreId]=useState(()=>/[?&]from=ai/.test(window.location.search)?undefined:currentProjectId());
  const [restoring,setRestoring]=useState(!!restoreId);
  const [recent,setRecent]=useState<RecentProject[]>([]);
  const [selectedObstacleId, setSelectedObstacle] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  // Phones: start with the panel folded so the drawing is visible; tapping a roof opens it.
  useEffect(() => { if (viewOnly) setCollapsed(true); }, [viewOnly]);
  const [showShadows, setShowShadows] = useState(true);
  const [sunPreviewTime,setSunPreviewTime]=useState<string|null>(null);
  const [showWinterCheck,setShowWinterCheck]=useState(false);
  const designRays=useMemo(()=>ignoresShadows(sunSettings)?[]:winterRays(sunSettings.latitude),[sunSettings.latitude,sunSettings.locationMode]);
  const viewRays=useMemo(()=>ignoresShadows(sunSettings)?[]:[sunPosition(sunSettings)],[sunSettings]);
  useEffect(()=>{setRoofs(rs=>rs.some(r=>r.layoutOptions.shadowLatitude!==sunSettings.latitude||!!r.layoutOptions.shadowIgnored!==ignoresShadows(sunSettings))?rs.map(r=>({...r,layoutOptions:{...r.layoutOptions,shadowLatitude:sunSettings.latitude,shadowIgnored:ignoresShadows(sunSettings)}})):rs);},[sunSettings.latitude,sunSettings.locationMode,roofs]);

  const [arrayDimensions,setArrayDimensions]=useState(false);
  const [selectedId, setSelected] = useState<string | null>(null),
    [mode, setMode] = useState<Mode>("top"),
    [eyeLevel, setEyeLevel] = useState(false),
    [reset, setReset] = useState(0);
  const [fitSignal,setFitSignal]=useState(0);
  const [stressCount,setStressCount]=useState<3000|5000|10000>(3000);
  const [quality, setQuality] = useState<import('./render-options').RenderQuality>(coreEdition?'fine':'standard'),
    [guides, setGuides] = useState(false),
    [stress, setStress] = useState(false),
    [run, setRun] = useState(0),
    [progress, setProgress] = useState(""),
    [report, setReport] = useState<PerformanceReport | null>(() => {
      try {
        return JSON.parse(
          localStorage.getItem("pv.visual.performance") ?? "null",
        );
      } catch {
        return null;
      }
    });
  // Undo covers the saved project except the 3D view settings (sun hour and colours).
  const workspaceKeys=entry==='workspace'&&!layoutReportOpen&&!addonOpen&&!layoutAreaOpen&&!imageOpen&&!calibration&&!importing&&!saving&&!newProjectOpen&&!stress;
  const historyValue=useMemo(()=>{const {solarHour:_,backgroundColor:__,groundColor:___,...value}=projectDocument;return value;},[projectDocument]);
  const history=useProjectHistory(historyValue,(a,b)=>{if(a===b)return true;
    // Pictures (every `url`: base drawing, overlays, add-on photos) are compared by identity, the rest by content.
    const signature=(v:typeof historyValue)=>{const urls:unknown[]=[v.baseImage?.url];
      const text=JSON.stringify({...v,baseImage:v.baseImage?{name:v.baseImage.name,width:v.baseImage.width,height:v.baseImage.height,northAngle:v.baseImage.northAngle,metersPerPixel:v.baseImage.metersPerPixel,frame:v.baseImage.frame,crop:v.baseImage.crop,opacity:v.baseImage.opacity,visible:v.baseImage.visible}:null,activeId:undefined},(key,value)=>{if(key==='previous'||key==='layoutMessage')return undefined;if(key==='url'){urls.push(value);return undefined;}return value;});
      return {text,urls};};
    const x=signature(a),y=signature(b);
    return x.urls.length===y.urls.length&&x.urls.every((u,i)=>u===y.urls[i])&&x.text===y.text;
  },v=>{loadDocument({...projectDocument,...v});setSelected(null);setSelectedObstacle(null);setDeletedRoof(undefined);setFileMessage('');},historyEpoch,workspaceKeys);
  useEffect(()=>{if(!['已保存：{0}','已取消保存','全部屋面已布置'].some(text=>startsWithText(fileMessage,text)))return;const timer=setTimeout(()=>setFileMessage(''),5000);return()=>clearTimeout(timer);},[fileMessage]);
  const running = progress.startsWith("第")||progress.startsWith("Round");
  const edges={edge:globalEdge,ridge:globalRidgeEdge};
  const currentSignature = layoutSignatureFor(active,edges);
  const layoutStale = layoutSignature !== currentSignature;
  const needsOutline=!!baseImage&&(!baseImage.metersPerPixel||!hasSelection);
  const overlappingRoofs=useMemo(()=>roofs.filter(r=>r.id!==active.id&&overlaps(roofRect(active),roofRect(r))),[roofs,active]);
  const changeAddress=(address:string)=>{setProjectAddress(address);setSunSettings(s=>locationFromAddress(s,address));};
  // The next step lives on the Layout tab: open it and put focus on its main button.
  const checkLocation=()=>{if(!locationResolved(sunSettings)){setSettingsTab('project');setFileMessage(tx('必须填写可识别地点或完整经纬度，才能进行阴影校核和布置。'));return false;}return true;};
  const runLayout = (options: LayoutOptions) => {
    if(!checkLocation())return;
    try {
      if(needsOutline)throw new Error(tx('请先标定并圈屋面'));
      if(overlappingRoofs.length)throw new Error(tx('当前屋面与其他屋面重叠，请先调整轮廓'));
      const result = autoLayout(roof, obstacles, { ...options, removeIsolated:true, alignment:options.alignment??DEFAULT_WORKBENCH_ALIGNMENT,edge:globalEdge, ridgeEdge:globalRidgeEdge, carport:active.carport, pitch:active.pitch, wallHeight, module: moduleSpec, roofYaw:geographicYaw(active), limit:MAX_PROJECT_PANELS-totals(roofs.filter(r=>r.id!==active.id)).count },coreEdition?neighborShadowCasters(active,roofs):[]);
      setFileMessage("");
      setLayoutSignature(currentSignature);
      setSelectedObstacle(null);
      setPrevious(arrays);
      setArrays(result.arrays);
      setSelected(null);
      setLayoutMessage(tx('已排布 {0} 块 / {1} kWp · 前后净距 {2} m{3}{4}',result.count,(result.count * moduleSpec.power / 1000).toFixed(2),result.rowGap.toFixed(2),result.shortened ? tx(' · 允许部分遮挡') : "",result.capped ? tx(' · 已达完整连排数量上限') : ""));
    } catch(e) { setLayoutMessage(tx('请检查参数：{0}。组件长宽 0.2–5m，功率 1–2000Wp，平屋面连排 1–{1}，坡屋面 1–6、列数 1–100，间距不得为负。',e instanceof Error ? e.message : tx('排布失败'),MAX_FLAT_TABLE_ROWS)); }
  };
  const issues = useMemo(()=>activeRoofIssues(active,designRays,overlappingRoofs,coreEdition?roofs:[]),[active,designRays,overlappingRoofs,roofs]),
    count = arrays.reduce((sum, a) => sum + a.rows * a.columns, 0);
  const selectedObstacle = obstacles.find(o => o.id === selectedObstacleId);
  useEffect(()=>{inspector.current?.scrollTo({top:0});},[active.id,selectedObstacleId,selectedId,panel]);
  const capacity = arrays.reduce((sum,a)=>sum+a.rows*a.columns*(a.module??defaultModule).power/1000,0);
  const total=totals(roofs);
  const updateModuleCatalog=(next:ModuleCatalogItem[])=>{
    if(!next.length||next.length>50||next.some(item=>!item.name.trim()||!validModule(item.spec)))return tx('组件名称和规格无效，未应用修改');
    if(roofs.some(r=>r.carport&&next.find(item=>item.id===r.moduleId)?.spec.kind==='lightweight'))return tx('车棚正在使用该组件，不能改为轻质组件');
    if(roofs.some(r=>r.moduleId&&!next.some(item=>item.id===r.moduleId)))return tx('组件正在被区域使用，不能删除');
    setModuleCatalog(next);
    setRoofs(current=>current.map(r=>{const item=next.find(candidate=>candidate.id===r.moduleId);return item?{...r,moduleSpec:{...item.spec}}:r;}));
    return null;
  };
  const bindModule=(r:RoofDesign):RoofDesign=>{
    const allowed=moduleCatalog.filter(item=>!r.carport||item.spec.kind!=='lightweight');
    let item=allowed.find(item=>item.id===r.moduleId&&sameModule(item.spec,r.moduleSpec))??allowed.find(item=>sameModule(item.spec,r.moduleSpec))??allowed[0];
    if(!item){item={id:newId(),name:tx('标准组件 {0} Wp',defaultModule.power),spec:{...defaultModule,kind:'standard'}};const added=item;setModuleCatalog(items=>[...items,added]);}
    return {...r,moduleId:item.id,moduleSpec:{...item.spec}};
  };
  const defaults=projectDocument.layoutDefaults??initialLayoutDefaults;
  function newRegionDefaults(r:RoofDesign):RoofDesign{
    const item=moduleCatalog.find(i=>!r.carport||i.spec.kind!=='lightweight');
    return bindModule({...r,moduleId:item?.id,moduleSpec:item?.spec??r.moduleSpec,layoutOptions:{
      portrait:true,...defaults,tableRows:r.pitch?Math.min(defaults.tableRows,6):defaults.tableRows,
      edge:globalEdge,spacingMode:'solar',rowGap:0,direction:0,azimuth:r.pitch||r.carport?undefined:180
    }});
  }
  const removeActiveRoof=()=>{
    const index=roofs.findIndex(r=>r.id===active.id),remaining=roofs.filter(r=>r.id!==active.id);
    const placeholder=remaining.length?undefined:roofFromPrevious(active,tx('屋面 1'));
    setHasSelection(!placeholder);setActiveSelected(!placeholder);setDeletedRoof({roof:active,index,placeholder});setRoofs(placeholder?[placeholder]:remaining);
    setActiveId(placeholder?.id??remaining[Math.min(index,remaining.length-1)].id);setSelected(null);setSelectedObstacle(null);
    if(placeholder&&baseImage)setBaseImage({...baseImage,frame:undefined});
    setFileMessage(tx('已删除 {0}，可撤回',active.name));
  };
  const undoRoofRemoval=()=>{
    if(!deletedRoof)return;
    const next=roofs.filter(r=>r!==deletedRoof.placeholder);
    const restored={...deletedRoof.roof};
    const item=moduleCatalog.find(item=>item.id===restored.moduleId&&(!restored.carport||item.spec.kind!=='lightweight'));
    if(item)restored.moduleSpec={...item.spec};
    else {
      if(moduleCatalog.length>=50){setFileMessage(tx('组件库已满，请先腾出一个组件位置再恢复区域'));return;}
      const recovered={id:newId(),name:tx('{0}组件 {1} Wp',restored.moduleSpec.kind==='lightweight'?tx('轻质'):tx('标准'),restored.moduleSpec.power),spec:{...restored.moduleSpec}};
      restored.moduleId=recovered.id;setModuleCatalog(items=>[...items,recovered]);
    }
    next.splice(Math.min(deletedRoof.index,next.length),0,restored);
    if(totals(next).count>MAX_PROJECT_PANELS||next.length>50){setFileMessage(tx('撤回后超过项目数量上限，请先移除新增内容'));return;}
    setHasSelection(true);setActiveSelected(true);setRoofs(next);setActiveId(deletedRoof.roof.id);setSelected(null);setSelectedObstacle(null);
    if(baseImage&&!baseImage.frame)setBaseImage({...baseImage,frame:{x:0,y:0,width:baseImage.width,height:baseImage.height}});
    setDeletedRoof(undefined);setFileMessage(tx('已恢复删除的屋面'));
  };
  const chooseRoof=(id:string)=>{setHasSelection(true);setActiveSelected(true);setActiveId(id);setSelected(null);setSelectedObstacle(null);setPicked([]);setPickedObjects([]);};
  /** Areas picked together on the 2D canvas (Shift / Ctrl click, drag box). The current area comes first: it is the key the others align to. */
  const [picked,setPicked]=useState<string[]>([]);
  const selection=hasSelection&&activeSelected?[active.id,...picked.filter((id,i)=>id!==active.id&&picked.indexOf(id)===i&&roofs.some(r=>r.id===id))]:[];
  const [selectBox,setSelectBox]=useState<{left:number;top:number;width:number;height:number}|null>(null);
  /** Objects (buildings, obstacles, keep-out zones) picked together in the current area; the selected one is the key. */
  const [pickedObjects,setPickedObjects]=useState<string[]>([]);
  const objectSelection=selectedObstacle?[selectedObstacle.id,...pickedObjects.filter((id,i)=>id!==selectedObstacle.id&&pickedObjects.indexOf(id)===i&&obstacles.some(o=>o.id===id))]:[];
  const pickAreas=(ids:string[])=>{if(!ids.length)return;chooseRoof(ids[0]);setPicked(ids.slice(1));setCollapsed(false);};
  const togglePicked=(id:string)=>{if(!selection.includes(id))pickAreas([...selection,id]);else if(selection.length>1)pickAreas(selection.filter(v=>v!==id));};
  /** Clicking one of several picked areas keeps them all and makes it the key. */
  const pickKey=(id:string)=>{if(selection.length>1&&selection.includes(id))pickAreas([id,...selection.filter(v=>v!==id)]);else chooseRoof(id);};
  const boxSelect=(a:Point,b:Point,add:boolean)=>{
    if(!hasSelection||overlayOpen)return;
    const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),z0=Math.min(a.z,b.z),z1=Math.max(a.z,b.z);
    const inside=roofs.filter(r=>corners(roofRect(r)).every(p=>p.x>=x0&&p.x<=x1&&p.z>=z0&&p.z<=z1)).map(r=>r.id);
    if(inside.length)pickAreas(add?[...selection,...inside.filter(id=>!selection.includes(id))]:inside);
  };
  /** Align and pattern on the Area tab. A pattern shows live while its popover is open; `patternBase` holds the design to go back to. */
  const patternBase=useRef<RoofDesign[]|null>(null);
  const patternActions=(make:(base:RoofDesign[],o:PatternOptions)=>{roofs:RoofDesign[];warning:string|null})=>({
    preview:(o:PatternOptions)=>{const base=patternBase.current??roofs;patternBase.current=base;try{const r=make(base,o);setRoofs(r.roofs);return r.warning;}catch(e){setRoofs(base);return (e as Error).message;}},
    cancel:()=>{if(patternBase.current)setRoofs(patternBase.current);patternBase.current=null;},
    apply:()=>{patternBase.current=null;},
  });
  const areaPattern=patternActions((base,o)=>{const r=patternRoof(base,active.id,o,edges);return {roofs:r.roofs,warning:r.overlap?tx('有副本与其他区域重叠，请检查'):null};});
  const objectPattern=(id:string)=>patternActions((base,o)=>{const r=base.find(v=>v.id===active.id)!,p=patternObstacle(r,id,o);return {roofs:base.map(v=>v===r?{...v,obstacles:p.obstacles}:v),warning:p.skipped?tx('{0} 个超出区域，已略过',p.skipped):null};});
  /** Line the other picked areas up with the key area; overlaps only warn. */
  const alignSelection=(edge:AlignEdge)=>{
    const ids=new Set(selection.slice(1));if(!ids.size)return;
    const next=roofs.map(r=>ids.has(r.id)?{...r,...alignRoof(r,active,edge)}:r);
    const clash=next.some(r=>ids.has(r.id)&&next.some(o=>o.id!==r.id&&overlaps(roofRect(o),roofRect(r))));
    setRoofs(next);setFileMessage(clash?tx('对齐后有区域重叠，请检查'):tx('已对齐到 {0}',active.name));
  };
  /** Objects line up with the key object on the screen's sides; panels on a rooftop building ride along. */
  const alignObjects=(edge:AlignEdge)=>{
    const key=selectedObstacle,ids=new Set(objectSelection.slice(1));if(!key||!ids.size)return;
    const world=(o:Obstacle)=>({...o,...toWorld(o,active),yaw:o.yaw+active.yaw}),target=world(key),shift=new Map<string,{x:number;z:number}>();
    const next=obstacles.map(o=>{if(!ids.has(o.id))return o;const n=alignRect(world(o),target,edge),p=toLocal(n,active);shift.set(o.id,{x:p.x-o.x,z:p.z-o.z});return {...o,...p,yaw:n.yaw-active.yaw};});
    setRoofs(rs=>rs.map(r=>r.id!==active.id?r:{...r,obstacles:next,arrays:r.arrays.map(a=>{const d=a.hostObstacleId?shift.get(a.hostObstacleId):undefined;return d?{...a,x:a.x+d.x,z:a.z+d.z}:a;})}));
    setFileMessage(tx('已对齐到 {0}',key.name));
  };
  const deleteObjects=(ids:string[])=>{
    const gone=new Set(ids);
    setRoofs(rs=>rs.map(r=>r.id!==active.id?r:{...r,obstacles:cleanupBrokenArrayGroups(r.obstacles.filter(o=>!gone.has(o.id))),arrays:r.arrays.filter(a=>!a.hostObstacleId||!gone.has(a.hostObstacleId))}));
    if(selectedObstacleId&&gone.has(selectedObstacleId))setSelectedObstacle(null);
    setPickedObjects(prev=>prev.filter(id=>!gone.has(id)));

    if(ids.length>1)setFileMessage(tx('已删除 {0} 个对象，可按 Ctrl+Z 撤回',ids.length));
  };
  const duplicateObjects=(ids:string[])=>{
    let list=active.obstacles;const made:string[]=[];
    for(const id of ids){
      const src=list.find(o=>o.id===id);if(!src)continue;
      const next=pasteObstacle({...active,obstacles:list},src);
      if(!next)break;
      list=next;made.push(next[next.length-1].id);
    }
    if(!made.length){setFileMessage(tx('当前区域没有空位放置副本'));return;}
    setRoofs(rs=>rs.map(r=>r.id!==active.id?r:{...r,obstacles:list}));
    setSelected(null);setSelectedObstacle(made[0]);setPickedObjects(made.slice(1));
    setFileMessage(tx('已复制 {0} 个对象',made.length));
  };
  const applyObjectEdit=(ids:string[],patch:{name?:string;height?:number;width?:number;depth?:number;topLayout?:{enabled:boolean;tilt:number;edge:number}})=>{
    const targetSet=new Set(ids);
    setRoofs(rs=>rs.map(r=>{
      if(r.id!==active.id)return r;
      let affectsLayout=false;
      const nextObstacles=r.obstacles.map(o=>{
        if(!targetSet.has(o.id))return o;
        const nextName=ids.length===1&&patch.name!==undefined?patch.name:o.name;
        const nextHeight=o.kind==='keepout'||patch.height===undefined?o.height:Math.max(0.2,patch.height);
        const nextWidth=patch.width!==undefined?Math.max(0.2,patch.width):o.width;
        const nextDepth=patch.depth!==undefined?Math.max(0.2,patch.depth):o.depth;
        const sizeChanged=Math.abs(nextWidth-o.width)>1e-6||Math.abs(nextDepth-o.depth)>1e-6;
        const nextTop=o.topLayout&&patch.topLayout?patch.topLayout:o.topLayout;
        const topChanged=o.topLayout&&nextTop&&(o.topLayout.enabled!==nextTop.enabled||o.topLayout.tilt!==nextTop.tilt||o.topLayout.edge!==nextTop.edge);
        if(sizeChanged||nextHeight!==o.height||topChanged)affectsLayout=true;
        return {...o,name:nextName,height:nextHeight,width:nextWidth,depth:nextDepth,...(nextTop?{topLayout:nextTop}:{})};
      });
      if(affectsLayout)return invalidateRoofLayoutForElements(r,nextObstacles);
      const next={...r,obstacles:nextObstacles};
      return {...next,layoutSignature:r.layoutSignature===layoutSignatureFor(r,edges)?layoutSignatureFor(next,edges):r.layoutSignature};
    }));

  };
  const applyObjectArray=(targetId:string,spec:ElementArraySpec)=>{
    try{
      const res=prepareElementArray(active,targetId,spec);
      if(res.skipped>0&&res.memberIds.length<2){setFileMessage(tx('区域空间不足，未能生成阵列'));return false;}
      setRoofs(rs=>rs.map(r=>r.id!==active.id?r:invalidateRoofLayoutForElements(r,res.obstacles)));
      setSelected(null);setSelectedObstacle(res.memberIds[0]??null);setPickedObjects(res.memberIds.slice(1));
      setFileMessage(res.skipped>0?tx('{0} 个超出区域，已略过',res.skipped):res.memberIds.length>1?tx('已生成 {0} 个阵列要素',res.memberIds.length):'');
      return true;
    }catch(e){setFileMessage((e as Error).message);return false;}
  };
  const ungroupArray=(groupId:string)=>{
    setRoofs(rs=>rs.map(r=>{if(r.id!==active.id)return r;const next={...r,obstacles:ungroupObstacleArray(r.obstacles,groupId)};return {...next,layoutSignature:r.layoutSignature===layoutSignatureFor(r,edges)?layoutSignatureFor(next,edges):r.layoutSignature};}));
    setFileMessage(tx('已解散阵列组'));
  };
  const duplicateActiveRoof=()=>{
    try{
      const r=pasteRoof(roofs,active,edges),created=r.roofs[r.roofs.length-1];
      setRoofs(r.roofs);chooseRoof(created.id);
      setFileMessage(r.overlap?tx('{0} 与其他区域重叠，请检查',created.name):tx('已复制 {0}',created.name));
    }catch(e){setFileMessage((e as Error).message);}
  };
  const changeActiveRoofType=(kind:'flat'|'gable'|'single')=>{
    try{
      const nextRoof=bindModule(applyRegionForm(active,kind));
      setRoofs(rs=>rs.map(r=>r.id!==active.id?r:{...nextRoof,arrays:[],previous:null,layoutSignature:'',layoutMessage:''}));
      setSelected(null);
    }catch(e){setFileMessage((e as Error).message);}
  };
  const deleteSelection=()=>{
    if(selection.length<2){removeActiveRoof();return;}
    const gone=new Set(selection),remaining=roofs.filter(r=>!gone.has(r.id)),placeholder=remaining.length?undefined:roofFromPrevious(active,tx('屋面 1'));
    setHasSelection(!placeholder);setActiveSelected(!placeholder);setRoofs(placeholder?[placeholder]:remaining);setActiveId(placeholder?.id??remaining[0].id);setPicked([]);setSelected(null);setSelectedObstacle(null);
    if(placeholder&&baseImage)setBaseImage({...baseImage,frame:undefined});
    setDeletedRoof(undefined);setFileMessage(tx('已删除 {0} 个区域，可按 Ctrl+Z 撤回',selection.length));
  };
  /** Ctrl+C / Ctrl+V on the Area tab: the selected obstacle or keep-out, otherwise the current area. */
  const clipboard=useRef<{area:RoofDesign}|{areas:RoofDesign[]}|{object:Obstacle}|{objects:Obstacle[]}|null>(null);
  const [hasClip,setHasClip]=useState(false);
  /** The pattern popover opened from the right-click menu, at the click. */
  const [patternAt,setPatternAt]=useState<{x:number;y:number;objectId?:string;n:number}|null>(null);
  useEffect(()=>{setPatternAt(null);},[panel,hasSelection,entry,active.id]);
  const copySelection=()=>{setHasClip(true);if(selectedObstacle&&objectSelection.length>1){clipboard.current={objects:objectSelection.map(id=>structuredClone(obstacles.find(o=>o.id===id)!))};setFileMessage(tx('已复制 {0} 个对象，Ctrl+V 粘贴',objectSelection.length));}else if(selectedObstacle){clipboard.current={object:structuredClone(selectedObstacle)};setFileMessage(tx('已复制 {0}，Ctrl+V 粘贴',selectedObstacle.name));}else if(selection.length>1){clipboard.current={areas:selection.map(id=>structuredClone(roofs.find(r=>r.id===id)!))};setFileMessage(tx('已复制 {0} 个区域，Ctrl+V 粘贴',selection.length));}else{clipboard.current={area:structuredClone(active)};setFileMessage(tx('已复制 {0}，Ctrl+V 粘贴',active.name));}};
  const pasteSelection=()=>{
    const clip=clipboard.current;if(!clip)return;
    if('objects' in clip){let list=active.obstacles;const made:string[]=[];for(const o of clip.objects){const next=pasteObstacle({...active,obstacles:list},o);if(!next)break;list=next;made.push(next[next.length-1].id);}if(!made.length){setFileMessage(tx('当前区域没有空位放置 {0}',clip.objects[0].name));return;}setRoofs(rs=>rs.map(r=>r.id===active.id?{...r,obstacles:list}:r));setSelected(null);setSelectedObstacle(made[0]);setPickedObjects(made.slice(1));setFileMessage(tx('已粘贴 {0} 个对象',made.length));return;}
    if('object' in clip){const next=pasteObstacle(active,clip.object);if(!next){setFileMessage(tx('当前区域没有空位放置 {0}',clip.object.name));return;}setRoofs(rs=>rs.map(r=>r.id===active.id?{...r,obstacles:next}:r));setSelected(null);setSelectedObstacle(next[next.length-1].id);setFileMessage(tx('已粘贴 {0}',next[next.length-1].name));return;}
    if('areas' in clip){try{let next=roofs,overlap=false;const made:string[]=[];for(const area of clip.areas){const r=pasteRoof(next,area,edges);next=r.roofs;overlap||=r.overlap;made.push(next[next.length-1].id);}setRoofs(next);pickAreas(made);setFileMessage(overlap?tx('粘贴的区域与其他区域重叠，请检查'):tx('已粘贴 {0} 个区域',made.length));}catch(e){setFileMessage((e as Error).message);}return;}
    try{const r=pasteRoof(roofs,clip.area,edges),created=r.roofs[r.roofs.length-1];setRoofs(r.roofs);chooseRoof(created.id);setFileMessage(r.overlap?tx('{0} 与其他区域重叠，请检查',created.name):tx('已粘贴 {0}',created.name));}catch(e){setFileMessage((e as Error).message);}
  };
  const clipboardKeys=useRef({copy:copySelection,paste:pasteSelection,save:()=>{void save();},copyPasteEnabled:false,saveEnabled:false});
  clipboardKeys.current={copy:copySelection,paste:pasteSelection,save:()=>{void save();},copyPasteEnabled:workspaceKeys&&!viewOnly&&panel==='roof'&&hasSelection&&activeSelected,saveEnabled:entry==='workspace'&&!addonOpen&&!layoutAreaOpen&&!imageOpen&&!calibration&&!newProjectOpen&&!viewOnly};
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{const k=clipboardKeys.current;if(e.defaultPrevented||!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey)return;const c=e.key.toLowerCase();if(c==='s'&&k.saveEnabled){e.preventDefault();k.save();return;}if(!k.copyPasteEnabled||isTextEditing(e.target))return;
      if(c==='c'&&!window.getSelection()?.toString()){e.preventDefault();k.copy();}else if(c==='v'&&clipboard.current){e.preventDefault();k.paste();}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[]);
  /** Stage every roof element on the existing canvas; no object is written until confirmation. */
  const addRegionObject=(requested:'obstacle'|'keepout'|'building')=>{
    const kind=requested==='building'?'obstacle':requested;
    const prefix=requested==='building'?tx('附属建筑'):kind==='keepout'?tx('禁布区'):tx('障碍物');
    let n=1;while(obstacles.some(object=>object.name===`${prefix} ${n}`))n++;
    setObjectDraft({id:newId(),kind,name:`${prefix} ${n}`,x:0,z:0,width:2,depth:2,yaw:0,height:kind==='keepout'?0:obstacleHeight,...(requested==='building'?{topLayout:{enabled:false,tilt:10,edge:.5}}:{})});
    setDrawingDraft(null);setCreatingBuilding(requested==='building');setDrawingIntent(kind);setDrawingTool(kind);setDrawingForm(undefined);
    setPanel('roof');setCollapsed(false);setMode('top');setNavigationMode('select');setSelected(null);setSelectedObstacle(null);setPickedObjects([]);setCanvasMenu(null);setDisplayOpen(false);setSunOpen(false);setOverlayOpen(false);setMeasureTool(null);
    if(!baseImage){const blank=blankDrawing();setBaseImage(blank);drawingView.current=blankDrawingInitialView(blank);}
    setImageOpen(true);
  };
  const requestElementAction=(roofId:string,objectId:string,mode:'properties'|'array'='properties')=>{
    chooseRoof(roofId);setPanel('roof');setCollapsed(false);setCanvasMenu(null);setSelectedObstacle(objectId);
    setElementEditRequest(previous=>({roofId,objectId,mode,serial:(previous?.serial??0)+1}));
  };
  // Canvas hits arrive as ids from the 3D view; see canvas-target.ts.
  function editCanvasObject(id:string){
    if(inlineDrawing||running||stress||baseImage&&!baseImage.metersPerPixel)return;
    const t=parseCanvasId(id),rid=targetRoofId(t),target=roofs.find(r=>r.id===rid);
    if(!rid||!target)return;
    const object=t.kind==='object'?target.obstacles.find(o=>o.id===t.objectId):undefined;
    if(t.kind==='object'&&!object)return;
    chooseRoof(rid);setPanel('roof');setMode('top');setCollapsed(false);setCanvasMenu(null);
    setNavigationMode('select');setMeasureTool(null);setOverlayOpen(false);setDisplayOpen(false);setSunOpen(false);
    setDrawingForm(undefined);
    if(object){
      setDrawingDraft(null);setObjectDraft({...object});setSelectedObstacle(object.id);
      setDrawingIntent('reshape-object');setDrawingTool(object.kind==='keepout'?'keepout':'obstacle');
    }else{
      setObjectDraft(null);setDrawingDraft(structuredClone(target));
      setDrawingIntent('reshape');setDrawingTool(target.carport?'carport':'roof');
    }
    if(!baseImage){
      const blank=blankDrawing();setBaseImage(blank);drawingView.current=undefined;
    }
    setImageOpen(true);
  }
  const openCanvasMenu=(id:string,x:number,y:number)=>{
    const t=parseCanvasId(id);
    if(t.kind==='overlay'){setSelectedOverlay(t.overlayId);return;}
    if(t.kind==='object'){if(!(t.roofId===active.id&&objectSelection.includes(t.objectId))){chooseRoof(t.roofId);setSelectedObstacle(t.objectId);}}else pickKey(t.roofId);
    setCanvasMenu({id,x,y});
  };
  const selectOnCanvas=(id?:string|null,add=false)=>{
    const t=id?parseCanvasId(id):undefined;
    // A plain click on empty canvas clears the entire selection in one step,
    // on every workflow page. Preserve modifier-drag additive box selection.
    if(!t){
      if(add)return;
      setActiveSelected(false);setSelected(null);setSelectedObstacle(null);
      setPicked([]);setPickedObjects([]);setSelectedOverlay(null);
      setCanvasMenu(null);setPatternAt(null);
      return;
    }
    if(t?.kind==='overlay'){setSelectedOverlay(t.overlayId);return;}
    if(overlayOpen){setSelectedOverlay(null);return;}
    // The direction marker always belongs to the active roof.
    if(t?.kind==='direction'){
      if(active.carport)updateCarport({...active.carport,startEnd:active.carport.startEnd==='end'?'start':'end'});
      else{const q=(layoutDirection(layoutOptions)+1)%4;setLayoutOptions({...layoutOptions,direction:q,portrait:q%2===0,azimuth:undefined,azimuthMode:undefined});}
      return;
    }
    if(t?.kind==='pitch'){setRoofs(rs=>rs.map(r=>r.id===t.roofId?r.carport?flipCarportSlope(r):r.pitch?{...r,pitch:turnPitch(r.pitch)}:r:r));return;}
    if(add&&(t.kind==='site'||t.kind==='array')){togglePicked(t.roofId);return;}
    if(t.kind==='site'){pickKey(t.roofId);setCollapsed(false);return;}
    if(t.kind==='object'){
      const same=t.roofId===active.id;
      if(add&&same&&selectedObstacle){const ids=objectSelection.includes(t.objectId)?objectSelection.filter(v=>v!==t.objectId):[...objectSelection,t.objectId];if(ids.length){setSelectedObstacle(ids[0]);setPickedObjects(ids.slice(1));}return;}
      if(same&&objectSelection.length>1&&objectSelection.includes(t.objectId)){setSelectedObstacle(t.objectId);setPickedObjects(objectSelection.filter(v=>v!==t.objectId));return;}
      if(!same)chooseRoof(t.roofId);else setActiveSelected(true);setSelected(null);setSelectedObstacle(t.objectId);setPickedObjects([]);setCollapsed(false);return;
    }
    if(t.kind!=='array')return;
    pickKey(t.roofId);if(arrayDimensions)setSelected(t.arrayId);setCollapsed(false);
  };
  /** Drag whole areas and elements on the Area tab. Edit handles belong to the drawing overlay. */
  const moveOnCanvas=(id:string,x:number,z:number)=>{
    const t=parseCanvasId(id);
    if(t.kind==='overlay'){setImageOverlays(items=>items.map(o=>o.id!==t.overlayId?o:t.corner===undefined?{...o,x,z}:resizeOverlay(o,{x,z},t.corner)));return;}
    const unit=metersPerPixel.current;
    if(t.kind!=='object'&&panel==='roof'&&!running&&!stress){
      const ids=new Set(selection.includes(t.roofId)?selection:[t.roofId]);
      setRoofs(rs=>{const r=rs.find(v=>v.id===t.roofId);if(!r)return rs;
        const a=t.kind==='array'?r.arrays.find(v=>v.id===t.arrayId):undefined,from=a?toWorld(a,r):r;
        let dx=x-from.x,dz=z-from.z;
        const moving=rs.filter(v=>ids.has(v.id)).map(v=>roofRect({...v,x:v.x+dx,z:v.z+dz}));
        const targets=rs.filter(v=>!ids.has(v.id)).map(roofRect);
        const snap=unit?snapDrawingMove(moving.map(corners),targets.map(corners),unit):undefined;
        if(snap&&!moving.some(m=>targets.some(target=>overlaps({...m,x:m.x+snap.x,z:m.z+snap.z},target)))){
          dx+=snap.x;dz+=snap.z;
        }
        return Math.abs(dx)+Math.abs(dz)<1e-9?rs:rs.map(v=>ids.has(v.id)?{...v,x:v.x+dx,z:v.z+dz}:v);});
      return;
    }
    if(t.kind!=='object')return;
    if(panel==='roof'&&!running&&!stress){
      const ids=new Set(t.roofId===active.id&&objectSelection.includes(t.objectId)?objectSelection:[t.objectId]);
      setRoofs(rs=>rs.map(r=>{const o=r.id===t.roofId?r.obstacles.find(v=>v.id===t.objectId):undefined;if(!o)return r;
        const p=toLocal({x,z},r);
        let dx=p.x-o.x,dz=p.z-o.z;
        const boundary={x:0,z:0,yaw:0,...r.roof};
        const moving=r.obstacles.filter(v=>ids.has(v.id)).map(v=>({...v,x:v.x+dx,z:v.z+dz}));
        const targets=[boundary,...r.obstacles.filter(v=>!ids.has(v.id))];
        const snap=unit?snapDrawingMove(moving.map(corners),targets.map(corners),unit):undefined;
        if(snap&&moving.every(m=>containsRect(boundary,{...m,x:m.x+snap.x,z:m.z+snap.z}))){
          dx+=snap.x;dz+=snap.z;
        }
        if(Math.abs(dx)+Math.abs(dz)<1e-9)return r;
        return invalidateRoofLayoutForElements(r,r.obstacles.map(v=>ids.has(v.id)?{...v,x:v.x+dx,z:v.z+dz}:v));}));
      return;
    }
  };

  const createBlankProject=()=>{
    saveTarget.current={};projectId.current=undefined;
    setHistoryEpoch(n=>n+1);loadDocument(blankDocument(readModuleLibrary()));setAddonOpen(null);setOverlayOpen(false);setSelectedOverlay(null);setPatternAt(null);setCanvasMenu(null);drawingView.current=undefined;setRestoredDrawingView(undefined);setDeletedRoof(undefined);
    setSelected(null);setSelectedObstacle(null);setActiveSelected(true);setSettingsTab(null);setImageOpen(false);setFileMessage('');
    setShowShadows(true);
    setStress(false);setRun(0);setProgress('');setReport(null);setMode('top');setPanel('roof');setCollapsed(false);setReset(n=>n+1);setNewProjectOpen(false);setEntry('new');
  };
  const saveTarget=useRef<WorkspaceSaveTarget>({});
  const workspaceSnapshot=(changes:Partial<ProjectExtras>={}):WorkspaceFile=>workspaceFromDocument({...projectDocument,...changes});
  const save = async(changes:Partial<ProjectExtras>={}):Promise<boolean> => {
    if(saving)return false;
    setSaving(true);
    try {const project=workspaceSnapshot(changes);
      parseWorkspace(JSON.stringify(project));const name=await downloadWorkspace(project,saveTarget.current);
      setSaveNotice({text:name?tx('已保存：{0}',name):tx('已取消保存'),id:Date.now()});return name!==null;
    }catch(e){const text=tx('保存失败：{0}',(e as Error).message);if(newProjectOpen)setFileMessage(text);setSaveNotice({text,error:true,id:Date.now()});return false;}finally{setSaving(false);}
  };
  const openingProject=useRef(false);
  /** `recent`: the file comes from the browser's recent projects, so it keeps that id. */
  const openFile = async(file?:File,recent?:{id:string;fileName?:string})=>{
    if(!file||openingProject.current)return;
    openingProject.current=true;setImporting(true);setFileMessage(tx('正在打开项目…'));
    try{
      if(file.size>120000000)throw new Error(tx('项目文件超过 120 MB'));
      const d=documentFromWorkspace(parseWorkspace(await file.text()));
      const fileName=recent?recent.fileName:file.name;
      saveTarget.current={name:fileName};projectId.current=recent?.id;setHistoryEpoch(n=>n+1);
      loadDocument({...d,name:resolveProjectName(d.name,fileName)});
      setEntry('workspace');setDeletedRoof(undefined);setPanel('roof');setAddonOpen(null);setOverlayOpen(false);setSelectedOverlay(null);setPatternAt(null);setCanvasMenu(null);
      drawingView.current=undefined;setRestoredDrawingView(undefined);
      setSelected(null);setSelectedObstacle(null);setImageOpen(false);setMode('top');
      setCalibration(d.baseImage&&!d.baseImage.metersPerPixel?{mode:'rescale',base:d.baseImage}:null);
      setSettingsTab(locationResolved(d.sunSettings)?null:'project');setActiveSelected(true);setNewProjectOpen(false);setFileMessage('');setReset(n=>n+1);
    }catch(e){setFileMessage(tx('打开失败：')+(e as Error).message);}
    finally{openingProject.current=false;setImporting(false);}
  };
  const show3D=useCallback(()=>{setMode('3d');setOverlayOpen(false);setMeasureTool(null);},[]);
  const addonContext:AddonContext={project:projectDocument,active,running,setExtra,save,capture3D:mode==='3d'?()=>captureScene.current?.():undefined,show3D,close:()=>setAddonOpen(null)};
  function downloadLayoutImage(options:LayoutImageOptions){
    setCaptureError('');
    try{
      if(!captureScene.current)throw new Error(tx('画布正在加载，请稍后再试'));
      const link=document.createElement('a');
      link.href=captureScene.current(options);
      const site=options.scope==='site'?active.name.trim():undefined;
      const name=[projectName.trim()||tx('屋面方案'),site,mode==='top'?tx('2D 布置图'):tx('3D 布置图')].filter(Boolean).join(' - ');
      link.download=name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_')+'.png';
      link.click();
    }catch(error){
      setCaptureError(error instanceof Error&&error.name==='Error'?error.message:tx('图片导出失败'));
    }
  }
  const openAddon=workbenchAddons().find(a=>a.id===addonOpen);
  const recentFile=(r:NonNullable<Awaited<ReturnType<typeof readRecent>>>)=>new File([r.text],r.summary.fileName??`${r.summary.name}.json`,{type:'application/json'});
  // After F5: reopen the project this tab had open, on the same step.
  useEffect(()=>{
    if(!restoreId)return;
    let step:string|null=null;try{step=sessionStorage.getItem('pvlane.current-step');}catch{/* Storage may be unavailable. */}
    void readRecent(restoreId).then(async r=>{if(r){await openFile(recentFile(r),{id:restoreId,fileName:r.summary.fileName});if(step)setPanel(step);}}).catch(()=>{}).finally(()=>setRestoring(false));
  },[]);
  useEffect(()=>{try{sessionStorage.setItem('pvlane.current-step',panel);}catch{/* Storage may be unavailable. */}},[panel]);
  const flushAutosave=useRef<()=>Promise<void>>(undefined);
  const pendingAutosave=useRef<Promise<void>>(undefined);
  useEffect(()=>{
    if(entry!=='workspace'){if(!restoring)setCurrentProjectId();return;}
    if(baseImage&&!baseImage.metersPerPixel)return; // still calibrating a new drawing
    const id=projectId.current??=newProjectId(),project=workspaceFromDocument(projectDocument);setCurrentProjectId(id);
    const save=()=>{
      flushAutosave.current=undefined;
      const fileName=saveTarget.current.name;
      const pending=(pendingAutosave.current??Promise.resolve())
        .then(()=>saveRecent(id,project,fileName))
        .then(()=>setAutosaveError(''),e=>setAutosaveError((e as Error).message));
      pendingAutosave.current=pending;
      return pending;
    };
    flushAutosave.current=save;const t=setTimeout(save,500);
    return ()=>clearTimeout(t);
  },[entry,projectDocument]);
  useEffect(()=>{const flush=()=>flushAutosave.current?.();window.addEventListener('pagehide',flush);return ()=>window.removeEventListener('pagehide',flush);},[]);
  useEffect(()=>{
    if(entry!=='welcome'||restoring)return;
    let active=true;
    void (pendingAutosave.current??Promise.resolve()).then(listRecent)
      .then(items=>{if(active)setRecent(items);})
      .catch(()=>{if(active)setRecent([]);});
    return ()=>{active=false;};
  },[entry,restoring]);
  const openRecent=async(id:string)=>{
    let r:Awaited<ReturnType<typeof readRecent>>;
    try{r=await readRecent(id);}catch(e){setFileMessage(tx('打开失败：')+(e as Error).message);return;}
    if(!r){setFileMessage(tx('打开失败：这个项目已不存在'));setRecent(await listRecent().catch(()=>[]));return;}
    await openFile(recentFile(r),{id,fileName:r.summary.fileName});
  };
  /** The logo goes home. Save now so the last half second of edits is not lost. */
  const goHome=()=>{flushAutosave.current?.();setFileMessage('');setAddonOpen(null);setImageOpen(false);setPatternAt(null);setCanvasMenu(null);setEntry('welcome');};
  useEffect(()=>{if(viewOnly&&panel!=='report')setPanel('report');},[viewOnly,panel]);
  const deleteRecent=async(id:string)=>{await removeRecent(id).catch(e=>setFileMessage(tx('删除失败：')+(e as Error).message));setRecent(await listRecent().catch(()=>[]));};
  /** Keep the imported drawing separate from the project until calibration is confirmed. */
  const loadImage=async(file?:File)=>{
    if(!file||importing)return;
    setImporting(true);setFileMessage(tx('正在读取底图…'));
    try{
      const base=await loadDrawing(file);
      setCalibration({mode:'import',base});setFileMessage('');
    }catch(e){setFileMessage((e as Error).message);}
    finally{setImporting(false);}
  };
  function confirmCalibration(base:BaseImage){
    if(calibration?.mode==='rescale'){
      const next=recalibrateDrawing(projectDocument,base);
      loadDocument(next);
      setRestoredDrawingView(drawingView.current?{...drawingView.current}:undefined);
    }else{
      saveTarget.current={};projectId.current=undefined;setHistoryEpoch(n=>n+1);
      setBaseImage(base);clearForNewBase();setAddonOpen(null);setImageOverlays([]);setOverlayOpen(false);setSelectedOverlay(null);setDeletedRoof(undefined);
      drawingView.current=undefined;setRestoredDrawingView(undefined);setGlobalEdge(.5);setGlobalRidgeEdge(.5);
      const first={...newRegionDefaults(roofFromPrevious(active,tx('屋面 1'))),northAngle:base.northAngle};
      setRoofs([first]);setActiveId(first.id);setSelected(null);setSelectedObstacle(null);setPicked([]);setPickedObjects([]);
      setHasSelection(false);setActiveSelected(false);setPanel('roof');setCollapsed(false);setMode('top');setReset(n=>n+1);
    }
    setImageOpen(false);setSettingsTab(null);setCalibration(null);setFileMessage('');setEntry('workspace');
  }
  const runAll=()=>{
    if(!checkLocation())return;
    try{
      if(roofs.some((r,i)=>roofs.slice(i+1).some(s=>overlaps(roofRect(r),roofRect(s)))))throw new Error(tx('屋面之间存在重叠，请先调整轮廓'));
      let remaining=MAX_PROJECT_PANELS;
      const next=roofs.map(r=>{
        const result=autoLayout(r.roof,r.obstacles,{...r.layoutOptions,removeIsolated:true,alignment:r.layoutOptions.alignment??DEFAULT_WORKBENCH_ALIGNMENT,edge:globalEdge,ridgeEdge:globalRidgeEdge,carport:r.carport,pitch:r.pitch,module:r.moduleSpec,wallHeight:r.wallHeight,roofYaw:geographicYaw(r),limit:remaining},coreEdition?neighborShadowCasters(r,roofs):[]);
        remaining-=result.count;
        return {...r,previous:r.arrays,arrays:result.arrays,layoutSignature:layoutSignatureFor(r,edges),layoutMessage:''};
      });
      setRoofs(next);setSelected(null);setFileMessage(remaining<3?tx('全部屋面已布置，接近项目 10000 块上限'):tx('全部屋面已布置'));
    }catch(e){setFileMessage((e as Error).message);}
  };
  const updateCarport=(carport:CarportOptions)=>setRoofs(prev=>prev.map(r=>r.id===active.id?{...r,carport,previous:null}:r));
  const createRegion=(form:RegionForm)=>{
    setCreating(false);setDrawingIntent('create');setDrawingForm(form);
    if(baseImage&&!baseImage.metersPerPixel){setCalibration({mode:'rescale',base:baseImage});return;}
    const carport=form.endsWith('carport'),prefix=carport?tx('车棚'):tx('屋面');
    let n=1;
    while(hasSelection&&roofs.some(r=>r.name===`${prefix} ${n}`))n++;
    const name=`${prefix} ${n}`;
    const r=newRegionDefaults(initialRegionForm(carport?carportFromPrevious(active,name):roofFromPrevious(active,name),form));
    if(baseImage||coreEdition&&carport){
      if(!baseImage){const blank=blankDrawing();setBaseImage(blank);drawingView.current=blankDrawingInitialView(blank);}
      setDrawingDraft(r);
      setPanel('roof');setCollapsed(false);setMode('top');setNavigationMode('select');setCanvasMenu(null);setDisplayOpen(false);setSunOpen(false);setOverlayOpen(false);setMeasureTool(null);
      setDrawingTool(carport?'carport':'roof');setImageOpen(true);return;
    }
    const empty=!hasSelection&&roofs.length===1&&!active.arrays.length&&!active.obstacles.length;
    if(!empty){const b=projectBounds(roofs);r.x=b.x+b.width/2+r.roof.width/2+2;}else r.name=`${prefix} 1`;
    setRoofs(empty?[r]:[...roofs,r]);chooseRoof(r.id);setPanel('roof');setMode('top');setReset(n=>n+1);
  };
  const bounds=projectBounds(roofs);
  const arrayPreview=useMemo(()=>{
    if(!elementArrayPreview||elementArrayPreview.roofId!==active.id||inlineDrawing)return;
    const {targetId,spec}=elementArrayPreview;
    try{
      const preview=prepareElementArray(active,targetId,spec,i=>'array-preview-'+targetId+'-'+i);
      if(!preview.skipped||preview.memberIds.length>=2)return preview;
    }catch{/* An invalid draft leaves the canvas on the last saved geometry. */}
  },[elementArrayPreview,active,inlineDrawing]);
  const worldArrays=useMemo(()=>(hasSelection?roofs:[]).flatMap(r=>(objectDrawing||layoutAreaOpen)&&r.id===active.id?[]:r.arrays.map(a=>worldArray(a,r))),[hasSelection,roofs,objectDrawing,layoutAreaOpen,active.id]);
  const worldObjects=useMemo(()=>(hasSelection?roofs:[]).flatMap(r=>(r.id===active.id&&arrayPreview?arrayPreview.obstacles:r.obstacles)
   .filter(o=>!(objectDrawing&&drawingIntent==='reshape-object'&&r.id===active.id&&o.id===objectDraft?.id)).map(o=>worldObstacle(o,r))),[hasSelection,roofs,active.id,arrayPreview,objectDrawing,drawingIntent,objectDraft?.id]);
  const sceneSites=useMemo(()=>(hasSelection?roofs:[]).map((r,index)=>({...roofRect(r),id:r.id,name:r.name,planNumber:index+1,capacity:panel==='layout'?r.arrays.reduce((s,a)=>s+a.rows*a.columns*(a.module??defaultModule).power/1000,0):undefined,wallHeight:r.wallHeight,markerPitch:carportPitch(r),pitch:r.pitch,carport:r.carport,flatHeight:r.flatHeight,layoutArea:activeLayoutArea(r.layoutOptions)})),[hasSelection,roofs,panel]);
  const previewWorldIds=arrayPreview?.memberIds.map(id=>active.id+'/'+id);
  const resolvePreviewHit=(id:string|null)=>{
    if(!id?.startsWith('@o/')||!previewWorldIds?.includes(id.slice(3))||!elementArrayPreview)return id;
    return '@o/'+active.id+'/'+elementArrayPreview.targetId;
  };
  const worldZones=useMemo(()=>mode==='top'?worldPanelShadowZones(hasSelection?roofs:[],viewRays,coreEdition):[],[mode,hasSelection,roofs,viewRays]);
  const winterCheck=useMemo(()=>showWinterCheck&&mode==='3d'&&hasSelection?winterCheckLines(roofs,designRays,coreEdition):undefined,[showWinterCheck,mode,hasSelection,roofs,designRays]);
  // The Core canvas draws actual shaded areas separately. Red is reserved for geometry conflicts.
  const issuesOnCanvas=useMemo(()=>worldIssues(roofs,coreEdition?[]:designRays,false),[roofs,designRays]);
  const View = Three;
  const shadow=shadowNotice(sunSettings,hasSelection?roofs:[],edges);
  const pending=useMemo(()=>reportReadiness(roofs,{edge:globalEdge,ridge:globalRidgeEdge},coreEdition),[roofs,globalEdge,globalRidgeEdge]);
  const drawingEditor=imageOpen && baseImage && <ImageEditor hasExistingRegions={hasSelection} embedded={inlineDrawing} toolbarAnchor={layoutAreaOpen?'layout-limit':objectDrawing?'elements':'roof'} layoutArea={layoutAreaOpen?{apply:points=>setLayoutOptions(v=>({...v,layoutArea:points,layoutAreaEnabled:true})),clear:activeLayoutArea(layoutOptions)?()=>setLayoutOptions(v=>({...v,layoutArea:undefined,layoutAreaEnabled:false})):undefined}:undefined} draftObject={objectDrawing?objectDraft??undefined:undefined} onDraftObject={setObjectDraft} onObjectCreated={id=>{setSelectedObstacle(id);setPickedObjects([]);if(active.arrays.length)setFileMessage(tx('屋面要素已变化，请更新布置'));}} panMode={navigationMode==='pan'} fitSignal={drawingFitSignal} onViewChange={inlineDrawing?v=>setRestoredDrawingView({...v}):undefined} draftRegion={areaDrawing?drawingDraft??undefined:undefined} onDraftRegion={setDrawingDraft} building={creatingBuilding} imageOverlays={imageOverlays} obstacleHeight={obstacleHeight} onObstacleHeight={setObstacleHeight} onUndo={history.undo} onRedo={history.redo} canUndo={history.canUndo} canRedo={history.canRedo} intent={drawingIntent} initialForm={drawingForm} initialTool={drawingTool} initialView={drawingIntent==='crop'?undefined:drawingView.current??(inlineDrawing&&baseImage?.blank&&drawingIntent!=='reshape'&&drawingIntent!=='reshape-object'?blankDrawingInitialView(baseImage):undefined)} onViewClose={v=>{if(drawingIntent==='crop')return;drawingView.current=v;setRestoredDrawingView({...v});}} base={baseImage} roofs={roofs} activeId={active.id} activeObjectId={selectedObstacleId} onBase={setBaseImage} onRoofs={next=>setRoofs(next.map(bindModule))} onActive={chooseRoof} onClose={()=>{setLayoutAreaOpen(false);setObjectDraft(null);setDrawingDraft(null);setImageOpen(false);setMode('top');if(drawingIntent==='crop'){setOverlayOpen(true);return;}setPanel(layoutAreaOpen?'layout':'roof');}}/>;
  const calibrationView=calibration&&<CalibrationWorkspace base={calibration.base} recalibrating={calibration.mode==='rescale'} roofs={hasSelection?roofs:[]} onCancel={cancelCalibration} onConfirm={confirmCalibration}/>;
  if(entry!=='workspace')return calibrationView??<ProjectStart sunSettings={sunSettings} onSunSettings={setSunSettings} pendingDrawing={baseImage&&!baseImage.metersPerPixel?baseImage.name:undefined} name={projectName} address={projectAddress} onName={setProjectName} onAddress={changeAddress} phone={phone} creating={entry==='new'} busy={importing} message={fileMessage} recent={recent} restoring={restoring} onOpenRecent={id=>void openRecent(id)} onRemoveRecent={id=>void deleteRecent(id)} onNew={createBlankProject} onBack={()=>setEntry('welcome')} onOpen={openFile} onCreate={(mode,file)=>{if(!locationResolved(sunSettings)){setFileMessage(tx('请先填写可识别地点或完整经纬度。'));return;}setFileMessage('');if(mode==='drawing'){if(!file&&baseImage&&!baseImage.metersPerPixel){setCalibration({mode:'rescale',base:baseImage});}else void loadImage(file);}else{const blank=blankDrawing();setBaseImage(blank);drawingView.current=blankDrawingInitialView(blank);setImageOpen(false);setHistoryEpoch(n=>n+1);setEntry('workspace');}}}/>;
  return (<>
    {calibrationView}
    <main inert={!!calibration}>
      {layoutReportOpen&&<LayoutReport name={projectName} roofs={hasSelection?roofs:[]} pending={hasSelection?pending:[]} onClose={()=>setLayoutReportOpen(false)}/>}
      {openAddon?.early&&openAddon.panel?.(addonContext)}

      {settingsTab&&<GlobalSettingsDialog initialTab={settingsTab} moduleItems={moduleCatalog} usedModuleIds={new Set(roofs.map(r=>r.moduleId).filter((id):id is string=>!!id))} onModuleChange={updateModuleCatalog} edge={globalEdge} ridge={globalRidgeEdge} onRidge={setGlobalRidgeEdge} onEdge={setGlobalEdge} defaults={defaults} onDefaults={v=>setExtra('layoutDefaults',v)} sunSettings={sunSettings} onSunSettings={setSunSettings} name={projectName} address={projectAddress} base={baseImage} busy={importing||running} onName={setProjectName} onAddress={changeAddress} onScale={()=>{if(baseImage&&!baseImage.blank){setSettingsTab(null);setCalibration({mode:'rescale',base:baseImage});}}} onClose={()=>setSettingsTab(null)}/>}








      {newProjectOpen&&<NewProjectDialog saving={saving} error={startsWithText(fileMessage,'保存失败：{0}')?fileMessage:undefined} onCancel={()=>setNewProjectOpen(false)} onDiscard={createBlankProject} onSave={async()=>{if(await save())createBlankProject();}}/>}
      <section className={`workspace workspace-forma${inlineDrawing?' is-drawing':''}`}>
        <TopBar viewOnly={viewOnly} panel={panel} collapsed={collapsed} onSelectStep={id=>{if(id==='report'&&coreEdition){setLayoutReportOpen(true);return;}setPanel(id);setCollapsed(false);if(id==='layout'&&hasSelection)setActiveSelected(true);}} saveNotice={saveNotice} onDismissSaveNotice={()=>setSaveNotice(null)} onHome={goHome} onLogout={()=>void logout(()=>flushAutosave.current?.())} onLanguage={coreEdition?undefined:()=>void setLanguage(otherLanguage,()=>flushAutosave.current?.())} importing={importing} saving={saving} running={running} imageOpen={imageOpen} stress={stress}
          fileInput={fileInput} onDeliver={coreEdition?undefined:()=>{setPanel('report');setCollapsed(false);}} onSave={()=>void save()}
          onSettings={()=>setSettingsTab('library')} onNewProject={()=>setNewProjectOpen(true)}
          onOpenFile={file=>void openFile(file)}/>











        <aside className={`editor-float sidebar-drawer ${collapsed ? 'is-collapsed' : ''}`} data-page={panel==='report'?'report':panel==='roof'||panel==='project'?'roof':'layout'} aria-label={tx('操作面板')} onKeyDown={e => { if(e.key === 'Escape'&&!inlineDrawing&&!measureTool) setCollapsed(true); }}>




          {autosaveError&&<p className="autosave-error" role="alert" title={autosaveError}><Icon name="alert"/>{tx('未能自动保存：')}{autosaveError}</p>}
          {viewOnly&&!collapsed&&<p className="view-only-note" role="note">{tx('仅查看 · 编辑请使用电脑或平板')}</p>}
          {!viewOnly&&!inlineDrawing&&<><LocationMismatchNotice value={sunSettings} address={projectAddress} onSettings={()=>setSettingsTab('project')}/></>}
          {areaDrawing?<header className="region-context-header drawing-context-header"><span className="region-title">{drawingIntent==='reshape'?tx('编辑区域'):drawingDraft?.carport?tx('新建车棚'):tx('新建屋面')}</span></header>:!viewOnly&&!collapsed&&<RegionBar layoutAction={{run:()=>runLayout(layoutOptions),disabled:stress||running||needsOutline||!hasSelection||!activeSelected,stale:layoutStale&&(arrays.length>0||!!active.previous?.length),runAll:roofs.length>1&&hasSelection?runAll:undefined,allDisabled:stress||running}} locked={objectDrawing||layoutAreaOpen} roofs={roofs} active={active} hasSelection={hasSelection&&activeSelected} panel={panel} creating={creating} importing={importing} running={running} canReshape={!!baseImage} canUndoDelete={!!deletedRoof}
            onCollapse={()=>setCollapsed(!collapsed)} onAdd={()=>setCreating(true)} onCancelCreate={()=>setCreating(false)} onCreateRegion={createRegion} onChoose={chooseRoof} onRename={name=>setRoofs(rs=>rs.map(r=>r.id===active.id?{...r,name}:r))}
            onReshape={()=>editCanvasObject('@s/'+active.id)} onDuplicate={duplicateActiveRoof} onDelete={removeActiveRoof} onUndoDelete={undoRoofRemoval} onChangeType={changeActiveRoofType}/>}
{/* RegionBar handles add & rename */}
{/* RegionBar handles reshape & delete */}


          <div ref={inspector} className="inspector-content" hidden={collapsed}>




          {!inlineDrawing&&panel==='roof'&&(!hasSelection||!activeSelected)&&<div className="region-empty-state"><Icon name={hasSelection?'pointer':'region-add'}/><span>{hasSelection?tx('在画布中选择区域'):tx('新增区域')}</span></div>}
          {!hasSelection&&panel==='layout'&&<button className="empty-add-region" onClick={()=>{setPanel('roof');setCreating(true);}}><Icon name="plus"/><span>{tx('新增区域后布置')}</span></button>}


          <div className="layout-inspector" hidden={panel !== 'layout'||!hasSelection||!activeSelected}>
          <ModulePicker items={moduleCatalog} value={active.moduleId} standardOnly={!!active.carport} disabled={running||stress} onSelect={item=>setRoofs(rs=>rs.map(r=>r.id===active.id?{...r,moduleId:item.id,moduleSpec:{...item.spec},layoutOptions:item.spec.kind==='lightweight'?{...r.layoutOptions,layoutAreaEnabled:false}:r.layoutOptions}:r))}/>



          <section className={"layout-rules"+(active.carport?" is-carport":"")}>
          {active.carport&&<div className="layout-field">
           <div className="layout-field-label"><Icon name="start-edge"/><span>{tx('车棚起排边')}</span></div>
           <div className="seg-track edge-options" role="group" aria-label={tx('车棚起排边')}>
            {(['start','end'] as const).map(startEnd=>{
             const selected=(active.carport!.startEnd??'start')===startEnd;
             const label=layoutOptions.portrait?(startEnd==='start'?tx('边 A'):tx('边 C')):(startEnd==='start'?tx('边 B'):tx('边 D'));
             return <button type="button" key={startEnd} className="seg-btn" disabled={running||stress} aria-pressed={selected}
              onClick={()=>{if(!selected)updateCarport({...active.carport!,startEnd});}}>{label}</button>;
            })}
           </div>
          </div>}
          <AutoPanel edge={globalEdge} ridgeEdge={globalRidgeEdge} onEdge={setGlobalEdge} onRidgeEdge={setGlobalRidgeEdge} onEditArea={()=>{
           if(!baseImage){const blank=blankDrawing();setBaseImage(blank);drawingView.current=blankDrawingInitialView(blank);}
           setMode('top');setNavigationMode('select');setMeasureTool(null);setCanvasMenu(null);setDisplayOpen(false);setSunOpen(false);setOverlayOpen(false);
           setDrawingIntent('keepout');setDrawingTool('keepout');setDrawingForm(undefined);setLayoutAreaOpen(true);setImageOpen(true);
          }} options={{...layoutOptions,carport:active.carport,pitch:active.pitch,module:moduleSpec,roofYaw:geographicYaw(active)}} onChange={v=>{const {module,roofYaw,pitch,carport,...rules}=v;if(!active.pitch&&!active.carport&&(rules.frontHeight??DEFAULT_FRONT_HEIGHT)!==(layoutOptions.frontHeight??DEFAULT_FRONT_HEIGHT))setArrays(as=>as.map(a=>a.surface||a.mounting?a:{...a,frontHeight:rules.frontHeight??DEFAULT_FRONT_HEIGHT}));setLayoutOptions(rules);}} disabled={stress||running||layoutAreaOpen}/></section>
          </div>
          {((areaDrawing||objectDrawing)||panel==='roof'&&hasSelection&&activeSelected)&&<RegionPanel editRequest={elementEditRequest?.roofId===active.id?elementEditRequest:undefined} onEditRequestHandled={()=>setElementEditRequest(null)} creatingRegion={areaDrawing&&drawingIntent==='create'} geometryOnly={areaDrawing} creatingObject={objectDrawing&&objectDraft?{draft:objectDraft,onChange:setObjectDraft,editing:drawingIntent==='reshape-object'}:undefined} region={areaDrawing?drawingDraft??active:active} objectSelection={objectSelection} disabled={running||stress||objectDrawing} onChange={patch=>{if(areaDrawing)setDrawingDraft(d=>({...d??structuredClone(active),...patch}));else setRoofs(rs=>rs.map(r=>r.id===active.id?{...r,...patch}:r));}} onObjectSelectionChange={ids=>{setSelected(null);setSelectedObstacle(ids[0]??null);setPickedObjects(ids.slice(1));}} onAdd={addRegionObject} onDeleteObjects={deleteObjects} onApplyObjectEdit={applyObjectEdit} onApplyObjectArray={applyObjectArray} onPreviewObjectArray={setElementArrayPreview} onUngroupArray={ungroupArray}/>}
          </div>

          {!inlineDrawing&&!collapsed&&panel==='roof'&&fileMessage&&<p role="status" className="file-message panel-toast">{fileMessage}</p>}
          <div className="design-result sidebar-footer" hidden={collapsed||!hasSelection||!activeSelected||panel!=='layout'}>{fileMessage && <p role="status" className="file-message">{fileMessage}</p>}
            <LayoutStatus active={active} arrays={arrays} sunSettings={sunSettings} issues={issues} needsOutline={needsOutline} layoutStale={layoutStale} count={count} capacity={capacity} shadow={shadow}/>
            {startsWithText(layoutMessage,'请检查参数：{0}。组件长宽 0.2–5m，功率 1–2000Wp，平屋面连排 1–{1}，坡屋面 1–6、列数 1–100，间距不得为负。') && <p className="layout-message validation-error" role="status">{layoutMessage}</p>}

          </div>
        </aside>
        <div className="viewport">
          {inlineDrawing&&drawingEditor}
          {collapsed&&<button className="sidebar-expand-trigger" onClick={()=>setCollapsed(false)} aria-label={tx('展开面板')}><Icon name="chevron-right"/><span>{hasSelection&&activeSelected?active.name:hasSelection?tx('未选中区域'):projectName}</span></button>}

          <ViewportTools drawing={inlineDrawing} viewOnly={viewOnly} mode={mode} eyeLevel={eyeLevel} onToggleEyeLevel={coreEdition?undefined:()=>setEyeLevel(v=>!v)} navigationMode={navigationMode} running={running} displayOpen={displayOpen} sunOpen={sunOpen} overlayOpen={overlayOpen}
            onDownload={downloadLayoutImage} downloadDisabled={stress||!hasSelection}
            downloadGridVisible={showGrid}
            downloadSiteId={hasSelection&&activeSelected?active.id:undefined}
            downloadHasBase={!!(baseImage?.metersPerPixel&&!baseImage.blank)||imageOverlays.some(item=>item.visible&&item.opacity>0)}
            downloadBaseVisible={!!(baseImage?.metersPerPixel&&!baseImage.blank&&baseImage.visible!==false&&baseImage.opacity!==0)||imageOverlays.some(item=>item.visible&&item.opacity>0)}
            tools={workbenchAddons().flatMap(({id,tool:t})=>t?[{key:id,icon:t.icon,label:t.label,tooltip:t.tooltip(addonContext),disabled:t.disabled(addonContext),beforeOverlay:t.beforeOverlay,onClick:()=>{setAddonOpen(id);setOverlayOpen(false);setDisplayOpen(false);setSunOpen(false);}}]:[])}
            onTop={()=>{setSunOpen(false);setMode("top");setRun(0);setProgress("");setStress(false);}} on3d={()=>{setMode("3d");setOverlayOpen(false);setMeasureTool(null);}}
            onSelectMode={()=>{setNavigationMode('select');setMeasureTool(null);}}
            measureTool={measureTool} measureCount={measureCount} onClearMeasures={()=>setMeasureClear(n=>n+1)}
            onMeasure={t=>{setSunOpen(false);setMeasureTool(v=>v===t?null:t);setMode('top');setStress(false);setNavigationMode('select');setOverlayOpen(false);}}
            onTogglePan={()=>{setNavigationMode(v=>v==='pan'?'select':'pan');setMeasureTool(null);}} onFit={()=>{if(inlineDrawing)setDrawingFitSignal(n=>n+1);else setFitSignal(n=>n+1);}}
            onToggleDisplay={coreEdition?undefined:()=>{setDisplayOpen(v=>!v);setSunOpen(false);setOverlayOpen(false);}} onToggleSun={()=>{setSunOpen(v=>!v);setDisplayOpen(false);setOverlayOpen(false);}}
            onToggleOverlay={()=>{setOverlayOpen(v=>!v);setDisplayOpen(false);setSunOpen(false);setMode("top");setStress(false);setSelectedOverlay(id=>id??imageOverlays[0]?.id??null);}}
            align={!viewOnly&&hasSelection&&activeSelected&&panel==='roof'?(selectedObstacle?{count:objectSelection.length,keyName:selectedObstacle.name,onAlign:alignObjects}:{count:selection.length,keyName:active.name,onAlign:alignSelection}):undefined}/>
          <TopRightCluster viewOnly={viewOnly} total={total} regionCount={hasSelection?roofs.length:0} history={history} disabled={importing||saving||running||imageOpen}/>
          {overlayOpen&&<ImageOverlayPanel
           mainBase={baseImage&&!baseImage.blank&&baseImage.metersPerPixel?baseImage:undefined}
           onMainBaseChange={patch=>setBaseImage(base=>base&&({...base,...patch}))}
           onCrop={()=>{setOverlayOpen(false);setDrawingIntent('crop');setDrawingTool('roof');setDrawingForm(undefined);setImageOpen(true);}}
           onResetCrop={baseImage?.crop?()=>setBaseImage({...baseImage,crop:undefined}):undefined}
           items={imageOverlays} selected={selectedOverlay} center={hasSelection?{x:active.x,z:active.z}:{x:0,z:0}} initialWidth={hasSelection?active.roof.width:baseImage?.metersPerPixel?baseImage.width*baseImage.metersPerPixel*.35:30} onChange={setImageOverlays} onSelect={setSelectedOverlay} onClose={()=>setOverlayOpen(false)}/>}
          {mode==='3d'&&sunOpen&&<SunPopover showWinterCheck={showWinterCheck} onShowWinterCheck={setShowWinterCheck} sunSettings={sunSettings} onSunSettings={setSunSettings} previewTime={sunPreviewTime} onPreviewTime={setSunPreviewTime} showShadows={showShadows} onShowShadows={setShowShadows} onClose={()=>setSunOpen(false)}/>}
          {!coreEdition&&displayOpen&&<DisplayPopover showGrid={showGrid} onShowGrid={setShowGrid} directionMarkerStyle={directionMarkerStyle} onDirectionMarkerStyle={changeDirectionMarkerStyle} arrayDimensions={arrayDimensions} onArrayDimensions={setArrayDimensions} stressCount={stressCount} onStressCount={setStressCount} backgroundColor={backgroundColor} groundColor={groundColor} quality={quality} guides={guides} stress={stress} running={running} progress={progress} report={report} count={total.count} onBackground={setBackgroundColor} onGround={setGroundColor} onQuality={value=>{setQuality(value);setRun(0);setProgress('');setReport(null);}} onGuides={setGuides} onStartTest={()=>{setMode('3d');setStress(true);setGuides(false);setReport(null);setProgress(tx('第 1/3 轮预热 · 5 秒'));setRun(n=>n+1);}} onStopTest={()=>{setRun(0);setProgress(tx('已停止'));}} onResetTest={()=>{setStress(false);setRun(0);setProgress('');setReset(n=>n+1);}} onClose={()=>setDisplayOpen(false)}/>}
          <CanvasCompass store={northStore}/>
          {measureTool&&mode==='top'&&<div className="measure-hint">
           <span role="status">{measureTool==='distance'?tx('点两点测距离 · 按住 Shift 水平/竖直 · Esc 退出'):tx('依次点各角，点回起点或双击结束 · Backspace 撤回一点 · Esc 退出')}</span>
           <button type="button" className="icon-button" title={tx('退出测量')} aria-label={tx('退出测量')} onClick={()=>setMeasureTool(null)}><Icon name="close"/></button>
          </div>}
          {captureError&&<div className="capture-error" role="alert">{captureError}</div>}
          {mode==='top'&&<CanvasLegend/>}
          {mode==='top'&&selectBox&&<SelectBox rect={selectBox}/>}
          {patternAt&&<div className="pattern-float" style={{left:patternAt.x,top:patternAt.y}}><PatternButton label={tx('阵列')} disabled={false} actions={patternAt.objectId?objectPattern(patternAt.objectId):areaPattern} openSignal={patternAt.n}>{null}</PatternButton></div>}
          <Suspense
            fallback={<div className="loading">{tx('正在加载')} {engine}…</div>}
          >
            <View
              imageOverlays={imageOverlays} editingOverlay={overlayOpen} selectedOverlayId={selectedOverlay}
              baseImage={baseImage?.metersPerPixel?{...baseImage,frame:baseImage.frame??{x:0,y:0,width:baseImage.width,height:baseImage.height}}:baseImage}
              onCaptureReady={setSceneCapture}
              onScale={value=>{metersPerPixel.current=value;}} onNorth={northStore.set} measureTool={measureTool} measureClear={measureClear} onMeasureCount={setMeasureCount} showGrid={showGrid} showSiteLabels={!inlineDrawing}
              sites={sceneSites}
              focus={bounds}
              onDrawingView={v=>{if(!imageOpen&&(hasSelection||!baseImage?.blank))drawingView.current=v;}}
              restoreDrawingView={restoredDrawingView}
              roof={bounds}
              wallHeight={wallHeight}
              solarHour={solarHour}
              shadowZones={worldZones}
              winterCheck={winterCheck}
              showShadows={showShadows}
              obstacles={worldObjects}
              arrays={worldArrays}
              selectedObjectId={!inlineDrawing&&hasSelection&&activeSelected&&selectedObstacleId?`${active.id}/${selectedObstacleId}`:null}
              selectedSiteId={!inlineDrawing&&hasSelection&&activeSelected?active.id:undefined}
              pickedSiteIds={inlineDrawing?[]:selection.slice(1)}
              pickedObjectIds={!inlineDrawing&&hasSelection&&activeSelected?previewWorldIds??objectSelection.slice(1).map(id=>`${active.id}/${id}`):[]}
              onBoxSelect={{update:setSelectBox,finish:boxSelect}}
              selectedId={!inlineDrawing&&selectedId?`${active.id}/${selectedId}`:null}
              issues={issuesOnCanvas}
              mode={mode}
              navigationMode={navigationMode}
              viewCommand={viewCommand}
              fitSignal={fitSignal}
              eyeLevel={eyeLevel}
              reset={reset}
              visual={{
                backgroundColor, groundColor, sunSettings, sunPreviewTime, arrayDimensions:inlineDrawing?false:arrayDimensions,
                realistic: quality !== 'simple',
                quality,
                northAngle:baseImage?.northAngle??active.northAngle??0,
                stressCount,
                guides,
                stress,
                run,
                onProgress: setProgress,
                onReport: (result) => {
                  setReport(result);
                  localStorage.setItem(
                    "pv.visual.performance",
                    JSON.stringify(result),
                  );
                },
              }}
              onEditObject={id=>{if(!viewOnly&&mode==='top')editCanvasObject(resolvePreviewHit(id)??id);}}
              onObjectMenu={(id,x,y)=>{if(!viewOnly)openCanvasMenu(resolvePreviewHit(id)??id,x,y);}}
              directionMarkerColor={inlineDrawing?undefined:directionMarkerStyle==='hidden'?undefined:directionMarkerColors[directionMarkerStyle]}
              layoutMarker={directionMarkerStyle!=='hidden'&&panel==='layout'&&hasSelection&&activeSelected&&!selectedObstacle?layoutMarker(active,coreEdition):undefined}
              showPitchMarker={!inlineDrawing&&directionMarkerStyle!=='hidden'&&panel==='roof'&&hasSelection&&activeSelected&&!selectedObstacle}

              onSelect={(id,add)=>selectOnCanvas(resolvePreviewHit(id??null),add)}

              onMove={(id,x,z)=>{if(!viewOnly)moveOnCanvas(id,x,z);}}

            />
          </Suspense>
        </div>
      {canvasMenu&&<CanvasObjectMenu menu={canvasMenu} canReshape={!!baseImage} onEdit={editCanvasObject} onClose={()=>setCanvasMenu(null)}
        actions={panel==='roof'&&!running&&!stress?(parseCanvasId(canvasMenu.id).kind==='object'&&selectedObstacle
          ?{count:objectSelection.length,keyName:selectedObstacle.name,canPaste:hasClip,
            canPattern:objectSelection.length===1||!!selectedObstacle.arrayGroup&&objectSelection.every(id=>active.obstacles.some(o=>o.id===id&&o.arrayGroup?.id===selectedObstacle.arrayGroup?.id)),
            onCopy:copySelection,onPaste:pasteSelection,onPattern:()=>requestElementAction(active.id,selectedObstacle.id,'array'),onAlign:alignObjects,onDelete:()=>deleteObjects(objectSelection)}
          :{count:selection.length,keyName:active.name,canPaste:hasClip,onCopy:copySelection,onPaste:pasteSelection,onPattern:()=>setPatternAt(p=>({x:canvasMenu.x,y:canvasMenu.y,n:(p?.n??0)+1})),onAlign:alignSelection,onDelete:deleteSelection}):undefined}/>}
      {openAddon&&!openAddon.early&&openAddon.panel?.(addonContext)}
      {!inlineDrawing&&drawingEditor}
      </section>

    </main></>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
