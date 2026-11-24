import {polygonContains,type Footprint} from './polygon';
import { MAX_PROJECT_PANELS } from './project-limits';
import { hitsShadow, type ShadowZone } from './shadow-zones';
import { corners, initial, overlaps, validModule, type Params, type PVArray, type Obstacle, type ModuleSpec } from './domain';
import {tx} from './i18n';
export type RoofPitch={kind:'single'|'gable';axis:'x'|'z';high:1|-1;percent:number;eave:number};
export const defaultPitch:RoofPitch={kind:'single',axis:'z',high:-1,percent:15,eave:3.5};
export const lightModule:ModuleSpec={kind:"lightweight",length:2.26,width:1.2,power:560,gap:.02};
export const validPitch=(p:RoofPitch)=>p&&['single','gable'].includes(p.kind)&&['x','z'].includes(p.axis)&&[1,-1].includes(p.high)&&Number.isFinite(p.percent)&&p.percent>=0&&p.percent<=100&&Number.isFinite(p.eave)&&p.eave>=1&&p.eave<=100;
type Size=Footprint;
export function roofHeight(roof:Size,p:RoofPitch,x:number,z:number){
 const span=p.axis==='x'?roof.width:roof.depth,t=p.axis==='x'?x:z;
 return p.eave-3.5+(p.kind==='single'?span/2+p.high*t:span/2-Math.abs(t))*p.percent/100;
}
export function roofGradient(p:RoofPitch,x:number,z:number){const t=p.axis==='x'?x:z,s=(p.kind==='single'?p.high:t<0?1:-1)*p.percent/100;return {sx:p.axis==='x'?s:0,sz:p.axis==='z'?s:0};}
export function pitchedLayout(roof:Size,obstacles:Obstacle[],options:{forbidden?:ShadowZone[];pitch:RoofPitch;module?:ModuleSpec;portrait:boolean;edge:number;ridgeEdge?:number;alignment?:'edge'|'center';gap:number;rowGap?:number;limit?:number;neighborBlocked?:(array:Params)=>boolean}){
 // ridge: setback at the ridge (gable) or the high side (single slope); edge: everywhere else.
 const {pitch:p,edge,gap}=options,ridge=options.ridgeEdge??edge,m=options.module??lightModule,limit=options.limit??MAX_PROJECT_PANELS;
 if(!validPitch(p)||!validModule(m)||![roof.width,roof.depth,edge,ridge,gap,options.rowGap??0].every(Number.isFinite)||roof.width<=0||roof.depth<=0||edge<0||ridge<0||gap<0||(options.rowGap??0)<0||!Number.isInteger(limit)||limit<0||limit>MAX_PROJECT_PANELS)throw new Error(tx('坡屋面或轻质组件参数无效'));
 const turned=!options.portrait,local=(x:number,z:number)=>turned?{x:-z,z:x}:{x,z};
 const w=turned?roof.depth:roof.width,d=turned?roof.width:roof.depth;
 const grad=roofGradient(p,0,0),sx=turned?grad.sz:grad.sx,sz=turned?-grad.sx:grad.sz;
 const kx=1/Math.sqrt(1+sx*sx),kz=1/Math.sqrt(1+sz*sz),pair=(2*m.width+m.gap)*kx,step=(m.length+m.gap)*kz,one=m.length*kz;
 const arrays:PVArray[]=[];let count=0,capped=false;
 const centered=p.kind==='gable'&&(options.alignment??'center')==='center';
 const slopeAcrossRows=(p.axis==='z')!==turned;
 const rowPositions=(start:number,end:number,direction:1|-1)=>{const values:number[]=[];for(let boundary=start;;boundary+=direction*step){const z=boundary+direction*one/2;if(direction>0?z+one/2>end+1e-7:z-one/2<end-1e-7)break;values.push(z);}return values;};
 const stripPositions=(start:number,end:number,direction:1|-1)=>{const values:number[]=[];let boundary=start;while(true){if(direction>0){if(boundary+m.width*kx>end+1e-7)break;values.push(boundary);boundary+=pair+gap*kx;}else{const oneLeft=boundary-m.width*kx;if(oneLeft<end-1e-7)break;const pairLeft=boundary-pair,left=pairLeft>=end-1e-7?pairLeft:oneLeft;values.push(left);boundary=left-gap*kx;}}return values;};
 let zs:number[];
 if(p.kind==='gable'&&slopeAcrossRows)zs=[...rowPositions(-ridge,-d/2+edge,-1),...rowPositions(ridge,d/2-edge,1)];
 else if(p.kind==='single'&&slopeAcrossRows){const high=turned?-p.high:p.high;zs=high>0?rowPositions(d/2-ridge,-d/2+edge,-1):rowPositions(-d/2+ridge,d/2-edge,1);}
 else {
  zs=rowPositions(-d/2+edge,d/2-edge,1);
  if(centered&&zs.length){
   const offset=(d/2-edge-zs.at(-1)!-one/2)/2;
   zs=zs.map(z=>z+offset);
  }
 }
 let strips:number[];
 if(p.kind==='gable'&&!slopeAcrossRows)strips=[...stripPositions(-ridge,-w/2+edge,-1),...stripPositions(ridge,w/2-edge,1)];
 else if(p.kind==='single'&&!slopeAcrossRows)strips=p.high>0?stripPositions(w/2-ridge,-w/2+edge,-1):stripPositions(-w/2+ridge,w/2-edge,1);
 else {
  const right=w/2-edge;
  strips=stripPositions(-w/2+edge,right,1);
  if(centered&&strips.length){
   const last=strips.at(-1)!;
   const lastWidth=last+pair<=right+1e-7?pair:m.width*kx;
   const offset=(right-last-lastWidth)/2;
   strips=strips.map(x=>x+offset);
  }
 }
 const arrayAt=(x:number,z:number,rows:number,columns:number)=>{
  const c=local(x,z),g=roofGradient(p,c.x,c.z);
  return {...initial,module:{...m},...c,portrait:true,azimuth:turned?270:180,tilt:0,rows,columns,connectedRows:true,surface:{sx:turned?g.sz:g.sx,sz:turned?-g.sx:g.sz,height:roofHeight(roof,p,c.x,c.z)}};
 };
 for(const left of strips){
  let run:number[]=[],runX=0,runCols=0,runSide=0;
  const flush=()=>{if(!run.length)return;arrays.push({...arrayAt(runX,(run[0]+run[run.length-1])/2,run.length,runCols),id:`light-${arrays.length+1}`,name:tx('轻质阵列 {0}',arrays.length+1)});run=[];};
  const allowed=(x:number,z:number,width:number)=>{
   const c=local(x,z),rect={...c,width,depth:one,yaw:turned?-Math.PI/2:0};
   if(x+width/2>w/2-(p.kind==='single'&&!slopeAcrossRows&&p.high>0?ridge:edge)+1e-7||roof.outline&&!polygonContains(roof.outline,corners(rect),edge))return false;
   const coord=corners(rect).map(v=>p.axis==='x'?v.x:v.z),min=Math.min(...coord),max=Math.max(...coord);
   return !(p.kind==='gable'&&!(max<=-ridge+1e-7||min>=ridge-1e-7))&&!obstacles.some(o=>overlaps(rect,o))&&!(options.forbidden??[]).some(zone=>hitsShadow(rect,zone))&&!options.neighborBlocked?.(arrayAt(x,z,1,width===pair?2:1));
  };
  for(const z of zs){
   let cols=2,x=left+pair/2;
   if(count+2>limit||!allowed(x,z,pair)){
    cols=1;x=left+m.width*kx/2;
    if(!allowed(x,z,m.width*kx)){x=left+(m.width+m.gap)*kx+m.width*kx/2;if(!allowed(x,z,m.width*kx)){flush();continue;}}
   }
   if(count+cols>limit){flush();capped=true;return {arrays,count,capped,rowGap:0,actual:0,recommended:0,shortened:false};}
   const c=local(x,z),side=p.kind==='gable'?Math.sign(p.axis==='x'?c.x:c.z):0;
   if(run.length&&(cols!==runCols||x!==runX||side!==runSide))flush();
   runX=x;runCols=cols;runSide=side;run.push(z);count+=cols;
  }
  flush();
 }

 return {arrays,count,capped,rowGap:0,actual:0,recommended:0,shortened:false};
}
