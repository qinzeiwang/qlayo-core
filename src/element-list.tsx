import {useEffect,useMemo,useRef,useState} from 'react';
import type {Obstacle,ArrayGrid} from './domain';
import {Icon} from './workbench-ui';
import {NumberProperty} from './number-property';
import {ElementPropertyCard} from './element-property-card';
import {MAX_PATTERN} from './area-tools';
import {tx} from './i18n';

export type ElementEditRequest={objectId:string;serial:number;mode?:'properties'|'array'};
export type ElementCreation={draft:Obstacle;onChange:(draft:Obstacle)=>void;editing?:boolean};
export type ElementArraySpec={grid?:ArrayGrid;count:number;axis:'width'|'depth';gap:number;groupId?:string;properties?:{name?:string;height?:number;topLayout?:{enabled:boolean;tilt:number;edge:number}}};
export type ElementArrayPreview={roofId:string;targetId:string;spec:ElementArraySpec};

type ListEntry=
 |{kind:'item';item:Obstacle}
 |{kind:'group';groupId:string;name:string;elementKind:'building'|'obstacle'|'keepout';members:Obstacle[]};

const elementKind=(o:Obstacle):'building'|'obstacle'|'keepout'=>
 o.topLayout?'building':(o.kind??'obstacle')==='keepout'?'keepout':'obstacle';

const elementIcon=(kind:'building'|'obstacle'|'keepout')=>
 kind==='building'?'annex':kind==='keepout'?'keepout-obj':'obstacle-obj';

type DraftValues={
 name:string;
 height:number;
 heightEdited:boolean;
 topEnabled:boolean;
 topTilt:number;
 topEdge:number;
 applyWholeGroup:boolean;
};

function makeDraft(targets:Obstacle[]):DraftValues{
 const first=targets[0];
 return {
  name:first.name,
  height:first.height,
  heightEdited:false,
  topEnabled:first.topLayout?.enabled??false,
  topTilt:first.topLayout?.tilt??10,
  topEdge:first.topLayout?.edge??.5,
  applyWholeGroup:false,
 };
}

type EditorFormProps={
 anchor:HTMLElement|null;
 roofId:string;
 targets:Obstacle[];
 groupInfo?:{groupId:string;name:string;members:Obstacle[]};
 isWholeGroup:boolean;
 isSingleMember:boolean;
 onCancel:()=>void;
 arrayInitial:{grid:ArrayGrid;count:number;axis:'width'|'depth';gap:number};initialArrayOpen:boolean;
 onUngroup?:()=>void;
 onDelete:()=>void;
 onPreview:(preview:ElementArrayPreview|null)=>void;
 onCommit:(draft:DraftValues,patch:NonNullable<ElementArraySpec['properties']>,array?:ElementArraySpec)=>void;
};

