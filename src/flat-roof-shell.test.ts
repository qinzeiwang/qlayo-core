import {describe,it,expect} from 'vitest';
import {flatRoofShell} from './flat-roof-shell';
import {signedArea,type Footprint} from './polygon';

export function auditShell(roof:Footprint,height=12,wall=1.2){
 const s=flatRoofShell(roof,height,wall),p=s.geometry.getAttribute('position');
 const edges=new Map<string,number>(),triangles=new Set<string>();let volume=0,minArea=Infinity;
 const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>n.toFixed(5)).join(',');
 for(let i=0;i<p.count;i+=3){
  const keys=[key(i),key(i+1),key(i+2)];
  const t=[...keys].sort().join('|');expect(triangles.has(t),'duplicate triangle').toBe(false);triangles.add(t);
  for(let k=0;k<3;k++){const e=[keys[k],keys[(k+1)%3]].sort().join('|');edges.set(e,(edges.get(e)??0)+1);}
  const a=[p.getX(i),p.getY(i),p.getZ(i)],b=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)],c=[p.getX(i+2),p.getY(i+2),p.getZ(i+2)];
  const u=b.map((n,k)=>n-a[k]),v=c.map((n,k)=>n-a[k]);
  minArea=Math.min(minArea,Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2);
  volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
 }
 expect([...edges.values()].every(n=>n===2),'closed two-manifold surface').toBe(true);
 expect(minArea,'no degenerate faces').toBeGreaterThan(1e-9);
 const outerArea=Math.abs(signedArea(s.outer)),innerArea=Math.abs(signedArea(s.inner));
 expect(volume,'outward normals and recessed roof volume').toBeCloseTo(outerArea*height+(outerArea-innerArea)*wall,1);
 s.geometry.dispose();s.roofGeometry.dispose();return s;
}
describe('continuous flat-roof shell',()=>{
 it('forms one closed rectangle with mitered corners and no facade roof-level seam',()=>{
  const s=auditShell({width:48,depth:24});expect(s.thickness).toBe(.2);
  expect(s.inner[0].x).toBeCloseTo(s.outer[0].x+.2);
  for(const p of s.outer)expect(s.inner.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<.2)).toBe(false);
 });
 it('handles concave L corners',()=>auditShell({width:20,depth:20,outline:[{x:-10,z:-10},{x:10,z:-10},{x:10,z:0},{x:0,z:0},{x:0,z:10},{x:-10,z:10}]}));
 it('handles U-shaped recessed corners and reversed winding',()=>{
  const outline=[{x:-10,z:-10},{x:10,z:-10},{x:10,z:10},{x:5,z:10},{x:5,z:-5},{x:-5,z:-5},{x:-5,z:10},{x:-10,z:10}];
  auditShell({width:20,depth:20,outline});auditShell({width:20,depth:20,outline:outline.reverse()});
 });
 it('removes collinear outline vertices without leaving T junctions',()=>auditShell({width:20,depth:20,outline:[{x:-10,z:-10},{x:0,z:-10},{x:10,z:-10},{x:10,z:10},{x:-10,z:10}]}));
 it('has a closed roof when parapet height is zero',()=>auditShell({width:20,depth:10},9,0));
 it('allows a small recessed area below the engineering minimum footprint area',()=>auditShell({width:1,depth:1},3,.2));
 it('closes acute mitered corners',()=>auditShell({width:20,depth:20,outline:[{x:-10,z:-10},{x:10,z:-10},{x:-9,z:10}]}));
 it('reduces only visual thickness for a narrow notch instead of self-intersecting',()=>{
  const s=auditShell({width:20,depth:20,outline:[{x:-10,z:-10},{x:10,z:-10},{x:10,z:10},{x:9.7,z:10},{x:9.7,z:-5},{x:-10,z:-5}]});
  expect(s.thickness).toBeLessThan(.2);
 });
});
