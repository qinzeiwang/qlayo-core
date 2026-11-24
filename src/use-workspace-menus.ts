import {useEffect,useRef} from 'react';
/** Closes open menus and popovers on an outside click or Escape. `closePopovers` closes the React-owned popovers. */
export function useWorkspaceMenus(closePopovers:()=>void){
  const close=useRef(closePopovers);close.current=closePopovers;
  useEffect(()=>{
    // Transient menus must not survive unrelated workspace actions or dialogs.
    const dismissOutside=(event:Event)=>{
      const target=event.target;
      if(!(target instanceof Element))return;
      document.querySelectorAll<HTMLDetailsElement>('.project-menu[open], .region-menu[open]').forEach(menu=>{
        if(!menu.contains(target))menu.open=false;
      });
      if(!target.closest('.display-popover, [data-display-trigger]'))close.current();
    };
    const dismissOnEscape=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      document.querySelectorAll<HTMLDetailsElement>('.project-menu[open], .region-menu[open]').forEach(menu=>{menu.open=false;});
      close.current();
    };
    document.addEventListener('pointerdown',dismissOutside,true);
    document.addEventListener('click',dismissOutside,true);
    document.addEventListener('keydown',dismissOnEscape);
    return()=>{
      document.removeEventListener('pointerdown',dismissOutside,true);
      document.removeEventListener('click',dismissOutside,true);
      document.removeEventListener('keydown',dismissOnEscape);
    };
  },[]);
}
