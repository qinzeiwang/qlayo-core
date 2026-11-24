import type {Obstacle,Rect} from './domain';
import type {RoofDesign} from './roof-project';
import {projectBounds,roofRect,toLocal} from './roof-project';
import {containsRect} from './drawing-geometry';
import {tx} from './i18n';

/** Object footprints currently use a rectangle; stage world coordinates as roof-local geometry. */
export function drawingObjectGeometry(roof:RoofDesign,draft:Obstacle,world:Rect):Obstacle{
 if(world.outline)throw new Error(tx('附属物仅支持矩形'));
 if(world.width<.2||world.depth<.2)throw new Error(tx('障碍物边长至少 0.2m'));
 if(!containsRect(roofRect(roof),world))throw new Error(tx('障碍物须位于当前选中屋面内'));
 return {...draft,...toLocal(world,roof),width:world.width,depth:world.depth,yaw:world.yaw-roof.yaw,height:draft.kind==='keepout'?0:draft.height,outline:undefined};
}

/** Fill the drawable viewport with the active roof, allowing space for the floating tools. */
export function drawingObjectView(roof:RoofDesign,base:{width:number;height:number;metersPerPixel?:number},viewportWidth:number,viewportHeight:number){
 const width=Math.max(1,viewportWidth),height=Math.max(1,viewportHeight),k=base.metersPerPixel??.25;
 const bounds=projectBounds([roof]);
 const left=Math.min(64,width*.12),right=Math.min(16,width*.04),top=Math.min(64,height*.12),bottom=Math.min(24,height*.05);
 const scale=Math.max(bounds.width/k/Math.max(1,width-left-right),bounds.depth/k/Math.max(1,height-top-bottom))*1.08;
 const spanWidth=Math.max(.01,scale*width),spanHeight=Math.max(.01,scale*height);
 return {x:base.width/2+bounds.x/k-(left+(width-left-right)/2)/width*spanWidth,
  y:base.height/2+bounds.z/k-(top+(height-top-bottom)/2)/height*spanHeight,
  width:spanWidth,height:spanHeight,viewportHeight:height};
}

/** Changed element geometry invalidates the roof layout; retain the prior arrays for undo. */
export function invalidateRoofLayoutForElements(roof:RoofDesign,obstacles:Obstacle[]):RoofDesign{
 return {...roof,obstacles,previous:roof.arrays.length?roof.arrays:roof.previous,
  arrays:[],layoutSignature:'',layoutMessage:tx('屋面要素已变化，请更新布置')};
}
export function appendDrawingObject(roof:RoofDesign,object:Obstacle):RoofDesign{
 return invalidateRoofLayoutForElements(roof,[...roof.obstacles,object]);
}
