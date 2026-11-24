import {useEffect,useState} from 'react';
import {Icon} from './workbench-ui';

type Props={
 label:string;
 textLabel?:string;
 icon:string;
 unit?:string;
 value:number;
 onChange:(value:number)=>void;
 step?:number|string;
 min?:number;
 max?:number;
 disabled?:boolean;
 hint?:string;
};

/** Unified 34px single-column inspector numeric row: icon | spacer | right-aligned number | unit. */
export function NumberProperty({label,textLabel,icon,unit='m',value,onChange,step='0.1',min=0,max,disabled=false,hint}:Props){
 const [text,setText]=useState(()=>Number.isFinite(value)?String(value):'');
 const [focused,setFocused]=useState(false);

 useEffect(()=>{
  if(!focused)setText(Number.isFinite(value)?String(value):'');
 },[value,focused]);

 return <div className="property-row" title={hint||label}>
  <Icon name={icon}/>
  <span className="property-spacer">{textLabel}</span>
  <input
   data-1p-ignore="true"
   aria-label={label}
   type="number"
   min={min}
   max={max}
   step={step}
   disabled={disabled}
   value={text}
   onFocus={()=>setFocused(true)}
   onChange={e=>{
    const raw=e.target.value;
    setText(raw);
    if(raw==='')return;
    const n=Number(raw);
    if(Number.isFinite(n)&&n>=min&&(max===undefined||n<=max))onChange(n);
   }}
   onWheel={event=>{if(event.currentTarget===document.activeElement)event.currentTarget.blur();}}
   onKeyDown={event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown')event.preventDefault();}}
   onBlur={()=>{
    setFocused(false);
    setText(Number.isFinite(value)?String(value):'');
   }}
  />
  <small>{unit}</small>
 </div>;
}
