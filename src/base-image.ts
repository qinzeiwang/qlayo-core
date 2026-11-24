import {newId} from './ids';
import type { Point, Obstacle } from './domain';
import {validOutline} from './polygon';
import {tx} from './i18n';
export type BaseImage = { blank?:boolean; northAngle?:number; url: string; width: number; height: number; name: string; pdfSource?: string; crop?:Point[]; opacity?:number; visible?:boolean; metersPerPixel?: number; frame?: { x: number; y: number; width: number; height: number } };
/** Crops are stored in the source image's coordinates, independently of calibration. */
export function validBaseImageCrop(points:Point[],base:Pick<BaseImage,'width'|'height'>){
 return Array.isArray(points)&&points.length>=3&&points.length<=64&&
  points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>=0&&p.x<=base.width&&p.z>=0&&p.z<=base.height)&&
  validOutline({width:base.width,depth:base.height,outline:points.map(p=>({x:p.x-base.width/2,z:p.z-base.height/2}))});
}
export function baseImageWorldOutline(base?:BaseImage):Point[]|undefined{
 if(!base||base.blank||!base.metersPerPixel)return;
 const {width,height,crop,frame,metersPerPixel}=base;
 const cx=frame?frame.x+frame.width/2:width/2;
 const cz=frame?frame.y+frame.height/2:height/2;
 const points=crop??[{x:0,z:0},{x:width,z:0},{x:width,z:height},{x:0,z:height}];
 return points.map(p=>({x:(p.x-cx)*metersPerPixel,z:(p.z-cz)*metersPerPixel}));
}
const transparentPixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
export function blankDrawing():BaseImage{return {blank:true,url:transparentPixel,name:tx('无底图画布'),width:10000,height:10000,metersPerPixel:.25,northAngle:0};}
export function blankDrawingInitialView(base:BaseImage){
  const k=base.metersPerPixel??.25,width=200/k,height=100/k;
  return {x:(base.width-width)/2,y:(base.height-height)/2,width,height};
}
export function imageRect(a: Point, b: Point) { return { x: Math.min(a.x,b.x), y: Math.min(a.z,b.z), width: Math.abs(a.x-b.x), height: Math.abs(a.z-b.z) }; }
export function rectToObstacle(r: {x:number;y:number;width:number;height:number}, base: BaseImage): Obstacle {
  if(!base.frame || !base.metersPerPixel) throw new Error(tx('请先标定并圈定屋面'));
  const f=base.frame,k=base.metersPerPixel;
  return {id:newId(),name:tx('矩形障碍物'),x:(r.x+r.width/2-f.x-f.width/2)*k,z:(r.y+r.height/2-f.y-f.height/2)*k,width:r.width*k,depth:r.height*k,yaw:0,height:1};
}
