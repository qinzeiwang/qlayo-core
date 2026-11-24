import {useEffect,useRef} from 'react';
import {Icon} from './workbench-ui';
import type {RegionForm} from './region-form';
import {tx} from './i18n';

/** Non-modal menu anchored to the add-area button; selecting a type starts creation. */
export function NewRegion({onCreate,onClose}:{onCreate:(form:RegionForm)=>void;onClose:()=>void}){
 const menuRef=useRef<HTMLDivElement>(null);
 const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{
  const menu=menuRef.current;
  menu?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
  const outside=(event:PointerEvent)=>{
   const target=event.target as Element;
   if(!menu?.contains(target)&&!target.closest('[data-region-create-trigger]'))closeRef.current();
  };
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeRef.current();document.getElementById('region-create-trigger')?.focus();}
  };
  window.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',key,true);
  return()=>{window.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);};
 },[]);
 const items:[RegionForm,string,string][]=[
  ['flat',tx('平屋面'),'flat-roof'],
  ['gable',tx('双坡屋面'),'gable-roof'],
  ['single',tx('单坡屋面'),'single-roof'],
  ['single-carport',tx('单向车棚'),'single-carport'],
  ['double-carport',tx('双向车棚'),'double-carport'],
 ];
 return <div ref={menuRef} id="region-create-menu" className="region-menu-items region-new-menu" role="menu" aria-label={tx('新增区域')}
  onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node)&&!(event.relatedTarget as Element).closest('[data-region-create-trigger]'))onClose();}}
  onKeyDown={event=>{
   const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
   const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
   const next=event.key==='ArrowDown'?(index+1)%buttons.length:event.key==='ArrowUp'?(index-1+buttons.length)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:-1;
   if(next>=0){event.preventDefault();buttons[next]?.focus();}
  }}>
  {items.map(([id,label,icon])=><button key={id} type="button" role="menuitem" onClick={()=>onCreate(id)}><Icon name={icon}/>{label}</button>)}
 </div>;
}
