import {validSunSettings,type SunSettings} from './sun-position';
import type {PanelFinish} from './render-material-options';
import type {RenderQuality} from './render-options';
import {tx} from './i18n';
export const photoPanelColors={
 blueBlack:{tint:'#aaa9a6',swatch:'#202e40'},
 deepBlue:{tint:'#668cc7',swatch:'#153668'},
 black:{tint:'#626266',swatch:'#151619'},
 grayBlue:{tint:'#b1c7db',swatch:'#526c86'},
} as const;
export type PhotoPanelColor=keyof typeof photoPanelColors;
export const defaultPhotoShadowStrength=.24;
export type PhotoRenderOptions={panelFinish?:PanelFinish;panelColor?:PhotoPanelColor;brightness?:number;reflection?:number;shadowStrength?:number;maxEdge?:2048|4096|8192;quality:RenderQuality;weather:'sunny'|'overcast';sun:SunSettings};
export type PhotoPoint={x:number;y:number};
/** What a mark points at. Roof corners use the drawing's corner order (1→4). `drop` is metres straight down from that corner (a wall foot).
 * `rise` is `meters` above a point on the roof surface that is seen at pixel `base`. Site points are measured points the user typed in. */
export type PhotoAnchor={kind:'corner';roofId:string;index:number;drop?:number}|{kind:'rise';roofId:string;meters:number;base?:PhotoPoint}|{kind:'site';pointId:string};
/** One reference in one photo. `at` is missing while the mark is planned but not clicked yet. Fit marks drive the camera; check marks only report their error. */
export type PhotoMark={id:string;anchor:PhotoAnchor;at?:PhotoPoint;role:'fit'|'check'};
/** A known real-world point: plan position x, z in project metres (same axes as roofs) and height h above the ground. */
export type SitePoint={id:string;name:string;x:number;z:number;h:number;source:'measured'|'assumed'};
/** A line drawn on the photo. `along` and `across` follow two ground directions at right angles (parking lines, kerbs); `vertical` follows plumb edges
 * (columns, poles, wall corners); `measure` is a ground distance with its real length, used only to check the camera. */
export type PhotoLine={id:string;kind:'along'|'across'|'vertical'|'measure';a:PhotoPoint;b:PhotoPoint;meters?:number};
export type PlanPoint={x:number;z:number};
/** One ground edge drawn twice: in the photo (`a`→`b`) and on the site plan in project metres (`planA`→`planB`). It places the camera on the site. */
export type PhotoReference={a?:PhotoPoint;b?:PhotoPoint;planA?:PlanPoint;planB?:PlanPoint};
/** One photo of the site, any angle. Pixels are in the imported image with a top-left origin. `roofId` is the roof the photo was added for.
 * `method` 'points' finds the camera from site points clicked in the photo, 'lines' from drawn lines; both cover the whole site. Older views mark the four corners of one roof. `lens35` is the
 * 35 mm-equivalent focal length, read from the photo file or typed in. */
export type PhotoView={id:string;roofId:string;name:string;url:string;width:number;height:number;marks:PhotoMark[];occlusions?:PhotoPoint[][];renderOptions?:PhotoRenderOptions;roofSignature:string;
 method?:'points'|'lines'|'corners';pointMode?:'corners'|'custom';referencePointIds?:string[];lines?:PhotoLine[];reference?:PhotoReference;lens35?:number;lensFromFile?:boolean};
