import type {Point} from './domain';
import {polygonsOverlap} from './polygon';

type Box={left:number;top:number;right:number;bottom:number};
export type LabelSize={width:number;height:number;minRoofSize:number;withCapacity:boolean};
type LabelRoof={id:string;outline:Point[];selected:boolean;sizes:LabelSize[]};
type Side='top'|'bottom'|'left'|'right';
type Anchor=Point&{dx:number;dz:number;side:Side};
type Placement={id:string;box:Box;lane:Box;center:Point;leader:[Point,Point];side:Side;size:LabelSize};

function bounds(points:Point[]):Box{
 const xs=points.map(p=>p.x),ys=points.map(p=>p.z);
 return {left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};
}
function intersects(a:Box,b:Box){
 return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
}
function expand(box:Box,gap:number):Box{
 return {left:box.left-gap,right:box.right+gap,top:box.top-gap,bottom:box.bottom+gap};
}
function boxPolygon(box:Box):Point[]{
 return [{x:box.left,z:box.top},{x:box.right,z:box.top},{x:box.right,z:box.bottom},{x:box.left,z:box.bottom}];
}
function edgeCenter(outline:Point[],axis:'x'|'z',coordinate:number){
 const opposite=axis==='x'?'z':'x';
 const edge=outline.filter(p=>Math.abs(p[axis]-coordinate)<.01).map(p=>p[opposite]);
 return (Math.min(...edge)+Math.max(...edge))/2;
}

/** Place tags in screen pixels so terrain scale does not determine when labels collide. */
export function placePlanLabels(roofs:LabelRoof[],width:number,height:number,preferred?:ReadonlyMap<string,Side>,projectCenter={x:width/2,z:height/2}){
 const viewport={left:0,top:0,right:width,bottom:height};
 const visible=roofs.map(r=>({...r,box:bounds(r.outline)})).filter(r=>intersects(r.box,viewport));
 const priority=[...visible].sort((a,b)=>Number(b.selected)-Number(a.selected)||
  (b.box.right-b.box.left)*(b.box.bottom-b.box.top)-(a.box.right-a.box.left)*(a.box.bottom-a.box.top));
 const compact:{roof:typeof visible[number];anchor:Anchor;label:Placement}[]=[];
 function fits(id:string,box:Box,lane:Box,placed:Placement[],gap=3){
  const padded=expand(box,gap);
  if(padded.left<1||padded.top<1||padded.right>width-1||padded.bottom>height-1)return false;
  if(placed.some(label=>label.id!==id&&(intersects(padded,label.box)||intersects(lane,label.box)||intersects(padded,label.lane)||intersects(lane,label.lane))))return false;
  return !visible.some(other=>other.id!==id&&
   (intersects(padded,other.box)&&polygonsOverlap(boxPolygon(padded),other.outline)||
    intersects(lane,other.box)&&polygonsOverlap(boxPolygon(lane),other.outline)));
 }
 function place(roof:typeof visible[number],fixed?:Side){
  const {outline,box}=roof;
  const span=Math.max(box.right-box.left,box.bottom-box.top);
  const size=roof.sizes.find(size=>!size.withCapacity&&span>=size.minRoofSize);
  if(!size)return;
  const anchors:Anchor[]=[
   {side:'top',x:edgeCenter(outline,'z',box.top),z:box.top,dx:0,dz:-1},
   {side:'bottom',x:edgeCenter(outline,'z',box.bottom),z:box.bottom,dx:0,dz:1},
   {side:'right',x:box.right,z:edgeCenter(outline,'x',box.right),dx:1,dz:0},
   {side:'left',x:box.left,z:edgeCenter(outline,'x',box.left),dx:-1,dz:0},
  ];
  const placed=compact.map(item=>item.label);
  let best:{anchor:Anchor;label:Placement;score:number}|undefined;
  for(const anchor of anchors){
   if(fixed&&anchor.side!==fixed)continue;
   const label=positionLabel(roof.id,anchor,size);
   if(!fits(roof.id,label.box,label.lane,placed))continue;
   if(fixed){compact.push({roof,anchor,label});return;}
   let clearance=3;
   for(const gap of [8,16,24,36,52]){
    if(!fits(roof.id,label.box,label.lane,placed,gap))break;
    clearance=gap;
   }
   const inward=(projectCenter.x-(box.left+box.right)/2)*anchor.dx+
    (projectCenter.z-(box.top+box.bottom)/2)*anchor.dz>0;
   const score=clearance+(anchor.side==='top'?9:0)+(inward?7:0);
   if(!best||score>best.score)best={anchor,label,score};
  }
  if(best)compact.push({roof,anchor:best.anchor,label:best.label});
 }
 // Reserve valid fitted sides first so a fallback tag cannot push other tags off their preferred sides.
 for(const roof of priority){const fixed=preferred?.get(roof.id);if(fixed)place(roof,fixed);}
 const reserved=new Set(compact.map(item=>item.roof.id));
 for(const roof of priority){if(!reserved.has(roof.id))place(roof);}
 const placed=compact.map(item=>item.label);
 compact.forEach(({roof,anchor,label},i)=>{
  const span=Math.max(roof.box.right-roof.box.left,roof.box.bottom-roof.box.top);
  const size=roof.sizes.find(size=>size.withCapacity&&span>=size.minRoofSize);
  if(!size)return;
  const expanded=positionLabel(roof.id,anchor,size,label.size.width);
  if(fits(roof.id,expanded.box,expanded.lane,placed))placed[i]=expanded;
 });
 return placed;
}
const leaderGap=11;
function positionLabel(id:string,anchor:Anchor,size:LabelSize,numberWidth=size.width):Placement{
 const w=size.width/2,h=size.height/2;
 const badgeOffset=(size.width-numberWidth)/2*(anchor.side==='left'?-1:1);
 const center={x:anchor.x+anchor.dx*(numberWidth/2+leaderGap)+badgeOffset,z:anchor.z+anchor.dz*(h+leaderGap)};
 const box={left:center.x-w,top:center.z-h,right:center.x+w,bottom:center.z+h};
 const start={x:anchor.x,z:anchor.z},end={x:start.x+anchor.dx*(leaderGap-2),z:start.z+anchor.dz*(leaderGap-2)};
 return {id,box,center,side:anchor.side,size,lane:expand(bounds([start,end]),2),leader:[start,end]};
}
