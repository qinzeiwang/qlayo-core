/** Project data that add-on modules keep in the project file. Each add-on adds its fields to this
 * interface (declaration merging) and registers a ProjectExtension that makes, reads and saves them.
 * The core never imports an add-on: without one, its fields stay in the file as they are. */
export interface ProjectExtras {}
export type ProjectExtension={
 key:string;
 /** Value for a new project. */
 blank:()=>unknown;
 /** Value before any project is loaded; defaults to `blank`. */
 initial?:()=>unknown;
 /** Reads the field of an opened file; `raw` is undefined when the file has none, and `file` holds the fields read so far.
  * Undefined leaves the field out. */
 read:(raw:unknown,file:Record<string,unknown>)=>unknown;
 /** Value in the open project; `value` is undefined when the file has none. */
 open:(value:unknown)=>unknown;
 /** Value to save; defaults to the value as it is. */
 save?:(value:unknown,roofIds:string[])=>unknown;
 /** Older file fields that `read` replaces; they are removed after reading. */
 legacy?:string[];
 /** The field belongs to the base drawing: a new drawing starts it blank. */
 clearWithBase?:boolean;
};
const extensions:ProjectExtension[]=[];
export function registerProjectExtension(e:ProjectExtension){if(!extensions.some(x=>x.key===e.key))extensions.push(e);}
export const projectExtensions=():readonly ProjectExtension[]=>extensions;
export const initialExtras=()=>Object.fromEntries(extensions.map(e=>[e.key,(e.initial??e.blank)()])) as unknown as ProjectExtras;
export const blankExtras=()=>Object.fromEntries(extensions.map(e=>[e.key,e.blank()])) as unknown as ProjectExtras;
export const newBaseExtras=()=>Object.fromEntries(extensions.filter(e=>e.clearWithBase).map(e=>[e.key,e.blank()])) as Partial<ProjectExtras>;
/** Reads every registered field of a parsed file in place. */
export function readExtras(file:Record<string,unknown>){
 for(const e of extensions){const v=e.read(file[e.key],file);if(v!==undefined)file[e.key]=v;}
 for(const e of extensions)for(const k of e.legacy??[])delete file[k];
}
/** Registered fields take their open value; fields of add-ons that are not loaded are kept as they are. */
export function openExtras(file:Record<string,unknown>,coreKeys:readonly string[]){
 const out:Record<string,unknown>=Object.fromEntries(Object.entries(file).filter(([k])=>!coreKeys.includes(k)));
 for(const e of extensions)out[e.key]=e.open(file[e.key]);
 return out as unknown as ProjectExtras;
}
export function saveExtras(extras:ProjectExtras,roofIds:string[]){
 const out:Record<string,unknown>={...extras as unknown as Record<string,unknown>};
 for(const e of extensions)if(e.save&&e.key in out)out[e.key]=e.save(out[e.key],roofIds);
 return out;
}
