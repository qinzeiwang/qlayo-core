/**
 * What a canvas click or drag hit. The 3D view (three.tsx) reports hits as string ids:
 * `@i/overlay[/corner]` image overlay, `@o/roof/object` object, `@h/roof/object/corner` object resize handle,
 * `@s/roof` roof outline, `@d/roof` layout direction marker, `@p/roof` pitch marker, `roof/array` module array.
 */
export type CanvasTarget=
 |{kind:'overlay';overlayId:string;corner?:number}
 |{kind:'object';roofId:string;objectId:string;corner?:number}
 |{kind:'site'|'direction'|'pitch';roofId:string}
 |{kind:'array';roofId:string;arrayId:string};
const markers={'@s/':'site','@d/':'direction','@p/':'pitch'} as const;
export function parseCanvasId(id:string):CanvasTarget{
 const prefix=id.slice(0,3),rest=id.slice(3).split('/');
 if(prefix==='@i/')return rest[1]===undefined?{kind:'overlay',overlayId:rest[0]}:{kind:'overlay',overlayId:rest[0],corner:Number(rest[1])};
 if(prefix==='@o/')return {kind:'object',roofId:rest[0],objectId:rest[1]};
 if(prefix==='@h/')return {kind:'object',roofId:rest[0],objectId:rest[1],corner:Number(rest[2])};
 if(prefix in markers)return {kind:markers[prefix as keyof typeof markers],roofId:id.slice(3)};
 const split=id.indexOf('/');
 return {kind:'array',roofId:id.slice(0,split),arrayId:id.slice(split+1)};
}
/** The roof a target belongs to; overlays belong to none. */
export const targetRoofId=(t:CanvasTarget)=>t.kind==='overlay'?undefined:t.roofId;
