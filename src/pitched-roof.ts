import {polygonContains,type Footprint} from './polygon';
import { MAX_PROJECT_PANELS } from './project-limits';
import { hitsShadow, type ShadowZone } from './shadow-zones';
import { corners, initial, overlaps, validModule, type Params, type PVArray, type Obstacle, type ModuleSpec } from './domain';
import {tx} from './i18n';
export type GableSpan={start:number;end:number;percent:number};
export type RoofPitch={kind:'single'|'gable';axis:'x'|'z';high:1|-1;percent:number;eave:number;spans?:GableSpan[]};
export const defaultPitch:RoofPitch={kind:'single',axis:'z',high:-1,percent:15,eave:3.5};
export const lightModule:ModuleSpec={kind:"lightweight",length:2.26,width:1.2,power:560,gap:.02};
export const MIN_GABLE_SPAN=1;
type Size=Footprint;
export function gableSpans(roof:{width:number;depth:number},p:RoofPitch):GableSpan[]{
 const half=(p.axis==='x'?roof.width:roof.depth)/2;
 if(p.kind!=='gable'||!p.spans?.length)return [{start:-half,end:half,percent:p.percent}];
 return p.spans;
}
export function equalGableSpans(roof:{width:number;depth:number},axis:'x'|'z',count:number,percent:number):GableSpan[]{
 const n=Math.max(1,Math.min(20,Math.round(count)));
 const total=axis==='x'?roof.width:roof.depth,half=total/2,step=total/n;
 return Array.from({length:n},(_,i)=>({
  start:i===0?-half:Number((-half+i*step).toFixed(4)),
  end:i===n-1?half:Number((-half+(i+1)*step).toFixed(4)),
  percent,
 }));
}
export function splitGableSpans(roof:{width:number;depth:number},p:RoofPitch,cuts:readonly number[]):GableSpan[]{
 const half=(p.axis==='x'?roof.width:roof.depth)/2;
 const existing=gableSpans(roof,p);
 const inner=[...cuts].filter(c=>Number.isFinite(c)&&c>-half+MIN_GABLE_SPAN/2&&c<half-MIN_GABLE_SPAN/2).sort((a,b)=>a-b);
 const bounds=[-half];
 for(const c of inner){
  if(c-bounds[bounds.length-1]>=MIN_GABLE_SPAN/2&&half-c>=MIN_GABLE_SPAN/2)bounds.push(Number(c.toFixed(4)));
 }
 bounds.push(half);
 const result:GableSpan[]=[];
 for(let i=1;i<bounds.length;i++){
  const start=bounds[i-1],end=bounds[i],mid=(start+end)/2;
  const donor=existing.find(s=>mid>=s.start-1e-6&&mid<=s.end+1e-6)??existing[0];
  result.push({start,end,percent:donor?.percent??p.percent});
 }
 return result;
}
export function rescaleGableSpans(spans:readonly GableSpan[],oldTotal:number,newTotal:number):GableSpan[]{
 if(!spans.length||oldTotal<=1e-6||newTotal<=1e-6)return [{start:-newTotal/2,end:newTotal/2,percent:spans[0]?.percent??10}];
 const ratio=newTotal/oldTotal,half=newTotal/2;
 const raw=spans.map((s,i)=>({
  start:i===0?-half:Number((s.start*ratio).toFixed(4)),
  end:i===spans.length-1?half:Number((s.end*ratio).toFixed(4)),
  percent:s.percent,
 }));
 const merged:GableSpan[]=[];
 for(const s of raw){
  if(s.end-s.start<.5&&merged.length){merged[merged.length-1]={...merged[merged.length-1],end:s.end};}
  else merged.push(s);
 }
 if(merged.length>1&&merged[0].end-merged[0].start<.5){
  merged[1]={...merged[1],start:merged[0].start};merged.shift();
 }
 merged[0]={...merged[0],start:-half};
 merged[merged.length-1]={...merged[merged.length-1],end:half};
 return merged;
}
export function validPitch(p:RoofPitch,roof?:{width:number;depth:number}){
 if(!(p&&['single','gable'].includes(p.kind)&&['x','z'].includes(p.axis)&&[1,-1].includes(p.high)&&Number.isFinite(p.percent)&&p.percent>=0&&p.percent<=100&&Number.isFinite(p.eave)&&p.eave>=1&&p.eave<=100))return false;
 if(p.spans===undefined)return true;
 if(p.kind!=='gable'||!Array.isArray(p.spans)||p.spans.length<1||p.spans.length>20)return false;
 for(let i=0;i<p.spans.length;i++){
  const s=p.spans[i];
  if(!s||![s.start,s.end,s.percent].every(Number.isFinite)||s.end-s.start<.5-1e-6||s.percent<0||s.percent>100)return false;
  if(i>0&&Math.abs(s.start-p.spans[i-1].end)>1e-3)return false;
 }
 if(roof){
  const half=(p.axis==='x'?roof.width:roof.depth)/2;
  if(Math.abs(p.spans[0].start+half)>1e-2||Math.abs(p.spans[p.spans.length-1].end-half)>1e-2)return false;
 }
 return true;
}
export function findGableSpan(roof:{width:number;depth:number},p:RoofPitch,t:number):GableSpan{
 const spans=gableSpans(roof,p);
 for(const s of spans)if(t<=s.end+1e-7)return s;
 return spans[spans.length-1];
}
export function roofHeight(roof:Size,p:RoofPitch,x:number,z:number){
 const span=p.axis==='x'?roof.width:roof.depth,t=p.axis==='x'?x:z;
 if(p.kind==='single')return p.eave-3.5+(span/2+p.high*t)*p.percent/100;
 const s=findGableSpan(roof,p,t),mid=(s.start+s.end)/2,half=(s.end-s.start)/2;
 return p.eave-3.5+(half-Math.abs(t-mid))*s.percent/100;
}
export function maxRoofHeight(roof:Size,p:RoofPitch){
 const span=p.axis==='x'?roof.width:roof.depth;
 if(p.kind==='single')return p.eave-3.5+span*p.percent/100;
 return Math.max(...gableSpans(roof,p).map(s=>p.eave-3.5+((s.end-s.start)/2)*s.percent/100));
}
export function roofGradient(p:RoofPitch,x:number,z:number){
 const t=p.axis==='x'?x:z;
 if(p.kind==='single'){const s=p.high*p.percent/100;return {sx:p.axis==='x'?s:0,sz:p.axis==='z'?s:0};}
 let mid=0,percent=p.percent;
 if(p.spans?.length){
  let chosen=p.spans[p.spans.length-1];
  for(const sp of p.spans)if(t<=sp.end+1e-7){chosen=sp;break;}
  mid=(chosen.start+chosen.end)/2;percent=chosen.percent;
 }
 const s=(t<mid?1:-1)*percent/100;
 return {sx:p.axis==='x'?s:0,sz:p.axis==='z'?s:0};
}
export function pitchedLayout(roof:Size,obstacles:Obstacle[],options:{forbidden?:ShadowZone[];pitch:RoofPitch;module?:ModuleSpec;portrait:boolean;edge:number;ridgeEdge?:number;alignment?:'edge'|'center';gap:number;rowGap?:number;limit?:number;neighborBlocked?:(array:Params)=>boolean}){
 // ridge: setback at the ridge (gable) or the high side (single slope); edge: everywhere else (including interior gutters).
 const {pitch:p,edge,gap}=options,ridge=options.ridgeEdge??edge,m=options.module??lightModule,limit=options.limit??MAX_PROJECT_PANELS;
 if(!validPitch(p,roof)||!validModule(m)||![roof.width,roof.depth,edge,ridge,gap,options.rowGap??0].every(Number.isFinite)||roof.width<=0||roof.depth<=0||edge<0||ridge<0||gap<0||(options.rowGap??0)<0||!Number.isInteger(limit)||limit<0||limit>MAX_PROJECT_PANELS)throw new Error(tx('坡屋面或轻质组件参数无效'));
 const turned=!options.portrait,local=(x:number,z:number)=>turned?{x:-z,z:x}:{x,z};
 const w=turned?roof.depth:roof.width,d=turned?roof.width:roof.depth;
 const arrays:PVArray[]=[];let count=0,capped=false;
 const centered=p.kind==='gable'&&(options.alignment??'center')==='center';
 const slopeAcrossRows=(p.axis==='z')!==turned;
 const flipWork=turned&&p.axis==='x';
 const spans=p.kind==='gable'?gableSpans(roof,p):[{start:-(p.axis==='x'?roof.width:roof.depth)/2,end:(p.axis==='x'?roof.width:roof.depth)/2,percent:p.percent}];

 for(let spanIndex=0;spanIndex<spans.length;spanIndex++){
  const sp=spans[spanIndex],mid=(sp.start+sp.end)/2,slope=sp.percent/100;
  const kx=slopeAcrossRows?1:1/Math.sqrt(1+slope*slope);
  const kz=slopeAcrossRows?1/Math.sqrt(1+slope*slope):1;
  const pair=(2*m.width+m.gap)*kx,step=(m.length+m.gap)*kz,one=m.length*kz;
  const rowPositions=(start:number,end:number,direction:1|-1)=>{const values:number[]=[];for(let boundary=start;;boundary+=direction*step){const z=boundary+direction*one/2;if(direction>0?z+one/2>end+1e-7:z-one/2<end-1e-7)break;values.push(z);}return values;};
  const stripPositions=(start:number,end:number,direction:1|-1)=>{const values:number[]=[];let boundary=start;while(true){if(direction>0){if(boundary+m.width*kx>end+1e-7)break;values.push(boundary);boundary+=pair+gap*kx;}else{const oneLeft=boundary-m.width*kx;if(oneLeft<end-1e-7)break;const pairLeft=boundary-pair,left=pairLeft>=end-1e-7?pairLeft:oneLeft;values.push(left);boundary=left-gap*kx;}}return values;};
  const workLo=flipWork?-sp.end:sp.start,workHi=flipWork?-sp.start:sp.end,workMid=flipWork?-mid:mid;

  let zs:number[];
  if(p.kind==='gable'&&slopeAcrossRows){
   zs=[...rowPositions(workMid-ridge,workLo+edge,-1),...rowPositions(workMid+ridge,workHi-edge,1)];
  }else if(p.kind==='single'&&slopeAcrossRows){
   const high=turned?-p.high:p.high;
   zs=high>0?rowPositions(d/2-ridge,-d/2+edge,-1):rowPositions(-d/2+ridge,d/2-edge,1);
  }else{
   zs=rowPositions(-d/2+edge,d/2-edge,1);
   if(centered&&zs.length){
    const offset=(d/2-edge-zs.at(-1)!-one/2)/2;
    zs=zs.map(z=>z+offset);
   }
  }
  let strips:number[];
  if(p.kind==='gable'&&!slopeAcrossRows){
   strips=[...stripPositions(workMid-ridge,workLo+edge,-1),...stripPositions(workMid+ridge,workHi-edge,1)];
  }else if(p.kind==='single'&&!slopeAcrossRows){
   strips=p.high>0?stripPositions(w/2-ridge,-w/2+edge,-1):stripPositions(-w/2+ridge,w/2-edge,1);
  }else{
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
  const maxRight=p.kind==='gable'&&!slopeAcrossRows?workHi-edge:w/2-(p.kind==='single'&&!slopeAcrossRows&&p.high>0?ridge:edge);
  for(const left of strips){
   let run:number[]=[],runX=0,runCols=0,runSide=0;
   const flush=()=>{if(!run.length)return;arrays.push({...arrayAt(runX,(run[0]+run[run.length-1])/2,run.length,runCols),id:`light-${arrays.length+1}`,name:tx('轻质阵列 {0}',arrays.length+1)});run=[];};
   const allowed=(x:number,z:number,width:number)=>{
    const c=local(x,z),rect={...c,width,depth:one,yaw:turned?-Math.PI/2:0};
    if(x+width/2>maxRight+1e-7||roof.outline&&!polygonContains(roof.outline,corners(rect),edge))return false;
    const coord=corners(rect).map(v=>p.axis==='x'?v.x:v.z),min=Math.min(...coord),max=Math.max(...coord);
    if(p.kind==='gable'&&(min<sp.start+edge-1e-7||max>sp.end-edge+1e-7||!(max<=mid-ridge+1e-7||min>=mid+ridge-1e-7)))return false;
    return !obstacles.some(o=>overlaps(rect,o))&&!(options.forbidden??[]).some(zone=>hitsShadow(rect,zone))&&!options.neighborBlocked?.(arrayAt(x,z,1,width===pair?2:1));
   };
   for(const z of zs){
    let cols=2,x=left+pair/2;
    if(count+2>limit||!allowed(x,z,pair)){
     cols=1;x=left+m.width*kx/2;
     if(!allowed(x,z,m.width*kx)){x=left+(m.width+m.gap)*kx+m.width*kx/2;if(!allowed(x,z,m.width*kx)){flush();continue;}}
    }
    if(count+cols>limit){flush();capped=true;return {arrays,count,capped,rowGap:0,actual:0,recommended:0,shortened:false};}
    const c=local(x,z),side=p.kind==='gable'?(spanIndex*2+(c[p.axis]<mid?0:1)):0;
    if(run.length&&(cols!==runCols||x!==runX||side!==runSide))flush();
    runX=x;runCols=cols;runSide=side;run.push(z);count+=cols;
   }
   flush();
  }
 }

 return {arrays,count,capped,rowGap:0,actual:0,recommended:0,shortened:false};
}
