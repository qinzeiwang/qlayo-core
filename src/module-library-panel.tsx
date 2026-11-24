import {newId} from './ids';
import {useCallback,useEffect,useState} from 'react';
import {defaultModule,validModule} from './domain';
import {Icon} from './workbench-ui';
import {isBuiltInModule,projectDefaultModule,type ModuleCatalogItem} from './module-library';
import {readModuleLibrary,sameLibraryModule,setModuleShared} from './saved-module-library';
import './module-library-panel.css';
import {tx} from './i18n';

type Props={items:ModuleCatalogItem[];usedIds:Set<string>;onChange:(items:ModuleCatalogItem[])=>string|null};
function LibraryItem({item,used,onApply,onDirty}:{item:ModuleCatalogItem;used:boolean;onApply:(item:ModuleCatalogItem)=>string|null;onDirty:(id:string,dirty:boolean)=>void}){
 const [draft,setDraft]=useState(item),[error,setError]=useState('');
 useEffect(()=>{setDraft(item);setError('');},[item]);
 const dirty=JSON.stringify(draft)!==JSON.stringify(item);
 useEffect(()=>{onDirty(item.id,dirty);return()=>onDirty(item.id,false);},[item.id,dirty,onDirty]);
 return <form className="module-library-item" onSubmit={e=>{e.preventDefault();if(!draft.name.trim()||!validModule(draft.spec)){setError(tx('请填写名称和有效的组件规格'));return;}setError(onApply({...draft,name:draft.name.trim()})??'');}}>
  <label className="module-library-heading"><span>{tx('组件名称')}</span><input data-1p-ignore="true" aria-label={tx('组件名称')} maxLength={80} required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
  <div className="module-library-fields"><label>{tx('类型')}<select value={draft.spec.kind??'standard'} onChange={e=>setDraft({...draft,spec:{...draft.spec,kind:e.target.value as 'standard'|'lightweight'}})}><option value="standard">{tx('标准组件')}</option><option value="lightweight">{tx('轻质组件')}</option></select></label>
  {([{key:'power',label:tx('功率 Wp'),min:1,max:2000,step:1},{key:'length',label:tx('长度 m'),min:.2,max:5,step:.001},{key:'width',label:tx('宽度 m'),min:.2,max:5,step:.001},{key:'gap',label:tx('拼缝 m'),min:0,max:2,step:.001}] as const).map(field=>{const unit=field.label.slice(field.label.lastIndexOf(' ')+1);return <label key={field.key}>{field.label.slice(0,field.label.lastIndexOf(' '))}<span className={unit.length>1?'spec-amount is-wide-unit':'spec-amount'}><input data-1p-ignore="true" aria-label={item.name+' '+field.label} type="number" required min={field.min} max={field.max} step={field.step} value={Number.isNaN(draft.spec[field.key])?'':draft.spec[field.key]} onChange={e=>setDraft({...draft,spec:{...draft.spec,[field.key]:e.target.value===''?NaN:Number(e.target.value)}})}/><small>{unit}</small></span></label>;})}</div>
  {dirty&&<div className="module-library-apply"><span>{used?tx('应用后需重新布置引用此组件的区域'):''}</span><button type="button" onClick={()=>{setDraft(item);setError('');}}>{tx('取消修改')}</button><button type="submit">{tx('应用规格')}</button></div>}{error&&<p role="alert" className="error">{error}</p>}
 </form>;
}
export function ModuleLibraryPanel({items,usedIds,onChange}:Props){
 const [selectedId,setSelectedId]=useState(items[0]?.id);
 const [error,setError]=useState(''),[dirty,setDirty]=useState(false);
 const [library,setLibrary]=useState(()=>readModuleLibrary());
 const onDirty=useCallback((_id:string,value:boolean)=>setDirty(value),[]);
 const selected=items.find(i=>i.id===selectedId)??items[0];
 const scope=(item:ModuleCatalogItem)=>isBuiltInModule(item)?'built-in'
  :library.items.some(entry=>sameLibraryModule(entry,item))?'shared':'project';
 const selectedScope=scope(selected);
 const groups=[
  ['built-in',tx('内置规格')],['shared',tx('公用规格')],['project',tx('项目规格')],
 ] as const;
 const apply=(next:ModuleCatalogItem[])=>{const failure=onChange(next);setError(failure??'');return !failure;};
 function changeSharing(){
  try{setLibrary(setModuleShared(selected,selectedScope!=='shared'));setError('');}
  catch(error){setError(error instanceof Error?error.message:tx('公用组件库保存失败'));}
 }
 function add(){
  const item={id:newId(),name:tx('新组件 ')+(items.length+1),spec:{...(selected?.spec??defaultModule)}};
  if(apply([...items,item]))setSelectedId(item.id);
 }
 return <div className="module-library-layout">
  <nav className="module-library-nav"><header><h3>{tx('组件列表')}</h3>
   <button aria-label={tx('新增组件')} title={tx('新增组件')} disabled={dirty||items.length>=50} onClick={add}><Icon name="plus"/></button>
   <button aria-label={tx('删除组件')} title={tx('删除组件')} disabled={dirty||items.length<=1||usedIds.has(selected.id)} onClick={()=>apply(items.filter(i=>i.id!==selected.id))}><Icon name="trash"/></button></header>
   {groups.map(([group,title])=>{
    const entries=items.filter(item=>scope(item)===group);
    return entries.length>0&&<div className="module-library-group" key={group}>
     <h4>{title}</h4>
     <ul aria-label={title}>{entries.map(i=><li key={i.id}><button disabled={dirty&&selected.id!==i.id} aria-current={selected.id===i.id||undefined} onClick={()=>{setSelectedId(i.id);setError('');}}>{i.name}</button></li>)}</ul>
    </div>;
   })}
  </nav>
  <section className="module-library-editor"><h3>{tx('组件信息')}</h3>
   <LibraryItem key={selected.id} item={selected} used={usedIds.has(selected.id)} onDirty={onDirty} onApply={next=>onChange(items.map(i=>i.id===next.id?next:i))}/>
   <div className="module-library-actions">
    {selectedScope!=='built-in'&&<button type="button" disabled={dirty} title={tx('公用规格可在本浏览器的新项目中使用')} onClick={changeSharing}>{selectedScope==='shared'?tx('移出公用库'):tx('加入公用库')}</button>}
    <button className="default-module-action" disabled={dirty||items[0].id===selected.id} onClick={()=>apply([selected,...items.filter(i=>i.id!==selected.id)])}>{items[0].id===selected.id?tx('项目默认组件'):tx('设为默认组件')}</button>
   </div>
   {error&&<p role="alert">{error}</p>}
  </section>
 </div>;
}
export function ModulePicker({items,value,inherited,standardOnly,disabled,onSelect}:{items:ModuleCatalogItem[];value?:string;inherited:boolean;standardOnly:boolean;disabled?:boolean;onSelect:(item:ModuleCatalogItem,inherit:boolean)=>void}){
 const available=items.filter(item=>!standardOnly||(item.spec.kind??'standard')==='standard');
 const selected=available.find(item=>item.id===value);
 const fallback=projectDefaultModule(items,standardOnly),inheritValue='@project-default';
 return <section className="module-picker">
  <div className="element-heading"><h2>{tx('组件')}</h2></div>
  <label className="workbench-select-row"><span>{tx('组件型号')}</span>
   <select disabled={disabled} aria-label={tx('当前区域组件')} value={inherited&&fallback?inheritValue:selected?.id??''} onChange={e=>{const inherit=e.target.value===inheritValue;const item=inherit?fallback:available.find(x=>x.id===e.target.value);if(item)onSelect(item,inherit);}}>
    {fallback&&<option value={inheritValue}>{tx('跟随项目默认 · {0}',fallback.name)}</option>}
    {!selected&&<option value="" disabled>{tx('请选择组件')}</option>}
    {available.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select>
  </label>
 </section>;
}
