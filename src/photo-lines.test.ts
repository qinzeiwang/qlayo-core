import {describe,expect,it} from 'vitest';
import {snapPlan} from './photo-lines';
import type {RoofDesign} from './roof-project';
// A 20 × 10 m area centred at the origin: corners at (±10, ±5).
const roofs=[{x:0,z:0,yaw:0,roof:{width:20,depth:10}} as RoofDesign];
describe('snapPlan',()=>{
 it('pulls a click onto a nearby corner first',()=>expect(snapPlan({x:9.2,z:4.6},roofs,1)).toEqual({x:10,z:5}));
 it('else onto the nearest edge',()=>expect(snapPlan({x:3,z:5.6},roofs,1)).toEqual({x:3,z:5}));
 it('leaves far clicks alone',()=>expect(snapPlan({x:3,z:8},roofs,1)).toEqual({x:3,z:8}));
});
