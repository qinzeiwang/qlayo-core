import {createPanelOcclusion} from './panel-occlusion';
import {pitchedParapetCasters} from './pitched-shadow-zones';
import {geographicYaw,worldObstacle,type RoofDesign} from './roof-project';
import {winterRays,type SunRay} from './solar';
import {neighborShadowCasters,roofShadowDatum} from './neighbor-shadows';

export function createRoofOcclusion(r:RoofDesign,rays:readonly SunRay[]=winterRays(r.layoutOptions.shadowLatitude),roofs:readonly RoofDesign[]=[]){
 const datum=roofShadowDatum(r);
 const objects=r.carport?[]:r.obstacles.map(o=>{const actual=worldObstacle(o,r);return {...o,baseHeight:(actual.baseHeight??0)-datum,height:actual.height};});
 if(r.pitch&&!r.carport)objects.push(...pitchedParapetCasters(r.roof,r.pitch,r.wallHeight));
 return createPanelOcclusion(r.roof,objects,r.pitch||r.carport?0:r.wallHeight,geographicYaw(r),rays,neighborShadowCasters(r,roofs,rays));
}
