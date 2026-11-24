import {expect,it} from 'vitest';
import {createRoofOcclusion} from './array-shadows';
import {autoLayout} from './auto-layout';
import {defaultArrays,defaultModule} from './domain';
import {neighborShadowCasters} from './neighbor-shadows';
import {lightModule} from './pitched-roof';
import {newRoof,type RoofDesign} from './roof-project';
import {winterCheckLines,worldIssues} from './roof-shadows';
import {winterRays,winterSun} from './solar';

const receiver=():RoofDesign=>({...newRoof('低屋面'),roof:{width:24,depth:32},flatHeight:8,wallHeight:0});
const building=()=>({...newRoof('南侧厂房'),roof:{width:24,depth:10},z:24,flatHeight:18,wallHeight:0});

it('projects separate buildings by elevation and flags a shaded module',()=>{
 const roof=receiver(),source=building(),rays=[winterSun(12,39.9)];
 roof.arrays=[{...defaultArrays()[0],x:0,z:8,azimuth:180,rows:1,columns:1,tilt:0,frontHeight:.45}];
 expect(winterCheckLines([roof],rays)).toHaveLength(0);
 const lines=winterCheckLines([roof,source],rays);
 expect(lines.length).toBeGreaterThan(0);
 const north=Math.min(...lines.filter((_,index)=>index%3===2));
 expect(north).toBeCloseTo(19-(18-8-.45)*rays[0].z/rays[0].y,4);
 expect(worldIssues([roof,source],rays)).toEqual(expect.arrayContaining([expect.objectContaining({text:expect.stringContaining(source.name)})]));
 expect(winterCheckLines([roof,{...source,flatHeight:7}],rays)).toHaveLength(0);
 expect(winterCheckLines([roof,{...source,z:400}],rays)).toHaveLength(0);
});

it.each(['flat','gable','lightweight','carport'] as const)('avoids neighbor shadows during %s layout',kind=>{
 const roof=receiver(),source=building(),rays=winterRays(39.9);
 if(kind==='gable'||kind==='lightweight')roof.pitch={kind:'gable',axis:'z',high:-1,percent:10,eave:8};
 if(kind==='carport')roof.carport={double:false,percent:10,clearance:2.5};
 const options={...roof.layoutOptions,spacingMode:'manual' as const,rowGap:.2,shadowLatitude:39.9,wallHeight:0,
  module:kind==='lightweight'?lightModule:defaultModule,pitch:roof.pitch,carport:roof.carport};
 const open=autoLayout(roof.roof,[],options);
 const shaded=autoLayout(roof.roof,[],options,neighborShadowCasters(roof,[roof,source],rays));
 expect(shaded.count).toBeLessThan(open.count);
 const check=createRoofOcclusion(roof,rays,[roof,source]);
 expect(shaded.arrays.some(check.blocked)).toBe(false);
});