/** Draft fields for the row-anchored property card; changes apply only on confirmation. */
function ElementEditorForm({anchor,roofId,targets,groupInfo,isWholeGroup,isSingleMember,arrayInitial,initialArrayOpen,onUngroup,onCancel,onDelete,onPreview,onCommit}:EditorFormProps){
 const [draft,setDraft]=useState<DraftValues>(()=>makeDraft(targets));
 const [arrayExpanded,setArrayExpanded]=useState(initialArrayOpen);
 const [array,setArray]=useState(arrayInitial);
 const arrayAllowed=isWholeGroup||targets.length===1&&!isSingleMember;
 const arrayChanged=arrayAllowed&&(array.gap!==arrayInitial.gap||array.grid.basis!==arrayInitial.grid.basis||
  array.grid.columns!==arrayInitial.grid.columns||array.grid.rows!==arrayInitial.grid.rows||array.grid.rowGap!==arrayInitial.grid.rowGap);
 const count=array.grid.rows*array.grid.columns;
 const arrayValid=[array.grid.rows,array.grid.columns].every(n=>Number.isInteger(n)&&n>=1&&n<=MAX_PATTERN+1)&&count<=100&&array.grid.rowGap>=0&&array.grid.rowGap<=100&&Number.isFinite(array.gap)&&array.gap>=0&&array.gap<=100;

 const single=targets.length===1?targets[0]:undefined;
 const elevated=targets.filter(t=>t.kind!=='keepout');
 const keepouts=targets.filter(t=>t.kind==='keepout');
 const title=isWholeGroup&&groupInfo
  ?`${groupInfo.name} · ${groupInfo.members.length} ${tx('个')}`
  :single?single.name:tx('已选 {0} 项',targets.length);
 const valid=!elevated.length||(Number.isFinite(draft.height)&&draft.height>=0.2&&draft.height<=30);
 const hasHeight=!!elevated.length;
 const patch=useMemo(()=>{
  const result:NonNullable<ElementArraySpec['properties']>={};
  const name=draft.name.trim();
  if(single&&!draft.applyWholeGroup&&name&&name!==single.name)result.name=name;
  if(hasHeight&&(draft.heightEdited||draft.applyWholeGroup))result.height=draft.height;
  if(single?.topLayout){
   const next={enabled:draft.topEnabled,tilt:draft.topTilt,edge:draft.topEdge};
   if(next.enabled!==single.topLayout.enabled||next.tilt!==single.topLayout.tilt||next.edge!==single.topLayout.edge)result.topLayout=next;
  }
  return result;
 },[draft,single,hasHeight]);
 const targetId=groupInfo?.members[0].id??single?.id;
 const arraySpec=useMemo<ElementArraySpec|undefined>(()=>
  arrayChanged&&arrayValid&&(count>1||isWholeGroup)?{...array,count,groupId:groupInfo?.groupId,properties:patch}:undefined,
  [array,arrayChanged,arrayValid,count,isWholeGroup,groupInfo?.groupId,patch]);
 useEffect(()=>{
  if(!arraySpec||!targetId||!valid)return;
  onPreview({roofId,targetId,spec:arraySpec});
  return()=>onPreview(null);
 },[arraySpec,targetId,roofId,valid,onPreview]);

 const body=<div className="element-editor-fields">
  {single?(
   <div className="property-row property-row-text element-edit-name">
    <Icon name="edit"/><span className="property-spacer">{tx('名称')}</span>
    <input data-1p-ignore="true" aria-label={tx('要素名称')} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder={tx('要素名称')}/>
   </div>
  ):null}
  {elevated.length>0&&<NumberProperty textLabel={tx('高度')} label={tx('要素高度 m')} icon="height" unit="m" min={0.2} max={30} step={0.1} value={draft.height} onChange={height=>setDraft({...draft,height,heightEdited:true})}/>}
  {single?.topLayout&&<div className="element-top-fields">
   <label className="building-top-toggle">
    <span>{tx('顶部布置组件')}</span>
    <input type="checkbox" checked={draft.topEnabled} onChange={e=>setDraft({...draft,topEnabled:e.target.checked})}/>
   </label>
   {draft.topEnabled&&<>
    <NumberProperty textLabel={tx('倾角')} label={tx('顶部倾角 °')} icon="slope" unit="°" min={0} max={60} step={1} value={draft.topTilt} onChange={topTilt=>setDraft({...draft,topTilt})}/>
    <NumberProperty textLabel={tx('间距')} label={tx('顶部边距 m')} icon="gap-x" unit="m" min={0} max={20} step={0.1} value={draft.topEdge} onChange={topEdge=>setDraft({...draft,topEdge})}/>
   </>}
  </div>}
  {isSingleMember&&groupInfo&&elevated.length>0&&(
   <label className="building-top-toggle">
    <span>{tx('同步整组高度')}</span>
    <input type="checkbox" checked={draft.applyWholeGroup} onChange={e=>setDraft({...draft,applyWholeGroup:e.target.checked})}/>
   </label>
  )}
  {!isWholeGroup&&targets.length>1&&keepouts.length>0&&elevated.length>0&&(
   <p className="object-outline-hint">{tx('高度仅应用到非禁布要素')}</p>
  )}
  {arrayAllowed&&<details className="element-array-section" open={arrayExpanded} onToggle={event=>setArrayExpanded(event.currentTarget.open)}>
   <summary><span>{tx('阵列')}</span><Icon name={arrayExpanded?'chevron':'chevron-right'}/></summary>
   <div className="array-dialog-fields">
    <div className="array-axis-seg seg-track" role="group" aria-label={tx('阵列方向')}>
     {(['roof','element'] as const).map(basis=><button key={basis} type="button" className="seg-btn" aria-pressed={array.grid.basis===basis} onClick={()=>setArray({...array,grid:{...array.grid,basis}})}>{basis==='roof'?tx('沿屋面'):tx('沿法向')}</button>)}
    </div>
    {(['columns','rows'] as const).map((key,i)=><div key={key}>
     <strong>{i?tx('方向 2'):tx('方向 1')}</strong>
     <NumberProperty textLabel={tx('数量')} label={i?tx('方向 2 数量'):tx('方向 1 数量')} icon="count" unit={tx('个')} min={1} max={MAX_PATTERN+1} step={1} value={array.grid[key]} onChange={count=>setArray({...array,grid:{...array.grid,[key]:count}})}/>
     <NumberProperty textLabel={tx('净距')} label={i?tx('方向 2 净距'):tx('方向 1 净距')} icon={i?'gap-y':'gap-x'} min={0} max={100} value={i?array.grid.rowGap:array.gap} onChange={gap=>setArray(i?{...array,grid:{...array.grid,rowGap:gap}}:{...array,gap})}/>
    </div>)}
    {onUngroup&&<button type="button" className="array-ungroup" onClick={onUngroup}>{tx('解散阵列组')}</button>}
   </div>
  </details>}
 </div>;

 return <ElementPropertyCard anchor={anchor} title={title} onDelete={onDelete} disabled={!valid||arrayChanged&&!arrayValid} onConfirm={()=>onCommit(draft,patch,arraySpec)} onClose={onCancel}>
  <div className="element-property-body">{body}</div>
 </ElementPropertyCard>;
}

