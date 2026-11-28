import {footprintArea} from './polygon';
import {gableSlopeArea} from './gable-geometry';
import {defaultModule,geometry,type PVArray,type ModuleSpec} from './domain';
import {worldArray,type RoofDesign} from './roof-project';
import {tx} from './i18n';
export function panelOrientation(a:PVArray){
 const g=geometry(a),nx=-Math.sin(g.roll),ny=Math.cos(g.tilt)*Math.cos(g.roll),nz=Math.sin(g.tilt)*Math.cos(g.roll);
 const x=nx*Math.cos(g.yaw)+nz*Math.sin(g.yaw),z=-nx*Math.sin(g.yaw)+nz*Math.cos(g.yaw);
 const tilt=Math.acos(Math.max(-1,Math.min(1,ny)))*180/Math.PI;
 return {tilt,azimuth:tilt<1e-7?null:(Math.atan2(x,-z)*180/Math.PI+360)%360,projection:Math.abs(ny)};
}
export type GenerationGroup={module:ModuleSpec;tilt:number;azimuth:number|null;count:number;capacity:number;roofCapacity:number;carportCapacity:number;regions:string[]};
export function projectStatistics(roofs:RoofDesign[]){
 const groups=new Map<string,GenerationGroup>();
 const regions=roofs.filter(r=>!r.shadingOnly).map(r=>{
  let count=0,capacity=0,moduleArea=0,occupiedArea=0,carportArea=0,standardCapacity=0,lightweightCapacity=0;
  const wings=new Map<string,{area:number;depth:number;number:number;gap:number}>();
  for(const a of r.arrays){
   const m=a.module??defaultModule,n=a.rows*a.columns,kw=n*m.power/1000,o=panelOrientation({...worldArray(a,r),azimuth:worldArray(a,r).azimuth-(r.northAngle??0)}),g=geometry(a);
   if(m.kind==='lightweight')lightweightCapacity+=kw;else standardCapacity+=kw;
   count+=n;capacity+=kw;moduleArea+=n*m.width*m.length*o.projection;occupiedArea+=n*m.width*m.length*o.projection*(a.hostObstacleId?1:a.surface?Math.sqrt(1+a.surface.sx**2+a.surface.sz**2):Math.sqrt(1+((r.pitch?.percent??0)/100)**2));
   if(r.carport){
    carportArea+=g.width*g.depth;
    if(r.carport.double){const key=JSON.stringify([a.azimuth,a.rows,a.azimuth===270?a.x:a.z]);const entry=wings.get(key)??{area:0,depth:g.depth,number:0,gap:m.gap/Math.sqrt(1+(a.surface?.sx??0)**2)};entry.number++;wings.set(key,entry);}
   }
   const tilt=Math.round(o.tilt*100)/100,azimuth=o.azimuth===null?null:(Math.round(o.azimuth*100)/100)%360;
   const key=JSON.stringify([m.kind??'standard',m.width,m.length,m.power,tilt,azimuth]);
   const group=groups.get(key)??{module:m,tilt,azimuth,count:0,capacity:0,roofCapacity:0,carportCapacity:0,regions:[]};
   group.count+=n;group.capacity+=kw;if(r.carport)group.carportCapacity+=kw;else group.roofCapacity+=kw;
   if(!group.regions.includes(r.name))group.regions.push(r.name);groups.set(key,group);
  }
  for(const w of wings.values())if(w.number===2)carportArea+=w.depth*w.gap;
  const roofArea=r.carport?0:footprintArea(r.roof);
  const slopeArea=r.carport?0:r.pitch?.kind==='gable'?gableSlopeArea(r.roof,r.pitch):roofArea*Math.sqrt(1+((r.pitch?.percent??0)/100)**2);
  return {id:r.id,name:r.name,type:r.carport?(r.carport.double?tx('双排车棚'):tx('单排车棚')):r.pitch?(r.pitch.kind==='gable'?(r.pitch.spans?tx('连坡屋面'):tx('双坡屋面')):tx('单坡屋面')):tx('平屋面'),isCarport:!!r.carport,roofArea,slopeArea,moduleArea,occupiedArea,carportArea,count,capacity,standardCapacity,lightweightCapacity};
 });
 const total=regions.reduce((s,r)=>({slopeArea:s.slopeArea+r.slopeArea,occupiedArea:s.occupiedArea+(r.isCarport?0:r.occupiedArea),standardCapacity:s.standardCapacity+r.standardCapacity,lightweightCapacity:s.lightweightCapacity+r.lightweightCapacity,roofArea:s.roofArea+r.roofArea,moduleArea:s.moduleArea+(r.isCarport?0:r.moduleArea),carportArea:s.carportArea+r.carportArea,roofCapacity:s.roofCapacity+(r.isCarport?0:r.capacity),carportCapacity:s.carportCapacity+(r.isCarport?r.capacity:0),capacity:s.capacity+r.capacity,count:s.count+r.count}),{slopeArea:0,occupiedArea:0,standardCapacity:0,lightweightCapacity:0,roofArea:0,moduleArea:0,carportArea:0,roofCapacity:0,carportCapacity:0,capacity:0,count:0});
 return {total,regions,groups:[...groups.values()].sort((a,b)=>a.tilt-b.tilt||(a.azimuth??-1)-(b.azimuth??-1)||a.module.power-b.module.power)};
}

/** Compass bearing: north 0°, clockwise; describe relative to the nearest cardinal. */
export function formatOrientation(azimuth:number|null):string {
 if(azimuth===null)return tx('水平 · 无朝向');
 if(!Number.isFinite(azimuth))return '—';
 const a=((Math.round(azimuth*100)/100)%360+360)%360;
 const index=Math.floor((a+45)/90)%4;
 const delta=((a-index*90+540)%360)-180;
 const cardinal=[tx('北'),tx('东'),tx('南'),tx('西')][index];
 if(Math.abs(delta)<.005)return tx('正')+cardinal;
 const toward=delta>0?[tx('东'),tx('南'),tx('西'),tx('北')][index]:[tx('西'),tx('北'),tx('东'),tx('南')][index];
 return tx('{0}偏{1} {2}°',cardinal,toward,Number(Math.abs(delta).toFixed(2)));
}
