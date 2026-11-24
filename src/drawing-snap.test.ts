import {describe,expect,it} from 'vitest';
import {snapDrawingEdge,snapDrawingMove,snapDrawingPoint} from './drawing-snap';

const rectangle=(x:number,z:number,width:number,height:number)=>[
 {x,z},{x:x+width,z},{x:x+width,z:z+height},{x,z:z+height},
];

describe('2D outline snapping',()=>{
 it('prefers a nearby vertex, then projects onto the actual edge',()=>{
  const targets=[rectangle(50,50,50,30)];
  expect(snapDrawingPoint({x:55,z:52},targets,1)).toEqual({kind:'vertex',point:{x:50,z:50}});
  expect(snapDrawingPoint({x:72,z:54},targets,1)).toEqual({kind:'edge',point:{x:72,z:50}});
  expect(snapDrawingPoint({x:72,z:57},targets,1)).toBeUndefined();
 });

 it('keeps horizontal, vertical and free angles distinct at every zoom',()=>{
  const origin={x:10,z:10};
  expect(snapDrawingPoint({x:110,z:13},[],1,[origin])).toEqual({kind:'axis',point:{x:110,z:10}});
  expect(snapDrawingPoint({x:12,z:110},[],1,[origin])).toEqual({kind:'axis',point:{x:10,z:110}});
  expect(snapDrawingPoint({x:110,z:22},[],1,[origin])).toBeUndefined();
  expect(snapDrawingPoint({x:110,z:13},[],.25,[origin])).toBeUndefined();
 });

 it('slides a moving edge onto a parallel edge without translating along that edge',()=>{
  const targets=[rectangle(-10,0,100,40)];
  expect(snapDrawingEdge({x:20,z:4},{x:50,z:4},targets,1)).toEqual({x:0,z:-4});
  expect(snapDrawingEdge({x:20,z:9},{x:50,z:9},targets,1)).toBeUndefined();
 });

 it('returns one translation that aligns a moving footprint corner',()=>{
  expect(snapDrawingMove([rectangle(75,45,20,20)],[rectangle(100,50,40,25)],1)).toEqual({x:5,z:5});
 });
});
