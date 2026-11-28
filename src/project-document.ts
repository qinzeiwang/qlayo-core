import {useCallback,useMemo,useState,type SetStateAction} from 'react';
import type {BaseImage} from './base-image';
import type {ImageOverlay} from './image-overlays';
import {restoreProjectLocation} from './location-presets';
import {defaultModuleCatalog,type ModuleCatalogItem} from './module-library';
import {blankExtras,initialExtras,newBaseExtras,openExtras,saveExtras,type ProjectExtras} from './project-extras';
import {newRoof,useRoofProject,type RoofDesign} from './roof-project';
import type {SavedModuleLibrary} from './saved-module-library';
import {defaultSunSettings,type SunSettings} from './sun-position';
import type {WorkspaceFile} from './workspace-file';
import {tx} from './i18n';
type CoreDocument={
 name:string;address:string;
 roofs:RoofDesign[];activeId:string;
 /** False until the first region is drawn; the placeholder roof is then hidden. */
 hasRegions:boolean;
 globalEdge:number;globalRidgeEdge:number;sunSettings:SunSettings;moduleCatalog:ModuleCatalogItem[];
 baseImage?:BaseImage;imageOverlays:ImageOverlay[];
 solarHour:number;backgroundColor:string;groundColor:string;
 viewRotation?:number;
};
/** Everything that is saved in a project file: the core fields plus the add-on fields (ProjectExtras).
 * Screen state (open dialogs, selection, tab) is not part of it. */
