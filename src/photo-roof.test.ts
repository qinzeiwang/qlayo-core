import {describe,it,expect} from 'vitest';
import {Euler,Matrix4,Vector3} from 'three';
import {photoRoofHeight,photoRoofVertices,photoRoofArrays,photoRoofRay} from './photo-roof';
import {fitPhotoCamera} from './photo-camera';
import {newRoof} from './roof-project';
import {pitchedLayout,type RoofPitch} from './pitched-roof';
import type {PhotoEdit} from './photo-match';
const width=30,depth=20;
function fixture(pitch:RoofPitch,mode:'off'|'below'|'above'){
 const rotation=new Matrix4().makeRotationFromEuler(new Euler(2.5,.2,.1)),f=1500,cx=mode==='off'?1000:850,cy=mode==='off'?750:650;
 const project=(q:number[])=>{const v=new Vector3(...q as [number,number,number]).applyMatrix4(rotation).add(new Vector3(2,3,90));return {x:f*v.x/v.z+cx,y:f*v.y/v.z+cy};};
 const Q=[[-15,10], [15,10],[15,-10],[-15,-10]].map(([x,y])=>[x,y,photoRoofHeight(width,depth,pitch,x,-y)]),corners=Q.map(project);
 const base=[-5,3,photoRoofHeight(width,depth,pitch,-5,-3)],top=[...base];top[2]+=6;const foot=[...Q[0]];foot[2]-=10;
 const m:PhotoEdit={width:2000,height:1500,corners,heightCalibration:mode!=='off',heightPoints:mode==='above'?[project(base),project(top)]:[corners[0],project(foot)],heightMeters:mode==='above'?6:10,heightMode:mode==='above'?'above':'below',anchor:0};
 return m;
}
describe('pitched photo matching',()=>{
 for(const kind of ['gable','single'] as const)for(const axis of ['x','z'] as const)for(const mode of ['off','below','above'] as const)for(const high of [-1,1] as const){
  it(`${kind} ${axis} ${mode} ${high}: solves slope-aware geometry`,()=>{const pitch:RoofPitch={kind,axis,high,percent:20,eave:12};const fit=fitPhotoCamera(fixture(pitch,mode),width,depth,pitch);expect(fit.rmse).toBeLessThan(.1);expect(fit.f).toBeCloseTo(1500,0);});
 }
 it('splits the roof at the ridge with upward-facing triangles',()=>{
  for(const axis of ['x','z'] as const){const pitch:RoofPitch={kind:'gable',axis,high:1,percent:20,eave:12};const vertices=photoRoofVertices(width,depth,pitch);expect(vertices.length).toBe(36);const ridge=(axis==='x'?width:depth)*.1;expect(Math.max(...Array.from(vertices).filter((_,i)=>i%3===1))).toBeCloseTo(ridge);
   for(let i=0;i<vertices.length;i+=9){const a=new Vector3().fromArray(vertices,i),b=new Vector3().fromArray(vertices,i+3),c=new Vector3().fromArray(vertices,i+6);expect(b.sub(a).cross(c.sub(a)).y).toBeGreaterThan(0);}
  }
 });
 it('keeps panel elevation relative to the eaves, including roofs above 3.5m',()=>{const r=newRoof();r.roof={width,depth};r.pitch={kind:'gable',axis:'z',high:1,percent:20,eave:12};r.arrays=pitchedLayout(r.roof,[],{pitch:r.pitch,portrait:true,edge:.5,gap:.6}).arrays;expect(r.arrays.length).toBeGreaterThan(0);const arrays=photoRoofArrays(r);arrays.forEach((a,i)=>expect(a.surface!.height).toBeCloseTo(r.arrays[i].surface!.height-8.5));expect(r.arrays[0].surface!.height).toBeGreaterThan(8.5);});
 it('intersects the raised slope rather than the eave plane',()=>{const pitch:RoofPitch={kind:'gable',axis:'z',high:1,percent:20,eave:12};const hit=photoRoofRay([0,3,30],[0,0,-1],width,depth,pitch)!;expect(hit[0]).toBe(0);expect(hit[1]).toBe(3);expect(hit[2]).toBeCloseTo(1.4);});
});
