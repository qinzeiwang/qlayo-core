import {carportPitch,flipCarportSlope} from './roof-direction';
import {it,expect} from 'vitest';
import {carportBoundary,carportPortrait,carportLayout,defaultCarport,validCarport,snapCarportEnd,snapCarportLength} from './carport';
import {defaultModule,geometry,detect,footprint,overlaps} from './domain';
import {carportFromPrevious,newRoof,worldArray} from './roof-project';
import {parseWorkspace} from './workspace-file';
import {layoutSignatureFor,needsLayoutUpdate} from './layout-state';
const options={carport:defaultCarport,module:defaultModule,portrait:true,edge:0,gap:1};
const roof={width:12,depth:10};
it('new carport lengths snap to the selected module pitch and preserve drawing direction',()=>{
 const start={x:10,z:20},end={x:46,z:68},metersPerPixel=.25;
 const target=snapCarportEnd(start,end,defaultModule,metersPerPixel);
 const length=7*(defaultModule.length+defaultModule.gap);
 expect(Math.hypot(target.x-start.x,target.z-start.z)*metersPerPixel).toBeCloseTo(length,10);
 expect((target.x-start.x)/(target.z-start.z)).toBeCloseTo(36/48,10);
 expect(snapCarportLength(length,defaultModule)).toBe(length);
 expect(carportLayout({width:length,depth:12},[],{...options,portrait:false}).count).toBe(35);
 expect(snapCarportEnd(start,start,defaultModule,metersPerPixel)).toBe(start);
});
it('单排横向固定五块，不补残组',()=>{const r=carportLayout(roof,[],options);expect(r.count).toBe(20);expect(r.arrays.every(a=>a.columns===5)).toBe(true);expect(carportLayout({width:5,depth:10},[],options).count).toBe(20);});
it('双排左右各五块，V 形中间低、两边高',()=>{
 const r=carportLayout(roof,[],{...options,carport:{...defaultCarport,double:true}});expect(r.count).toBe(40);expect(r.arrays).toHaveLength(2);
 const [left,right]=r.arrays;expect(left.surface!.sx).toBeLessThan(0);expect(right.surface!.sx).toBeGreaterThan(0);
 for(const a of r.arrays){const g=geometry(a),first=g.panels[0],last=g.panels[4];expect(a.columns).toBe(5);expect((last.y-first.y)*a.surface!.sx).toBeGreaterThan(0);expect(Math.hypot(last.x-first.x,last.y-first.y)).toBeCloseTo(4*(defaultModule.width+defaultModule.gap));}
 expect(detect(r.arrays,[],roof)).toEqual([]);
});
for(const portrait of [true,false])it(`旋转方向后仍满足边界与禁布区域 ${portrait}`,()=>{
 const area={width:20,depth:20},o={id:'k',name:'禁布区',kind:'keepout' as const,x:0,z:0,width:2,depth:3,height:0,yaw:.2};
 const r=carportLayout(area,[o],{...options,portrait,edge:.5,carport:{...defaultCarport,double:true}});
 expect(r.count).toBeGreaterThan(0);expect(detect(r.arrays,[o],area)).toEqual([]);expect(r.arrays.every(a=>!overlaps(footprint(a),o))).toBe(true);expect(r.count%10).toBe(0);
});
it('双排总数上限不能拆成单侧',()=>{const r=carportLayout(roof,[],{...options,carport:{...defaultCarport,double:true},limit:39});expect(r.count).toBe(30);expect(r.capped).toBe(true);});
it('拒绝轻质组件及无效高度',()=>{expect(()=>carportLayout(roof,[],{...options,module:{...defaultModule,kind:'lightweight'}})).toThrow();expect(validCarport({...defaultCarport,clearance:NaN})).toBe(false);});
it('车棚配置、几何、装机量可以随多区域项目往返保存',()=>{
 const r=carportFromPrevious(newRoof(),'车棚 1');r.roof=roof;r.carport={...defaultCarport,double:true};r.arrays=carportLayout(roof,[],{...options,carport:r.carport}).arrays;
 const p={version:3,name:'车棚测试',globalEdge:0,roofs:[r],activeId:r.id,solarHour:9,backgroundColor:'#ffffff',groundColor:'#dddddd'};
 const loaded=parseWorkspace(JSON.stringify(p));expect(loaded.roofs[0].carport).toEqual(r.carport);expect(loaded.roofs[0].arrays).toEqual(r.arrays);
 expect(worldArray(r.arrays[0],{...r,yaw:1}).surface).toEqual(r.arrays[0].surface);
});

