import {footprintCenter,insidePolygon,segmentDistance} from './polygon';
import {corners,footprint,type Point} from './domain';
import {directionMarkerLength} from './direction-marker-style';
import {localLayoutAzimuth} from './auto-layout';
import {geographicYaw,toWorld,type RoofDesign} from './roof-project';
type BadgeAnchor=Point&{clearance:number};
type BadgePlacement={target:BadgeAnchor;anchors:BadgeAnchor[];boundary:Point[]};
export type LayoutMarker={id:string;segments:number[][];head:number[];outline?:number[][];badgePlacement?:BadgePlacement};

function roofClearance(p:Point,boundary:Point[]){
 return insidePolygon(p,boundary)
  ?Math.min(...boundary.map((a,i)=>segmentDistance(p,a,boundary[(i+1)%boundary.length]))):0;
}

function placeBadge({target,anchors,boundary}:BadgePlacement,radius:number,margin:number):BadgeAnchor{
 if(target.clearance>=radius+margin)return target;
 let deepest=target,nearest:BadgeAnchor|undefined,distance=Infinity;
 for(const anchor of anchors){
  if(anchor.clearance>deepest.clearance)deepest=anchor;
  const d=Math.hypot(anchor.x-target.x,anchor.z-target.z);
  if(anchor.clearance>=radius+margin&&d<distance){nearest=anchor;distance=d;}
 }
 if(!nearest)return deepest;
 let low=0,high=1,best=nearest;
 for(let i=0;i<12;i++){
  const t=(low+high)/2,p={x:target.x+(nearest.x-target.x)*t,z:target.z+(nearest.z-target.z)*t};
  const clearance=roofClearance(p,boundary);
  if(clearance>=radius+margin){high=t;best={...p,clearance};}
  else low=t;
 }
 return best;
}

/** Screen-sized arrow on the existing marker axis. Carport markers still show their start edge. */
export function layoutMarkerBadge(marker:LayoutMarker,unit:number){
 if(!marker.outline||!Number.isFinite(unit)||unit<=0)return;
 const [x,z,bx,bz]=marker.segments[0],length=Math.hypot(bx-x,bz-z);
 if(length<1e-8)return;
 const desiredRadius=Math.min(unit*14,length*.8);
 const anchor=marker.badgePlacement?placeBadge(marker.badgePlacement,desiredRadius,unit*2):undefined;
 const cx=anchor?.x??(x+bx)/2,cz=anchor?.z??(z+bz)/2,dx=(bx-x)/length,dz=(bz-z)/length;
 const radius=Math.min(desiredRadius,anchor?.clearance??Infinity),tip=radius*.62,wing=radius*.32;
 const tipX=cx+dx*tip,tipZ=cz+dz*tip;
 const segments=[
  [cx-dx*tip,cz-dz*tip,tipX,tipZ],
  [tipX-dx*wing-dz*wing*1.2,tipZ-dz*wing+dx*wing*1.2,tipX,tipZ],
  [tipX-dx*wing+dz*wing*1.2,tipZ-dz*wing-dx*wing*1.2,tipX,tipZ],
 ];
 return {cx,cz,radius,segments};
}

function arrayMarkerPlacement(r:RoofDesign,roofCenter:Point):BadgePlacement{
 const boundary=corners({x:0,z:0,yaw:0,...r.roof});
 const anchor=(p:Point)=>({...toWorld(p,r),clearance:roofClearance(p,boundary)});
 const worldBoundary=boundary.map(p=>toWorld(p,r));
 if(!r.arrays.length)return {target:anchor(roofCenter),anchors:[],boundary:worldBoundary};
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const a of r.arrays)for(const p of corners(footprint(a))){
  minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
  minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);
 }
 const target=anchor({x:(minX+maxX)/2,z:(minZ+maxZ)/2});
 return {target,anchors:[...r.arrays,roofCenter].map(anchor),boundary:worldBoundary};
}

export function layoutMarker(r:RoofDesign,anchorToArrays=false):LayoutMarker|undefined{
 if(r.pitch||r.moduleSpec.kind==='lightweight')return;
 const length=directionMarkerLength(r.roof.width,r.roof.depth),head=length*.28;
 let map=(x:number,z:number)=>({x,z}),start=-length/2,end=length/2,edge:number[]|undefined;
 if(r.carport){const turned=!r.layoutOptions.portrait,sign=r.carport.startEnd==='end'?-1:1,d=turned?r.roof.width:r.roof.depth,w=turned?r.roof.depth:r.roof.width;
 map=(x,z)=>turned?{x:-z*sign,z:x}:{x,z:z*sign};start=-d/2;end=start+length;edge=[-w/2,start,w/2,start];
 }else{const angle=(localLayoutAzimuth({...r.layoutOptions,roofYaw:geographicYaw(r)})-180)*Math.PI/180;map=(x,z)=>({x:x*Math.cos(angle)-z*Math.sin(angle),z:x*Math.sin(angle)+z*Math.cos(angle)});}
 const center=footprintCenter(r.roof);
 const badgePlacement=anchorToArrays&&!r.carport?arrayMarkerPlacement(r,center):undefined;
 if(badgePlacement&&badgePlacement.target.clearance<=0&&!badgePlacement.anchors.some(p=>p.clearance>0))return;
 const world=(x:number,z:number)=>{const v=map(x,z),p=toWorld({x:v.x+center.x,z:v.z+center.z},r);return [p.x,p.z];};
 if(r.carport){const segments=[[...world(0,start+length*.16),...world(0,end)],[...world(-head*.65,end-head*.65),...world(0,end)],[...world(head*.65,end-head*.65),...world(0,end)],[...world(edge![0],edge![1]),...world(edge![2],edge![3])]];return {id:r.id,segments,head:[]};}
 // Compact four-point silhouette as the panel's module-direction icon.
 const tip=world(0,end),left=world(-length*8/17,start),notch=world(0,start+length*4/17),right=world(length*8/17,start);
 const outline=[[...tip,...left],[...left,...notch],[...notch,...right],[...right,...tip]];
 return {id:r.id,segments:[[...world(0,start),...tip],...outline],outline,head:[],badgePlacement};
}
