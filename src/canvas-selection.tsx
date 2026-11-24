import {useEffect,useRef,useState} from 'react';
import type {AlignEdge} from './area-tools';
import {Icon} from './workbench-ui';
import {tx} from './i18n';
import './canvas-selection.css';

export const ALIGN_EDGES:AlignEdge[]=['left','right','top','bottom','middle','center','angle'];
export const alignLabel=(e:AlignEdge)=>({left:tx('左对齐'),right:tx('右对齐'),top:tx('上对齐'),bottom:tx('下对齐'),middle:tx('左右居中'),center:tx('上下居中'),angle:tx('同角度')})[e];

/** Align icon button: grey until two or more areas (or objects) are picked; the menu lines them up with the key one. Closes on a click elsewhere or Esc. */
export function AlignMenuButton({count,keyName,disabled,onAlign,className}:{count:number;keyName:string;disabled?:boolean;onAlign:(edge:AlignEdge)=>void;className?:string}){
 const [open,setOpen]=useState(false),box=useRef<HTMLDivElement>(null),off=disabled||count<2;
 useEffect(()=>{if(off)setOpen(false);},[off]);
 useEffect(()=>{if(!open)return;
  const outside=(e:Event)=>{if(e.target instanceof Node&&!box.current?.contains(e.target))setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();setOpen(false);}};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);};
 },[open]);
 const tip=off?tx('对齐：按住 Shift 点选两个以上区域或对象'):tx('对齐到 {0}',keyName);
 return <div className="align-anchor" ref={box}>
  <button className={`${className??''}${open?' active':''}`} aria-label={tx('对齐')} data-tooltip={tip} aria-expanded={open} aria-haspopup="menu" disabled={off} onClick={()=>setOpen(v=>!v)}><Icon name="align"/></button>
  {open&&<div className="align-menu" role="menu" aria-label={tx('对齐')}>
   <p>{tx('对齐到 {0}',keyName)}</p>
   {ALIGN_EDGES.map(edge=><button key={edge} role="menuitem" onClick={()=>{setOpen(false);onAlign(edge);}}>{alignLabel(edge)}</button>)}
  </div>}
 </div>;
}

/** Drag box on the 2D canvas, in canvas pixels. */
export const SelectBox=({rect}:{rect:{left:number;top:number;width:number;height:number}})=><div className="select-box" aria-hidden="true" style={rect}/>;
