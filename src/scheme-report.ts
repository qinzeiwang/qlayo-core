import {detect,overlaps} from './domain';
import {layoutAreaIssues} from './layout-area';
import {geographicYaw,roofRect} from './roof-project';
import {layoutShadowSources,neighborShadowCasters} from './neighbor-shadows';
import {createPanelOcclusion} from './panel-occlusion';
import {winterRays} from './solar';
import {carportBoundary} from './carport';
import {reportStyle} from './theme/report-style';
import {projectStatistics} from './project-statistics';
import {needsLayoutUpdate,type Edges} from './layout-state';
import type {RoofDesign} from './roof-project';
export const escapeHtml=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function reportReadiness(roofs:RoofDesign[],edge:Edges,includeNeighborShadows=false){
 const sources=layoutShadowSources(roofs,includeNeighborShadows);
 return roofs.filter(r=>{
  if(r.shadingOnly)return false;
  if(!r.arrays.length||layoutAreaIssues(r.arrays,r.layoutOptions).length||needsLayoutUpdate(r,edge,sources)||detect(r.arrays,r.obstacles,carportBoundary(r.roof,r.carport,r.layoutOptions.portrait)).length||roofs.some(other=>other.id!==r.id&&overlaps(roofRect(r),roofRect(other))))return true;
  if(!sources.length||r.layoutOptions.shadowIgnored)return false;
  const neighbors=neighborShadowCasters(r,sources);
  return neighbors.length>0&&r.arrays.some(createPanelOcclusion(r.roof,[],0,geographicYaw(r),winterRays(r.layoutOptions.shadowLatitude),neighbors).blocked);
 }).map(r=>r.name);
}
export type ReportTable=(heads:string[],rows:unknown[][])=>string;
/** Report content from add-on modules (e.g. energy yield): overview rows, region columns, whole sections and a closing note. */
export type ReportExtra={overview:unknown[][];regionTitle:string;regionHeads:string[];regionCells:(regionId:string)=>unknown[];sections:(table:ReportTable)=>string;note:string};
/** The project report: 3D picture, overview, region details. `extra` is read only once the project is ready. */
export function schemeReport(name:string,roofs:RoofDesign[],edge:Edges,picture:string,address="",extra?:()=>ReportExtra){
 if(!roofs.length||reportReadiness(roofs,edge).length)throw new Error('请先完成所有区域布置、更新参数并消除占地冲突');
 if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(picture))throw new Error('三维图像尚未准备好');
 const {total:t,regions,groups}=projectStatistics(roofs),f=(n:number)=>n.toFixed(2),e=escapeHtml;
 const x=extra?.()??{overview:[],regionTitle:'区域明细',regionHeads:[],regionCells:()=>[],sections:()=>'',note:''};
 const table:ReportTable=(heads:string[],rows:unknown[][])=>`<div class="report-table"><table><thead><tr>${heads.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${e(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${e(name)} · 光伏前期方案</title><style>${reportStyle}</style><button onclick="window.print()">打印 / 保存为 PDF</button><h1>${e(name)}</h1><p>光伏前期方案 · ${e(new Date().toLocaleDateString('zh-CN'))}</p>${address?`<p>项目地址：${e(address)}</p>`:""}<h2>三维效果</h2><img alt="当前三维方案视图" src="${picture}"><h2>项目概况</h2>${table(['项目指标','数值'],[['屋顶展开面积',f(t.slopeArea)+' ㎡'],['屋面组件占用面积',f(t.occupiedArea)+' ㎡'],['车棚占地面积',f(t.carportArea)+' ㎡'],['屋面装机量',f(t.roofCapacity)+' kWp'],['车棚装机量',f(t.carportCapacity)+' kWp'],['标准组件装机量',f(t.standardCapacity)+' kWp'],['轻质组件装机量',f(t.lightweightCapacity)+' kWp'],['总装机量',f(t.capacity)+' kWp'],['组件总数',t.count],...x.overview])}<h2>${e(x.regionTitle)}</h2>${table(['区域','类型','展开面积 ㎡','水平投影参考 ㎡','组件占用 ㎡','车棚占地 ㎡','数量','装机量 kWp',...x.regionHeads],regions.map(r=>[r.name,r.type,r.isCarport?'—':f(r.slopeArea),r.isCarport?'—':f(r.roofArea),f(r.occupiedArea),r.isCarport?f(r.carportArea):'—',r.count,f(r.capacity),...x.regionCells(r.id)]))}${x.sections(table)}<p><small>面积以屋面展开口径为主；车棚占地按实际棚顶水平投影。倾角以水平面为 0°；朝向以北 0°、东 90°、南 180°、西 270°，顺时针，中文以最近正方向为参考。装机量按当前已布置组件计算。${x.note}</small></p></html>`;
}
export async function downloadScheme(html:string,name:string){
 const picker=(window as unknown as {showSaveFilePicker?:(options:unknown)=>Promise<{createWritable:()=>Promise<{write:(data:Blob)=>Promise<void>;close:()=>Promise<void>}>}>}).showSaveFilePicker;
 if(!picker)throw new Error('当前浏览器不支持选择保存位置，请在 Chrome 或 Edge 中下载报告。');
 try{
  const handle=await picker.call(window,{suggestedName:(name.replace(/[\\/:*?"<>|]/g,'_')||'光伏方案')+'-方案报告.html',types:[{description:'方案报告 HTML',accept:{'text/html':['.html']}}],excludeAcceptAllOption:true});
  const file=await handle.createWritable();await file.write(new Blob([html],{type:'text/html;charset=utf-8'}));await file.close();return true;
 }catch(e){if(e instanceof DOMException&&e.name==='AbortError')return false;throw e;}
}
