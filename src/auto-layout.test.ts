import { expect, it } from 'vitest';
import { autoLayout } from './auto-layout';
import { detect, obstacles } from './domain';
const options = { portrait: true, tilt: 20, edge: 0.5, gap: 1, maxColumns: 18 };
it('fills a roof and avoids rotated obstacles without array collisions', () => {
  for (const portrait of [true, false]) {
    const roof = { width: 30, depth: 20 };
    const result = autoLayout(roof, obstacles, { ...options, portrait });
    expect(result.count).toBeGreaterThan(36);
    expect(detect(result.arrays, obstacles, { width: 29, depth: 19 })).toEqual([]);
    expect(result.count).toBe(result.arrays.reduce((n, a) => n + a.rows * a.columns, 0));
  }
});
it('handles fully blocked or too-small roofs and limits capacity', () => {
  expect(autoLayout({ width: 2, depth: 2 }, [], options).count).toBe(0);
  expect(autoLayout({ width: 30, depth: 20 }, [{ ...obstacles[0], x: 0, z: 0, width: 40, depth: 40 }], options).count).toBe(0);
  const result = autoLayout({ width: 200, depth: 200 }, [], {...options,tilt:0,gap:0,edge:0});
  expect(result.count).toBe(10000);
  expect(result.capped).toBe(true);
});
it('rejects invalid scan steps', () => {
  expect(() => autoLayout({ width: 30, depth: 20 }, [], { ...options, gap: -3 })).toThrow();
});

const straight={...options,tilt:0,edge:0,wallHeight:0,module:{width:1,length:1,power:500,gap:0}};

it('starts a new column count after a blockage and packs full tables before the remainder',()=>{
  const roof={width:38,depth:1};
  const blocked=[{id:'edge',name:'禁布区',kind:'keepout' as const,x:-18.5,z:0,width:1,depth:1,yaw:0,height:0}];
  const result=autoLayout(roof,blocked,{...straight,maxColumns:16});
  expect(result.arrays.map(a=>a.columns)).toEqual([16,16,3]);
  expect(result.count).toBe(35);
  expect(detect(result.arrays,blocked,roof)).toEqual([]);
});

it('prefers the continuous side of an L-shaped roof when both scans fit the same count',()=>{
  const roof={width:20,depth:10,outline:[{x:-10,z:1},{x:-3,z:1},{x:-3,z:-5},{x:10,z:-5},{x:10,z:5},{x:-10,z:5}]};
  const result=autoLayout(roof,[],{...straight,gap:0,maxColumns:4});
  expect(result.count).toBe(158);
  expect(result.arrays[0]).toMatchObject({x:8,columns:4});
  expect(detect(result.arrays,[],roof)).toEqual([]);
});

it('lays out a non-cardinal compass azimuth within the roof setback',()=>{
  const roof={width:30,depth:20};
  const result=autoLayout(roof,[],{...options,azimuth:147.5,roofYaw:Math.PI/12});
  expect(result.count).toBeGreaterThan(0);
  for(const array of result.arrays)expect(array.azimuth).toBeCloseTo(162.5);
  expect(detect(result.arrays,[],{width:29,depth:19})).toEqual([]);
});
