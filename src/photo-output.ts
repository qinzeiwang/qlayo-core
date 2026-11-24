import type {PhotoRenderOptions} from './photo-match';
export function photoOutputSize(width:number,height:number,options:PhotoRenderOptions,deviceLimit:number,renderAtTargetSize=false){
 const requested=options.maxEdge??(options.quality==='simple'?1600:options.quality==='fine'?4096:2560);
 // New geometry can use the target resolution independently of the photo’s pixel count.
 const scale=Math.min(renderAtTargetSize?Infinity:1,requested/Math.max(width,height),deviceLimit/Math.max(width,height),Math.sqrt(24000000/(width*height)));
 return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
