import { newRoof,worldArray,worldObstacle } from './roof-project';
import { parseWorkspace } from './workspace-file';
import { describe,it,expect } from 'vitest';
import { pitchedLayout,defaultPitch,lightModule,roofHeight } from './pitched-roof';
import { corners,footprint,geometry,detect } from './domain';
import { autoLayout } from './auto-layout';
const roof={width:30,depth:20};
const options={pitch:defaultPitch,module:lightModule,portrait:true,edge:.5,gap:1};
describe('坡屋面轻质布置',()=>{
 it('15% 为高差比，单坡两端和中点准确',()=>{expect(roofHeight(roof,defaultPitch,0,-10)).toBe(3);expect(roofHeight(roof,defaultPitch,0,10)).toBe(0);expect(roofHeight(roof,defaultPitch,0,0)).toBe(1.5);});
 for(const axis of ['x','z'] as const)for(const portrait of [true,false])it(`${axis} 坡向 / ${portrait} 排列保持实际尺寸并贴坡`,()=>{
  const p={...defaultPitch,axis},result=pitchedLayout(roof,[],{...options,pitch:p,portrait});
  expect(result.count).toBeGreaterThan(0);expect(detect(result.arrays,[],roof)).toEqual([]);
  for(const a of result.arrays){expect([1,2]).toContain(a.columns);const g=geometry(a),c=Math.cos(g.yaw),s=Math.sin(g.yaw);
   for(const v of g.panels)expect(v.y-.045).toBeCloseTo(roofHeight(roof,p,a.x+v.x*c+v.z*s,a.z-v.x*s+v.z*c),8);
   if(a.rows>1){const b=g.panels[a.columns],first=g.panels[0];expect(Math.hypot(first.x-b.x,first.y-b.y,first.z-b.z)).toBeCloseTo(2.28,8);}
  }
 });
 it('避让坡面日照阴影，同时避开障碍物实体',()=>{
  const obs=[{id:'o',name:'o',x:0,z:0,width:5,depth:5,yaw:0,height:25}];
  const a=autoLayout(roof,obs,{...options,tilt:20,maxColumns:18,wallHeight:5});
  const b=autoLayout(roof,obs.map(o=>({...o,height:1})),{...options,tilt:20,maxColumns:18,wallHeight:0});
  expect(a.count).toBeLessThan(b.count);expect(detect(a.arrays,obs,roof)).toEqual([]);
 });
 for(const axis of ['x','z'] as const)for(const portrait of [true,false])it(`双坡阵列不跨屋脊 ${axis} ${portrait}`,()=>{
  const result=pitchedLayout(roof,[],{...options,pitch:{...defaultPitch,kind:'gable',axis},portrait,edge:0});
  expect(result.count).toBeGreaterThan(0);
  for(const a of result.arrays){const z=corners(footprint(a)).map(p=>p[axis]);expect(Math.min(...z)>=-1e-6||Math.max(...z)<=1e-6).toBe(true);}
 });
 it('双坡轻质组件贴屋脊起排，单坡从高侧起排',()=>{
  const edge=.5,gable=pitchedLayout(roof,[],{...options,edge,pitch:{...defaultPitch,kind:'gable'}});
  const negative=gable.arrays.filter(a=>a.z<0).flatMap(a=>corners(footprint(a)).map(v=>v.z));
  const positive=gable.arrays.filter(a=>a.z>0).flatMap(a=>corners(footprint(a)).map(v=>v.z));
  expect(Math.max(...negative)).toBeCloseTo(-edge,6);
  expect(Math.min(...positive)).toBeCloseTo(edge,6);
  const single=pitchedLayout(roof,[],{...options,pitch:{...defaultPitch,high:1}});
  expect(single.arrays[0].z).toBeGreaterThan(0);
 });
 it('坡屋面与阵列保存重载，拒绝非法坡度',()=>{
  const r=newRoof();r.pitch={...defaultPitch};r.moduleSpec={...lightModule};r.arrays=pitchedLayout(r.roof,[],options).arrays;
  const p={version:3,name:'坡面验证',roofs:[r],activeId:r.id,solarHour:9,backgroundColor:'#ffffff',groundColor:'#bbbbbb'};
  expect(parseWorkspace(JSON.stringify(p)).roofs[0].arrays).toEqual(r.arrays);
  expect(parseWorkspace(JSON.stringify(p)).roofs[0].pitch).toEqual(defaultPitch);
  r.pitch.percent=Infinity;expect(()=>parseWorkspace(JSON.stringify(p))).toThrow();
 });
 it('旋转屋面不改变组件贴坡坐标，障碍物基础覆盖屋面高差',()=>{
  const r=newRoof();r.pitch={...defaultPitch};r.yaw=.7;r.arrays=pitchedLayout(r.roof,[],options).arrays;
  const a=r.arrays[0];expect(worldArray(a,r).surface).toEqual(a.surface);
  const o=worldObstacle({id:'o',name:'o',x:0,z:0,width:2,depth:4,yaw:0,height:1},r);
  expect(o.baseHeight).toBeCloseTo(1.2);expect(o.height).toBeCloseTo(1.6);
 });
 it('奇数上限允许补一个单列组件',()=>{const r=pitchedLayout(roof,[],{...options,limit:5});expect(r.count).toBe(5);expect(r.capped).toBe(true);});
});

it('centers gable layouts parallel to the ridge without moving them away from it',()=>{
 for(const axis of ['x','z'] as const)for(const portrait of [true,false])for(const kind of ['standard','lightweight'] as const){
  const area={width:21.3,depth:17.1},p={...defaultPitch,kind:'gable' as const,axis},ridgeEdge=.65;
  const rules={...options,pitch:p,portrait,module:{...lightModule,kind},ridgeEdge,tilt:20,maxColumns:6};
  const result=autoLayout(area,[],rules),edge=autoLayout(area,[],{...rules,alignment:'edge'});
  const points=result.arrays.flatMap(a=>corners(footprint(a))), parallel=axis==='x'?'z':'x';
  expect(result.count).toBe(edge.count);
  expect(Math.min(...points.map(p=>p[parallel]))+Math.max(...points.map(p=>p[parallel]))).toBeCloseTo(0,5);
  expect(Math.min(...points.filter(p=>p[axis]>0).map(p=>p[axis]))).toBeCloseTo(ridgeEdge,5);
  expect(Math.max(...points.filter(p=>p[axis]<0).map(p=>p[axis]))).toBeCloseTo(-ridgeEdge,5);
 }
});
