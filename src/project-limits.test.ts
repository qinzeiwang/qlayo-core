import {expect,it} from 'vitest';
import {initial} from './domain';
import {newRoof,totals} from './roof-project';
import {parseWorkspace} from './workspace-file';
import {autoLayout} from './auto-layout';

const workspace=(roofs:ReturnType<typeof newRoof>[])=>JSON.stringify({version:3,name:'上限验证',roofs,activeId:roofs[0].id,solarHour:11,backgroundColor:'#dce5ec',groundColor:'#c7cccb'});
it('10000 块项目可以保存后重新解析，10001 块跨屋面项目拒绝导入',()=>{
 const first=newRoof();first.arrays=[{...initial,id:'a',name:'a',rows:100,columns:100}];
 expect(totals(parseWorkspace(workspace([first])).roofs).count).toBe(10000);
 const second=newRoof('屋面 2');second.arrays=[{...initial,id:'b',name:'b',rows:1,columns:1}];
 expect(()=>parseWorkspace(workspace([first,second]))).toThrow('10000');
 first.arrays.push({...initial,id:'c',name:'c',rows:1,columns:1});
 expect(()=>parseWorkspace(workspace([first]))).toThrow('阵列数据无效');
});
it('布置遵守剩余项目容量，容量用尽返回零且不超额',()=>{
 const options={...newRoof().layoutOptions,tilt:0,edge:0,gap:0};
 const full=autoLayout({width:200,depth:200},[],options);
 expect(full.count).toBe(10000);
 const remaining=autoLayout({width:200,depth:200},[],{...options,limit:17});
 expect(remaining.count).toBe(17);
 expect(autoLayout({width:200,depth:200},[],{...options,limit:0}).count).toBe(0);
 expect(()=>autoLayout({width:200,depth:200},[],{...options,limit:10001})).toThrow();
});
