import {describe,expect,it} from 'vitest';
import {snapDrawingEdge,snapDrawingMove,snapDrawingPoint,snapPolygonPoint} from './drawing-snap';
import {horizonCalibrationAngle} from './image-editor';

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

 it('aligns polygon vertices to earlier corners with dual-axis guides and respects canvas rotation',()=>{
  const polygon=[{x:0,z:0},{x:100,z:0},{x:100,z:60},{x:40,z:60},{x:40,z:110}];
  // Near directly below point 0 (x=0) and horizontally aligned with last point (z=110)
  const snap=snapPolygonPoint({x:3,z:107},polygon,1,0);
  expect(snap).toBeDefined();
  expect(snap!.point.x).toBeCloseTo(0,6);
  expect(snap!.point.z).toBeCloseTo(110,6);
  expect(snap!.guides.map(g=>g.axis).sort()).toEqual(['horizontal','vertical']);

  // Orthogonal-locked polygon drawing snaps free coordinate to point 0
  const ortho=snapPolygonPoint({x:4,z:112},polygon,1,0,polygon[4]);
  expect(ortho).toBeDefined();
  expect(ortho!.point.x).toBeCloseTo(0,6);
  expect(ortho!.point.z).toBeCloseTo(110,6);
  expect(ortho!.guides).toHaveLength(1);
  expect(ortho!.guides[0].axis).toBe('vertical');

  // Rotated canvas (30 deg): screen horizontal axis is (cos 30, -sin 30)
  const rad=30*Math.PI/180;
  const p0={x:0,z:0};
  const alongHoriz={x:100*Math.cos(rad),z:-100*Math.sin(rad)};
  const slightlyOff={x:alongHoriz.x+2*Math.sin(rad),z:alongHoriz.z+2*Math.cos(rad)};
  const rotSnap=snapPolygonPoint(slightlyOff,[p0],1,rad);
  expect(rotSnap).toBeDefined();
  expect(rotSnap!.point.x).toBeCloseTo(alongHoriz.x,5);
  expect(rotSnap!.point.z).toBeCloseTo(alongHoriz.z,5);
  expect(rotSnap!.guides[0].axis).toBe('horizontal');
 });

 it('calibrates horizontal direction without flipping 180 degrees regardless of click order',()=>{
  const a={x:0,z:0},b={x:Math.cos(15*Math.PI/180)*100,z:Math.sin(15*Math.PI/180)*100};
  expect(horizonCalibrationAngle(a,b,0)).toBeCloseTo(-15,2);
  expect(horizonCalibrationAngle(b,a,0)).toBeCloseTo(-15,2);
  // Refining from -85° toward a -95° wall rotates -10°, not +170°
  const c={x:0,z:0},d={x:Math.cos(95*Math.PI/180)*100,z:Math.sin(95*Math.PI/180)*100};
  expect(horizonCalibrationAngle(c,d,-85)).toBeCloseTo(-95,2);
 });
});
