import {describe,expect,it} from 'vitest';
import {createRoofOcclusion} from './array-shadows';
import {blankDrawing} from './base-image';
import {autoLayout} from './auto-layout';
import {recalibrateDrawing} from './drawing-calibration';
import {drawingRegionGeometry} from './drawing-region';
import {corners,defaultModule,detect,footprint,geometry} from './domain';
import {gableCustomShell,gableOuterLoop,gablePlanLines,gableSlopeArea,gableSpanHighlightPositions} from './gable-geometry';
import {layoutSignatureFor,needsLayoutUpdate} from './layout-state';
import {defaultModuleCatalog,defaultSharedModule,lightweightModuleId,standardModuleId} from './module-library';
import {layoutShadowSources,neighborShadowCasters} from './neighbor-shadows';
import {photoRoofRay,photoRoofVertices} from './photo-roof';
import {equalGableSpans,lightModule,maxRoofHeight,roofHeight,splitGableSpans,type RoofPitch} from './pitched-roof';
import {polygonContains,polygonRect} from './polygon';
import {projectStatistics} from './project-statistics';
import {blankDocument,workspaceFromDocument} from './project-document';
import {initialRegionForm} from './region-form';
import {reshapeRegion} from './reshape-region';
import {newRoof,type RoofDesign} from './roof-project';
import {readModuleLibrary} from './saved-module-library';
import {reportReadiness} from './scheme-report';
import {winterRays} from './solar';
import {parseWorkspace} from './workspace-file';

// L-shaped orthogonal factory footprint modeled after the bottom-left building in 多坡屋面.jpg:
// Width 40m (x in [-20, 20]), Depth 36m (z in [-18, 18]), bottom-left 14m × 12m notch removed.
const lOutline=[
 {x:-20,z:-18},{x:20,z:-18},{x:20,z:18},{x:-6,z:18},{x:-6,z:6},{x:-20,z:6},
];
const lFootprint={width:40,depth:36,outline:lOutline};

