export type DirectionMarkerStyle='dark'|'light'|'hidden';
export const directionMarkerColors={dark:'#18191c',light:'#e8edf2'};
// Use the shorter roof side so markers also fit narrow roofs after rotation.
export const directionMarkerLength=(width:number,depth:number)=>Math.min(width,depth)*.2;
