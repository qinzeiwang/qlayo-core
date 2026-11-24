import {expect,test} from 'vitest';
import {createOrUpdateObstacleArrayGroup,alignRoof,pasteObstacle,pasteRoof,patternObstacle,patternRoof} from './area-tools';
import {corners,type Obstacle} from './domain';
import {layoutSignatureFor,needsLayoutUpdate} from './layout-state';
import {newRoof,roofRect,type RoofDesign} from './roof-project';
const area=(name:string,x:number,z:number,width:number,depth:number,yaw=0):RoofDesign=>({...newRoof(name),x,z,yaw,roof:{width,depth}});
const box=(id:string,x:number,z:number,kind:'obstacle'|'keepout'='obstacle'):Obstacle=>({id,name:(kind==='keepout'?'禁布区':'障碍物')+' 1',kind,x,z,width:1,depth:2,yaw:0,height:kind==='keepout'?0:1});
const bounds=(r:RoofDesign)=>{const ps=corners(roofRect(r));return {x0:Math.min(...ps.map(p=>p.x)),x1:Math.max(...ps.map(p=>p.x)),z0:Math.min(...ps.map(p=>p.z)),z1:Math.max(...ps.map(p=>p.z))};};

test('align moves one area so an edge or centre line meets the other area',()=>{
 const target=area('A',0,0,10,20),moving=area('B',30,7,6,8);
 const at=(edge:Parameters<typeof alignRoof>[2])=>bounds({...moving,...alignRoof(moving,target,edge)});
 expect(at('left').x0).toBeCloseTo(-5);expect(at('right').x1).toBeCloseTo(5);
 expect(at('top').z0).toBeCloseTo(-10);expect(at('bottom').z1).toBeCloseTo(10);
 expect(alignRoof(moving,target,'middle').x).toBeCloseTo(0);expect(alignRoof(moving,target,'center').z).toBeCloseTo(0);
 // Only the aligned direction changes.
 expect(alignRoof(moving,target,'left').z).toBe(7);expect(alignRoof(moving,target,'top').x).toBe(30);
});

test('align follows a turned target along its own axes, and angle copies its turn',()=>{
 const target=area('A',5,5,10,20,Math.PI/6),moving={...area('B',40,0,4,4),yaw:Math.PI/6};
 const p=alignRoof(moving,target,'left'),t=corners(roofRect(target)),m=corners(roofRect({...moving,...p}));
 // The left sides (corner 0 → 3) lie on one line.
 const cross=(a:{x:number;z:number},b:{x:number;z:number},c:{x:number;z:number})=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
 expect(cross(t[0],t[3],m[0])).toBeCloseTo(0);expect(cross(t[0],t[3],m[3])).toBeCloseTo(0);
 expect(alignRoof(area('C',0,0,3,3),target,'angle').yaw).toBe(Math.PI/6);
});

test('pattern copies an area in a row with objects and panels, new ids and names, layout kept up to date',()=>{
 const src={...area('车棚 1',0,0,6,16),obstacles:[box('o1',0,0)],arrays:[{x:0,z:0,rows:2,columns:5,tilt:0,azimuth:180,portrait:true,id:'a1',name:'a',hostObstacleId:'o1'}]} as RoofDesign;
 src.layoutSignature=layoutSignatureFor(src,.5);
 const {roofs,created,overlap}=patternRoof([src],src.id,{count:3,axis:'width',gap:1},.5);
 expect(roofs.map(r=>r.name)).toEqual(['车棚 1','车棚 2','车棚 3','车棚 4']);
 expect(created.length).toBe(3);expect(overlap).toBe(false);
 expect(roofs.map(r=>r.x)).toEqual([0,7,14,21]);
 for(const r of roofs.slice(1)){expect(r.obstacles[0].id).not.toBe('o1');expect(r.arrays[0].hostObstacleId).toBe(r.obstacles[0].id);expect(needsLayoutUpdate(r,.5)).toBe(false);}
 expect(new Set(roofs.map(r=>r.id)).size).toBe(4);
 // Along the length, and a warning when copies land on another area.
 const other=area('屋面 1',0,20,6,6),down=patternRoof([src,other],src.id,{count:1,axis:'depth',gap:.5},.5);
 expect(down.roofs[1].z).toBeCloseTo(16.5);expect(down.overlap).toBe(true);
 expect(()=>patternRoof([src],src.id,{count:0,axis:'width',gap:1},.5)).toThrow();
});

test('paste puts an area copy in the first free spot beside the copied one',()=>{
 const a=area('屋面 1',0,0,10,10),b=area('屋面 2',11,0,10,10);
 const first=pasteRoof([a,b],a,.5);
 expect(first.overlap).toBe(false);expect(first.roofs[2].x).toBeCloseTo(22);expect(first.roofs[2].name).toBe('屋面 3');
});

test('obstacle pattern stays inside the area and paste finds a free spot',()=>{
 const r={...area('屋面 1',0,0,10,10),obstacles:[box('o1',-3,0,'keepout')]};
 const p=patternObstacle(r,'o1',{count:6,axis:'width',gap:.5});
 expect(p.created).toBe(5);expect(p.skipped).toBe(1);
 expect(p.obstacles.map(o=>o.x)).toEqual([-3,-1.5,0,1.5,3,4.5]);
 expect(new Set(p.obstacles.map(o=>o.name)).size).toBe(6);
 const pasted=pasteObstacle(r,r.obstacles[0])!;
 expect(pasted.length).toBe(2);expect(pasted[1].x).toBeCloseTo(-1.5);expect(pasted[1].kind).toBe('keepout');
 const full={...area('屋面 1',0,0,1.2,2.2),obstacles:[box('o1',0,0)]};
 expect(pasteObstacle(full,full.obstacles[0])).toBeNull();
});

test('two-axis array uses clear gaps in roof or element coordinates',()=>{
 const r=area('A',0,0,50,50,Math.PI/5);
 r.obstacles=[{...box('a',0,0),yaw:Math.PI/2}];
 for(const basis of ['roof','element'] as const){
  const result=createOrUpdateObstacleArrayGroup(r,'a',{count:4,axis:'width',gap:1,grid:{basis,columns:2,rows:2,rowGap:2}});
  expect(result.obstacles).toHaveLength(4);
  const last=result.obstacles[3];
  expect(last.x).toBeCloseTo(basis==='roof'?3:4);
  expect(last.z).toBeCloseTo(basis==='roof'?3:-2);
 }
});

test('starts with one unchanged element and can reduce an existing group to its anchor',()=>{
 const origin=box('a',0,0),roof={...area('A',0,0,50,50),obstacles:[origin]};
 const single={count:1,axis:'width' as const,gap:1,grid:{basis:'roof' as const,columns:1,rows:1,rowGap:1}};
 expect(createOrUpdateObstacleArrayGroup(roof,'a',single).obstacles).toBe(roof.obstacles);
 const group=createOrUpdateObstacleArrayGroup(roof,'a',{...single,count:3,grid:{...single.grid,columns:3}},i=>'preview-'+i);
 expect(group.memberIds).toEqual(['a','preview-1','preview-2']);
 const collapsed=createOrUpdateObstacleArrayGroup({...roof,obstacles:group.obstacles},'a',{...single,groupId:group.groupId});
 expect(collapsed.memberIds).toEqual(['a']);
 expect(collapsed.obstacles[0].arrayGroup).toBeUndefined();
 expect(roof.obstacles).toEqual([origin]);
});
