import type {Rect} from './domain';
import type {RoofDesign} from './roof-project';
import {carportPortrait} from './carport';

/** Update only a drawing draft; project arrays stay untouched until explicit confirmation. */
export function drawingRegionGeometry(region:RoofDesign,rect:Rect,carportAlongFirstEdge=false):RoofDesign{
 const roof={width:rect.width,depth:rect.depth,outline:rect.outline?.map(p=>({...p}))};
 return {...region,x:rect.x,z:rect.z,yaw:rect.yaw,roof,
  layoutOptions:region.carport?{...region.layoutOptions,portrait:!carportAlongFirstEdge&&carportPortrait(roof)}:region.layoutOptions};
}
