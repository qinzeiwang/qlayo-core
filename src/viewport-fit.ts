import {corners,fittedPlanView,footprint,geometry,type CameraView,type Obstacle,type PVArray,type Rect,type SceneSite} from './domain';
import {maxRoofHeight} from './pitched-roof';

export function fitPlanImage(aspect:number,sites:SceneSite[],obstacles:Obstacle[],arrays:PVArray[],viewRotation=0){
 const laidOutSiteIds=new Set(arrays.map(array=>array.id.split('/')[0]));
 const outlines=[...sites.filter(site=>!site.carport||!laidOutSiteIds.has(site.id)),...obstacles,...arrays.map(footprint)];
 const rad=viewRotation*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
 let minU=Infinity,minV=Infinity,maxU=-Infinity,maxV=-Infinity;
 for(const rect of outlines)for(const {x,z} of corners(rect)){
  const u=x*c-z*s,v=x*s+z*c;
  minU=Math.min(minU,u);minV=Math.min(minV,v);maxU=Math.max(maxU,u);maxV=Math.max(maxV,v);
 }
 if(!Number.isFinite(minU))return;
 const cu=(minU+maxU)/2,cv=(minV+maxV)/2;
 return fittedPlanView({x:cu*c+cv*s,z:-cu*s+cv*c},{width:maxU-minU,depth:maxV-minV},aspect);
}

export function fitOrbitView(view:CameraView,aspect:number,fov:number,sites:SceneSite[],obstacles:Obstacle[],arrays:PVArray[]){
 const points:{x:number;y:number;z:number}[]=[];
 const add=(rect:Rect,bottom:number,top:number)=>{
  for(const p of corners(rect))points.push({...p,y:bottom},{...p,y:top});
 };
 const ground=-3.5;
 for(const site of sites){
  const {pitch,carport}=site;
  const roofTop=pitch?maxRoofHeight(site,pitch):ground+(site.flatHeight??3.5);
  add(site,ground,carport?ground+carport.clearance+.25:roofTop+site.wallHeight);
 }
 for(const object of obstacles)if(object.kind!=='keepout')add(object,object.baseHeight??0,(object.baseHeight??0)+object.height);
 for(const array of arrays){
  const g=geometry(array);
  let low=Infinity,high=-Infinity;
  for(const panel of g.panels){low=Math.min(low,panel.y);high=Math.max(high,panel.y);}
  if(!Number.isFinite(low))continue;
  const rise=(g.l*Math.abs(Math.sin(g.tilt))+g.w*Math.abs(Math.sin(g.roll)))/2+.1;
  add({...array,width:g.width,depth:g.depth,yaw:g.yaw},array.mounting==='carport'?ground:low-rise,high+rise);
 }
 if(!points.length)return;
 let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
 for(const p of points){
  minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);minZ=Math.min(minZ,p.z);
  maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);maxZ=Math.max(maxZ,p.z);
 }
 view.x=(minX+maxX)/2;view.z=(minZ+maxZ)/2;
 const sy=Math.sin(view.yaw),cy=Math.cos(view.yaw),sp=Math.sin(view.pitch),cp=Math.cos(view.pitch);
 const tanY=Math.tan(fov*Math.PI/360)/1.14,tanX=tanY*Math.max(.01,aspect);
 const centerY=(minY+maxY)/2;
 let distance=8;
 for(const p of points){
  const x=p.x-view.x,y=p.y-centerY,z=p.z-view.z;
  const right=x*cy-z*sy,up=y*cp-(x*sy+z*cy)*sp,towardCamera=(x*sy+z*cy)*cp+y*sp;
  distance=Math.max(distance,towardCamera+Math.max(1,Math.abs(right)/tanX,Math.abs(up)/tanY));
 }
 view.distance=distance;
 view.target=Math.max(centerY,ground+.3-distance*sp);
}
