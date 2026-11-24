import {registerProjectExtension} from './project-extras';
import {MAX_FLAT_TABLE_ROWS} from './project-limits';

export const initialLayoutDefaults={tableRows:1,maxColumns:18,tilt:20,gap:1};
export type ProjectLayoutDefaults=typeof initialLayoutDefaults;
declare module './project-extras' {interface ProjectExtras {layoutDefaults?:ProjectLayoutDefaults}}
function readDefaults(raw:unknown){
 const result={...initialLayoutDefaults};
 if(raw&&typeof raw==='object'){
  for(const [key,min,max,integer] of [['tableRows',1,MAX_FLAT_TABLE_ROWS,true],['maxColumns',1,100,true],['tilt',0,60,false],['gap',0,20,false]] as const){
   const n=(raw as Partial<ProjectLayoutDefaults>)[key];
   if(typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max&&(!integer||Number.isInteger(n)))result[key]=n;
  }
 }
 return result;
}
registerProjectExtension({key:'layoutDefaults',blank:()=>({...initialLayoutDefaults}),read:readDefaults,open:readDefaults});
