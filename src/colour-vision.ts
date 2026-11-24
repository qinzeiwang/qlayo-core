import {useSyncExternalStore} from 'react';

/**
 * Colour-blind friendly colours: one per-person switch (kept in this browser, not in the project) that swaps the
 * plan and canvas colours to the Okabe–Ito set, readable with the common red/green colour blindness.
 * Status still never relies on colour alone; this mode also adds dash patterns where two states shared a line style.
 */
const KEY='pv.colourBlind';
const listeners=new Set<()=>void>();
let on=(()=>{try{return localStorage.getItem(KEY)==='1';}catch{return false;}})();

export function setColourBlind(value:boolean){on=value;try{localStorage.setItem(KEY,value?'1':'0');}catch{/* Browser storage may be unavailable. */}listeners.forEach(f=>f());}
export function useColourBlind(){return useSyncExternalStore(f=>{listeners.add(f);return()=>{listeners.delete(f);};},()=>on);}

// Okabe–Ito: blue, orange, bluish green, reddish purple, vermillion, sky blue, black. Yellow is left out: too pale on white.
const groupsNormal=['#2f6fde','#d9822b','#2e9e6f','#9b59b6','#c0392b','#16a2b8'];
const groupsSafe=['#0072b2','#e69f00','#009e73','#cc79a7','#d55e00','#56b4e9','#1d1d1d'];
export const groupColours=(safe:boolean)=>safe?groupsSafe:groupsNormal;

/** Canvas colours that carry a meaning: layout conflicts and shadow zones. */
export const canvasColours=(safe:boolean)=>safe
 ?{conflictFill:'#d98a5c',conflictEdge:'#f5d0b8',conflictLine:'#d55e00',conflictModule:'#d55e00',shadowFill:'#cc79a7',shadowLine:'#a8557f'}
 :{conflictFill:'#e11d48',conflictEdge:'#fecdd3',conflictLine:'#be123c',conflictModule:'#e11d48',shadowFill:'#1e293b',shadowLine:'#64748b'};
