import {describe,it,expect} from 'vitest';
import {Euler,Matrix4,Vector3} from 'three';
import {fitPhotoCamera} from './photo-camera';
import type {PhotoEdit} from './photo-match';
function fixture(calibrated=false):PhotoEdit{const matrix=new Matrix4().makeRotationFromEuler(new Euler(2.5,.2,.1)),f=1500,cx=calibrated?850:1000,cy=calibrated?650:750;const project=(q:number[])=>{const v=new Vector3(...q as [number,number,number]).applyMatrix4(matrix).add(new Vector3(2,3,90));return {x:f*v.x/v.z+cx,y:f*v.y/v.z+cy};};const corners=[[-15,10,0],[15,10,0],[15,-10,0],[-15,-10,0]].map(project);return {width:2000,height:1500,corners,heightCalibration:calibrated,heightPoints:[corners[0],project([-15,10,-10])],heightMeters:10,heightMode:'below',anchor:0};}
describe('photo camera',()=>{
 it('solves four corners with a centered principal point',()=>{const fit=fitPhotoCamera(fixture(),30,20);expect(fit.rmse).toBeLessThan(.01);expect(fit.f).toBeCloseTo(1500,0);expect(fit.principal).toEqual([1000,750]);});
 it('uses optional height to solve an offset principal point',()=>{const fit=fitPhotoCamera(fixture(true),30,20);expect(fit.rmse).toBeLessThan(.1);expect(fit.principal[0]).toBeCloseTo(850,0);expect(fit.principal[1]).toBeCloseTo(650,0);});
 it('rejects incomplete corners and enabled incomplete height',()=>{const m=fixture();expect(()=>fitPhotoCamera({...m,corners:m.corners.slice(0,3)},30,20)).toThrow();expect(()=>fitPhotoCamera({...m,heightCalibration:true,heightPoints:[]},30,20)).toThrow();});
});
