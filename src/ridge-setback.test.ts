import {it,expect} from 'vitest';
import {pitchedLayout,lightModule,type RoofPitch} from './pitched-roof';
import {autoLayout} from './auto-layout';
import {corners,footprint,type PVArray} from './domain';
import {layoutSignatureFor,projectEdges,roofLayoutEdges} from './layout-state';
import {newRoof} from './roof-project';
import {parseWorkspace} from './workspace-file';

const roof={width:30,depth:20},gable:RoofPitch={kind:'gable',axis:'z',high:1,percent:15,eave:3};
/** Panel corners along the slope (z) and across it (x). */
const span=(arrays:PVArray[])=>{const v=arrays.flatMap(a=>corners(footprint(a)));return {z:v.map(p=>p.z),x:v.map(p=>p.x)};};

it('gable roofs keep the ridge setback at the ridge and the edge setback at the eaves and gables',()=>{
 for(const layout of [
  (o:{edge:number;ridgeEdge?:number})=>pitchedLayout(roof,[],{pitch:gable,module:lightModule,portrait:true,gap:1,...o}).arrays,
  (o:{edge:number;ridgeEdge?:number})=>autoLayout(roof,[],{pitch:gable,portrait:true,tilt:0,gap:1,maxColumns:18,...o}).arrays]){
  const same=span(layout({edge:.5})),wide=span(layout({edge:.5,ridgeEdge:2}));
  expect(Math.min(...wide.z.map(Math.abs))).toBeGreaterThanOrEqual(2-1e-6);
  expect(Math.min(...same.z.map(Math.abs))).toBeLessThan(2);
  for(const s of [same,wide]){expect(Math.max(...s.z.map(Math.abs))).toBeLessThanOrEqual(10-.5+1e-6);expect(Math.max(...s.x.map(Math.abs))).toBeLessThanOrEqual(15-.5+1e-6);}
  expect(layout({edge:.5,ridgeEdge:.5})).toEqual(layout({edge:.5}));
 }
});
it('a single slope keeps the ridge setback at its high side only',()=>{
 const single:RoofPitch={kind:'single',axis:'z',high:-1,percent:15,eave:3};  // high side at z = -10
 const s=span(pitchedLayout(roof,[],{pitch:single,module:lightModule,portrait:true,gap:1,edge:.5,ridgeEdge:3}).arrays);
 expect(Math.min(...s.z)).toBeGreaterThanOrEqual(-10+3-1e-6);
 expect(Math.min(...s.z)).toBeLessThan(-10+3+2.5);
 expect(Math.max(...s.z)).toBeLessThanOrEqual(10-.5+1e-6);
});
it('old projects keep their layout signature; a different ridge only changes pitched roofs',()=>{
 const flat=newRoof('flat'),pitched={...newRoof('pitched'),pitch:gable};
 for(const r of [flat,pitched])expect(layoutSignatureFor(r,{edge:.5,ridge:.5})).toBe(layoutSignatureFor(r,.5));
 expect(layoutSignatureFor(flat,{edge:.5,ridge:2})).toBe(layoutSignatureFor(flat,.5));
 expect(layoutSignatureFor(pitched,{edge:.5,ridge:2})).not.toBe(layoutSignatureFor(pitched,.5));
 expect(projectEdges({globalEdge:.8})).toEqual({edge:.8,ridge:.8});
 expect(projectEdges({globalEdge:.8,globalRidgeEdge:1.5})).toEqual({edge:.8,ridge:1.5});
});

it('resolves per-roof overrides before project defaults and preserves them in project files',()=>{
 const defaults={edge:.5,ridge:1.5};
 const flat={...newRoof('flat'),edgeOverride:0};
 const pitched={...newRoof('pitched'),pitch:gable,edgeOverride:1.2,ridgeEdgeOverride:2};
 const untouched={...newRoof('untouched'),pitch:gable};
 expect(roofLayoutEdges(flat,defaults)).toEqual({edge:0,ridgeEdge:0});
 expect(roofLayoutEdges(pitched,defaults)).toEqual({edge:1.2,ridgeEdge:2});
 expect(roofLayoutEdges(untouched,defaults)).toEqual({edge:.5,ridgeEdge:1.5});
 expect(layoutSignatureFor(pitched,defaults)).toBe(layoutSignatureFor(pitched,{edge:3,ridge:4}));
 expect(layoutSignatureFor(untouched,defaults)).not.toBe(layoutSignatureFor(untouched,{edge:3,ridge:4}));
 const file={version:3,name:'setbacks',globalEdge:.5,globalRidgeEdge:1.5,roofs:[flat,pitched,untouched],
  activeId:flat.id,solarHour:9,backgroundColor:'#ffffff',groundColor:'#eeeeee'};
 expect(parseWorkspace(JSON.stringify(file)).roofs.map(r=>roofLayoutEdges(r,defaults)))
  .toEqual([{edge:0,ridgeEdge:0},{edge:1.2,ridgeEdge:2},{edge:.5,ridgeEdge:1.5}]);
 pitched.ridgeEdgeOverride=21;
 expect(()=>parseWorkspace(JSON.stringify(file))).toThrow('单独设置的屋面边距无效');
});

it('applies a flat roof override to its own panel boundary',()=>{
 const defaults={edge:.5,ridge:1.5};
 const r={...newRoof(),roof,wallHeight:0,edgeOverride:2};
 const options={...r.layoutOptions,tilt:0,wallHeight:0,spacingMode:'manual' as const};
 const standard=autoLayout(roof,[],{...options,...roofLayoutEdges(newRoof(),defaults)});
 const setback=autoLayout(roof,[],{...options,...roofLayoutEdges(r,defaults)});
 expect(setback.count).toBeLessThan(standard.count);
 const placed=span(setback.arrays);
 expect(Math.max(...placed.x.map(Math.abs))).toBeLessThanOrEqual(15-2+1e-6);
 expect(Math.max(...placed.z.map(Math.abs))).toBeLessThanOrEqual(10-2+1e-6);
});
