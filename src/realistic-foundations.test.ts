import {describe,it,expect} from 'vitest';
import {Vector3,Quaternion} from 'three';
import {instanceData} from './realistic';
import {geometry,initial,type PVArray} from './domain';
const array=(rows:number,columns=6):PVArray=>({...initial,id:'test',name:'test',rows,columns,connectedRows:true});
const position=(m:any)=>new Vector3().setFromMatrixPosition(m);
describe('flat roof foundations',()=>{
 for(const rows of [1,2,3])it(`${rows} connected module rows use ${Math.max(2,rows)} foundation rows`,()=>{
  const data=instanceData([array(rows)]);
  const points=data.pads.map(p=>position(p.matrix));
  expect(new Set(points.map(p=>p.z)).size).toBe(Math.max(2,rows));
  const xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b);
  expect(xs.length).toBeGreaterThanOrEqual(2);
  for(let i=1;i<xs.length;i++)expect(xs[i]-xs[i-1]).toBeLessThanOrEqual(2+1e-9);
  for(const pad of data.pads){
   const p=new Vector3(),s=new Vector3();pad.matrix.decompose(p,new Quaternion(),s);
   expect(s.toArray()).toEqual([.4,.3,.4]);expect(p.y).toBe(.15);
  }
 });
 it('places four portrait modules on three columns and sets back the pad edges in both axes',()=>{
  const a=array(1,4),g=geometry(a),points=instanceData([a]).pads.map(p=>position(p.matrix));
  const xs=[...new Set(points.map(p=>p.x))];
  const zs=[...new Set(points.map(p=>p.z))];
  expect(xs).toHaveLength(3);
  expect(points).toHaveLength(6);
  expect(xs.slice(1).map((x,i)=>Math.round((x-xs[i])*1000))).toEqual([1950,1940]);
  expect(g.width/2-Math.max(...xs)-.2).toBeCloseTo(.153,8);
  expect(g.depth/2-Math.max(...zs)-.2).toBeCloseTo(.15,8);
  expect(g.depth/2+Math.min(...zs)-.2).toBeCloseTo(.15,8);
 });
 it('keeps two columns even for a single module and clears pads at zero tilt',()=>{
  const data=instanceData([{...array(1,1),tilt:0}]);
  expect(data.pads).toHaveLength(4);
  expect(position(data.frames[0].matrix).y-.035/2).toBeGreaterThan(.3);
 });
 it('preserves independent rows in legacy arrays',()=>{
  expect(instanceData([{...array(3,1),connectedRows:false}]).pads).toHaveLength(12);
 });
 it('transforms pad elevation and orientation with the array',()=>{
  const a=array(2);const base=instanceData([a]).pads;
  const moved=instanceData([{...a,x:10,z:20,elevation:4,azimuth:90}]).pads;
  base.forEach((p,i)=>{
   const expected=position(p.matrix).applyAxisAngle(new Vector3(0,1,0),Math.PI/2).add(new Vector3(10,4,20));
   expect(position(moved[i].matrix).distanceTo(expected)).toBeLessThan(1e-10);
  });
 });
 it('does not add flat roof pads to pitched surfaces',()=>{
  expect(instanceData([{...array(2),surface:{sx:.1,sz:0,height:1}}]).pads).toHaveLength(0);
 });
});

it('uses two upward-opening, full-width purlins per row and inset rafters along the tilt',()=>{
 const vertical=new Vector3(0,1,0);
 for(const tilt of [0,20,60])for(const azimuth of [90,180,247]){
  const a={...array(3,4),tilt,azimuth},g=geometry(a),data=instanceData([a]);
  const along=new Vector3(0,-Math.sin(g.tilt),Math.cos(g.tilt)).applyAxisAngle(vertical,g.yaw);
  const across=new Vector3(1,0,0).applyAxisAngle(vertical,g.yaw);
  const up=new Vector3(0,Math.cos(g.tilt),Math.sin(g.tilt)).applyAxisAngle(vertical,g.yaw);
  const axis=(m:import('three').Matrix4,column:number)=>new Vector3().setFromMatrixColumn(m,column);
  expect(data.purlins).toHaveLength(2*a.rows);
  for(const {matrix} of data.purlins){
   expect(axis(matrix,1).distanceTo(across.clone().multiplyScalar(g.width+.30))).toBeLessThan(1e-8);
   expect(axis(matrix,2).negate().normalize().dot(up)).toBeCloseTo(1);
  }
  expect(data.rafters.length).toBe(data.pads.length/a.rows);
  expect(data.channels).toHaveLength(data.pads.length);
  for(const {matrix} of data.rafters){
   expect(axis(matrix,1).normalize().dot(along)).toBeCloseTo(1);
   expect(axis(matrix,2).negate().normalize().dot(up)).toBeCloseTo(1);
   expect(axis(matrix,1).length()).toBeLessThanOrEqual(g.depth/Math.cos(g.tilt)-.20+1e-9);
   expect(position(matrix).dot(up)).toBeLessThan(position(data.purlins[0].matrix).dot(up));
   const horizontal=along.clone().setY(0).normalize();
   for(const y of [-.5,.5])for(const z of [-.5,.5]){
    expect(Math.abs(new Vector3(0,y,z).applyMatrix4(matrix).dot(horizontal))).toBeLessThan(g.depth/2);
   }
  }
 }
});