describe('多边形双坡与连坡屋面',()=>{
 it('连坡重标定后仍能保存重开，实景网格与相机射线使用分跨屋脊',()=>{
  const pitch:RoofPitch={kind:'gable',axis:'z',high:-1,percent:10,eave:8,
   spans:[{start:-18,end:6,percent:10},{start:6,end:18,percent:50}]};
  const draft=blankDocument(readModuleLibrary());
  const r={...draft.roofs[0],roof:lFootprint,pitch};
  const redrawn=drawingRegionGeometry(r,{x:0,z:0,yaw:0,width:80,depth:72});
  expect(redrawn.pitch?.spans).toEqual([{start:-36,end:12,percent:10},{start:12,end:36,percent:50}]);
  const baseImage=blankDrawing();
  const project={...draft,name:'连坡校核',roofs:[r],activeId:r.id,
   hasRegions:true,baseImage};
  const recalibrated=recalibrateDrawing(project,{...baseImage,metersPerPixel:baseImage.metersPerPixel!*2});
  const restored=parseWorkspace(JSON.stringify(workspaceFromDocument(recalibrated))).roofs[0];
  expect(restored.pitch?.spans?.map(s=>[s.start,s.end])).toEqual([[-36,12],[12,36]]);
  const vertices=photoRoofVertices(40,36,pitch,lOutline);
  let area=0;
  for(let i=0;i<vertices.length;i+=9){
   const [ax,,az,bx,,bz,cx,,cz]=vertices.slice(i,i+9);
   area+=Math.abs((bx-ax)*(cz-az)-(bz-az)*(cx-ax))/2;
  }
  expect(area).toBeCloseTo(40*36-14*12);
  expect(photoRoofRay([10,-12,40],[0,0,-1],40,36,pitch)?.[2]).toBeCloseTo(3);
 });

 it('polygonRect 保留画布旋转角 yaw，且世界角点精确还原',()=>{
  const yaw=-22*Math.PI/180;
  const worldPts=lOutline.map(p=>({x:10+p.x*Math.cos(yaw)+p.z*Math.sin(yaw),z:-5-p.x*Math.sin(yaw)+p.z*Math.cos(yaw)}));
  const rect=polygonRect(worldPts,yaw);
  expect(rect.yaw).toBeCloseTo(yaw,8);
  expect(rect.width).toBeCloseTo(40,6);
  expect(rect.depth).toBeCloseTo(36,6);
  const restored=corners(rect);
  worldPts.forEach((p,i)=>{
   expect(restored[i].x).toBeCloseTo(p.x,6);
   expect(restored[i].z).toBeCloseTo(p.z,6);
  });
 });

 it('多边形单跨双坡支持标准与轻质组件布置，组件严格留在轮廓内且贴坡不跨脊',()=>{
  const pitch:RoofPitch={kind:'gable',axis:'z',high:-1,percent:12,eave:8};
  const {ridges,gutters}=gablePlanLines(lFootprint,pitch);
  expect(ridges).toHaveLength(1);
  expect(gutters).toHaveLength(0);
  // Ridge at z=0 spans full width [-20, 20]
  expect(ridges[0][0].x).toBeCloseTo(-20,5);
  expect(ridges[0][1].x).toBeCloseTo(20,5);

  const shell=gableCustomShell(lFootprint,pitch,0);
  expect(shell.top.length).toBeGreaterThan(0);
  expect(shell.walls.length).toBeGreaterThan(0);
  expect(shell.top.every(Number.isFinite)).toBe(true);

  const parapetShell=gableCustomShell(lFootprint,pitch,0.8);
  expect(parapetShell.top.length).toBeGreaterThan(shell.top.length);

  for(const mod of [defaultModule,lightModule]){
   const result=autoLayout(lFootprint,[],{
    portrait:true,tilt:10,edge:.5,ridgeEdge:.5,gap:1,maxColumns:18,tableRows:2,
    spacingMode:'manual',rowGap:.3,pitch,module:mod,wallHeight:0,shadowLatitude:31.2,
   });
   expect(result.count).toBeGreaterThan(0);
   expect(detect(result.arrays,[],lFootprint)).toEqual([]);
   for(const a of result.arrays){
    const cs=corners(footprint(a));
    expect(polygonContains(lOutline,cs,.5-1e-6)).toBe(true);
    const zs=cs.map(p=>p.z);
    expect(Math.max(...zs)<=-.5+1e-5||Math.min(...zs)>=.5-1e-5).toBe(true);
    const g=geometry(a),c=Math.cos(g.yaw),s=Math.sin(g.yaw);
    for(const v of g.panels){
     expect(v.y-.045).toBeCloseTo(roofHeight(lFootprint,pitch,a.x+v.x*c+v.z*s,a.z-v.x*s+v.z*c),6);
    }
   }
  }
 });

 it('L 形多跨连坡屋面：低檐/天沟同高、各跨独立坡度屋脊不同高，且完整布置与统计',()=>{
  const basePitch:RoofPitch={kind:'gable',axis:'z',high:-1,percent:10,eave:8};
  // Cut at z=-6 and z=6 (z=6 matches the exact L-notch horizontal step!)
  const spans=splitGableSpans(lFootprint,basePitch,[-6,6]).map((s,i)=>({...s,percent:[5,15,10][i]}));
  const pitch:RoofPitch={...basePitch,spans};
  expect(spans).toHaveLength(3);

  // Low eaves and interior gutters all sit at exact shared eave elevation (8 - 3.5 = 4.5)
  for(const z of [-18,-6,6,18]){
   expect(roofHeight(lFootprint,pitch,10,z)).toBeCloseTo(4.5,6);
  }
  // Ridges at z=-12, 0, +12 have distinct heights based on independent slopes (5%, 15%, 10% over 6m half-span)
  expect(roofHeight(lFootprint,pitch,10,-12)).toBeCloseTo(4.5+6*0.05,6);
  expect(roofHeight(lFootprint,pitch,10,0)).toBeCloseTo(4.5+6*0.15,6);
  expect(roofHeight(lFootprint,pitch,10,12)).toBeCloseTo(4.5+6*0.10,6);
  expect(maxRoofHeight(lFootprint,pitch)).toBeCloseTo(4.5+6*0.15,6);

  // Clipped ridges & gutters: 3 ridges (bottom one shorter: x in [-6, 20]), 2 gutters
  const {ridges,gutters}=gablePlanLines(lFootprint,pitch);
  expect(ridges).toHaveLength(3);
  expect(gutters).toHaveLength(2);
  expect(ridges[2][0].x).toBeCloseTo(-6,5);
  expect(ridges[2][1].x).toBeCloseTo(20,5);

  // Exact sloped area: span1(40*12)@5% + span2(40*12)@15% + span3(26*12)@10%
  const expectedArea=480*Math.hypot(1,.05)+480*Math.hypot(1,.15)+312*Math.hypot(1,.10);
  expect(gableSlopeArea(lFootprint,pitch)).toBeCloseTo(expectedArea,4);

  // Layout stays inside L outline and respects every ridge & gutter setback
  const res=autoLayout(lFootprint,[],{
   portrait:true,tilt:10,edge:.5,ridgeEdge:.5,gap:1,maxColumns:18,tableRows:2,
   spacingMode:'manual',rowGap:.2,pitch,module:defaultModule,wallHeight:0,shadowLatitude:31.2,
  });
  expect(res.count).toBeGreaterThan(0);
  for(const a of res.arrays){
   const cs=corners(footprint(a));
   expect(polygonContains(lOutline,cs,.5-1e-6)).toBe(true);
   const zs=cs.map(p=>p.z),minZ=Math.min(...zs),maxZ=Math.max(...zs);
   // Must stay inside one half of one span (never cross -12, -6, 0, 6, 12)
   for(const cut of [-12,-6,0,6,12]){
    expect(maxZ<=cut-.5+1e-5||minZ>=cut+.5-1e-5).toBe(true);
   }
  }

  // Save/reload workspace preserves spans & viewRotation
  const r:RoofDesign={...newRoof('连坡厂房'),roof:lFootprint,pitch,arrays:res.arrays};
  const saved={version:3,viewRotation:-14.5,name:'连坡测试',roofs:[r],activeId:r.id,solarHour:10,backgroundColor:'#f0f1f2',groundColor:'#e4e6e7'};
  const parsed=parseWorkspace(JSON.stringify(saved));
  expect(parsed.viewRotation).toBe(-14.5);
  expect(parsed.roofs[0].pitch?.spans).toEqual(spans);

  // Reshaping rescales spans cleanly
  const reshaped=reshapeRegion([r],r.id,{x:0,z:0,yaw:0,width:40,depth:24});
  expect(reshaped[0].pitch?.spans?.[0].start).toBeCloseTo(-12,5);
  expect(reshaped[0].pitch?.spans?.at(-1)?.end).toBeCloseTo(12,5);
 });

 it('连坡高屋脊跨在冬至对相邻低跨产生真实自遮挡并避让',()=>{
  const rect={width:24,depth:30};
  const baseOptions={
   portrait:true,tilt:10,edge:.5,ridgeEdge:.5,gap:1,maxColumns:18,tableRows:1,
   spacingMode:'manual' as const,rowGap:.2,module:defaultModule,wallHeight:0,shadowLatitude:39.9,
  };
  const flatSpans=equalGableSpans(rect,'z',2,5);
  const tallSouthSpans=[{start:-15,end:0,percent:5},{start:0,end:15,percent:60}];
  const lowPitch:RoofPitch={kind:'gable',axis:'z',high:-1,percent:5,eave:8,spans:flatSpans};
  const highSouthPitch:RoofPitch={kind:'gable',axis:'z',high:-1,percent:5,eave:8,spans:tallSouthSpans};

  const unshaded=autoLayout(rect,[],{...baseOptions,pitch:lowPitch});
  const shaded=autoLayout(rect,[],{...baseOptions,pitch:highSouthPitch});
  // North span (z < 0) receives shadow from the much taller south span (z > 0)
  const northCount=(arrs:typeof unshaded.arrays)=>arrs.filter(a=>a.z<0).reduce((s,a)=>s+a.rows*a.columns,0);
  expect(northCount(shaded.arrays)).toBeLessThan(northCount(unshaded.arrays));

  const roof:RoofDesign={...newRoof('高低连坡'),roof:rect,pitch:highSouthPitch,arrays:shaded.arrays,wallHeight:0};
  const check=createRoofOcclusion(roof,winterRays(39.9),[roof]);
  expect(shaded.arrays.some(check.blocked)).toBe(false);
 });
});