type Props={
 editRequest?:ElementEditRequest;onEditRequestHandled?:()=>void;
 creation?:ElementCreation;
 roofId:string;
 items:Obstacle[];
 selection:string[];
 disabled:boolean;
 onSelectionChange:(ids:string[])=>void;
 onAdd:(kind:'building'|'obstacle'|'keepout')=>void;
 onDelete:(ids:string[])=>void;
 onApplyEdit:(ids:string[],patch:{name?:string;height?:number;width?:number;depth?:number;topLayout?:{enabled:boolean;tilt:number;edge:number}})=>void;
 onApplyArray:(targetId:string,spec:ElementArraySpec)=>boolean;
 onPreviewArray:(preview:ElementArrayPreview|null)=>void;
 onUngroup:(groupId:string)=>void;
};

/** Compact selectable list; each row explicitly expands one property card with optional array settings. */
export function ElementList({editRequest,onEditRequestHandled,creation,roofId,items,selection,disabled,onSelectionChange,onAdd,onDelete,onApplyEdit,onApplyArray,onPreviewArray,onUngroup}:Props){
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const [editorOpen,setEditorOpen]=useState(false);
 const [editorAnchor,setEditorAnchor]=useState<HTMLElement|null>(null);
 const [initialArrayOpen,setInitialArrayOpen]=useState(false);
 const lastIndex=useRef(0);
 const listHost=useRef<HTMLElement>(null);

 useEffect(()=>{
  if(!selection.length){setEditorOpen(false);setInitialArrayOpen(false);}
 },[selection.length]);

 // Group items that share a real parametric arrayGroup.id with >= 2 members; single survivors fall back to standalone.
 const {entries,groupsById}=useMemo(()=>{
  const membersByGroup=new Map<string,Obstacle[]>();
  for(const o of items){
   if(!o.arrayGroup)continue;
   const arr=membersByGroup.get(o.arrayGroup.id)??[];
   arr.push(o);
   membersByGroup.set(o.arrayGroup.id,arr);
  }
  const seen=new Set<string>();
  const out:ListEntry[]=[];
  const validGroups=new Map<string,{groupId:string;name:string;members:Obstacle[]}>();
  for(const o of items){
   const gid=o.arrayGroup?.id;
   const members=gid?membersByGroup.get(gid):undefined;
   if(gid&&members&&members.length>=2){
    if(seen.has(gid))continue;
    seen.add(gid);
    const sorted=[...members].sort((a,b)=>(a.arrayGroup?.index??0)-(b.arrayGroup?.index??0));
    const name=sorted[0].arrayGroup?.name??sorted[0].name;
    validGroups.set(gid,{groupId:gid,name,members:sorted});
    out.push({kind:'group',groupId:gid,name,elementKind:elementKind(sorted[0]),members:sorted});
   }else{
    out.push({kind:'item',item:o});
   }
  }
  return {entries:out,groupsById:validGroups};
 },[items]);

 // Auto-expand a group if a single member inside it was selected from the 2D/3D canvas.
 useEffect(()=>{
  if(selection.length!==1)return;
  const o=items.find(v=>v.id===selection[0]);
  const gid=o?.arrayGroup?.id;
  if(gid&&groupsById.has(gid))setExpanded(prev=>prev[gid]?prev:{...prev,[gid]:true});
 },[selection,items,groupsById]);

 const flatIds=useMemo(()=>entries.flatMap(e=>e.kind==='group'?e.members.map(m=>m.id):[e.item.id]),[entries]);
 const selectedItems=items.filter(o=>selection.includes(o.id));
 const single=selectedItems.length===1?selectedItems[0]:undefined;

 // Determine if selection is a complete array group or a single member of one.
 let activeGroup:{groupId:string;name:string;members:Obstacle[]}|undefined;
 let isWholeGroup=false;
 let isSingleMember=false;
 for(const g of groupsById.values()){
  const ids=g.members.map(m=>m.id);
  if(selection.length===ids.length&&ids.every(id=>selection.includes(id))){activeGroup=g;isWholeGroup=true;break;}
  if(single&&ids.includes(single.id)){activeGroup=g;isSingleMember=true;break;}
 }

 const canArray=!!single||(isWholeGroup&&!!activeGroup);
 function pickIds(ids:string[],index:number,event:{ctrlKey:boolean;metaKey:boolean;shiftKey:boolean}){
  if(event.shiftKey&&ids.length===1){
   const a=Math.min(index,lastIndex.current),b=Math.max(index,lastIndex.current);
   const range=flatIds.slice(a,b+1);
   onSelectionChange(event.ctrlKey||event.metaKey?[...new Set([...selection,...range])]:range);
  }else if(event.ctrlKey||event.metaKey){
   const allIn=ids.every(id=>selection.includes(id));
   onSelectionChange(allIn?selection.filter(id=>!ids.includes(id)):[...new Set([...selection,...ids])]);
  }else{
   onSelectionChange(ids);
  }
  lastIndex.current=index;
  setEditorOpen(false);setInitialArrayOpen(false);
 }

 const openEditor=(ids:string[],anchor:HTMLElement)=>{onSelectionChange(ids);setEditorAnchor(anchor);setInitialArrayOpen(false);setEditorOpen(true);};
 const expandButton=(ids:string[])=>{
  const open=editorOpen&&selection.length===ids.length&&ids.every(id=>selection.includes(id));
  return <button type="button" className="icon-button element-row-expand" aria-label={open?tx('收起属性'):tx('展开属性')} title={open?tx('收起属性'):tx('展开属性')} aria-expanded={open} disabled={disabled} onClick={event=>{event.stopPropagation();if(open){setEditorOpen(false);return;}openEditor(ids,event.currentTarget.closest('.element-row') as HTMLElement);}}><Icon name={open?'chevron-left':'chevron-right'}/></button>;
 };

 useEffect(()=>{
  if(!editRequest||creation)return;
  const item=items.find(item=>item.id===editRequest.objectId);
  const group=item?.arrayGroup?groupsById.get(item.arrayGroup.id):undefined;
  const ids=editRequest.mode==='array'&&group?group.members.map(member=>member.id):[editRequest.objectId];
  const rows=Array.from(listHost.current?.querySelectorAll<HTMLElement>('[data-object-id]')??[]);
  const anchor=editRequest.mode==='array'&&group?rows.find(row=>row.classList.contains('element-group-row')&&row.dataset.objectId===ids[0]):rows.reverse().find(row=>row.dataset.objectId===editRequest.objectId);
  if(item&&anchor){onSelectionChange(ids);setEditorAnchor(anchor);setInitialArrayOpen(editRequest.mode==='array');setEditorOpen(true);}
  onEditRequestHandled?.();
 },[editRequest,creation]);

 const addKinds=['building','obstacle','keepout'] as const;
 const addMeta:Record<'building'|'obstacle'|'keepout',[string,string]>={
  building:['annex-add',tx('新建附属建筑')],
  obstacle:['obstacle-add',tx('新建障碍物')],
  keepout:['keepout-add',tx('新建禁布区')],
 };

 const arrayInitial=useMemo(()=>{
  const meta=activeGroup?.members[0]?.arrayGroup;
  return {grid:meta?.grid??{basis:meta?'element' as const:'roof' as const,columns:meta?.axis==='depth'?1:meta?.count??1,rows:meta?.axis==='depth'?meta.count:1,rowGap:meta?.gap??1},count:meta?.count??1,axis:meta?.axis??'width',gap:meta?.gap??1};
 },[activeGroup]);

 return <section ref={listHost} className="element-section element-browser">
  <div className="element-heading" data-drawing-anchor="elements">
   <h2>{tx('屋面要素')}{items.length>0&&<span> · {items.length}</span>}</h2>
   <div className="quick-add" aria-label={tx('屋面要素')}>
    {addKinds.map(k=>{
     const [icon,label]=addMeta[k];
     return <button key={k} type="button" className="create-tool" title={label} aria-label={label} disabled={disabled||items.length>=100} onClick={()=>onAdd(k)}>
      <Icon name={icon}/>
     </button>;
    })}
   </div>
  </div>

  {creation?<section className="element-object-draft" aria-label={creation.editing?tx('修改轮廓'):creation.draft.kind==='keepout'?tx('新建禁布区'):creation.draft.topLayout?tx('新建附属建筑'):tx('新建障碍物')}>
   <h3>{creation.editing?tx('修改轮廓'):creation.draft.kind==='keepout'?tx('新建禁布区'):creation.draft.topLayout?tx('新建附属建筑'):tx('新建障碍物')}</h3>
   <div className="property-row property-row-text"><Icon name="edit"/><span className="property-spacer">{tx('名称')}</span><input data-1p-ignore="true" aria-label={tx('要素名称')} value={creation.draft.name} onChange={event=>creation.onChange({...creation.draft,name:event.target.value})}/></div>
   {creation.draft.kind!=='keepout'&&<NumberProperty textLabel={tx('高度')} label={tx('要素高度 m')} icon="height" unit="m" min={.2} max={30} step={.1} value={creation.draft.height} onChange={height=>creation.onChange({...creation.draft,height})}/>}
  </section>:<>
  <div className="element-list" role="listbox" aria-label={tx('屋面要素')} aria-multiselectable="true">
   {entries.map(entry=>{
    if(entry.kind==='item'){
     const o=entry.item,k=elementKind(o),idx=flatIds.indexOf(o.id),isSel=selection.includes(o.id);
     return <div key={o.id} data-object-id={o.id} role="option" aria-selected={isSel} tabIndex={0} className={'element-row'+(isSel?' selected':'')}
      onClick={e=>pickIds([o.id],idx,e)}
      onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();pickIds([o.id],idx,e);}if((e.ctrlKey||e.metaKey)&&e.key==='a'){e.preventDefault();onSelectionChange(items.map(v=>v.id));}}}>
      <Icon name={elementIcon(k)}/>
      <span title={o.name}>{o.name}</span>
      <span className="element-value">{k==='keepout'?'':o.height.toFixed(1)}</span>
      <small>{k==='keepout'?'':'m'}</small>
      {expandButton([o.id])}
     </div>;
    }
    const {groupId,name,elementKind:ek,members}=entry;
    const isOpen=!!expanded[groupId];
    const memberIds=members.map(m=>m.id);
    const groupSel=memberIds.every(id=>selection.includes(id));
    const firstIdx=flatIds.indexOf(memberIds[0]);
    return <div key={groupId} className="element-group">
     <div data-object-id={memberIds[0]} role="option" aria-selected={groupSel} tabIndex={0} className={'element-row element-group-row'+(groupSel?' selected':'')}
      onClick={e=>pickIds(memberIds,firstIdx,e)}
      onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();pickIds(memberIds,firstIdx,e);}}}>
      <button type="button" className="group-chevron" aria-label={isOpen?tx('收起分组'):tx('展开分组')} aria-expanded={isOpen}
       onClick={e=>{e.stopPropagation();setExpanded(prev=>({...prev,[groupId]:!isOpen}));}}>
       <Icon name={isOpen?'chevron':'chevron-right'}/>
      </button>
      <Icon name={elementIcon(ek)}/>
      <span title={name}>{name}</span>
      <span className="element-value">{members.length}</span>
      <small>{tx('个')}</small>
      {expandButton(memberIds)}
     </div>
     {isOpen&&<div className="element-group-members">
      {members.map(m=>{
       const mk=elementKind(m),midx=flatIds.indexOf(m.id),mSel=selection.includes(m.id)&&!groupSel;
       return <div key={m.id} data-object-id={m.id} role="option" aria-selected={selection.includes(m.id)} tabIndex={0} className={'element-row element-member-row'+(mSel?' selected':'')}
        onClick={e=>pickIds([m.id],midx,e)}
        onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();pickIds([m.id],midx,e);}}}>
        <Icon name={elementIcon(mk)}/>
        <span title={m.name}>{m.name}</span>
        <span className="element-value">{mk==='keepout'?'':m.height.toFixed(1)}</span>
        <small>{mk==='keepout'?'':'m'}</small>
        {expandButton([m.id])}
       </div>;
      })}
     </div>}
    </div>;
   })}
  </div>

  {editorOpen&&selectedItems.length>0&&(
   <ElementEditorForm
    key={selectedItems.map(item=>item.id).join(',')+'-'+initialArrayOpen}
    roofId={roofId}
    targets={selectedItems}
    groupInfo={activeGroup}
    isWholeGroup={isWholeGroup}
    isSingleMember={isSingleMember}
    anchor={editorAnchor}
    onPreview={onPreviewArray}
    arrayInitial={arrayInitial} initialArrayOpen={initialArrayOpen}
    onUngroup={isWholeGroup&&activeGroup?()=>{onUngroup(activeGroup.groupId);setEditorOpen(false);}:undefined}
    onCancel={()=>setEditorOpen(false)}
    onDelete={()=>{setEditorOpen(false);onDelete(selectedItems.map(item=>item.id));}}
    onCommit={(draft,patch,array)=>{
     const ids=isSingleMember&&draft.applyWholeGroup&&activeGroup?activeGroup.members.map(m=>m.id):selection;
     if(array&&canArray){
      const targetId=activeGroup?activeGroup.members[0].id:single!.id;
      if(!onApplyArray(targetId,array))return;
     }else if(Object.keys(patch).length)onApplyEdit(ids,patch);
     setEditorOpen(false);
    }}
   />
  )}

  </>}
 </section>;
}
