import {useEffect,useRef,useState} from 'react';
import type {RoofDesign} from './roof-project';
import {Icon} from './workbench-ui';
import {tx} from './i18n';
import {NewRegion} from './new-region';
import type {RegionForm} from './region-form';

type RoofShapeTarget='flat'|'gable'|'single';
type Props={
 locked?:boolean;
 layoutAction?:{run:()=>void;disabled:boolean;stale?:boolean;runAll?:()=>void;allDisabled:boolean};
 roofs:RoofDesign[];active:RoofDesign;hasSelection:boolean;panel:string;creating:boolean;
 importing:boolean;running:boolean;canReshape:boolean;canUndoDelete:boolean;
 onCollapse:()=>void;onAdd:()=>void;onCancelCreate:()=>void;onCreateRegion:(form:RegionForm)=>void;
 onChoose:(id:string)=>void;onRename:(name:string)=>void;
 onReshape:()=>void;onDuplicate:()=>void;onDelete:()=>void;onUndoDelete:()=>void;
 onChangeType?:(kind:RoofShapeTarget)=>void;
 onToggleShadingOnly?:()=>void;
};
function regionIcon(r:RoofDesign){
 if(r.shadingOnly)return 'obstacle-building';
 if(r.carport)return r.carport.double?'double-carport':'single-carport';
 if(r.pitch?.kind==='gable'&&r.pitch.spans)return 'multi-gable-roof';
 return `${r.pitch?.kind??'flat'}-roof`;
}
/** Run a region-menu action and close the menu first. */
const menuAction=(action:()=>void)=>(e:{currentTarget:Element})=>{e.currentTarget.closest('details')?.removeAttribute('open');action();};

