import {expect,it} from 'vitest';
import {autoLayout,layoutDirection,tableSpacing} from './auto-layout';
import {defaultArrays,defaultModule,detect} from './domain';
import {insidePolygon} from './polygon';
import {newRoof,worldArray} from './roof-project';
import {panelOrientation} from './project-statistics';
import {layoutMarker,layoutMarkerBadge} from './layout-direction';
import {recommendedGap} from './solar';
it('四个朝向的布置、间距、报告法线和画布箭头一致',()=>{
 const r={...newRoof(),yaw:.3};
 for(let direction=0;direction<4;direction++){
 const options={...r.layoutOptions,direction,tilt:20,wallHeight:0,module:{...defaultModule,kind:'standard' as const},roofYaw:r.yaw};
 const result=autoLayout(r.roof,[],options);expect(result.count).toBeGreaterThan(0);expect(detect(result.arrays,[],r.roof)).toEqual([]);
 const expected=((180+90*direction-r.yaw*180/Math.PI)%360+360)%360;
 for(const a of result.arrays)expect(panelOrientation(worldArray(a,r)).azimuth).toBeCloseTo(expected);
 expect(tableSpacing(options).actual).toBe(recommendedGap(defaultModule.length,20,expected));
 const marker=layoutMarker({...r,layoutOptions:options})!,[x,z,bx,bz]=marker.segments[0];
 expect((Math.atan2(bx-x,-(bz-z))*180/Math.PI+360)%360).toBeCloseTo(expected);
 }
 expect(layoutDirection({portrait:true})).toBe(0);expect(layoutDirection({portrait:false})).toBe(1);
});
it('车棚起排边翻转，标记与起排位置同向',()=>{
 const r={...newRoof(),carport:{double:true,percent:10,clearance:2.5,startEnd:'start' as const}};
 const a=layoutMarker(r)!,b=layoutMarker({...r,carport:{...r.carport,startEnd:'end'}})!;
 expect(a.segments[3][1]).toBe(-r.roof.depth/2);expect(b.segments[3][1]).toBe(r.roof.depth/2);
 expect(a.segments[0][3]).toBeGreaterThan(a.segments[0][1]);expect(b.segments[0][3]).toBeLessThan(b.segments[0][1]);
 expect(layoutMarker({...r,carport:undefined,pitch:{kind:'single',axis:'z',high:1,percent:10,eave:3.5}})).toBeUndefined();
});

it('组件朝向标记随屋面尺寸按相同比例缩放',()=>{
 const r={...newRoof(),x:0,z:0,yaw:0,roof:{width:30,depth:20}};
 const a=layoutMarker(r)!,b=layoutMarker({...r,roof:{width:60,depth:40}})!;
 expect(b.outline).toEqual(a.outline!.map(s=>s.map(v=>v*2)));
});

it('Core 箭头的圆底最多 28 px，且保持原来的朝向',()=>{
 const marker=layoutMarker(newRoof())!;
 const near=layoutMarkerBadge(marker,.02)!,far=layoutMarkerBadge(marker,1)!;
 expect(near.radius/.02*2).toBeCloseTo(28,8);
 expect(far.radius*2).toBeLessThan(28);
 const [x,z,bx,bz]=near.segments[0],original=marker.segments[0];
 expect(Math.atan2(bz-z,bx-x)).toBeCloseTo(Math.atan2(original[3]-original[1],original[2]-original[0]),8);
});

it('方向圆标随阵列移动，且整个圆标留在 L 形屋面轮廓内',()=>{
 const r=newRoof();
 const array={...defaultArrays()[0],rows:1,columns:1,x:7,z:-2};
 const outline=[{x:-10,z:-10},{x:10,z:-10},{x:10,z:0},{x:0,z:0},{x:0,z:10},{x:-10,z:10}];
 r.roof={width:20,depth:20,outline};
 r.arrays=[array];
 const single=layoutMarkerBadge(layoutMarker(r,true)!,.1)!;
 expect(single.cx).toBeCloseTo(7);
 expect(single.cz).toBeCloseTo(-2);
 r.arrays=[array,{...array,id:'other',x:-2,z:7}];
 const concave=layoutMarkerBadge(layoutMarker(r,true)!,.5)!;
 expect(insidePolygon({x:concave.cx,z:concave.cz},outline)).toBe(true);
 for(let i=0;i<32;i++){
  const angle=i*Math.PI/16;
  expect(insidePolygon({x:concave.cx+concave.radius*Math.cos(angle),z:concave.cz+concave.radius*Math.sin(angle)},outline)).toBe(true);
 }
});

it('L 形屋面的阵列中心贴近内角时，圆标向内移动并保持完整大小',()=>{
 const r=newRoof();
 r.roof={width:40,depth:40,outline:[{x:-20,z:-20},{x:20,z:-20},{x:20,z:0},{x:0,z:0},{x:0,z:20},{x:-20,z:20}]};
 const a={...defaultArrays()[0],rows:1,columns:1};
 r.arrays=[{...a,x:10,z:-10},{...a,id:'other',x:-10,z:9}];
 const unit=.2,marker=layoutMarker(r,true)!,badge=layoutMarkerBadge(marker,unit)!;
 expect(badge.radius*2/unit).toBeCloseTo(28);
 expect(Math.hypot(badge.cx,badge.cz+.5)).toBeLessThan(8);
 expect(Math.hypot(badge.cx,badge.cz+.5)).toBeGreaterThan(1);
});
