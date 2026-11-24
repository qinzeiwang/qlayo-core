import {expect,it} from 'vitest';
import {photoOutputSize} from './photo-output';
import {photoRoofObjects,photoRoofArrays} from './photo-roof';
import {newRoof} from './roof-project';
import {autoLayout} from './auto-layout';
import {defaultModule} from './domain';
import {defaultSunSettings} from './sun-position';
import {parsePhotoViews,viewsFromLegacy} from './photo-match';
const options={quality:'fine' as const,weather:'sunny' as const,sun:defaultSunSettings(),maxEdge:8192 as const};
it('bounds image size by source, hardware and pixel budget without changing aspect',()=>{
 expect(photoOutputSize(1200,800,options,8192)).toEqual({width:1200,height:800});
 expect(photoOutputSize(12000,3000,options,4096)).toEqual({width:4096,height:1024});
 const size=photoOutputSize(12000,9000,options,16384);
 expect(size.width*size.height).toBeLessThanOrEqual(24000000);
 expect(size.width/size.height).toBeCloseTo(4/3,3);
});
it('renders Core geometry at 4K for a small source while respecting device limits',()=>{
 const coreOptions={...options,maxEdge:4096 as const};
 expect(photoOutputSize(1200,800,coreOptions,8192,true)).toEqual({width:4096,height:2730});
 expect(photoOutputSize(1200,800,coreOptions,2048,true)).toEqual({width:2048,height:1365});
});
it('matches auxiliary building tops and panels in photo-local coordinates',()=>{
 for(const pitched of [false,true]){
  const r=newRoof();r.flatHeight=12;r.yaw=.4;r.x=100;r.z=50;r.roof={width:50,depth:40};
  if(pitched)r.pitch={kind:'gable',axis:'z',high:1,percent:20,eave:12};
  r.obstacles=[{id:'house',name:'平顶建筑',kind:'obstacle',width:16,depth:12,x:0,z:0,yaw:.2,height:3,topLayout:{enabled:true,tilt:10,edge:.5}}];
  r.arrays=autoLayout(r.roof,r.obstacles,{...r.layoutOptions,module:{...defaultModule,kind:'standard'},pitch:r.pitch}).arrays;
  const object=photoRoofObjects(r)[0],upper=photoRoofArrays(r).filter(a=>a.hostObstacleId);
  expect(object.x).toBe(0);expect(object.z).toBe(0);expect(object.yaw).toBe(.2);
  expect(upper.length).toBeGreaterThan(0);
  for(const a of upper)expect(a.elevation).toBeCloseTo(object.baseHeight+object.height);
  expect(object.baseHeight+object.height).toBe(pitched?7:3);
 }
});
it('validates persisted export resolution and keeps old settings compatible',()=>{
 const m={id:'v',roofId:'r',name:'test',url:'data:image/png;base64,AA==',width:1200,height:800,marks:[],roofSignature:'',renderOptions:options};
 expect(parsePhotoViews([m])[0].renderOptions?.maxEdge).toBe(8192);
 expect(()=>parsePhotoViews([{...m,renderOptions:{...options,maxEdge:100000}}])).toThrow();
 expect(()=>parsePhotoViews([{...m,renderOptions:{...options,maxEdge:undefined}}])).not.toThrow();
 const legacy={roofId:'r',name:'test',url:m.url,width:1200,height:800,corners:[],heightPoints:[],heightMeters:3,heightMode:'above',anchor:0,roofSignature:''};
 expect(viewsFromLegacy([{...legacy,renderOptions:{...options,maxEdge:undefined}}])[0].renderOptions?.maxEdge).toBeUndefined();
});
import {photoGlassRoughness} from './photo-material';
it('keeps glass variation subtle and confined to a linear roughness map',()=>{
 const map=photoGlassRoughness(),data=map.image.data as Uint8Array;
 const values=Array.from(data).filter((_,i)=>i%4===1);
 expect(Math.min(...values)).toBeGreaterThanOrEqual(197);
 expect(Math.max(...values)).toBeLessThanOrEqual(225);
 expect(new Set(values).size).toBeGreaterThan(5);
 expect(map.colorSpace).toBe('');map.dispose();
});
