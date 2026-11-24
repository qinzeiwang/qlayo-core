import {corners,footprint,type PVArray,type SceneSite} from './domain';
import {toLocal} from './roof-project';
/** One actual footprint corner, located in the roof coordinate frame. */
export function arrayLocationDimensions(array:PVArray,site:SceneSite){
 const origin={x:-site.width/2,z:-site.depth/2};
 const points=corners(footprint(array)).map(p=>toLocal(p,site));
 const anchor=points.reduce((best,p)=>Math.hypot(p.x-origin.x,p.z-origin.z)<Math.hypot(best.x-origin.x,best.z-origin.z)?p:best);
 return {origin,anchor,x:anchor.x-origin.x,z:anchor.z-origin.z};
}
