import {restoreProjectLocation,locationResolved} from './location-presets';
import {parseSunSettings,type SunSettings} from './sun-position';
import { MAX_FLAT_TABLE_ROWS,MAX_PROJECT_PANELS } from './project-limits';
import {parseImageOverlays,type ImageOverlay} from './image-overlays';
import { validCarport } from './carport';
import { validPitch } from './pitched-roof';
import { parseProject, validateProject } from './project-file';
import { newRoof, totals, type RoofDesign } from './roof-project';
import type { BaseImage } from './base-image';
import {parseModuleCatalog,sameModule,type ModuleCatalogItem} from './module-library';
import {tx} from './i18n';
import {readExtras,type ProjectExtras} from './project-extras';
/** A project file: the core fields plus the add-on fields (ProjectExtras), which older files may not have. */
export type WorkspaceFile={version:3;viewRotation?:number;sunSettings?:SunSettings;imageOverlays?:ImageOverlay[];moduleCatalog?:ModuleCatalogItem[];globalEdge?:number;globalRidgeEdge?:number;name:string;address?:string;hasRegions?:boolean;roofs:RoofDesign[];activeId:string;solarHour:number;backgroundColor:string;groundColor:string;baseImage?:BaseImage}&Partial<ProjectExtras>;
export function parseWorkspace(text:string):WorkspaceFile {
 const raw=JSON.parse(text);
 if(raw.version!==3){const p=parseProject(text),r={...newRoof(),northAngle:p.baseImage?.northAngle,roof:p.roof,obstacles:p.obstacles,arrays:p.arrays,moduleSpec:p.module,layoutOptions:p.rules,flatHeight:undefined,wallHeight:p.wallHeight};const b=p.baseImage;
  if(b?.frame&&b.metersPerPixel){r.x=(b.frame.x+b.frame.width/2-b.width/2)*b.metersPerPixel;r.z=(b.frame.y+b.frame.height/2-b.height/2)*b.metersPerPixel;b.frame={x:0,y:0,width:b.width,height:b.height};}
  const moduleCatalog=parseModuleCatalog(undefined,[r.moduleSpec]);r.moduleId=moduleCatalog[0].id;
  const file:Record<string,unknown>={version:3,moduleCatalog,globalEdge:r.layoutOptions.edge,name:p.name,roofs:[r],activeId:r.id,solarHour:p.solarHour,backgroundColor:p.backgroundColor,groundColor:p.groundColor,baseImage:b};
  readExtras(file);return file as WorkspaceFile;
 }
 const p=raw as WorkspaceFile;
 if(p.sunSettings!==undefined)p.sunSettings=parseSunSettings(p.sunSettings);
 if(p.imageOverlays!==undefined)p.imageOverlays=parseImageOverlays(p.imageOverlays);
 readExtras(raw);
 if(p.address!==undefined&&typeof p.address!=='string')throw new Error(tx('项目地址无效'));
 if(p.viewRotation!==undefined&&(!Number.isFinite(p.viewRotation)||Math.abs(p.viewRotation)>360))throw new Error(tx('画布旋转角度无效'));
 if(p.hasRegions!==undefined&&typeof p.hasRegions!=='boolean')throw new Error(tx('区域状态无效'));
 if(!Array.isArray(p.roofs)||!p.roofs.length||p.roofs.length>50||new Set(p.roofs.map(r=>r.id)).size!==p.roofs.length)throw new Error(tx('屋面数量或标识无效'));
 for(const r of p.roofs){
  if([r.edgeOverride,r.ridgeEdgeOverride].some(edge=>edge!==undefined&&(!Number.isFinite(edge)||edge<0||edge>20)))throw new Error(tx('单独设置的屋面边距无效'));
  if(r.shadingOnly!==undefined&&typeof r.shadingOnly!=='boolean')throw new Error(tx('遮挡状态无效'));
  if(r.shadingOnly&&r.carport)throw new Error(tx('车棚不能设为障碍建筑'));
  if(r.roof?.outline&&(r.carport||(r.pitch&&r.pitch.kind!=='gable')))throw new Error(tx('多段线轮廓仅支持平屋面、双坡屋面、连坡屋面和障碍建筑'));
  if(r.northAngle!==undefined&&(!Number.isFinite(r.northAngle)||r.northAngle<0||r.northAngle>=360))throw new Error(tx('北向角度无效'));
  r.northAngle=p.baseImage?.northAngle??r.northAngle;
  if(r.flatHeight!==undefined&&(!Number.isFinite(r.flatHeight)||r.flatHeight<1||r.flatHeight>100))throw new Error(tx('屋面高度无效'));
  if(r.carport!==undefined&&(!validCarport(r.carport)||r.pitch||r.moduleSpec?.kind==='lightweight'))throw new Error(tx('车棚参数或组件类型无效'));
  if(r.pitch!==undefined&&!validPitch(r.pitch,r.roof))throw new Error(tx('屋面坡度参数无效'));
  if(typeof r.id!=='string'||r.id.includes('/')||typeof r.name!=='string'||![r.x,r.z,r.yaw].every(Number.isFinite)||Math.abs(r.x)>100000||Math.abs(r.z)>100000)throw new Error(tx('屋面坐标无效'));
  validateProject({version:2,name:p.name,roof:r.roof,obstacles:r.obstacles,arrays:r.arrays,module:r.moduleSpec,rules:r.layoutOptions,wallHeight:r.wallHeight,solarHour:p.solarHour,backgroundColor:p.backgroundColor,groundColor:p.groundColor},r.pitch?6:MAX_FLAT_TABLE_ROWS);
  if(r.moduleSpec.kind===undefined)r.moduleSpec.kind=r.pitch?'lightweight':'standard';
  r.previous=null;
  if(typeof r.layoutSignature!=='string')r.layoutSignature='';
  if(typeof r.layoutMessage!=='string')r.layoutMessage='';
 }
 p.moduleCatalog=parseModuleCatalog(p.moduleCatalog,p.roofs.map(r=>r.moduleSpec));
 for(const r of p.roofs){
  const selected=p.moduleCatalog.find(item=>item.id===r.moduleId&&sameModule(item.spec,r.moduleSpec))||p.moduleCatalog.find(item=>sameModule(item.spec,r.moduleSpec));
  if(!selected)throw new Error(tx('{0} 的组件规格与组件库不一致',r.name));
  r.moduleId=selected.id;
 }
 if(p.globalEdge===undefined)p.globalEdge=p.roofs[0].layoutOptions.edge;
 if(!Number.isFinite(p.globalEdge)||p.globalEdge<0||p.globalEdge>20)throw new Error(tx('全局屋面边距无效'));
 if(p.globalRidgeEdge!==undefined&&(!Number.isFinite(p.globalRidgeEdge)||p.globalRidgeEdge<0||p.globalRidgeEdge>20))throw new Error(tx('全局屋脊边距无效'));
 if(totals(p.roofs).count>MAX_PROJECT_PANELS)throw new Error(tx('项目组件总数超过 {0}',MAX_PROJECT_PANELS));
 if(p.baseImage){const r=p.roofs[0];validateProject({version:2,name:p.name,roof:r.roof,obstacles:[],arrays:[],module:r.moduleSpec,rules:r.layoutOptions,wallHeight:r.wallHeight,solarHour:p.solarHour,backgroundColor:p.backgroundColor,groundColor:p.groundColor,baseImage:p.baseImage},r.pitch?6:MAX_FLAT_TABLE_ROWS);}
 if(!p.roofs.some(r=>r.id===p.activeId))p.activeId=p.roofs[0].id;
 if(p.sunSettings){p.sunSettings=restoreProjectLocation(p.sunSettings,p.address);if(locationResolved(p.sunSettings))for(const r of p.roofs)if(r.layoutOptions.shadowIgnored){r.layoutOptions={...r.layoutOptions,shadowIgnored:false,shadowLatitude:p.sunSettings.latitude};}}
 return p;
}
export type SaveHandle={name:string;createWritable:()=>Promise<{write:(data:Blob)=>Promise<void>;close:()=>Promise<void>}>};
export type WorkspaceSaveTarget={handle?:SaveHandle;name?:string};
export async function downloadWorkspace(p:WorkspaceFile,target?:WorkspaceSaveTarget):Promise<string|null>{
 const picker=(window as unknown as {showSaveFilePicker?:(options:unknown)=>Promise<SaveHandle>}).showSaveFilePicker;
 if(!picker&&!target?.handle)throw new Error(tx('当前浏览器不支持选择保存位置，请在 Chrome 或 Edge 中打开本项目后保存。'));
 const suggestedName=target?.name??`${p.name.replace(/[\\/:*?"<>|]/g,'_')||tx('光伏方案')}.json`;
 try{
  const handle=target?.handle??await picker!.call(window,{suggestedName,types:[{description:tx('光伏项目 JSON'),accept:{'application/json':['.json']}}],excludeAcceptAllOption:true});
  const file=await handle.createWritable();
  await file.write(new Blob([JSON.stringify(p)],{type:'application/json'}));await file.close();if(target){target.handle=handle;target.name=handle.name;}return handle.name;
 }catch(e){if(e instanceof DOMException&&e.name==='AbortError')return null;throw e;}
}
