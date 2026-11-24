import {describe,expect,it} from 'vitest';
import {calibrationScale,recalibrateDrawing} from './drawing-calibration';
import {blankDocument} from './project-document';
import {defaultModuleCatalog} from './module-library';
import {blankDrawing} from './base-image';

function sample(){
 const items=defaultModuleCatalog(),project=blankDocument({items,defaultId:items[0].id});
 const base={...blankDrawing(),blank:false,metersPerPixel:.1,northAngle:15};
 const roof={...project.roofs[0],x:4,z:6,northAngle:15,roof:{width:20,depth:12},
  obstacles:[{id:'obstacle',name:'障碍',x:2,z:1,width:2,depth:1,height:3,yaw:0}],
 };
 return {...project,hasRegions:true,roofs:[roof],baseImage:base};
}

describe('drawing calibration',()=>{
 it('requires two distinct endpoints and a positive measured length',()=>{
  const a={x:10,z:20},b={x:40,z:60};
  expect(calibrationScale([a,b],25)).toBe(.5);
  expect(calibrationScale([a],25)).toBeUndefined();
  expect(calibrationScale([a,a],25)).toBeUndefined();
  expect(calibrationScale([a,b],0)).toBeUndefined();
 });
 it('keeps roof and object geometry aligned to the source while preserving height',()=>{
  const project=sample();
  const updated=recalibrateDrawing(project,{...project.baseImage,metersPerPixel:.2,northAngle:90});
  expect(updated.roofs[0]).toMatchObject({x:8,z:12,northAngle:90,roof:{width:40,depth:24},
   obstacles:[{x:4,z:2,width:4,depth:2,height:3}],arrays:[],layoutSignature:'',
  });
  expect(project.roofs[0]).toMatchObject({x:4,z:6,northAngle:15});
  expect(updated.baseImage?.metersPerPixel).toBe(.2);
 });
 it('keeps the existing layout when only the north direction changes',()=>{
  const project=sample();
  const updated=recalibrateDrawing(project,{...project.baseImage,northAngle:90});
  expect(updated.roofs[0].arrays).toBe(project.roofs[0].arrays);
  expect(updated.roofs[0].roof).toBe(project.roofs[0].roof);
 });
 it('rejects an invalid recalibration without changing the project document',()=>{
  const project=sample();
  expect(()=>recalibrateDrawing(project,{...project.baseImage,metersPerPixel:20})).toThrow('尺寸超出');
  expect(project.baseImage.metersPerPixel).toBe(.1);
  expect(project.roofs[0].roof.width).toBe(20);
 });
});