/** Four roof corners plus one optional height line: the classic marking form, and the shape of photo matches in older project files. */
export type PhotoEdit={width:number;height:number;corners:PhotoPoint[];heightCalibration?:boolean;heightPoints:PhotoPoint[];heightMeters:number;heightMode:'below'|'above';anchor:number};
type LegacyPhotoMatch=PhotoEdit&{roofId:string;name:string;url:string;occlusions?:PhotoPoint[][];renderOptions?:PhotoRenderOptions;roofSignature:string};
export const usesHeightCalibration=(m:Pick<PhotoEdit,'heightCalibration'|'heightPoints'>)=>m.heightCalibration??m.heightPoints.length===2;
export const photoRoofSignature=(r:{roof:{width:number;depth:number};x:number;z:number;yaw:number;pitch?:unknown})=>JSON.stringify([r.roof,r.x,r.z,r.yaw,r.pitch]);
const inside=(p:PhotoPoint|undefined,w:number,h:number)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=w&&p.y<=h;
const text=(v:unknown,max:number)=>typeof v==='string'&&!!v&&v.length<=max;
const height=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=500;
function checkCommon(m:{name:unknown;url:unknown;width:number;height:number;occlusions?:unknown;renderOptions?:PhotoRenderOptions}){
 if(typeof m.name!=='string'||m.name.length>200||typeof m.url!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(m.url))throw new Error(tx('实景照片无效'));
 if(!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<1||m.height<1||m.width>20000||m.height>20000)throw new Error(tx('实景标注参数无效'));
 const options=m.renderOptions;
 if(options){
  const validRange=(value:number|undefined,min:number,max:number)=>value===undefined||(Number.isFinite(value)&&value>=min&&value<=max);
  if((options.panelColor!==undefined&&!Object.hasOwn(photoPanelColors,options.panelColor))||
     !validRange(options.brightness,.4,1.8)||!validRange(options.shadowStrength,0,1)){
   throw Error(tx('实景渲染设置无效'));
  }
 }
 if(m.renderOptions&&((m.renderOptions.panelFinish!==undefined&&!['blue-grey','charcoal'].includes(m.renderOptions.panelFinish))||(m.renderOptions.reflection!==undefined&&(!Number.isFinite(m.renderOptions.reflection)||m.renderOptions.reflection<0||m.renderOptions.reflection>1))||!['simple','standard','fine'].includes(m.renderOptions.quality)||!['sunny','overcast'].includes(m.renderOptions.weather)||!validSunSettings(m.renderOptions.sun)||(m.renderOptions.maxEdge!==undefined&&![2048,4096,8192].includes(m.renderOptions.maxEdge))))throw new Error(tx('实景渲染设置无效'));
 if(m.occlusions!==undefined&&(!Array.isArray(m.occlusions)||m.occlusions.length>100||m.occlusions.some(points=>!Array.isArray(points)||points.length<3||points.length>200||points.some(p=>!inside(p,m.width,m.height)))))throw new Error(tx('遮挡区域无效'));
}
export function parseSitePoints(raw:unknown):SitePoint[]{
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>500)throw new Error(tx('现场测量点无效'));
 const ids=new Set<string>();
 return raw.map((p:SitePoint)=>{
  if(!p||!text(p.id,100)||ids.has(p.id)||typeof p.name!=='string'||p.name.length>200||![p.x,p.z,p.h].every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=100000)||!['measured','assumed'].includes(p.source))throw new Error(tx('现场测量点无效'));
  ids.add(p.id);return {id:p.id,name:p.name,x:p.x,z:p.z,h:p.h,source:p.source};
 });
}
function parseAnchor(a:PhotoAnchor,w:number,h:number,sites:Set<string>):PhotoAnchor{
 if(a?.kind==='corner'&&text(a.roofId,100)&&Number.isInteger(a.index)&&a.index>=0&&a.index<200&&(a.drop===undefined||height(a.drop)))return a.drop===undefined?{kind:'corner',roofId:a.roofId,index:a.index}:{kind:'corner',roofId:a.roofId,index:a.index,drop:a.drop};
 if(a?.kind==='rise'&&text(a.roofId,100)&&height(a.meters)&&(a.base===undefined||inside(a.base,w,h)))return a.base?{kind:'rise',roofId:a.roofId,meters:a.meters,base:{x:a.base.x,y:a.base.y}}:{kind:'rise',roofId:a.roofId,meters:a.meters};
 if(a?.kind==='site'&&sites.has(a.pointId))return {kind:'site',pointId:a.pointId};
 throw new Error(tx('实景标注坐标无效'));
}
export function parsePhotoViews(raw:unknown,sitePoints:SitePoint[]=[]):PhotoView[]{
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>50)throw new Error(tx('实景标注数量无效'));
 const ids=new Set<string>(),sites=new Set(sitePoints.map(p=>p.id));let bytes=0;
 return raw.map((v:PhotoView)=>{
  if(!v||!text(v.id,100)||ids.has(v.id)||!text(v.roofId,100)||typeof v.roofSignature!=='string')throw new Error(tx('实景照片无效'));
  checkCommon(v);ids.add(v.id);bytes+=v.url.length;if(bytes>40000000)throw new Error(tx('实景照片总量超过限制'));
  if(!Array.isArray(v.marks)||v.marks.length>300)throw new Error(tx('实景标注数量无效'));
  const markIds=new Set<string>();
  const marks=v.marks.map(k=>{
   if(!k||!text(k.id,100)||markIds.has(k.id)||!['fit','check'].includes(k.role)||(k.at!==undefined&&!inside(k.at,v.width,v.height)))throw new Error(tx('实景标注坐标无效'));
   markIds.add(k.id);return {id:k.id,anchor:parseAnchor(k.anchor,v.width,v.height,sites),...(k.at?{at:{x:k.at.x,y:k.at.y}}:{}),role:k.role};
  });
  if(v.method!==undefined&&!['points','lines','corners'].includes(v.method))throw new Error(tx('实景标注参数无效'));
  if(v.pointMode!==undefined&&!['corners','custom'].includes(v.pointMode))throw new Error(tx('实景标注参数无效'));
  const pointIds=v.referencePointIds;
  if(pointIds!==undefined&&(!Array.isArray(pointIds)||pointIds.length>300||pointIds.some(id=>!text(id,100))))throw new Error(tx('实景标注参数无效'));
  if(v.lens35!==undefined&&(typeof v.lens35!=='number'||!Number.isFinite(v.lens35)||v.lens35<8||v.lens35>800)||v.lensFromFile!==undefined&&typeof v.lensFromFile!=='boolean')throw new Error(tx('镜头焦距无效'));
  const lineIds=new Set<string>();
  if(v.lines!==undefined&&(!Array.isArray(v.lines)||v.lines.length>200||v.lines.some(l=>!l||!text(l.id,100)||lineIds.has(l.id)||!lineIds.add(l.id)||!['along','across','vertical','measure'].includes(l.kind)||!inside(l.a,v.width,v.height)||!inside(l.b,v.width,v.height)||(l.meters!==undefined&&!height(l.meters)))))throw new Error(tx('照片线条无效'));
  const ref=v.reference,plan=(p:PlanPoint|undefined)=>p===undefined||!!p&&[p.x,p.z].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=100000);
  if(ref!==undefined&&(!ref||typeof ref!=='object'||[ref.a,ref.b].some(p=>p!==undefined&&!inside(p,v.width,v.height))||!plan(ref.planA)||!plan(ref.planB)))throw new Error(tx('参考线无效'));
  return {...v,marks,...(pointIds?{referencePointIds:[...new Set(pointIds)].filter(id=>sites.has(id))}:{}),...(v.occlusions?{occlusions:v.occlusions.map(p=>p.map(q=>({...q})))}:{}),...(v.lines?{lines:v.lines.map(l=>({...l,a:{...l.a},b:{...l.b}}))}:{}),...(ref?{reference:{...ref}}:{})};
 });
}
const heightMark=(v:PhotoView)=>v.marks.find(k=>(k.anchor.kind==='corner'&&k.anchor.drop!==undefined||k.anchor.kind==='rise')&&k.anchor.roofId===v.roofId);
const cornerMark=(v:PhotoView,i:number)=>v.marks.find(k=>k.anchor.kind==='corner'&&k.anchor.drop===undefined&&k.anchor.roofId===v.roofId&&k.anchor.index===i);
/** The view's own-roof corners and height line in the classic marking form. */
export function editOf(v:PhotoView):PhotoEdit{
 const corners:PhotoPoint[]=[];for(let i=0;i<4;i++){const p=cornerMark(v,i)?.at;if(!p)break;corners.push(p);}
 const k=heightMark(v),a=k?.anchor;
 const base={width:v.width,height:v.height,corners,heightCalibration:k?.role==='fit'};
 if(a?.kind==='rise')return {...base,heightMode:'above',anchor:0,heightMeters:a.meters,heightPoints:[a.base,k!.at].filter(p=>!!p).slice(0,a.base?2:0)};
 if(a?.kind==='corner'){const top=corners[a.index];return {...base,heightMode:'below',anchor:a.index,heightMeters:a.drop!,heightPoints:top&&k!.at?[top,k!.at]:[]};}
 return {...base,heightMode:'below',anchor:0,heightMeters:10,heightPoints:[]};
}
/** Write the classic marking form back as marks, keeping every other mark of the view. */
export function applyEdit(v:PhotoView,e:PhotoEdit):PhotoView{
 const own=new Set([0,1,2,3].map(i=>cornerMark(v,i)).concat(heightMark(v)));
 const marks:PhotoMark[]=v.marks.filter(k=>!own.has(k));
 e.corners.slice(0,4).forEach((p,i)=>marks.push({id:`corner-${i+1}`,anchor:{kind:'corner',roofId:v.roofId,index:i},at:{x:p.x,y:p.y},role:'fit'}));
 const enabled=usesHeightCalibration(e),role=enabled?'fit':'check',[first,second]=e.heightPoints;
 if(enabled||e.heightPoints.length){
  if(e.heightMode==='above')marks.push({id:'height',anchor:first?{kind:'rise',roofId:v.roofId,meters:e.heightMeters,base:{...first}}:{kind:'rise',roofId:v.roofId,meters:e.heightMeters},...(second?{at:{...second}}:{}),role});
  else marks.push({id:'height',anchor:{kind:'corner',roofId:v.roofId,index:e.anchor,drop:e.heightMeters},...(second?{at:{...second}}:{}),role});
 }
 return {...v,marks};
}
function parseLegacy(m:LegacyPhotoMatch){
 if(!m||!text(m.roofId,100))throw new Error(tx('实景照片无效'));
 checkCommon(m);
 if(m.heightCalibration!==undefined&&typeof m.heightCalibration!=='boolean')throw new Error(tx('高度校准选项无效'));
 if(!height(m.heightMeters)||!['below','above'].includes(m.heightMode)||!Number.isInteger(m.anchor)||m.anchor<0||m.anchor>3||typeof m.roofSignature!=='string')throw new Error(tx('实景标注参数无效'));
 for(const [points,max] of [[m.corners,4],[m.heightPoints,2]] as const)if(!Array.isArray(points)||points.length>max||points.some(p=>!inside(p,m.width,m.height)))throw new Error(tx('实景标注坐标无效'));
}
/** Older project files kept one photo per roof as `photoMatches`; each becomes one view with the same marks. */
export function viewsFromLegacy(raw:unknown):PhotoView[]{
 if(!Array.isArray(raw)||raw.length>50)throw new Error(tx('实景标注数量无效'));
 const roofs=new Set<string>();
 const views=raw.map((m:LegacyPhotoMatch)=>{
  parseLegacy(m);if(roofs.has(m.roofId))throw new Error(tx('实景照片无效'));roofs.add(m.roofId);
  const view:PhotoView={id:`photo-${m.roofId}`,roofId:m.roofId,name:m.name,url:m.url,width:m.width,height:m.height,marks:[],...(m.occlusions?{occlusions:m.occlusions}:{}),...(m.renderOptions?{renderOptions:m.renderOptions}:{}),roofSignature:m.roofSignature};
  return applyEdit(view,m);
 });
 return parsePhotoViews(views);
}
export function cornerProblem(points:PhotoPoint[]):string{
 if(points.length<4)return '';
 const cross=points.map((p,i)=>{const q=points[(i+1)%4],r=points[(i+2)%4];return (q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x);});
 if(cross.some(v=>Math.abs(v)<1)||!(cross.every(v=>v>0)||cross.every(v=>v<0)))return tx('四角交叉或过于接近，请按图纸编号沿边依次标注');
 return '';
}
