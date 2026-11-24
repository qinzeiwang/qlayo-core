import {directionMarkerLength} from './direction-marker-style';
import type {RoofPitch} from './pitched-roof';

/** A ridge runs perpendicular to the roof's slope axis. */
export function longRidgeAxis({width,depth}:{width:number;depth:number}):RoofPitch['axis']{
 return width>=depth?'z':'x';
}
export function gableRidgeLine(width:number,depth:number,axis:RoofPitch['axis']):[number,number,number,number]{
 return axis==='z'?[-width/2,0,width/2,0]:[0,-depth/2,0,depth/2];
}

export function turnPitch(p:RoofPitch):RoofPitch{
 if(p.kind==='gable')return {...p,axis:p.axis==='x'?'z':'x'};
 return {...p,axis:p.axis==='x'?'z':'x',high:p.axis==='z'?-p.high as 1|-1:p.high};
}
export function pitchSegments(width:number,depth:number,p:RoofPitch):number[][]{
 if(p.kind==='gable')return [gableRidgeLine(width,depth,p.axis)];
 const length=directionMarkerLength(width,depth),widthOfArrow=length*5/18;
 const map=(u:number,v:number)=>p.axis==='z'?[u,v*-p.high]:[v*-p.high,u];
 const high=map(0,-length/2),low=map(0,length/2),corner=map(widthOfArrow,-length/2);
 return [[...high,...low],[...low,...corner],[...corner,...high]];
}

export function carportPitch(r:import('./roof-project').RoofDesign):RoofPitch|undefined{
 if(!r.carport||r.carport.double)return;
 return {kind:'single',axis:r.layoutOptions.portrait?'x':'z',high:r.carport.slopeSign??1,percent:r.carport.percent,eave:r.carport.clearance};
}
/** The single carport's column edge: the low edge of its slope, as [x,z,x2,z2] in area coordinates. */
export function carportColumnEdge(width:number,depth:number,p:RoofPitch):[number,number,number,number]{
 return p.axis==='x'?[-p.high*width/2,-depth/2,-p.high*width/2,depth/2]:[-width/2,-p.high*depth/2,width/2,-p.high*depth/2];
}
export function flipCarportSlope(r:import('./roof-project').RoofDesign){
 if(!r.carport||r.carport.double)return r;
 const carport={...r.carport,slopeSign:-(r.carport.slopeSign??1) as 1|-1};
 return {...r,carport,layoutSignature:flippedSignature(r.layoutSignature,r.carport,carport),arrays:r.arrays.map(a=>a.surface?{...a,surface:{...a.surface,sx:-a.surface.sx}}:a)};
}
/** The flipped panels are exactly a fresh layout, so a layout that was up to date stays up to date. */
function flippedSignature(signature:string,before:object,after:object){
 try{const s=JSON.parse(signature);if(JSON.stringify(s.carport)!==JSON.stringify(before))return signature;s.carport=after;return JSON.stringify(s);}catch{return signature;}
}
