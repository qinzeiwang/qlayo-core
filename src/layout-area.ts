import {corners,footprint,type Point,type PVArray,type Issue} from './domain';
import {polygonContains,validOutline,type Footprint} from './polygon';
export type LayoutAreaOptions={layoutArea?:Point[];layoutAreaEnabled?:boolean};
export const activeLayoutArea=(o:LayoutAreaOptions)=>o.layoutAreaEnabled===false?undefined:o.layoutArea;
export function rescaleLayoutArea<T extends LayoutAreaOptions>(options:T,ratio:number):T{
 return options.layoutArea?{...options,layoutArea:options.layoutArea.map(p=>({x:p.x*ratio,z:p.z*ratio}))}:options;
}
export function layoutAreaProblem(o:LayoutAreaOptions,roof?:Footprint):string{
 if(o.layoutAreaEnabled!==undefined&&typeof o.layoutAreaEnabled!=='boolean')return '限定布置区域开关无效';
 const area=o.layoutArea;
 if(area===undefined)return o.layoutAreaEnabled?'请先圈定允许布置区域':'';
 if(!Array.isArray(area)||area.length<3||area.length>64||area.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)||Math.abs(p.x)>100000||Math.abs(p.z)>100000))return '限定布置区域坐标无效';
 const width=Math.max(2,...area.map(p=>Math.abs(p.x)*2)),depth=Math.max(2,...area.map(p=>Math.abs(p.z)*2));
 if(!validOutline({width,depth,outline:area}))return '限定布置区域需至少 1 ㎡，边长不少于 0.05 m，且不能交叉或重叠';
 if(roof&&o.layoutAreaEnabled!==false){const outline=roof.outline??corners({x:0,z:0,yaw:0,...roof});if(!polygonContains(outline,area))return '限定布置区域必须位于真实屋面内';}
 return '';
}
export function layoutAreaIssues(arrays:PVArray[],o:LayoutAreaOptions):Issue[]{
 const area=activeLayoutArea(o);if(!area)return [];
 return arrays.filter(a=>!polygonContains(area,corners(footprint(a)))).map(a=>({kind:'boundary',ids:[a.id],text:`${a.name} 超出限定布置区域`}));
}
