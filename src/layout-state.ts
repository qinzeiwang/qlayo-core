import type {RoofDesign} from './roof-project';
/** Project setbacks: the roof edge, and the ridge (or high side) of pitched roofs. A plain number means both. */
export type Edges=number|{edge:number;ridge:number};
export const edgeOf=(e:Edges)=>typeof e==='number'?e:e.edge;
export const ridgeOf=(e:Edges)=>typeof e==='number'?e:e.ridge;
export const projectEdges=(p:{globalEdge?:number;globalRidgeEdge?:number}):Edges=>({edge:p.globalEdge??.5,ridge:p.globalRidgeEdge??p.globalEdge??.5});
// A ridge setback equal to the edge keeps the old signature, so existing layouts stay current.
export function layoutSignatureFor(r:RoofDesign,edges:Edges){return JSON.stringify({roof:r.roof,obstacles:r.obstacles,wallHeight:r.wallHeight,layoutOptions:r.layoutOptions,moduleSpec:r.moduleSpec,yaw:r.yaw,...(r.northAngle?{northAngle:r.northAngle}:{}),...(r.pitch?{pitchedShadowRevision:r.pitch.kind==='gable'&&r.wallHeight>0?2:1}:!r.carport?{flatShadowRevision:2}:{}),pitch:r.pitch,carport:r.carport&&{...r.carport,frame:undefined},globalEdge:edgeOf(edges),...(r.pitch&&ridgeOf(edges)!==edgeOf(edges)?{ridgeEdge:ridgeOf(edges)}:{})});}
export const needsLayoutUpdate=(r:RoofDesign,edge:Edges)=>r.layoutSignature!==layoutSignatureFor(r,edge);