describe('障碍建筑与仅作遮挡屋面',()=>{
 it('障碍建筑参与邻栋阴影遮挡，但完全排除出报告就绪校验与项目面积统计',()=>{
  const pvRoof:RoofDesign={...newRoof('屋面 1'),roof:{width:24,depth:24},flatHeight:8,wallHeight:0};
  const obstacleBldg:RoofDesign={...initialRegionForm(newRoof('障碍建筑 1'),'obstacle-building'),z:20,roof:{width:24,depth:10},flatHeight:20};
  expect(obstacleBldg.shadingOnly).toBe(true);
  expect(obstacleBldg.wallHeight).toBe(0);

  const rays=winterRays(39.9);
  const casters=neighborShadowCasters(pvRoof,[pvRoof,obstacleBldg],rays);
  expect(layoutShadowSources([pvRoof,obstacleBldg],false)).toEqual([obstacleBldg]);
  expect(casters.length).toBeGreaterThan(0);

  const open=autoLayout(pvRoof.roof,[],{...pvRoof.layoutOptions,shadowLatitude:39.9,wallHeight:0});
  const shaded=autoLayout(pvRoof.roof,[],{...pvRoof.layoutOptions,shadowLatitude:39.9,wallHeight:0},casters);
  expect(shaded.count).toBeLessThan(open.count);

  const laidOut:RoofDesign={...pvRoof,arrays:shaded.arrays,layoutSignature:''};
  // Obstacle building with 0 arrays is NOT flagged by reportReadiness, nor counted in projectStatistics
  const stats=projectStatistics([laidOut,obstacleBldg]);
  expect(stats.regions).toHaveLength(1);
  expect(stats.regions[0].id).toBe(pvRoof.id);
  expect(stats.total.roofArea).toBeCloseTo(24*24,6);
  expect(reportReadiness([obstacleBldg],.5)).toEqual([]);

  // Workspace persistence preserves shadingOnly and rejects shadingOnly on carports
  const ws={version:3,name:'障碍建筑测试',roofs:[laidOut,obstacleBldg],activeId:laidOut.id,solarHour:10,backgroundColor:'#f0f1f2',groundColor:'#e4e6e7'};
  const parsed=parseWorkspace(JSON.stringify(ws));
  expect(parsed.roofs[1].shadingOnly).toBe(true);
  const bad={...ws,roofs:[{...obstacleBldg,carport:{double:false,percent:10,clearance:2.5}}]};
  expect(()=>parseWorkspace(JSON.stringify(bad))).toThrow();
 });

 it('传入带世界坐标偏移的 SceneSite 时 gableOuterLoop/平面线/子跨高亮/三维壳体均严格保持局部坐标',()=>{
  const pitch:RoofPitch={kind:'gable',axis:'z',high:1,percent:10,eave:8,spans:[
   {start:-15,end:-5,percent:6},
   {start:-5,end:5,percent:18},
   {start:5,end:15,percent:10},
  ]};
  const worldSite={
   id:'site-offset',name:'连坡',x:-75,z:42,yaw:0.35,
   width:24,depth:30,
   outline:[{x:-12,z:-15},{x:12,z:-15},{x:12,z:15},{x:-4,z:15},{x:-4,z:5},{x:-12,z:5}],
  };
  for(const p of gableOuterLoop(worldSite)){
   expect(Math.abs(p.x)).toBeLessThanOrEqual(12.01);
   expect(Math.abs(p.z)).toBeLessThanOrEqual(15.01);
  }
  const {ridges,gutters}=gablePlanLines(worldSite,pitch);
  expect(ridges).toHaveLength(3);
  expect(gutters).toHaveLength(2);
  for(const [a,b] of [...ridges,...gutters]){
   expect(Math.abs(a.x)).toBeLessThanOrEqual(12.01);
   expect(Math.abs(b.x)).toBeLessThanOrEqual(12.01);
   expect(Math.abs(a.z)).toBeLessThanOrEqual(15.01);
   expect(Math.abs(b.z)).toBeLessThanOrEqual(15.01);
  }
  const hi=gableSpanHighlightPositions(worldSite,pitch,1);
  expect(hi.length).toBeGreaterThan(0);
  for(let i=0;i<hi.length;i+=3){
   expect(Math.abs(hi[i])).toBeLessThanOrEqual(12.01);
   expect(Math.abs(hi[i+2])).toBeLessThanOrEqual(15.01);
  }
  const shell=gableCustomShell(worldSite,pitch,0);
  for(let i=0;i<shell.top.length;i+=3){
   expect(Math.abs(shell.top[i])).toBeLessThanOrEqual(12.01);
   expect(Math.abs(shell.top[i+2])).toBeLessThanOrEqual(15.01);
  }
 });

 it('移动或调整障碍建筑高度会自动使受影响屋面的布置签名失效并提示更新布置',()=>{
  const pvRoof:RoofDesign={...newRoof('屋面 1'),roof:{width:24,depth:24},flatHeight:8,wallHeight:0};
  const obstacleBldg:RoofDesign={...initialRegionForm(newRoof('障碍建筑 1'),'obstacle-building'),z:22,roof:{width:20,depth:10},flatHeight:14};
  const casters=neighborShadowCasters(pvRoof,[pvRoof,obstacleBldg]);
  const res=autoLayout(pvRoof.roof,[],{...pvRoof.layoutOptions,wallHeight:0},casters);
  const laidOut:RoofDesign={...pvRoof,arrays:res.arrays,layoutSignature:''};
  laidOut.layoutSignature=layoutSignatureFor(laidOut,.5,[laidOut,obstacleBldg]);
  expect(needsLayoutUpdate(laidOut,.5,[laidOut,obstacleBldg])).toBe(false);
  expect(reportReadiness([laidOut,obstacleBldg],.5,true)).toEqual([]);

  // Raising or shifting the obstacle building invalidates the PV roof layout signature.
  const taller={...obstacleBldg,flatHeight:25};
  expect(needsLayoutUpdate(laidOut,.5,[laidOut,taller])).toBe(true);
  expect(reportReadiness([laidOut,taller],.5,true)).toEqual(['屋面 1']);

  const moved={...obstacleBldg,x:5};
  expect(needsLayoutUpdate(laidOut,.5,[laidOut,moved])).toBe(true);
 });

 it('默认公用组件库仅保留单个 660 Wp 标准组件，并平滑迁移旧版内置组件缓存',()=>{
  const catalog=defaultModuleCatalog();
  expect(catalog).toHaveLength(1);
  expect(catalog[0].spec).toEqual(defaultSharedModule);
  expect(catalog[0].spec.power).toBe(660);
  expect(catalog[0].spec.length).toBe(2.382);
  expect(catalog[0].spec.width).toBe(1.134);

  const mem=new Map<string,string>();
  const storage={getItem:(k:string)=>mem.get(k)??null,setItem:(k:string,v:string)=>{mem.set(k,v);}};
  // Fresh storage returns the single 660 Wp module.
  const fresh=readModuleLibrary(storage);
  expect(fresh.items).toHaveLength(1);
  expect(fresh.items[0].spec.power).toBe(660);

  // Legacy v1 storage containing old built-ins + a custom 700 Wp module strips legacy built-ins and preserves custom.
  mem.set('pvlane.module-library.v1',JSON.stringify({
   defaultId:standardModuleId,
   items:[
    {id:standardModuleId,name:'标准组件 550 Wp',spec:{kind:'standard',width:1.134,length:2.278,power:550,gap:.02}},
    {id:lightweightModuleId,name:'轻质组件 560 Wp',spec:{kind:'lightweight',width:1.2,length:2.26,power:560,gap:.02}},
    {id:'custom-700',name:'自定义 700 Wp',spec:{kind:'standard',width:1.303,length:2.384,power:700,gap:.02}},
   ],
  }));
  const migrated=readModuleLibrary(storage);
  expect(migrated.items).toHaveLength(1);
  expect(migrated.items[0].id).toBe('custom-700');
 });
});