for(const double of [false,true])for(const portrait of [false,true])it(`窄区域居中且不限制棚宽 ${double} ${portrait}`,()=>{
 const area=portrait?{width:2,depth:20}:{width:20,depth:2};
 const carport={...defaultCarport,double};
 const r=carportLayout(area,[],{...options,carport,portrait});
 expect(r.count).toBeGreaterThan(0);
 expect(r.arrays.reduce((n,a)=>n+(portrait?a.x:a.z),0)).toBeCloseTo(0);
 expect(detect(r.arrays,[],carportBoundary(area,carport,portrait))).toEqual([]);
 expect(carportPortrait(area)).toBe(portrait);
});

for(const portrait of [true,false])for(const double of [true,false])it(`起排边贴齐且忽略屋面退距和通道 ${portrait} ${double}`,()=>{
 const area=portrait?{width:2,depth:10}:{width:10,depth:2};
 for(const startEnd of ['start','end'] as const){
  const r=carportLayout(area,[],{...options,portrait,edge:8,gap:15,carport:{...defaultCarport,double,startEnd}});
  expect(r.count).toBe(double?40:20);
  const points=r.arrays.flatMap(a=>{const f=footprint(a);return [portrait?f.z-f.depth/2:f.x-f.depth/2,portrait?f.z+f.depth/2:f.x+f.depth/2];});
  const positive=portrait?startEnd==='end':startEnd==='start';
  expect(positive?Math.max(...points):Math.min(...points)).toBeCloseTo(positive?5:-5);
  expect(detect(r.arrays,[],carportBoundary(area,r.arrays.length?{...defaultCarport,double}:undefined,portrait))).toEqual([]);
 }
});
it('起排边保存且兼容旧项目',()=>{
 const r=carportFromPrevious(newRoof(),'车棚');r.carport={...defaultCarport,startEnd:'end'};
 const p={version:3,name:'车棚',globalEdge:.5,roofs:[r],activeId:r.id,solarHour:9,backgroundColor:'#ffffff',groundColor:'#dddddd'};
 expect(parseWorkspace(JSON.stringify(p)).roofs[0].carport?.startEnd).toBe('end');
 expect(validCarport(defaultCarport)).toBe(true);
 expect(validCarport({...defaultCarport,startEnd:'wrong'} as never)).toBe(false);
});

it('单侧坡向翻转保持起排边和装机量，重排仍使用新坡向',()=>{
 for(const portrait of [true,false]){
 const r=carportFromPrevious(newRoof(),'车棚');r.roof=roof;r.layoutOptions={...r.layoutOptions,portrait};r.carport={...defaultCarport,startEnd:'end'};
 r.arrays=carportLayout(roof,[],{...options,portrait,carport:r.carport}).arrays;
 const flipped=flipCarportSlope(r),rebuilt=carportLayout(roof,[],{...options,portrait,carport:flipped.carport!});
 expect(flipped.carport?.startEnd).toBe('end');expect(flipped.carport?.slopeSign).toBe(-1);
 expect(flipped.arrays.map(a=>[a.x,a.z,a.rows,a.columns])).toEqual(r.arrays.map(a=>[a.x,a.z,a.rows,a.columns]));
 expect(flipped.arrays[0].surface!.sx).toBe(-r.arrays[0].surface!.sx);
 expect(rebuilt.arrays[0].surface).toEqual(flipped.arrays[0].surface);
 expect(carportPitch(flipped)?.high).toBe(-1);expect(carportPitch(flipped)?.axis).toBe(portrait?'x':'z');
 expect(flipCarportSlope(flipped).arrays).toEqual(r.arrays);
 r.layoutSignature=layoutSignatureFor(r,0);expect(needsLayoutUpdate(flipCarportSlope(r),0)).toBe(false);
 expect(needsLayoutUpdate(flipCarportSlope({...r,layoutSignature:'old'}),0)).toBe(true);
 const p={version:3,name:'翻坡',globalEdge:0,roofs:[flipped],activeId:r.id,solarHour:9,backgroundColor:'#ffffff',groundColor:'#dddddd'};
 expect(parseWorkspace(JSON.stringify(p)).roofs[0].carport?.slopeSign).toBe(-1);
 }
 expect(validCarport({...defaultCarport,slopeSign:0} as never)).toBe(false);
 const d={...carportFromPrevious(newRoof(),'双排'),carport:{...defaultCarport,double:true}};
 expect(carportPitch(d)).toBeUndefined();expect(flipCarportSlope(d)).toBe(d);
});
