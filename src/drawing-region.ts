import type {Rect} from './domain';
import type {RoofDesign} from './roof-project';
import {carportPortrait} from './carport';
import {rescaleGableSpans} from './pitched-roof';
import {longRidgeAxis} from './roof-direction';

/** Update only a drawing draft; project arrays stay untouched until explicit confirmation. */
export function drawingRegionGeometry(region:RoofDesign,rect:Rect,carportAlongFirstEdge=false):RoofDesign{
 const roof={width:rect.width,depth:rect.depth,outline:rect.outline?.map(p=>({...p}))};
 let pitch=region.pitch;
 if(pitch?.kind==='gable'){
  const axis=longRidgeAxis(roof);
  const oldSpan=pitch.axis==='x'?region.roof.width:region.roof.depth;
  const newSpan=axis==='x'?roof.width:roof.depth;
  pitch=pitch.spans?{...pitch,axis,spans:rescaleGableSpans(pitch.spans,oldSpan,newSpan)}:{...pitch,axis};
 }
 return {...region,pitch,x:rect.x,z:rect.z,yaw:rect.yaw,roof,
  layoutOptions:region.carport?{...region.layoutOptions,portrait:!carportAlongFirstEdge&&carportPortrait(roof)}:region.layoutOptions};
}
