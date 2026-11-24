import {defaultModuleCatalog,parseModuleCatalog,sameModule,type ModuleCatalogItem} from './module-library';
import {tx} from './i18n';
import {newId} from './ids';
const key='pvlane.module-library.v1';
export type SavedModuleLibrary={items:ModuleCatalogItem[];defaultId:string};
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>;
export function readModuleLibrary(storage?:Storage):SavedModuleLibrary{try{const raw=(storage??localStorage).getItem(key);if(raw){const v=JSON.parse(raw),items=parseModuleCatalog(v.items,[]);if(!items.some(i=>i.id===v.defaultId))throw Error();return {items,defaultId:v.defaultId};}}catch{/* Invalid or unavailable storage falls back to built-in modules. */}const items=defaultModuleCatalog();return {items,defaultId:items[0].id};}
export function saveModuleLibrary(value:SavedModuleLibrary,storage?:Storage){const items=parseModuleCatalog(value.items,[]);if(!items.some(i=>i.id===value.defaultId))throw Error(tx('请选择新项目默认组件'));(storage??localStorage).setItem(key,JSON.stringify({items,defaultId:value.defaultId}));}
export const sameLibraryModule=(a:ModuleCatalogItem,b:ModuleCatalogItem)=>a.name===b.name&&sameModule(a.spec,b.spec);

/** Store a separate copy for future projects. IDs and references in open projects are independent. */
export function setModuleShared(item:ModuleCatalogItem,shared:boolean,storage?:Storage):SavedModuleLibrary{
 const current=readModuleLibrary(storage);
 const matching=current.items.filter(candidate=>sameLibraryModule(candidate,item));
 if(shared===!!matching.length)return current;
 const items=shared
  ?[...current.items,{...item,id:newId(),spec:{...item.spec}}]
  :current.items.filter(candidate=>!matching.includes(candidate));
 const available=items.length?items:defaultModuleCatalog();
 const next={items:available,defaultId:available.some(candidate=>candidate.id===current.defaultId)?current.defaultId:available[0].id};
 saveModuleLibrary(next,storage);
 return next;
}
export function mergeModuleLibrary(project:ModuleCatalogItem[],saved:ModuleCatalogItem[]){const result=structuredClone(project);for(const item of saved){if(result.some(i=>sameModule(i.spec,item.spec)))continue;let id=item.id;while(result.some(i=>i.id===id))id+='-saved';result.push({...item,id,spec:{...item.spec}});}return parseModuleCatalog(result,[]);}
