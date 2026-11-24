export const FLAT_PAD_SIZE = .4;
export const FLAT_PAD_EDGE_INSET = .15;
export const FLAT_PAD_MAX_BAY = 2;

/** Centred foundation axes measured in the array's horizontal plane, in metres. */
export function flatFoundationGrid(width:number,depth:number,rows:number,edge=FLAT_PAD_EDGE_INSET,maxBay=FLAT_PAD_MAX_BAY){
 // Include half the pad when moving the column axis in from the module edge.
 // On narrow arrays, reduce the clearance first to leave room for two pads.
 const centreSpan=(size:number)=>Math.min(size,Math.max(Math.min(FLAT_PAD_SIZE,size),size-2*edge-FLAT_PAD_SIZE));
 const clear=centreSpan(width),bayUnits=Math.floor((clear+1e-9)*100);
 const maxUnits=Math.max(1,Math.floor((maxBay+1e-9)*100));
 const count=Math.max(1,Math.ceil(bayUnits/maxUnits));
 const span=bayUnits?bayUnits/100:clear;
 const xs=Array.from({length:count+1},(_,i)=>Math.round(i*bayUnits/count)/100-span/2);
 if(!bayUnits)xs[1]=span/2;
 // A two-module slope adds a middle support between the two outer rows.
 const posts=rows===1?2:Math.max(3,rows),run=centreSpan(depth);
 const zs=Array.from({length:posts},(_,i)=>-run/2+i*run/(posts-1));
 return {xs,zs};
}
