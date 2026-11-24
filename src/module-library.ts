import {defaultModule,type ModuleSpec,validModule} from './domain';
import {lightModule} from './pitched-roof';
import {tx} from './i18n';
import {en} from './i18n-en';

export type ModuleCatalogItem={id:string;name:string;spec:ModuleSpec};
export const standardModuleId='module-standard-default';
export function projectDefaultModule(items:ModuleCatalogItem[],standardOnly:boolean){
 return items.find(item=>!standardOnly||item.spec.kind!=='lightweight');
}

export const lightweightModuleId='module-lightweight-default';

export function defaultModuleCatalog():ModuleCatalogItem[]{
 return [
  {id:standardModuleId,name:tx('标准组件 {0} Wp',defaultModule.power),spec:{...defaultModule,kind:'standard'}},
  {id:lightweightModuleId,name:tx('轻质组件 {0} Wp',lightModule.power),spec:{...lightModule,kind:'lightweight'}},
 ];
}

export const sameModule=(a:ModuleSpec,b:ModuleSpec)=>
 (a.kind??'standard')===(b.kind??'standard')&&a.power===b.power&&a.length===b.length&&a.width===b.width&&a.gap===b.gap;

/** Modified copies belong to their project, including copies from older files. */
export function isBuiltInModule(item:ModuleCatalogItem){
 const standard=item.id===standardModuleId;
 if(!standard&&item.id!==lightweightModuleId)return false;
 const spec=standard?defaultModule:lightModule;
 const name=standard?'标准组件 {0} Wp':'轻质组件 {0} Wp';
 return sameModule(item.spec,spec)&&[name,en[name]].some(template=>item.name===template.replace('{0}',String(spec.power)));
}

export function catalogFromModules(modules:ModuleSpec[]):ModuleCatalogItem[]{
 const result:ModuleCatalogItem[]=[];
 for(const spec of modules){
  if(result.some(item=>sameModule(item.spec,spec)))continue;
  const kind=spec.kind??'standard';
  result.push({id:`module-${result.length+1}`,name:tx('{0}组件 {1} Wp',kind==='lightweight'?tx('轻质'):tx('标准'),spec.power),spec:{...spec,kind}});
 }
 return result.length?result:defaultModuleCatalog();
}

export function parseModuleCatalog(value:unknown,fallback:ModuleSpec[]):ModuleCatalogItem[]{
 if(value===undefined)return catalogFromModules(fallback);
 if(!Array.isArray(value)||!value.length||value.length>50)throw new Error(tx('组件库数量无效'));
 const items=value as ModuleCatalogItem[];
 if(new Set(items.map(item=>item?.id)).size!==items.length)throw new Error(tx('组件库标识重复'));
 for(const item of items){
  if(!item||typeof item.id!=='string'||!item.id||item.id.includes('/')||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||!item.spec||!validModule(item.spec))throw new Error(tx('组件库参数无效'));
 }
 return items.map(item=>({...item,name:item.name.trim(),spec:{...item.spec,kind:item.spec.kind??'standard'}}));
}