export type ProjectDocument=CoreDocument&ProjectExtras;
/** File fields that belong to the core; every other field belongs to an add-on. */
export const coreKeys=['version','name','address','roofs','activeId','hasRegions','globalEdge','globalRidgeEdge','sunSettings','moduleCatalog','baseImage','imageOverlays','solarHour','backgroundColor','groundColor','viewRotation'] as const;
const backgroundColor='#f0f1f2',groundColor='#e4e6e7';
const extrasOf=(d:object)=>Object.fromEntries(Object.entries(d).filter(([k])=>!(coreKeys as readonly string[]).includes(k))) as unknown as ProjectExtras;
/** A new, empty project that uses the saved default module. */
export function blankDocument(library:SavedModuleLibrary):ProjectDocument{
 const item=library.items.find(i=>i.id===library.defaultId)!;
 const r={...newRoof(),moduleId:item.id,moduleSpec:{...item.spec}};
 const moduleCatalog=library.items[0]===item?library.items:[item,...library.items.filter(i=>i.id!==item.id)];
 return {name:tx('未命名项目'),address:'',roofs:[r],activeId:r.id,hasRegions:false,globalEdge:.5,globalRidgeEdge:.5,sunSettings:defaultSunSettings(),moduleCatalog,
  baseImage:undefined,imageOverlays:[],solarHour:9,backgroundColor,groundColor,viewRotation:0,...blankExtras()};
}
/** Fill in defaults for fields that older project files do not have. */
export function documentFromWorkspace(p:WorkspaceFile):ProjectDocument{
 return {name:p.name,address:p.address??'',roofs:p.roofs,activeId:p.activeId,hasRegions:p.hasRegions??true,globalEdge:p.globalEdge??.5,globalRidgeEdge:p.globalRidgeEdge??p.globalEdge??.5,
  sunSettings:restoreProjectLocation(p.sunSettings,p.address),moduleCatalog:p.moduleCatalog??defaultModuleCatalog(),
  baseImage:p.baseImage,imageOverlays:p.imageOverlays??[],
  solarHour:p.solarHour,
  viewRotation:p.viewRotation??0,
  backgroundColor:['#dce5ec','#eef1f5'].includes(p.backgroundColor.toLowerCase())?backgroundColor:p.backgroundColor,
  groundColor:['#c7cccb','#f0f1f2'].includes(p.groundColor.toLowerCase())?groundColor:p.groundColor,
  ...openExtras(p as Record<string,unknown>,coreKeys)};
}
/** The project file. */
export function workspaceFromDocument(d:ProjectDocument):WorkspaceFile{
 return {version:3,sunSettings:d.sunSettings,imageOverlays:d.imageOverlays,moduleCatalog:d.moduleCatalog,
  name:d.name,address:d.address,hasRegions:d.hasRegions,roofs:d.roofs.map(r=>({...r,previous:null})),activeId:d.activeId,globalEdge:d.globalEdge,globalRidgeEdge:d.globalRidgeEdge,
  solarHour:d.solarHour,backgroundColor:d.backgroundColor,groundColor:d.groundColor,baseImage:d.baseImage,...(d.viewRotation?{viewRotation:d.viewRotation}:{}),...saveExtras(extrasOf(d),d.roofs.map(r=>r.id))};
}
/** Project state: one setter per core field and `setExtra` for add-on fields, plus `projectDocument` and `loadDocument` to read or replace all of it. */
export function useProjectDocument(initialCatalog:()=>ModuleCatalogItem[]){
 const roofProject=useRoofProject(),{roofs,setRoofs,active,setActiveId}=roofProject;
 const [projectName,setProjectName]=useState(tx('未命名项目'));
 const [projectAddress,setProjectAddress]=useState('');
 const [hasSelection,setHasSelection]=useState(false);
 const [globalEdge,setGlobalEdge]=useState(.5),[globalRidgeEdge,setGlobalRidgeEdge]=useState(.5);
 const [sunSettings,setSunSettings]=useState(defaultSunSettings);
 const [moduleCatalog,setModuleCatalog]=useState<ModuleCatalogItem[]>(initialCatalog);
 const [baseImage,setBaseImage]=useState<BaseImage>();
 const [imageOverlays,setImageOverlays]=useState<ImageOverlay[]>([]);
 const [extras,setExtras]=useState<ProjectExtras>(initialExtras);
 const [solarHour,setSolarHour]=useState(11);
 const [background,setBackgroundColor]=useState(backgroundColor);
 const [ground,setGroundColor]=useState(groundColor);
 const [viewRotation,setViewRotation]=useState(0);
 const setExtra=useCallback(<K extends keyof ProjectExtras>(key:K,value:SetStateAction<ProjectExtras[K]>)=>
  setExtras(e=>({...e,[key]:typeof value==='function'?(value as (v:ProjectExtras[K])=>ProjectExtras[K])(e[key]):value})),[]);
 /** A new base drawing: the add-on fields tied to the drawing start blank. */
 const clearForNewBase=useCallback(()=>setExtras(e=>({...e,...newBaseExtras()})),[]);
 // `activeId` is the roof actually shown: it falls back to the first roof when the stored id is missing.
 const projectDocument=useMemo<ProjectDocument>(()=>({name:projectName,address:projectAddress,roofs,activeId:active.id,hasRegions:hasSelection,globalEdge,globalRidgeEdge,sunSettings,moduleCatalog,baseImage,imageOverlays,solarHour,backgroundColor:background,groundColor:ground,viewRotation,...extras}),
  [projectName,projectAddress,roofs,active.id,hasSelection,globalEdge,globalRidgeEdge,sunSettings,moduleCatalog,baseImage,imageOverlays,extras,solarHour,background,ground,viewRotation]);
 const loadDocument=(d:ProjectDocument)=>{
  setProjectName(d.name);setProjectAddress(d.address);setRoofs(d.roofs);setActiveId(d.activeId);setHasSelection(d.hasRegions);setGlobalEdge(d.globalEdge);setGlobalRidgeEdge(d.globalRidgeEdge);setSunSettings(d.sunSettings);
  setModuleCatalog(d.moduleCatalog);setBaseImage(d.baseImage);setImageOverlays(d.imageOverlays);setExtras(extrasOf(d));
  setSolarHour(d.solarHour);setBackgroundColor(d.backgroundColor);setGroundColor(d.groundColor);setViewRotation(d.viewRotation??0);
 };
 return {...roofProject,projectDocument,loadDocument,
  projectName,setProjectName,projectAddress,setProjectAddress,hasSelection,setHasSelection,globalEdge,setGlobalEdge,globalRidgeEdge,setGlobalRidgeEdge,sunSettings,setSunSettings,
  moduleCatalog,setModuleCatalog,baseImage,setBaseImage,imageOverlays,setImageOverlays,extras,setExtra,clearForNewBase,
  solarHour,setSolarHour,backgroundColor:background,setBackgroundColor,groundColor:ground,setGroundColor,viewRotation,setViewRotation};
}
