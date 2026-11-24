import {useEffect,useLayoutEffect,useRef} from 'react';
import {parseCanvasId} from './canvas-target';
import {ALIGN_EDGES,alignLabel} from './canvas-selection';
import type {AlignEdge} from './area-tools';
import {tx} from './i18n';
/** Asks whether to save the current project before clearing the workspace. */
export function NewProjectDialog({saving,error,onCancel,onDiscard,onSave}:{saving:boolean;error?:string;onCancel:()=>void;onDiscard:()=>void;onSave:()=>void}){
 return <div className="project-dialog-backdrop"><section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
  <h2 id="new-project-title">{tx('新建项目')}</h2>
  <p>{tx('新建将清空当前工作区。是否先保存当前项目？')}</p>
  <div><button disabled={saving} onClick={onCancel}>{tx('取消')}</button><button disabled={saving} onClick={onDiscard}>{tx('不保存，新建')}</button><button className="primary" disabled={saving} onClick={onSave}>{saving?tx('保存中…'):tx('保存后新建')}</button></div>
  {error&&<p role="alert">{error}</p>}
 </section></div>;
}
/** Raised only when the user makes an output while layout or shadow checks are unfinished. Warns, never blocks. */
export function ReminderDialog({lines,action,onAction,onContinue,onClose}:{lines:string[];action:string;onAction:()=>void;onContinue:()=>void;onClose:()=>void}){
 const latest=useRef(onClose);latest.current=onClose;
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();latest.current();}};document.addEventListener('keydown',key,true);return()=>document.removeEventListener('keydown',key,true);},[]);
 return <div className="project-dialog-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="project-dialog reminder-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reminder-title">
  <h2 id="reminder-title">{tx('继续之前')}</h2>
  {lines.map(t=><p key={t}>{t}</p>)}
  <div><button onClick={onContinue}>{tx('仍然继续')}</button><button className="primary" autoFocus onClick={onAction}>{action}</button></div>
 </section></div>;
}
type MenuActions={count:number;keyName:string;canPaste:boolean;canPattern?:boolean;onCopy:()=>void;onPaste:()=>void;onPattern:()=>void;onAlign:(edge:AlignEdge)=>void;onDelete:()=>void};
/** Right-click menu on a canvas area or object. On the Area tab both get copy, paste, pattern, align (two or more picked) and delete. */
export function CanvasObjectMenu({menu,canReshape,onEdit,onClose,actions:a}:{menu:{id:string;x:number;y:number};canReshape:boolean;onEdit:(id:string)=>void;onClose:()=>void;actions?:MenuActions}){
 const object=parseCanvasId(menu.id).kind==='object',many=(a?.count??0)>1,run=(f:()=>void)=>()=>{onClose();f();};
 const box=useRef<HTMLDivElement>(null),latest=useRef(onClose);latest.current=onClose;
 // Kept inside the window once its real size is known.
 useLayoutEffect(()=>{const el=box.current;if(!el)return;el.style.left=`${Math.max(8,Math.min(menu.x,window.innerWidth-el.offsetWidth-8))}px`;el.style.top=`${Math.max(8,Math.min(menu.y,window.innerHeight-el.offsetHeight-8))}px`;},[menu,many]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();latest.current();}};document.addEventListener('keydown',key,true);return()=>document.removeEventListener('keydown',key,true);},[]);
 return <div className="canvas-menu-backdrop" onPointerDown={onClose} onContextMenu={e=>{e.preventDefault();onClose();}}>
  <div ref={box} className="canvas-object-menu" role="menu" style={{left:menu.x,top:menu.y}} onPointerDown={e=>e.stopPropagation()}>
   <button role="menuitem" disabled={!object&&!canReshape} onClick={()=>onEdit(menu.id)}>{object?tx('修改所选对象'):tx('修改轮廓')}</button>
   {a&&<><hr/>
    <button role="menuitem" onClick={run(a.onCopy)}>{tx('复制')}<kbd>Ctrl+C</kbd></button>
    <button role="menuitem" disabled={!a.canPaste} onClick={run(a.onPaste)}>{tx('粘贴')}<kbd>Ctrl+V</kbd></button>
    <button role="menuitem" disabled={!(a.canPattern??!many)} onClick={run(a.onPattern)}>{tx('阵列…')}</button>
    {many&&<><hr/><p>{tx('对齐到 {0}',a.keyName)}</p>{ALIGN_EDGES.map(edge=><button key={edge} role="menuitem" onClick={run(()=>a.onAlign(edge))}>{alignLabel(edge)}</button>)}</>}
    <hr/><button role="menuitem" className="danger" onClick={run(a.onDelete)}>{object?(many?tx('删除所选 {0} 个对象',a.count):tx('删除对象')):many?tx('删除所选 {0} 个区域',a.count):tx('删除区域')}</button>
   </>}
  </div>
 </div>;
}
