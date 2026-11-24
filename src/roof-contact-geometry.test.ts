import {describe,expect,it} from 'vitest';
import {corners,type SceneSite} from './domain';
import {roofHeight} from './pitched-roof';
import {contactSolid,roofContact,roofKeepout,roofObstacle,trimHostEdges,trimHostTop} from './roof-contact-geometry';

const roof:SceneSite={id:'roof',name:'屋面',x:0,z:0,yaw:0,width:48,depth:24,flatHeight:12,wallHeight:1.2};
const corner={id:'roof/contact',name:'要素',x:22,z:10,yaw:0,width:4,depth:4,height:3.4,baseHeight:8.5};
const vertices=(data:number[])=>Array.from({length:data.length/3},(_,i)=>data.slice(i*3,i*3+3));

describe('3D roof contact geometry',()=>{
 it('cuts both coplanar sides at a flat roof corner and retains the exposed top',()=>{
  const solid=contactSolid(corner,roof),contact=roofContact(roof);
  const geometry=roofObstacle(contact,solid);
  for(const points of [vertices(geometry.faces),vertices(geometry.edges)]){
   const aligned=points.filter(([x,,z])=>x===24||z===12);
   expect(aligned.length).toBeGreaterThan(0);
   expect(aligned.every(([,y])=>y>=9.7-1e-6)).toBe(true);
   expect(aligned.some(([,y])=>y===solid.top)).toBe(true);
  }
  expect(trimHostEdges([-24,9.7,12,24,9.7,12],[solid])).toEqual([-24,9.7,12,20,9.7,12]);
  expect(trimHostEdges([24,9.7,-12,24,9.7,12],[solid])).toEqual([24,9.7,-12,24,9.7,8]);
 });

 it('keeps the base line of a detached obstacle and removes coplanar coping from a low top',()=>{
  const detached=contactSolid({...corner,x:0,z:0},roof);
  expect(vertices(roofObstacle(roofContact(roof),detached).edges).some(([,y])=>y===detached.bottom)).toBe(true);
  const low=contactSolid({...corner,height:roof.wallHeight},roof),verticesOnTop=vertices(roofObstacle(roofContact(roof),low).faces).filter(([,y])=>y===low.top);
  expect(verticesOnTop.length).toBeGreaterThan(0);
  expect(Math.max(...verticesOnTop.map(([x])=>x))).toBeCloseTo(23.8);
 });

 it('removes the covered coping face and lets it own an exactly coplanar top',()=>{
  const face=[20,9.7,11.8,20,9.7,12,24,9.7,12];
  expect(trimHostTop(face,[contactSolid(corner,roof)])).toEqual([]);
  expect(trimHostTop(face,[contactSolid({...corner,height:1.2},roof)])).toEqual(face);
 });

 it('uses the local roof direction even when world coordinates are rotated',()=>{
  const yaw=Math.PI/2,site={...roof,x:40,z:50,yaw};
  const solid=contactSolid({...corner,x:50,z:28,yaw},site);
  expect(solid.x).toBeCloseTo(22);
  expect(solid.z).toBeCloseTo(10);
  expect(vertices(roofObstacle(roofContact(site),solid).faces).some(([x,y])=>Math.abs(x-24)<1e-7&&y<9.7-1e-6)).toBe(false);
 });

 it('clips a flat keep-out zone to the same inner edge for fill and lines',()=>{
  const geometry=roofKeepout(roofContact(roof),corners(corner));
  for(const points of [vertices(geometry.faces),vertices(geometry.edges)]){
   expect(Math.max(...points.map(([x])=>x))).toBeCloseTo(23.8);
   expect(Math.max(...points.map(([, ,z])=>z))).toBeCloseTo(11.8);
  }
 });

 it('does not fill the missing corner of a concave roof',()=>{
  const site={...roof,width:20,depth:20,wallHeight:0,outline:[
   {x:-10,z:-10},{x:10,z:-10},{x:10,z:0},{x:0,z:0},{x:0,z:10},{x:-10,z:10},
  ]};
  const data=roofKeepout(roofContact(site),corners({...corner,x:1,z:1,width:6,depth:6}));
  const points=vertices(data.faces);
  let area=0;
  for(let i=0;i<points.length;i+=3){
   const [a,b,c]=points.slice(i,i+3);
   area+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;
  }
  expect(area).toBeCloseTo(20);
 });

 it('splits a gable decal at the ridge without an internal ridge outline',()=>{
  const pitch={kind:'gable',axis:'z',high:-1,percent:18,eave:8} as const,site={...roof,pitch};
  const geometry=roofKeepout(roofContact(site),corners({...corner,x:0,z:0,width:10,depth:8}));
  const edges=vertices(geometry.edges);
  expect(edges.some(([, ,z])=>z===0)).toBe(true);
  for(let i=0;i<edges.length;i+=2)expect(edges[i][2]===0&&edges[i+1][2]===0).toBe(false);
  for(const [x,y,z] of vertices(geometry.faces))expect(y-roofHeight(site,pitch,x,z)).toBeCloseTo(.031);
 });
});
