import {loadAccount} from './account';
import {newId} from './ids';
import {projectStatistics} from './project-statistics';
import {drawLayoutRaster} from './layout-raster';
import type {WorkspaceFile} from './workspace-file';
import {tx} from './i18n';

/** Auto-saved projects. Logged in to the Qlayo server: saved on the server (server/projects.mjs), all of the user's projects.
 * Without login (Vite dev): this browser's IndexedDB, small summaries for the home page list and full project text in a second store, newest 8 kept. */
export type RecentProject={id:string;name:string;address:string;capacity:number;regions:number;updatedAt:number;fileName?:string;planThumbnail?:string};
export const recentLimit=8;
const dbName='pvlane',summaries='recent',files='recent-files',currentKey='pvlane.current-project';

export const newProjectId=newId;
export function resolveProjectName(name:string,fileName?:string){
 const title=name.trim();
 if(title&&title!=='未命名项目'&&title!=='Untitled project')return title;
 return fileName?.replace(/\.json$/i,'').trim()||tx('未命名项目');
}
export function summarize(id:string,p:WorkspaceFile,updatedAt:number,fileName?:string):RecentProject{
 const roofs=p.hasRegions===false?[]:p.roofs;
 return {id,name:resolveProjectName(p.name,fileName),address:p.address??'',capacity:projectStatistics(roofs).total.capacity,regions:roofs.length,updatedAt,fileName};
}
function savedSummary(id:string,p:WorkspaceFile,fileName?:string):RecentProject{
 const summary=summarize(id,p,Date.now(),fileName);
 if(summary.regions){
  try{
   const thumbnail=drawLayoutRaster(p,240);
   if(thumbnail.length<=40000)summary.planThumbnail=thumbnail;
  }catch{/* The saved project is usable even without a thumbnail. */}
 }
 return summary;
}
/** Newest first; everything after the first `limit` is to be removed. */
export function splitRecent(items:RecentProject[],limit=recentLimit){
 const sorted=[...items].sort((a,b)=>b.updatedAt-a.updatedAt);
 return {keep:sorted.slice(0,limit),drop:sorted.slice(limit)};
}
/** "14:20" for today, "10月6日" this year, "2025年10月6日" before. */
export function formatSavedTime(t:number,now=Date.now()){
 const d=new Date(t),n=new Date(now),pad=(v:number)=>String(v).padStart(2,'0');
 if(d.toDateString()===n.toDateString())return tx('今天 {0}:{1}',pad(d.getHours()),pad(d.getMinutes()));
 return d.getFullYear()===n.getFullYear()?tx('{0}月{1}日',d.getMonth()+1,d.getDate()):tx('{0}年{1}月{2}日',d.getFullYear(),d.getMonth()+1,d.getDate());
}

let opening:Promise<IDBDatabase>|undefined;
function db(){
 opening??=new Promise((resolve,reject)=>{
  const r=indexedDB.open(dbName,1);
  r.onupgradeneeded=()=>{r.result.createObjectStore(summaries,{keyPath:'id'});r.result.createObjectStore(files);};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>{opening=undefined;reject(r.error);};
 });
 return opening;
}
function done(t:IDBTransaction){return new Promise<void>((resolve,reject)=>{t.oncomplete=()=>resolve();t.onerror=t.onabort=()=>reject(t.error);});}
function result<T>(r:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}

/** True when projects live on the server. */
export const savedOnServer=async()=>!!await loadAccount();
async function api<T>(url:string,init?:RequestInit):Promise<T>{
 const r=await fetch(url,init),body=await r.json().catch(()=>null);
 if(!r.ok)throw new Error(body?.error??tx('服务器错误 {0}',r.status));
 return body as T;
}
const lastSaved=new Map<string,string>();

export async function listRecent():Promise<RecentProject[]>{
 let items:RecentProject[];
 if(await savedOnServer())items=await api<RecentProject[]>('/api/projects');
 else{
  const store=(await db()).transaction(summaries).objectStore(summaries);
  items=splitRecent(await result(store.getAll() as IDBRequest<RecentProject[]>)).keep;
 }
 return items.map(item=>({...item,name:resolveProjectName(item.name,item.fileName)}));
}
/** Save (or update) one project and drop the oldest beyond the limit. */
export async function saveRecent(id:string,p:WorkspaceFile,fileName?:string){
 if(await savedOnServer()){
  const project=JSON.stringify(p),key=`${fileName??''}\n${project}`;
  if(lastSaved.get(id)===key)return; // nothing changed since the last save
  const body=`{"summary":${JSON.stringify(savedSummary(id,p,fileName))},"project":${project}}`;
  // keepalive lets a small last save finish while the page closes (browsers cap it at 64 KB).
  await api(`/api/projects/${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body,keepalive:body.length<60000});
  lastSaved.set(id,key);return;
 }
 const text=JSON.stringify(p),d=await db(),old=await result(d.transaction(summaries).objectStore(summaries).getAll() as IDBRequest<RecentProject[]>);
 const item=savedSummary(id,p,fileName),{drop}=splitRecent([...old.filter(o=>o.id!==id),item]);
 const t=d.transaction([summaries,files],'readwrite');
 t.objectStore(summaries).put(item);t.objectStore(files).put(text,id);
 for(const o of drop){t.objectStore(summaries).delete(o.id);t.objectStore(files).delete(o.id);}
 await done(t);
}
export async function readRecent(id:string):Promise<{summary:RecentProject;text:string}|undefined>{
 if(await savedOnServer()){
  const r=await fetch(`/api/projects/${encodeURIComponent(id)}`);
  if(r.status===404)return undefined;
  const body=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(body?.error??tx('服务器错误 {0}',r.status));
  return body;
 }
 const t=(await db()).transaction([summaries,files]);
 const [summary,text]=await Promise.all([result(t.objectStore(summaries).get(id) as IDBRequest<RecentProject|undefined>),result(t.objectStore(files).get(id) as IDBRequest<string|undefined>)]);
 return summary&&text?{summary,text}:undefined;
}
export async function removeRecent(id:string){
 if(await savedOnServer()){await api(`/api/projects/${encodeURIComponent(id)}`,{method:'DELETE'});lastSaved.delete(id);return;}
 const t=(await db()).transaction([summaries,files],'readwrite');
 t.objectStore(summaries).delete(id);t.objectStore(files).delete(id);await done(t);
}

/** The project open in this tab. sessionStorage survives F5 but not a new tab, so a refresh reopens it and a new tab starts at home. */
export function currentProjectId(){try{return sessionStorage.getItem(currentKey)??undefined;}catch{return undefined;}}
export function setCurrentProjectId(id?:string){try{if(id)sessionStorage.setItem(currentKey,id);else sessionStorage.removeItem(currentKey);}catch{/* Storage may be unavailable. */}}
