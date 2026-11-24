import {validOutline} from './polygon';
import {layoutAreaProblem} from './layout-area';
import {validRoofSize} from './roof-limits';
import { MAX_FLAT_TABLE_ROWS,MAX_PROJECT_PANELS } from './project-limits';
import { valid, validModule, type ModuleSpec, type PVArray, type Obstacle } from './domain';
import type { LayoutOptions } from './auto-layout';
import {validBaseImageCrop,type BaseImage} from './base-image';
import {tx} from './i18n';
export type ProjectFile = {version:1|2;name:string;roof:import("./polygon").Footprint;obstacles:Obstacle[];arrays:PVArray[];module:ModuleSpec;rules:LayoutOptions;wallHeight:number;solarHour:number;backgroundColor:string;groundColor:string;baseImage?:BaseImage};
export function validateProject(p:ProjectFile,maxTableRows=MAX_FLAT_TABLE_ROWS):ProjectFile {
 const range=(v:number,min:number,max:number)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(![1,2].includes(p.version)||typeof p.name!=='string'||!p.roof||(!validRoofSize(p.roof)||!validOutline(p.roof))||!p.module||!validModule(p.module)||!range(p.wallHeight,0,5)||!range(p.solarHour,9,15))throw new Error(tx('项目参数或版本无效'));
 if(!Array.isArray(p.arrays)||p.arrays.length>MAX_PROJECT_PANELS||p.arrays.some(a=>!valid(a)||typeof a.id!=='string'||typeof a.name!=='string')||p.arrays.reduce((n,a)=>n+a.rows*a.columns,0)>MAX_PROJECT_PANELS||new Set(p.arrays.map(a=>a.id)).size!==p.arrays.length)throw new Error(tx('阵列数据无效'));
 if(!Array.isArray(p.obstacles)||p.obstacles.length>100||p.obstacles.some(o=>(o.kind!==undefined&&!['obstacle','keepout'].includes(o.kind))||typeof o.id!=='string'||typeof o.name!=='string'||![o.x,o.z,o.yaw].every(Number.isFinite)||!range(o.width,.2,500)||!range(o.depth,.2,500)||!(o.kind==='keepout'?o.height===0:range(o.height,.2,30)))||new Set(p.obstacles.map(o=>o.id)).size!==p.obstacles.length)throw new Error(tx('障碍物数据无效'));
 for(const o of p.obstacles){if(o.topLayout&&(o.kind==='keepout'||typeof o.topLayout.enabled!=='boolean'||!range(o.topLayout.tilt,0,60)||!range(o.topLayout.edge,0,20)))throw new Error(tx('附属建筑顶部参数无效'));if(o.arrayGroup&&(typeof o.arrayGroup.id!=='string'||typeof o.arrayGroup.name!=='string'||!Number.isInteger(o.arrayGroup.count)||o.arrayGroup.count<2||o.arrayGroup.count>(o.arrayGroup.grid?100:21)||!!o.arrayGroup.grid&&(![o.arrayGroup.grid.columns,o.arrayGroup.grid.rows].every(n=>Number.isInteger(n)&&n>=1&&n<=21)||o.arrayGroup.grid.columns*o.arrayGroup.grid.rows>100||!range(o.arrayGroup.grid.rowGap,0,100)||!['roof','element'].includes(o.arrayGroup.grid.basis))||!['width','depth'].includes(o.arrayGroup.axis)||!Number.isFinite(o.arrayGroup.gap)||o.arrayGroup.gap<0||!Number.isInteger(o.arrayGroup.index)||o.arrayGroup.index<0))throw new Error(tx('障碍物阵列数据无效'));}
 for(const a of p.arrays)if(a.hostObstacleId!==undefined&&(typeof a.hostObstacleId!=='string'||!p.obstacles.some(o=>o.id===a.hostObstacleId&&o.topLayout)))throw new Error(tx('顶部阵列所属建筑无效'));
 const r=p.rules;if(!r||typeof r.portrait!=='boolean'||!range(r.tilt,0,60)||!range(r.edge,0,20)||!range(r.gap,0,20)||!Number.isInteger(r.maxColumns)||!range(r.maxColumns,1,100)||!Number.isInteger(r.maxRows??1)||!range(r.maxRows??1,1,100)||!range(r.arrayGapY??r.gap,0,20)||!range(r.rowGap??0,0,100))throw new Error(tx('排布规则无效'));
 if(r.shadowIgnored!==undefined&&typeof r.shadowIgnored!=='boolean')throw new Error(tx('阴影校核开关无效'));
 const areaProblem=layoutAreaProblem(r,p.roof);if(areaProblem)throw new Error(tx(areaProblem));
 if(r.frontHeight!==undefined&&!range(r.frontHeight,.2,10))throw new Error(tx('组件前沿高度应为 0.2–10 m'));
 if(r.alignment!==undefined&&!['edge','center'].includes(r.alignment))throw new Error(tx('布置对齐方式无效'));
 if(r.shadowLatitude!==undefined&&!range(r.shadowLatitude,-90,90))throw new Error(tx('阴影校核纬度无效'));
 if((r.azimuth!==undefined&&(!range(r.azimuth,0,360)||r.azimuth===360))||(r.azimuthMode!==undefined&&!['auto','manual'].includes(r.azimuthMode)))throw new Error(tx('组件朝向无效'));
 if(r.direction!==undefined&&(!Number.isInteger(r.direction)||!range(r.direction,0,3)))throw new Error(tx('组件朝向无效'));
 if(r.tableRows!==undefined&&(!Number.isInteger(r.tableRows)||!range(r.tableRows,1,maxTableRows))||r.spacingMode!==undefined&&!['solar','manual'].includes(r.spacingMode))throw new Error(tx('连排或间距模式无效'));
 if(!/^#[0-9a-f]{6}$/i.test(p.backgroundColor)||!/^#[0-9a-f]{6}$/i.test(p.groundColor))throw new Error(tx('颜色无效'));
 const b=p.baseImage;if(b){if((b.opacity!==undefined&&!range(b.opacity,0,1))||(b.visible!==undefined&&typeof b.visible!=='boolean'))throw new Error(tx('底图无效'));if(b.crop!==undefined&&!validBaseImageCrop(b.crop,b))throw new Error(tx('底图修剪轮廓无效'));if(b.blank!==undefined&&typeof b.blank!=='boolean')throw new Error(tx('底图类型无效'));if(b.northAngle!==undefined&&(!Number.isFinite(b.northAngle)||b.northAngle<0||b.northAngle>=360))throw new Error(tx('北向角度无效'));if(b.pdfSource!==undefined&&(typeof b.pdfSource!=='string'||!/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(b.pdfSource)||b.pdfSource.length>41000000))throw new Error(tx('PDF 原文件数据无效'));if(typeof b.name!=='string'||typeof b.url!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(b.url)||b.url.length>60000000||!range(b.width,1,10000)||!range(b.height,1,10000)||b.metersPerPixel!==undefined&&!range(b.metersPerPixel,.000001,10000))throw new Error(tx('底图无效'));if(b.frame&&(!b.metersPerPixel||![b.frame.x,b.frame.y,b.frame.width,b.frame.height].every(Number.isFinite)||b.frame.x<0||b.frame.y<0||b.frame.width<=0||b.frame.height<=0||b.frame.x+b.frame.width>b.width+1||b.frame.y+b.frame.height>b.height+1))throw new Error(tx('底图区域无效'));}
 return p;
}
export function parseProject(text:string,maxTableRows=MAX_FLAT_TABLE_ROWS):ProjectFile {
 return validateProject(JSON.parse(text) as ProjectFile,maxTableRows);
}
export function downloadProject(p:ProjectFile){const url=URL.createObjectURL(new Blob([JSON.stringify(p)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${p.name.replace(/[\\/:*?"<>|]/g,'_')||tx('屋面方案')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
