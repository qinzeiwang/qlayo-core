import {createPanelOcclusion} from './panel-occlusion';
import {it,expect} from 'vitest';
import {autoLayout} from './auto-layout';
import {centerLayout} from './center-layout';
import {corners,footprint,detect,initial,type PVArray} from './domain';
import {winterRays} from './solar';
import {shadowZones,hitsShadow} from './shadow-zones';
import {polygonContains} from './polygon';
import {newRoof} from './roof-project';
import {parseWorkspace} from './workspace-file';
const options={portrait:true,tilt:5,edge:.2,gap:1,maxColumns:8,tableRows:4,wallHeight:0};
function bounds(arrays:PVArray[]){const p=arrays.flatMap(a=>corners(footprint(a)));return {x:(Math.min(...p.map(p=>p.x))+Math.max(...p.map(p=>p.x)))/2,z:(Math.min(...p.map(p=>p.z))+Math.max(...p.map(p=>p.z)))/2};}
for(const direction of [0,1,2,3])it(`centres four-row layout in both axes, direction=${direction}`,()=>{
 const roof={width:16.7,depth:10.13},edge=autoLayout(roof,[],{...options,direction}),center=autoLayout(roof,[],{...options,direction,alignment:'center'});
 expect(center.count).toBe(edge.count);expect(center.count).toBeGreaterThan(0);
 expect(bounds(center.arrays).x).toBeCloseTo(0,7);expect(bounds(center.arrays).z).toBeCloseTo(0,7);
 expect(detect(center.arrays,[],roof)).toEqual([]);
 const dx=center.arrays[0].x-edge.arrays[0].x,dz=center.arrays[0].z-edge.arrays[0].z;
 center.arrays.forEach((a,i)=>{expect(a.x-edge.arrays[i].x).toBeCloseTo(dx,9);expect(a.z-edge.arrays[i].z).toBeCloseTo(dz,9);expect(a.rows).toBe(edge.arrays[i].rows);expect(a.columns).toBe(edge.arrays[i].columns);});
 expect(autoLayout(roof,[],{...options,direction,alignment:'edge'})).toEqual(edge);
});
it('limits centring to clear space without moving into an obstacle or shadow',()=>{
 const arrays=[{...initial,id:'a',name:'a',connectedRows:true,rows:4,columns:4,x:-5,z:-2,tilt:5}],roof={width:24,depth:24};
 const obstacles=[{id:'o',name:'o',x:2.2,z:0,width:.5,depth:4,yaw:0,height:.5}];
 for(const zones of [[],shadowZones(roof,obstacles,0)]){
  const result=centerLayout(arrays,roof,.2,obstacles,zones);
  expect(Math.abs(result[0].x)).toBeLessThan(Math.abs(arrays[0].x));expect(Math.abs(result[0].x)).toBeGreaterThan(.1);
  expect(detect(result,obstacles,roof)).toEqual([]);expect(zones.some(z=>hitsShadow(footprint(result[0]),z))).toBe(false);
 }
});
it('respects concave roof margins and parapet shadows after centring',()=>{
 const roof={width:30,depth:24,outline:[{x:-15,z:-12},{x:15,z:-12},{x:15,z:0},{x:0,z:0},{x:0,z:12},{x:-15,z:12}]};
 const obstacles=[{id:'o',name:'o',x:-6,z:-4,width:2,depth:2,yaw:.2,height:1}];
 const opts={...options,alignment:'center' as const,wallHeight:.32,shadowLatitude:31.23},result=autoLayout(roof,obstacles,opts),model=createPanelOcclusion(roof,obstacles,.32,0,winterRays(31.23));
 expect(result.count).toBeGreaterThan(0);expect(detect(result.arrays,obstacles,roof)).toEqual([]);
 for(const a of result.arrays){expect(polygonContains(roof.outline,corners(footprint(a)),.2)).toBe(true);expect(model.blocked(a)).toBe(false);}
});
it('centres capped layouts and preserves alignment on save/reopen',()=>{
 const r=newRoof();r.roof={width:100,depth:100};r.layoutOptions={...options,alignment:'center',limit:10};
 const result=autoLayout(r.roof,[],r.layoutOptions);expect(result.capped).toBe(true);expect(result.count).toBe(8);expect(bounds(result.arrays).x).toBeCloseTo(0,7);expect(bounds(result.arrays).z).toBeCloseTo(0,7);r.arrays=result.arrays;
 const p={version:3,name:'居中',roofs:[r],activeId:r.id,solarHour:9,backgroundColor:'#ffffff',groundColor:'#dddddd'};
 expect(parseWorkspace(JSON.stringify(p)).roofs[0].layoutOptions.alignment).toBe('center');
 expect(()=>parseWorkspace(JSON.stringify({...p,roofs:[{...r,layoutOptions:{...r.layoutOptions,alignment:'bad'}}]}))).toThrow('对齐');
});

it('balances open space between the perimeter and the facing edge of a keep-out',()=>{
 const roof={width:24,depth:24};
 const arrays=[{...initial,id:'a',name:'a',rows:1,columns:4,x:-7,z:0,tilt:0}];
 const keepout={id:'k',name:'keep-out',kind:'keepout' as const,x:4,z:0,width:4,depth:8,yaw:0,height:0};
 const result=centerLayout(arrays,roof,.2,[keepout],[]);
 expect(bounds(result).x).toBeCloseTo((-11.8+2)/2,7);
 expect(detect(result,[keepout],roof)).toEqual([]);
});