/** Single-line 45px context header at the top of the sidebar drawer: stays anchored to the working roof context. */
export function RegionBar(p:Props){
 const [renaming,setRenaming]=useState(false);
 const [draft,setDraft]=useState(p.active.name);
 const renameCancelled=useRef(false);
 const menuRef=useRef<HTMLDetailsElement>(null);
 const {active,importing,running}=p;

 useEffect(()=>{setRenaming(false);setDraft(p.active.name);},[p.active.id,p.panel,p.hasSelection,p.creating]);
 useEffect(()=>{
  const close=(e:PointerEvent)=>{if(menuRef.current?.open&&!menuRef.current.contains(e.target as Node))menuRef.current.removeAttribute('open');};
  window.addEventListener('pointerdown',close);
  return ()=>window.removeEventListener('pointerdown',close);
 },[]);

 if(p.panel==='report'){
  return <header inert={p.locked} className="region-context-header">
   <button type="button" className="icon-button header-back" title={tx('收起面板')} aria-label={tx('收起面板')} onClick={p.onCollapse}><Icon name="chevron-left"/></button>
   <span className="region-title">{tx('成果')}</span>
  </header>;
 }

 const full=importing||running||p.roofs.length>=50;
 const canSwitchType=!active.carport&&!active.shadingOnly&&!active.pitch?.spans&&!!p.onChangeType;
 const currentShape:RoofShapeTarget=active.pitch?.kind??'flat';

 return <header inert={p.locked} className="region-context-header">
  <button type="button" className="icon-button header-back" title={tx('收起面板')} aria-label={tx('收起面板')} onClick={p.onCollapse}><Icon name="chevron-left"/></button>
  {!p.hasSelection?(
   <span className="region-title is-empty">{tx('未选中区域')}</span>
  ):renaming?(
   <input data-1p-ignore="true" className="region-title-input" autoFocus aria-label={tx('区域名称')} value={draft}
    onChange={e=>setDraft(e.target.value)}
    onBlur={()=>{if(!renameCancelled.current){const next=draft.trim();if(next)p.onRename(next);}renameCancelled.current=false;setRenaming(false);}}
    onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();renameCancelled.current=true;setDraft(active.name);setRenaming(false);}else if(e.key==='Enter')e.currentTarget.blur();}}/>
  ):(
   p.panel==='layout'&&p.roofs.length>1?<details ref={menuRef} className="region-menu region-switch-menu" onKeyDown={event=>{
    const menu=event.currentTarget;
    if(event.key!=='Escape'||!menu.open)return;
    event.preventDefault();
    event.stopPropagation();
    menu.open=false;
    menu.querySelector('summary')?.focus();
   }}>
    <summary className="region-title region-title-switch" title={active.name}><span>{active.name}</span><Icon name="chevron"/></summary>
    <div className="region-menu-items"><div className="region-menu-group"><span>{tx('切换区域')}</span>{p.roofs.map(r=><button key={r.id} aria-current={r.id===active.id?'true':undefined} onClick={menuAction(()=>p.onChoose(r.id))}><Icon name={regionIcon(r)}/><span className="region-switch-name">{r.name}</span>{r.id===active.id&&<Icon name="check"/>}</button>)}</div></div>
   </details>:<span className="region-title" title={active.name}>{active.name}</span>
  )}

  {p.panel==='roof'&&p.hasSelection&&<>
   <details ref={menuRef} className="region-menu region-more">
    <summary className="icon-button" title={tx('区域管理')} aria-label={tx('区域管理')}><Icon name="more"/></summary>
    <div className="region-menu-items">
     <div className="region-menu-group">
      <span>{tx('编辑区域')}</span>
      <button onClick={menuAction(()=>{renameCancelled.current=false;setDraft(active.name);setRenaming(true);})}><Icon name="edit"/>{tx('重命名')}</button>
      {p.canReshape&&<button disabled={importing||running} onClick={menuAction(p.onReshape)}><Icon name="polygon"/>{tx('修改轮廓')}</button>}
      <button disabled={full} onClick={menuAction(p.onDuplicate)}><Icon name="copy"/>{tx('复制区域')}</button>
      {canSwitchType&&<details className="region-type-menu">
       <summary><Icon name={`${currentShape}-roof`}/>{tx('屋面类型')}<Icon name="chevron"/></summary>
       <div>
        {([['flat',tx('平屋面')],['gable',tx('双坡屋面')],['single',tx('单坡屋面')]] as const).map(([kind,label])=>(
         <button key={kind} disabled={running||currentShape===kind||(kind==='single'&&!!active.roof.outline)} onClick={menuAction(()=>{menuRef.current?.removeAttribute('open');p.onChangeType!(kind);})}>
          <Icon name={`${kind}-roof`}/>{label}{currentShape===kind&&<Icon name="check"/>}
         </button>
        ))}
       </div>
      </details>}
      {!active.carport&&p.onToggleShadingOnly&&<button disabled={running} onClick={menuAction(p.onToggleShadingOnly)}><Icon name="obstacle-building"/>{active.shadingOnly?tx('转为可布置屋面'):tx('仅作遮挡（不布置）')}</button>}
      <button className="danger" disabled={running} onClick={menuAction(p.onDelete)}><Icon name="trash"/>{tx('删除区域')}</button>
      {p.canUndoDelete&&<button onClick={menuAction(p.onUndoDelete)}><Icon name="reset"/>{tx('撤回删除')}</button>}
     </div>
     <div className="region-menu-group">
      <span>{tx('切换区域')}</span>
      {p.roofs.map(r=><button key={r.id} aria-current={r.id===active.id?'true':undefined} onClick={menuAction(()=>p.onChoose(r.id))}>
       <Icon name={regionIcon(r)}/><span className="region-switch-name">{r.name}</span>{r.id===active.id&&<Icon name="check"/>}
      </button>)}
     </div>
    </div>
   </details>
  </>}

  {p.panel==='layout'&&<div className="context-layout-actions">
   {p.layoutAction?.runAll&&<button type="button" className="icon-button" title={tx('布置全部屋面')} aria-label={tx('布置全部屋面')} disabled={p.layoutAction.allDisabled} onClick={p.layoutAction.runAll}><Icon name="layout-all"/></button>}
   <button type="button" className="context-primary-action" disabled={!p.layoutAction||p.layoutAction.disabled} onClick={p.layoutAction?.run}>{p.layoutAction?.stale?tx('更新布置'):tx('布置')}</button>
  </div>}
  {p.panel==='roof'&&<>
   {!p.hasSelection&&p.canUndoDelete&&<details ref={menuRef} className="region-menu region-more">
    <summary className="icon-button" title={tx('区域管理')} aria-label={tx('区域管理')}><Icon name="more"/></summary>
    <div className="region-menu-items">
     <button onClick={menuAction(p.onUndoDelete)}><Icon name="reset"/>{tx('撤回删除')}</button>
    </div>
   </details>}
   <button type="button" id="region-create-trigger" data-region-create-trigger="" aria-haspopup="menu" aria-expanded={p.creating} aria-controls={p.creating?'region-create-menu':undefined} className="context-primary-action" title={tx('新增区域')} aria-label={tx('新增区域')} disabled={full} onClick={()=>{menuRef.current?.removeAttribute('open');if(p.creating)p.onCancelCreate();else p.onAdd();}}>{tx('新建')}</button>
   {p.creating&&<NewRegion onCreate={p.onCreateRegion} onClose={p.onCancelCreate}/>}
  </>}
 </header>;
}
