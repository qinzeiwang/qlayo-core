import { MAX_PROJECT_PANELS } from './project-limits';
import {defaultModule,initial,overlaps,validModule,type ModuleSpec,type Obstacle,type Point,type PVArray} from './domain';
import {MIN_ROOF_SIDE,MAX_ROOF_SIDE} from './roof-limits';
import {tx} from './i18n';
export type CarportOptions={double:boolean;percent:number;clearance:number;startEnd?:'start'|'end';slopeSign?:1|-1;frame?:'curved'};
export const defaultCarport:CarportOptions={double:false,percent:Math.tan(6*Math.PI/180)*100,clearance:2.5};
export const validCarport=(c:CarportOptions)=>c&&(c.frame===undefined||c.frame==='curved')&&(c.slopeSign===undefined||c.slopeSign===1||c.slopeSign===-1)&&typeof c.double==='boolean'&&(c.startEnd===undefined||c.startEnd==='start'||c.startEnd==='end')&&Number.isFinite(c.percent)&&c.percent>=0&&c.percent<=30&&Number.isFinite(c.clearance)&&c.clearance>=2&&c.clearance<=10;
export function carportSpan(c:CarportOptions,m:ModuleSpec){
 const slope=c.percent/100,k=1/Math.hypot(1,slope),wing=(5*m.width+4*m.gap)*k,centerGap=m.gap*k;
 return {slope,wing,centerGap,totalWidth:c.double?2*wing+centerGap:wing};
}
export function snapCarportLength(length:number,module:ModuleSpec){
 const pitch=module.length+module.gap;
 const min=Math.ceil(MIN_ROOF_SIDE/pitch),max=Math.floor(MAX_ROOF_SIDE/pitch);
 return Math.max(min,Math.min(max,Math.round(length/pitch)))*pitch;
}
/** Keep the chosen bearing and fit the drawn length to whole module pitches. */
export function snapCarportEnd(start:Point,end:Point,module:ModuleSpec,metersPerPixel:number):Point{
 const dx=end.x-start.x,dz=end.z-start.z,distance=Math.hypot(dx,dz)*metersPerPixel;
 if(distance<1e-7)return start;
 const scale=snapCarportLength(distance,module)/distance;
 return {x:start.x+dx*scale,z:start.z+dz*scale};
}
export function carportLayout(roof:{width:number;depth:number},obstacles:Obstacle[],options:{carport:CarportOptions;module?:ModuleSpec;portrait:boolean;edge:number;gap:number;limit?:number;neighborBlocked?:(array:PVArray)=>boolean}){
 const {carport:c,edge,gap}=options,m=options.module??defaultModule,limit=options.limit??MAX_PROJECT_PANELS;
 if(!validCarport(c)||!validModule(m)||m.kind==='lightweight'||![roof.width,roof.depth,edge,gap].every(Number.isFinite)||roof.width<=0||roof.depth<=0||edge<0||gap<0||!Number.isInteger(limit)||limit<0||limit>MAX_PROJECT_PANELS)throw new Error(tx('车棚须使用标准组件，请检查车棚参数'));
 const {slope,wing,centerGap,totalWidth}=carportSpan(c,m);
 const turned=!options.portrait,local=(x:number,z:number)=>turned?{x:-z,z:x}:{x,z};
 const d=turned?roof.width:roof.depth,groupCount=c.double?10:5;
 const arrays:PVArray[]=[];let count=0;
 const result=(capped=false)=>({arrays,count,capped,rowGap:0,actual:0,recommended:0,shortened:false});
 const signs=c.double?[-1,1]:[c.slopeSign??1];
 const wingAt=(x:number,z:number,sign:number,rows:number):PVArray=>{
  const offset=c.double?sign*(wing+centerGap)/2:0,pos=local(x+offset,z);
  return {...initial,...pos,module:{...m,kind:'standard'},id:`carport-${arrays.length+1}`,name:tx('{0}车棚 {1}',c.double?tx('双排'):tx('单排'),arrays.length+1),rows,columns:5,connectedRows:true,portrait:true,azimuth:turned?270:180,tilt:0,mounting:'carport',...(c.frame&&!c.double?{carportFrame:c.frame}:{}),surface:{sx:sign*slope,sz:0,height:-3.5+c.clearance+.25+wing*slope/2}};
 };
 for(const x of [0]){
  let run:number[]=[];
  const flush=()=>{if(!run.length)return;const z=(run[0]+run[run.length-1])/2;
   for(const sign of signs)arrays.push(wingAt(x,z,sign,run.length));
   run=[];
  };
  const direction=c.startEnd==='end'?-1:1;
  for(let distance=m.length/2;distance+m.length/2<=d+1e-7;distance+=m.length+m.gap){
   const z=direction*(-d/2+distance);
   const rect={...local(x,z),width:totalWidth,depth:m.length,yaw:turned?-Math.PI/2:0};
   if(obstacles.some(o=>overlaps(rect,o))||options.neighborBlocked&&signs.some(sign=>options.neighborBlocked!(wingAt(x,z,sign,1)))){flush();continue;}
   if(count+groupCount>limit){flush();return result(true);}
   run.push(z);count+=groupCount;
  }
  flush();
 }
 return result();
}

export function carportBoundary(roof:{width:number;depth:number},carport:CarportOptions|undefined,portrait:boolean){
 return carport ? {...roof,...(portrait?{width:Infinity}:{depth:Infinity})} : roof;
}

export const carportPortrait=(area:{width:number;depth:number})=>area.depth>=area.width;
