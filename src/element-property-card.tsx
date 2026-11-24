import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './workbench-ui';
import {tx} from './i18n';

/** A single non-modal property card, anchored beside the owning list row. */
export function ElementPropertyCard({anchor,title,onClose,onConfirm,onDelete,disabled,children}:{disabled:boolean;onConfirm:()=>void;onDelete:()=>void;anchor:HTMLElement|null;title:string;onClose:()=>void;children:ReactNode}){
 const card=useRef<HTMLElement>(null);
 const close=useRef(onClose);close.current=onClose;
 const [position,setPosition]=useState({left:0,top:0});
 useLayoutEffect(()=>{
  const place=()=>{
   if(!anchor?.isConnected){close.current();return;}
   const row=anchor.getBoundingClientRect(),panel=anchor.closest('.sidebar-drawer')?.getBoundingClientRect()??row;
   const width=card.current?.offsetWidth??280,height=card.current?.offsetHeight??240;
   const left=Math.max(12,Math.min(panel.right+8,window.innerWidth-width-12));
   const top=Math.max(12,Math.min(row.top,window.innerHeight-height-12));
   setPosition(previous=>previous.left===left&&previous.top===top?previous:{left,top});
  };
  place();const observer=new ResizeObserver(place);if(card.current)observer.observe(card.current);
  window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[anchor]);
 useEffect(()=>{
  card.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});
  const outside=(event:PointerEvent)=>{const target=event.target as Node;if(!card.current?.contains(target)&&!anchor?.contains(target))close.current();};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close.current();(anchor?.tabIndex!==undefined&&anchor.tabIndex>=0?anchor:anchor?.querySelector<HTMLButtonElement>('button'))?.focus({preventScroll:true});}};
  window.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);
  return()=>{window.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);};
 },[anchor]);
 return createPortal(<section ref={card} className="element-property-card" role="dialog" aria-label={title} style={position}>
  <header><h2 title={title}>{title}</h2>
   <button type="button" className="icon-button element-delete" title={tx('删除')} aria-label={tx('删除')} onClick={onDelete}><Icon name="trash"/></button>
   <button type="button" className="icon-button" disabled={disabled} title={tx('完成')} aria-label={tx('完成')} onClick={onConfirm}><Icon name="check"/></button><button type="button" className="icon-button" title={tx('取消')} aria-label={tx('取消')} onClick={()=>{onClose();(anchor?.tabIndex!==undefined&&anchor.tabIndex>=0?anchor:anchor?.querySelector<HTMLButtonElement>('button'))?.focus({preventScroll:true});}}><Icon name="close"/></button></header>
  {children}
 </section>,document.body);
}
