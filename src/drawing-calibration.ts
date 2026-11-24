import type {BaseImage} from './base-image';
import type {Point} from './domain';
import {rescaleLayoutArea} from './layout-area';
import type {ProjectDocument} from './project-document';
import {validRoofSize} from './roof-limits';
import {tx} from './i18n';

export function calibrationScale(points:Point[],meters:number){
 if(points.length!==2||!Number.isFinite(meters)||meters<.01)return;
 const pixels=Math.hypot(points[0].x-points[1].x,points[0].z-points[1].z);
 if(pixels<2)return;
 const scale=meters/pixels;
 return scale>=.000001&&scale<=10000?scale:undefined;
}

/** Keep the existing plan aligned to the same raster pixels after applying the calibration. */
export function recalibrateDrawing(project:ProjectDocument,base:BaseImage):ProjectDocument{
 const old=project.baseImage?.metersPerPixel,next=base.metersPerPixel;
 const ratio=old&&next?next/old:1;
 const changed=Math.abs(ratio-1)>1e-9;
 const roofs=project.roofs.map(roof=>{
  if(!changed)return {...roof,northAngle:base.northAngle};
  const scalePoint=({x,z}:Point)=>({x:x*ratio,z:z*ratio});
  return {...roof,...scalePoint(roof),northAngle:base.northAngle,
   roof:{width:roof.roof.width*ratio,depth:roof.roof.depth*ratio,outline:roof.roof.outline?.map(scalePoint)},
   layoutOptions:rescaleLayoutArea(roof.layoutOptions,ratio),
   obstacles:roof.obstacles.map(object=>({...object,...scalePoint(object),width:object.width*ratio,depth:object.depth*ratio})),
   arrays:[],previous:null,layoutSignature:'',
  };
 });
 if(changed&&project.hasRegions&&roofs.some(roof=>!validRoofSize(roof.roof)))throw new Error(tx('标定后屋面尺寸超出 2–500m，请核对实际长度'));
 const imageOverlays=changed?project.imageOverlays.map(image=>({...image,x:image.x*ratio,z:image.z*ratio,
  width:image.width*ratio,depth:image.depth*ratio,originalWidth:image.originalWidth*ratio})):project.imageOverlays;
 return {...project,roofs,imageOverlays,baseImage:changed||!old?base:{...base,metersPerPixel:old}};
}
