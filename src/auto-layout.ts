import {removeIsolatedPanels} from './isolated-panels';
import {tx} from './i18n';
import {createPanelOcclusion,type ShadowCaster} from './panel-occlusion';
import {activeLayoutArea,layoutAreaProblem} from './layout-area';
import {centerLayout} from './center-layout';
import {polygonContains,type Footprint} from './polygon';
import {buildingContext} from './building-top';
import {pitchedShadowZones} from './pitched-shadow-zones';
import { MAX_FLAT_TABLE_ROWS, MAX_PROJECT_PANELS } from './project-limits';
import { carportLayout, type CarportOptions } from './carport';
import { standardPitchedLayout } from './standard-pitched-layout';
import { pitchedLayout, type RoofPitch } from './pitched-roof';
import { recommendedGap,winterRays } from './solar';
import { shadowZones, parapets } from './shadow-zones';
import { corners, geometry, initial, overlaps, defaultModule, DEFAULT_FRONT_HEIGHT, validModule, type ModuleSpec, type Obstacle, type PVArray } from './domain';

export type LayoutOptions = {
  removeIsolated?:boolean;
  shadowLatitude?:number;
  shadowIgnored?:boolean;
  carport?:CarportOptions;
  pitch?: RoofPitch;
  direction?: number; azimuth?: number; azimuthMode?: 'auto' | 'manual'; portrait: boolean; tilt: number; edge: number; ridgeEdge?: number; gap: number; maxColumns: number;
  roofYaw?: number; limit?: number; wallHeight?: number; module?: ModuleSpec; tableRows?: number;
  layoutArea?:import("./domain").Point[];layoutAreaEnabled?:boolean;
  frontHeight?:number;
  alignment?: 'edge' | 'center';
  spacingMode?: 'solar' | 'manual'; rowGap?: number;
  // Legacy file fields, unused by the connected-table layout.
  maxRows?: number; arrayGapY?: number;
};
export const DEFAULT_WORKBENCH_ALIGNMENT='center';
export const layoutDirection=(o:Pick<LayoutOptions,'direction'|'portrait'>)=>o.direction??(o.portrait?0:1);
export const normalizeAzimuth=(degrees:number)=>((degrees%360)+360)%360;
export const layoutAzimuth=(o:LayoutOptions)=>o.azimuth===undefined
 ? normalizeAzimuth(180+90*layoutDirection(o)-(o.roofYaw??0)*180/Math.PI)
 : normalizeAzimuth(o.azimuth);
export const localLayoutAzimuth=(o:LayoutOptions)=>normalizeAzimuth(layoutAzimuth(o)+(o.roofYaw??0)*180/Math.PI);
export function tableSpacing(options: LayoutOptions) {
  const module = options.module ?? defaultModule;
  const rows = options.tableRows ?? 1;
  const slopeLength = rows * module.length + (rows - 1) * module.gap;
  const recommended = recommendedGap(slopeLength, options.tilt, layoutAzimuth(options),options.shadowLatitude);
  const requested = options.rowGap ?? 0;
  const actual = options.spacingMode === 'manual' ? requested : Math.max(requested, recommended);
  return { recommended, actual, shortened: actual < recommended };
}

