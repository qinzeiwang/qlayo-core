import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {MAX_PATTERN,type PatternOptions} from './area-tools';
import {tx} from './i18n';
export type PatternActions={preview:(o:PatternOptions)=>string|null;cancel:()=>void;apply:()=>void};
/** A button that opens the pattern popover. The design shows the copies live while it is open; Cancel, Esc or a click elsewhere takes them back. */
export function PatternButton({label,className,disabled,actions,children,openSignal}:{label:string;className?:string;disabled:boolean;actions:PatternActions;children:React.ReactNode;/** Opens the popover when it changes (the right-click menu's Pattern item). */openSignal?:number}){
 const [open,setOpen]=useState(false),[o,setO]=useState<PatternOptions>({count:3,axis:'width',gap:1}),[warning,setWarning]=useState<string|null>(null),[gapText,setGapText]=useState('1');
 const box=useRef<HTMLDivElement>(null),pop=useRef<HTMLDivElement>(null),latest=useRef(actions);latest.current=actions;
 // Fixed position, so the panel's scroll box never clips it; opens upward when there is no room below.
 useLayoutEffect(()=>{const b=box.current?.getBoundingClientRect(),el=pop.current;if(!open||!b||!el)return;const h=el.offsetHeight,below=b.bottom+4+h<=window.innerHeight-8;el.style.left=`${Math.max(8,b.right-el.offsetWidth)}px`;el.style.top=`${below?b.bottom+4:Math.max(8,b.top-4-h)}px`;},[open,warning]);
 const show=(next:PatternOptions)=>{setO(next);setWarning(latest.current.preview(next));};
 const close=(apply:boolean)=>{if(apply)latest.current.apply();else latest.current.cancel();setOpen(false);setWarning(null);};
 useEffect(()=>{if(openSignal&&!disabled&&!open){setOpen(true);show(o);}},[openSignal]);
 useEffect(()=>{if(!open)return;
  const outside=(e:Event)=>{if(e.target instanceof Node&&!box.current?.contains(e.target))close(false);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(false);}};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);};
 },[open]);
 return <div className="pattern-anchor" ref={box}>
  <button className={className} aria-label={label} title={label} aria-expanded={open} disabled={disabled} onClick={()=>{if(open)close(false);else{setOpen(true);show(o);}}}>{children}</button>
  {open&&<div ref={pop} className="pattern-popover" role="dialog" aria-label={label}>
   <header className="pattern-popover-header"><strong>{tx('阵列')}</strong></header>
   <div className="pattern-axis seg-track" role="group" aria-label={tx('阵列方向')}>{(['width','depth'] as const).map(axis=><button type="button" className="seg-btn" key={axis} aria-pressed={o.axis===axis} onClick={()=>show({...o,axis})}>{axis==='width'?tx('沿宽度'):tx('沿长度')}</button>)}</div>
   <label className="region-field"><span>{tx('数量（新增）')}</span><input aria-label={tx('阵列数量')} type="number" min={1} max={MAX_PATTERN} step={1} value={o.count} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=MAX_PATTERN)show({...o,count:n});}}/></label>
   <label className="region-field"><span>{tx('间距 m')}</span><input aria-label={tx('阵列间距 m')} type="number" min={0} max={100} step={0.1} value={gapText} onChange={e=>{setGapText(e.target.value);const n=Number(e.target.value);if(e.target.value&&Number.isFinite(n)&&n>=0&&n<=100)show({...o,gap:n});}}/></label>
   {warning&&<p className="pattern-warning" role="status">{warning}</p>}
   <div className="pattern-actions"><button type="button" onClick={()=>close(false)}>{tx('取消')}</button><button type="button" className="primary" onClick={()=>close(true)}>{tx('确定')}</button></div>
  </div>}
 </div>;
}
