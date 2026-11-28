import {corners,overlaps,type Obstacle,type Point,type Rect} from './domain';
import {containsRect} from './drawing-geometry';
import {newId} from './ids';
import {layoutSignatureFor,needsLayoutUpdate,type Edges} from './layout-state';
import {MAX_PROJECT_PANELS} from './project-limits';
import {roofRect,toLocal,toWorld,type RoofDesign} from './roof-project';
import {tx} from './i18n';
export type AlignEdge='left'|'right'|'top'|'bottom'|'middle'|'center'|'angle';
/** A row of copies: how many new ones, along the item's own width (local x) or length (local z), and the gap between them. */
export type PatternOptions={count:number;axis:'width'|'depth';gap:number};
export const MAX_PATTERN=20;
export const validPattern=(o:PatternOptions)=>Number.isInteger(o.count)&&o.count>=1&&o.count<=MAX_PATTERN&&(o.axis==='width'||o.axis==='depth')&&Number.isFinite(o.gap)&&o.gap>=0&&o.gap<=100;
/** Extent of a rect's corners along another frame's own axes. */
function extent(r:Rect,frame:Pick<RoofDesign,'x'|'z'|'yaw'>){
 const ps=corners(r).map(p=>toLocal(p,frame)),xs=ps.map(p=>p.x),zs=ps.map(p=>p.z);
 return {x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};
}
/** New position of `moving` with one edge, centre line or angle lined up with `target`. Measured along the target's own axes turned by whole quarter turns to sit closest to the screen's, so "left" is always the side nearest screen left. Panels and objects ride along. */
export function alignRoof(moving:RoofDesign,target:RoofDesign,edge:AlignEdge,viewRotation=0):Pick<RoofDesign,'x'|'z'|'yaw'>{
 return alignRect(roofRect(moving),roofRect(target),edge,viewRotation);
}
/** The same for any two rects in one frame (areas in the world, or objects in their area). */
export function alignRect(moving:Rect,target:Rect,edge:AlignEdge,viewRotation=0):{x:number;z:number;yaw:number}{
 if(edge==='angle')return {x:moving.x,z:moving.z,yaw:target.yaw};
 const base=viewRotation*Math.PI/180,rel=target.yaw-base;
 const frame={x:target.x,z:target.z,yaw:base+rel-Math.round(rel/(Math.PI/2))*Math.PI/2};
 const m=extent(moving,frame),t=extent(target,frame);
 const dx=edge==='left'?t.x0-m.x0:edge==='right'?t.x1-m.x1:edge==='middle'?(t.x0+t.x1-m.x0-m.x1)/2:0;
 const dz=edge==='top'?t.z0-m.z0:edge==='bottom'?t.z1-m.z1:edge==='center'?(t.z0+t.z1-m.z0-m.z1)/2:0;
 const d=toWorld({x:dx,z:dz},{x:0,z:0,yaw:frame.yaw});
 return {x:moving.x+d.x,z:moving.z+d.z,yaw:moving.yaw};
}
/** "车棚 2" → next free "车棚 n" among the names in use. */
function nextName(name:string,used:Set<string>){
 const prefix=name.replace(/\s*\d+$/,'').trim()||name;let n=1;while(used.has(`${prefix} ${n}`))n++;
 const next=`${prefix} ${n}`;used.add(next);return next;
}
const panels=(rs:RoofDesign[])=>rs.reduce((n,r)=>n+r.arrays.reduce((m,a)=>m+a.rows*a.columns,0),0);
/** A copy of an area moved by a world offset: new ids, objects and panels kept, layout still up to date if the source was. */
function copyRoof(src:RoofDesign,offset:Point,name:string,globalEdge:Edges):RoofDesign{
 const ids=new Map(src.obstacles.map(o=>[o.id,newId()]));
 const copy:RoofDesign={...structuredClone(src),id:newId(),name,x:src.x+offset.x,z:src.z+offset.z,previous:null,
  obstacles:src.obstacles.map(o=>({...structuredClone(o),id:ids.get(o.id)!})),
  arrays:src.arrays.map(a=>({...structuredClone(a),...(a.hostObstacleId?{hostObstacleId:ids.get(a.hostObstacleId)}:{})}))};
 copy.layoutSignature=needsLayoutUpdate(src,globalEdge)?'':layoutSignatureFor(copy,globalEdge);
 return copy;
}
function checkLimits(roofs:RoofDesign[]){
 if(roofs.length>50)throw new Error(tx('当前最多支持 50 个屋面'));
 if(panels(roofs)>MAX_PROJECT_PANELS)throw new Error(tx('超过项目组件数量上限'));
}
const overlapsOthers=(rs:RoofDesign[],ids:string[])=>rs.some(r=>ids.includes(r.id)&&rs.some(o=>o.id!==r.id&&overlaps(roofRect(r),roofRect(o))));
/** A row of area copies right after the source, inserted after it in the list. `overlap` is a warning only. */
export function patternRoof(roofs:RoofDesign[],id:string,o:PatternOptions,globalEdge:Edges){
 const src=roofs.find(r=>r.id===id);if(!src||!validPattern(o))throw new Error(tx('阵列参数无效'));
 const step=(o.axis==='width'?src.roof.width:src.roof.depth)+o.gap,used=new Set(roofs.map(r=>r.name));
 const copies=Array.from({length:o.count},(_,i)=>copyRoof(src,toWorld(o.axis==='width'?{x:step*(i+1),z:0}:{x:0,z:step*(i+1)},{x:0,z:0,yaw:src.yaw}),nextName(src.name,used),globalEdge));
 const index=roofs.indexOf(src),next=[...roofs.slice(0,index+1),...copies,...roofs.slice(index+1)];checkLimits(next);
 return {roofs:next,created:copies.map(r=>r.id),overlap:overlapsOthers(next,copies.map(r=>r.id))};
}
/** Paste an area: the first free spot in a row beside the copied one (1 m gap), or the first spot with an overlap warning. */
export function pasteRoof(roofs:RoofDesign[],clip:RoofDesign,globalEdge:Edges){
 const used=new Set(roofs.map(r=>r.name)),name=nextName(clip.name,used),step=clip.roof.width+1;
 const at=(k:number)=>copyRoof(clip,toWorld({x:step*k,z:0},{x:0,z:0,yaw:clip.yaw}),name,globalEdge);
 let copy=at(1);for(let k=1;k<=50;k++){const c=at(k);if(!roofs.some(r=>overlaps(roofRect(r),roofRect(c)))){copy=c;break;}}
 const next=[...roofs,copy];checkLimits(next);
 return {roofs:next,created:copy.id,overlap:overlapsOthers(next,[copy.id])};
}
const areaRect=(r:RoofDesign):Rect=>({x:0,z:0,yaw:0,...r.roof});
const fits=(r:RoofDesign,o:Obstacle,others:Obstacle[])=>containsRect(areaRect(r),o)&&!others.some(p=>overlaps(p,o));
/** A row of obstacle or keep-out copies inside the same area; copies that would stick out of the area are left out. */
export function patternObstacle(r:RoofDesign,id:string,o:PatternOptions){
 const src=r.obstacles.find(v=>v.id===id);if(!src||!validPattern(o))throw new Error(tx('阵列参数无效'));
 const step=(o.axis==='width'?src.width:src.depth)+o.gap,used=new Set(r.obstacles.map(v=>v.name)),copies:Obstacle[]=[];let skipped=0;
 for(let i=1;i<=o.count;i++){
  const d=toWorld(o.axis==='width'?{x:step*i,z:0}:{x:0,z:step*i},{x:0,z:0,yaw:src.yaw}),copy={...structuredClone(src),id:newId(),name:src.name,x:src.x+d.x,z:src.z+d.z};
  if(r.obstacles.length+copies.length>=100||!containsRect(areaRect(r),copy)){skipped++;continue;}
  copy.name=nextName(src.name,used);copies.push(copy);
 }
 const index=r.obstacles.indexOf(src);
 return {obstacles:[...r.obstacles.slice(0,index+1),...copies,...r.obstacles.slice(index+1)],created:copies.length,skipped};
}
/** Paste an obstacle or keep-out into an area: the first free spot near where it was copied, or null when there is no room. */
export function pasteObstacle(r:RoofDesign,clip:Obstacle):Obstacle[]|null{
 if(r.obstacles.length>=100)return null;
 const name=nextName(clip.name,new Set(r.obstacles.map(v=>v.name))),axes=[{x:clip.width+.5,z:0},{x:0,z:clip.depth+.5}];
 for(let k=0;k<=20;k++)for(const sign of k?[1,-1]:[1])for(const a of axes){
  const d=toWorld({x:a.x*k*sign,z:a.z*k*sign},{x:0,z:0,yaw:clip.yaw}),copy={...structuredClone(clip),id:newId(),name,x:clip.x+d.x,z:clip.z+d.z};
  delete copy.arrayGroup;
  if(fits(r,copy,r.obstacles))return [...r.obstacles,copy];
 }
 return null;
}
/** Build the array from its anchor. A count of one keeps just the anchor. */
export function createOrUpdateObstacleArrayGroup(r:RoofDesign,targetId:string,opts:{grid?:import('./domain').ArrayGrid;count:number;axis:'width'|'depth';gap:number;groupId?:string},idFor:(index:number)=>string=newId):{obstacles:Obstacle[];memberIds:string[];groupId:string;skipped:number}{
 const grid=opts.grid;
 const totalCount=grid?grid.columns*grid.rows:opts.count;
 if(grid&&(!['roof','element'].includes(grid.basis)||![grid.columns,grid.rows].every(n=>Number.isInteger(n)&&n>=1&&n<=MAX_PATTERN+1)||!Number.isFinite(grid.rowGap)||grid.rowGap<0||grid.rowGap>100))throw new Error(tx('阵列参数无效'));
 if(!Number.isInteger(totalCount)||totalCount<1||totalCount>(grid?100:MAX_PATTERN+1)||(opts.axis!=='width'&&opts.axis!=='depth')||!Number.isFinite(opts.gap)||opts.gap<0||opts.gap>100)throw new Error(tx('阵列参数无效'));
 const existingGroupId=opts.groupId??r.obstacles.find(o=>o.id===targetId)?.arrayGroup?.id;
 const members=existingGroupId?r.obstacles.filter(o=>o.arrayGroup?.id===existingGroupId).sort((a,b)=>(a.arrayGroup?.index??0)-(b.arrayGroup?.index??0)):[];
 const anchor=members[0]??r.obstacles.find(v=>v.id===targetId);
 if(!anchor)throw new Error(tx('阵列参数无效'));
 const withoutGroup=existingGroupId?r.obstacles.filter(o=>o.arrayGroup?.id!==existingGroupId||o.id===anchor.id):r.obstacles;
 if(totalCount===1){
  const {arrayGroup:_,...standalone}=anchor;
  return {obstacles:existingGroupId?withoutGroup.map(o=>o.id===anchor.id?standalone:o):withoutGroup,memberIds:[anchor.id],groupId:'',skipped:0};
 }
 const groupId=existingGroupId??idFor(0);
 const baseName=anchor.name.replace(/\s+\d+$/,'').trim()||anchor.name;
 const groupName=members[0]?.arrayGroup?.name??`${baseName}${tx('阵列')}`;
 const columns=grid?.columns??(opts.axis==='width'?totalCount:1);
 const yaw=grid?.basis==='roof'?0:anchor.yaw;
 const c=Math.abs(Math.cos(anchor.yaw-yaw)),s=Math.abs(Math.sin(anchor.yaw-yaw));
 const dx=anchor.width*c+anchor.depth*s+opts.gap;
 const dz=anchor.width*s+anchor.depth*c+(grid?.rowGap??opts.gap);
 const created:Obstacle[]=[];
 let skipped=0;
 const metaBase={id:groupId,name:groupName,axis:opts.axis,gap:opts.gap,...(grid?{grid}:{})};
 for(let i=1;i<totalCount;i++){
  const d=toWorld({x:(i%columns)*dx,z:Math.floor(i/columns)*dz},{x:0,z:0,yaw});
  const copy:Obstacle={...structuredClone(anchor),id:idFor(i),name:`${baseName} ${String(i+1).padStart(2,'0')}`,x:anchor.x+d.x,z:anchor.z+d.z,arrayGroup:{...metaBase,count:totalCount,index:i}};
  if(withoutGroup.length+created.length>=100||!containsRect(areaRect(r),copy)){skipped++;continue;}
  created.push(copy);
 }
 const finalCount=1+created.length;
 if(finalCount<2)return {obstacles:r.obstacles,memberIds:[anchor.id],groupId:'',skipped};
 const updatedAnchor:Obstacle={...anchor,name:members.length?anchor.name:`${baseName} 01`,arrayGroup:{...metaBase,count:finalCount,index:0}};
 const groupList=[updatedAnchor,...created.map((c,i)=>({...c,arrayGroup:{...metaBase,count:finalCount,index:i+1}}))];
 const insertAt=withoutGroup.indexOf(anchor);
 const obstacles=[...withoutGroup.slice(0,insertAt),...groupList,...withoutGroup.slice(insertAt+1)];
 return {obstacles,memberIds:groupList.map(m=>m.id),groupId,skipped};
}
/** Dissolve an array group while keeping all its elements as independent items. */
export function ungroupObstacleArray(obstacles:Obstacle[],groupId:string):Obstacle[]{
 return obstacles.map(o=>{if(o.arrayGroup?.id!==groupId)return o;const {arrayGroup:_,...rest}=o;return rest;});
}
/** Strip arrayGroup metadata if fewer than 2 members remain in a group. */
export function cleanupBrokenArrayGroups(obstacles:Obstacle[]):Obstacle[]{
 const counts=new Map<string,number>();
 for(const o of obstacles)if(o.arrayGroup)counts.set(o.arrayGroup.id,(counts.get(o.arrayGroup.id)??0)+1);
 return obstacles.map(o=>{
  if(!o.arrayGroup)return o;
  const n=counts.get(o.arrayGroup.id)??0;
  if(n>=2)return o.arrayGroup.count===n?o:{...o,arrayGroup:{...o.arrayGroup,count:n}};
  const {arrayGroup:_,...rest}=o;
  return rest;
 });
}