// Scan whole connected table strips; an obstacle excludes all rows in that strip.
function baseAutoLayout(roof: Footprint, obstacles: Obstacle[], options: LayoutOptions,neighbors:readonly ShadowCaster[]=[]) {
  const winter=winterRays(options.shadowLatitude),yaw=options.roofYaw??0;
  const neighborBlocked=neighbors.length?createPanelOcclusion(roof,[],0,yaw,winter,neighbors).blocked:undefined;
  if(options.carport)return carportLayout(roof,obstacles,{...options,carport:options.carport,neighborBlocked});
  const lightweight=options.module?.kind==='lightweight'||(options.module?.kind===undefined&&!!options.pitch);
  if(lightweight)return pitchedLayout(roof,obstacles,{...options,neighborBlocked,forbidden:options.pitch?pitchedShadowZones(roof,obstacles,options.pitch,yaw,winter,0,options.wallHeight):shadowZones(roof,obstacles,options.wallHeight??.32,yaw,winter),pitch:options.pitch??{kind:'single',axis:'z',high:-1,percent:0,eave:3.5}});
  if(options.pitch)return standardPitchedLayout(roof,obstacles,options,neighborBlocked);
  if (![roof.width, roof.depth, options.tilt, options.edge, options.gap, options.maxColumns].every(Number.isFinite) || roof.width <= 0 || roof.depth <= 0 || options.edge < 0 || options.gap < 0 || options.tilt < 0 || options.tilt > 60 || !Number.isInteger(options.maxColumns) || options.maxColumns < 1 || options.maxColumns > 100) throw new Error(tx('排布参数无效'));
  if(!Number.isFinite(options.roofYaw??0)||!Number.isInteger(options.limit??MAX_PROJECT_PANELS)||(options.limit??MAX_PROJECT_PANELS)<0||(options.limit??MAX_PROJECT_PANELS)>MAX_PROJECT_PANELS)throw new Error(tx('屋面角度或项目数量上限无效'));
  const module = options.module ?? defaultModule, rows = options.tableRows ?? 1;
  if (!validModule(module) || !Number.isInteger(rows) || rows < 1 || rows > MAX_FLAT_TABLE_ROWS || !Number.isFinite(options.rowGap ?? 0) || (options.rowGap ?? 0) < 0 || !['solar', 'manual'].includes(options.spacingMode ?? 'solar')) throw new Error(tx('组件或连排规则无效'));
  if(options.frontHeight!==undefined&&(!Number.isFinite(options.frontHeight)||options.frontHeight<.2||options.frontHeight>10))throw new Error(tx('组件前沿高度应为 0.2–10 m'));
  if(!['edge','center'].includes(options.alignment??'edge'))throw new Error(tx('布置对齐方式无效'));
  const q=layoutDirection(options);if(!Number.isInteger(q)||q<0||q>3)throw new Error(tx('组件朝向无效'));
  if(options.azimuth!==undefined&&(!Number.isFinite(options.azimuth)||options.azimuth<0||options.azimuth>=360))throw new Error(tx('组件朝向无效'));
  const azimuth=options.azimuth===undefined?(180+90*q)%360:localLayoutAzimuth(options);
  const angle=(azimuth-180)*Math.PI/180;
  const rotated=options.azimuth!==undefined&&Math.abs(Math.sin(2*angle))>1e-7;
  const turned=Math.abs(Math.cos(angle))<1e-7;
  const spacing = tableSpacing(options), rowGap = spacing.actual;
  const occlusion=createPanelOcclusion(roof,obstacles,options.wallHeight??.32,yaw,winter,neighbors);
  const c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const localRoof=rotated?{width:roof.width*c+roof.depth*s,depth:roof.width*s+roof.depth*c}:turned?{width:roof.depth,depth:roof.width}:roof;
  const boundary=roof.outline??(rotated?corners({x:0,z:0,yaw:0,...roof}):undefined);
  const area=activeLayoutArea(options);
  const scanArea=area?.map(p=>({x:p.x*Math.cos(angle)+p.z*Math.sin(angle),z:-p.x*Math.sin(angle)+p.z*Math.cos(angle)}));
  const local = (x: number, z: number) => ({x:x*Math.cos(angle)-z*Math.sin(angle),z:x*Math.sin(angle)+z*Math.cos(angle)});
  const template = { ...initial, frontHeight:options.frontHeight??DEFAULT_FRONT_HEIGHT, module, rows, connectedRows: true, columns: 1, portrait: true, tilt: options.tilt, azimuth, rowGap };
  const left=Math.max(-localRoof.width/2+options.edge,scanArea?Math.min(...scanArea.map(p=>p.x)):-Infinity);
  const start=Math.max(-localRoof.depth/2+options.edge,scanArea?Math.min(...scanArea.map(p=>p.z)):-Infinity);
  const right=Math.min(localRoof.width/2-options.edge,scanArea?Math.max(...scanArea.map(p=>p.x)):Infinity),bottom=Math.min(localRoof.depth/2-options.edge,scanArea?Math.max(...scanArea.map(p=>p.z)):Infinity);
  const limit=options.limit??MAX_PROJECT_PANELS;
  const bandGeometry=Array.from({length:rows},(_,i)=>geometry({...template,rows:i+1}));
  const scan=(step:1|-1)=>{
    const arrays:PVArray[]=[];
    let count=0,leadingDistance=0;
    for(let top=start;top<bottom;){
      let bandRows=rows;
      while(bandRows>0&&top+bandGeometry[bandRows-1].depth>bottom+1e-7)bandRows--;
      if(!bandRows)break;
      const bandTemplate={...template,rows:bandRows},g=bandGeometry[bandRows-1],z=top+g.depth/2;
      top+=g.depth+rowGap;
      const tableHeightOffset=(chosen:number)=>(bandRows-chosen)*(g.l+module.gap)*Math.sin(g.tilt);
      let run:number[]=[],runRows=bandRows,runZ=z,firstFullDistance:number|undefined;
      const flush=()=>{
        if(!run.length)return;
        arrays.push({...bandTemplate,rows:runRows,...(runRows<bandRows?{tableHeightOffset:tableHeightOffset(runRows)}:{}),id:`auto-${arrays.length+1}`,name:tx('阵列 {0}',arrays.length+1),...local((run[0]+run[run.length-1])/2,runZ),columns:run.length});
        run=[];
      };
      const begin=step===1?left+g.w/2:right-g.w/2;
      const end=step===1?right-g.w/2:left+g.w/2;
      if(step*(end-begin)<-1e-7)break;
      for(let x=begin;step*(x-end)<=1e-7;){
        let chosen=bandRows,chosenZ=z;
        for(;chosen>0;chosen--){
          const depth=bandGeometry[chosen-1].depth;
          chosenZ=z-g.depth/2+depth/2;
          const position=local(x,chosenZ),candidate={...position,width:g.w,depth,yaw:g.yaw};
          if((!area||polygonContains(area,corners(candidate)))&&(!boundary||polygonContains(boundary,corners(candidate),options.edge))&&!obstacles.some(o=>overlaps(candidate,o))&&!occlusion.blocked({...bandTemplate,...position,rows:chosen,tableHeightOffset:tableHeightOffset(chosen)}))break;
        }
        let full=false;
        if(!chosen)flush();
        else{
          if(chosen===bandRows)firstFullDistance??=Math.abs(x-begin);
          if(count+chosen>limit){flush();return {arrays,count,capped:true,leadingDistance:leadingDistance+(firstFullDistance??Math.abs(end-begin))};}
          if(run.length&&chosen!==runRows)flush();
          runRows=chosen;runZ=chosenZ;run.push(x);count+=chosen;
          full=run.length===options.maxColumns;
          if(full)flush();
        }
        // Blocked columns never consume a slot. Only a full run inserts a table gap.
        x+=step*(g.w+(full?options.gap:module.gap));
      }
      flush();
      leadingDistance+=firstFullDistance??Math.abs(end-begin);
    }
    return {arrays,count,capped:false,leadingDistance};
  };
  const score=(candidate:ReturnType<typeof scan>)=>{
   const arrays=options.removeIsolated?removeIsolatedPanels(candidate.arrays):candidate.arrays;
   const panels=(a:PVArray)=>a.rows*a.columns;
   return [
    arrays.reduce((total,a)=>total+panels(a),0),
    arrays.reduce((total,a)=>total+(a.columns===options.maxColumns?panels(a):0),0),
    arrays.reduce((total,a)=>total+(a.rows===rows?panels(a):0),0),
    -Math.round(candidate.leadingDistance*1000),
    -arrays.length,
   ];
  };
  const fromLeft=scan(1),fromRight=scan(-1);
  const leftScore=score(fromLeft),rightScore=score(fromRight);
  const firstDifference=rightScore.findIndex((value,index)=>value!==leftScore[index]);
  const best=firstDifference>=0&&rightScore[firstDifference]>leftScore[firstDifference]?fromRight:fromLeft;
  const arrays=options.alignment==='center'?centerLayout(best.arrays,roof,options.edge,obstacles,[],area,occlusion.blocked):best.arrays;
  return {arrays,count:best.count,capped:best.capped,rowGap,...spacing};
}

// Child roof panels remain in the owning roof's array list so all reports count them once.
export function autoLayout(roof:Footprint,obstacles:Obstacle[],options:LayoutOptions,neighbors:readonly ShadowCaster[]=[]){
 const areaProblem=layoutAreaProblem(options,roof);if(areaProblem)throw new Error(areaProblem);
 if(activeLayoutArea(options)&&(options.pitch||options.carport||options.module?.kind==='lightweight'))throw new Error(tx('限定布置区域目前用于平屋面标准组件，请先关闭区域限制'));
 if(options.shadowIgnored)throw new Error(tx('必须填写项目地点或经纬度，阴影校核不能跳过'));
 for(const o of obstacles)if(o.topLayout&&(!Number.isFinite(o.topLayout.tilt)||o.topLayout.tilt<0||o.topLayout.tilt>60||!Number.isFinite(o.topLayout.edge)||o.topLayout.edge<0||o.topLayout.edge>20))throw new Error(tx("附属建筑顶部参数无效"));
 if(roof.outline&&(options.pitch||options.carport))throw new Error(tx("多段线轮廓仅支持平屋面"));
 if(options.shadowLatitude!==undefined&&(!Number.isFinite(options.shadowLatitude)||Math.abs(options.shadowLatitude)>90||!winterRays(options.shadowLatitude).length))throw new Error(tx('所在地冬至没有有效日照，需另定校核时段；当前自动校核不适用'));
 const result=baseAutoLayout(roof,obstacles,options,neighbors);if(options.carport)return result;
 const arrays=[...result.arrays];let count=result.count,capped=!!result.capped;const limit=options.limit??MAX_PROJECT_PANELS;
 for(const host of obstacles.filter(o=>o.kind!=='keepout'&&o.topLayout?.enabled)){
  const ctx=buildingContext(roof,options.pitch,options.pitch?obstacles:[...obstacles,...parapets(roof,options.wallHeight??.32)],host),top=host.topLayout!;
  if(count>=limit){capped=true;break;}
  const parentArea=activeLayoutArea(options),cHost=Math.cos(host.yaw),sHost=Math.sin(host.yaw);
  const hostArea=parentArea?.map(p=>{const x=p.x-host.x,z=p.z-host.z;return {x:x*cHost-z*sHost,z:x*sHost+z*cHost};});
  const hostCasters=neighbors.map(caster=>({...caster,vertices:caster.vertices.map(v=>{
   const x=v.x-host.x,z=v.z-host.z;
   return {x:x*cHost-z*sHost,z:x*sHost+z*cHost,y:v.y-ctx.height};
  })}));
  const upper=baseAutoLayout(host,ctx.objects,{...options,layoutArea:hostArea,pitch:undefined,carport:undefined,wallHeight:0,tilt:top.tilt,edge:top.edge,tableRows:Math.min(MAX_FLAT_TABLE_ROWS,options.tableRows??1),roofYaw:(options.roofYaw??0)+host.yaw,limit:limit-count},hostCasters);
  const c=Math.cos(host.yaw),s=Math.sin(host.yaw);
  for(const a of upper.arrays)arrays.push({...a,id:`top-${host.id}-${a.id}`,name:tx('{0} 顶部 {1}',host.name,a.name),hostObstacleId:host.id,x:host.x+a.x*c+a.z*s,z:host.z-a.x*s+a.z*c,azimuth:a.azimuth-host.yaw*180/Math.PI,elevation:ctx.height+(a.elevation??0),...(a.surface?{surface:{...a.surface,height:a.surface.height+ctx.height}}:{})});
  count+=upper.count;capped=capped||!!upper.capped;
 }
 if(!options.removeIsolated)return {...result,arrays,count,capped};
 const retained=removeIsolatedPanels(arrays);
 return {...result,arrays:retained,count:retained.reduce((sum,array)=>sum+array.rows*array.columns,0),capped};
}
