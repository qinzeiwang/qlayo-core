import type {WorkspaceFile} from './workspace-file';
import {canvasStyle,planElementColours} from './canvas-style';
import {projectBounds,roofRect,toWorld,type RoofDesign} from './roof-project';
import {corners,fittedPlanView,geometry,type Point} from './domain';
export function panelPolygons(r:RoofDesign):Point[][]{
 return r.arrays.flatMap(a=>{const g=geometry(a),c=Math.cos(g.yaw),s=Math.sin(g.yaw),w=a.surface?g.w/Math.sqrt(1+a.surface.sx**2):g.w,d=a.surface?g.l/Math.sqrt(1+a.surface.sz**2):g.l*Math.cos(g.tilt);
 return g.panels.map(p=>corners({x:p.x,z:p.z,width:w,depth:d,yaw:0}).map(v=>({x:a.x+v.x*c+v.z*s,z:a.z-v.x*s+v.z*c})));});
}
export function layoutFrame(project:Pick<WorkspaceFile,'roofs'>){
 const yaw=project.roofs[0]?.yaw??0,c=Math.cos(yaw),s=Math.sin(yaw);
 const rotate=(p:Point):Point=>({x:p.x*c-p.z*s,z:p.x*s+p.z*c});
 const points=project.roofs.flatMap(r=>corners(roofRect(r))).map(rotate);
 const xs=points.map(p=>p.x),zs=points.map(p=>p.z);
 const minX=points.length?Math.min(...xs):0,maxX=points.length?Math.max(...xs):0,minZ=points.length?Math.min(...zs):0,maxZ=points.length?Math.max(...zs):0;
 return {rotate,x:(minX+maxX)/2,z:(minZ+maxZ)/2,width:maxX-minX,depth:maxZ-minZ};
}
export function drawLayoutRaster(project:Pick<WorkspaceFile,'roofs'>,width:number,title?:string){
 const thumbnail=title===undefined;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.round(width*9/16);const c=canvas.getContext('2d')!;
 c.fillStyle=thumbnail?'#eef0f2':'#fff';c.fillRect(0,0,canvas.width,canvas.height);
 const pad=width*.04;
 const frame=thumbnail?null:layoutFrame(project);
 const bounds=projectBounds(project.roofs);
 const fit=fittedPlanView(bounds,bounds,width/canvas.height);
 const view=frame??fit;
 const scale=frame?Math.min((width-2*pad)/Math.max(1,frame.width),(canvas.height-2*pad)/Math.max(1,frame.depth)):canvas.height/fit.span;
 const xy=(point:Point)=>{const p=frame?frame.rotate(point):point;return [width/2+(p.x-view.x)*scale,canvas.height/2+(p.z-view.z)*scale]};
 const poly=(points:Point[],fill:string,stroke?:string)=>{c.beginPath();points.forEach((p,i)=>{const [x,y]=xy(p);if(i)c.lineTo(x,y);else c.moveTo(x,y)});c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=Math.max(1,width/1920);c.stroke()}};
 for(const r of project.roofs){
  poly(corners(roofRect(r)),thumbnail?canvasStyle.planRoof:'#f1f3f4',thumbnail?'#919ba5':'#606b75');
  for(const p of panelPolygons(r))poly(p.map(v=>toWorld(v,r)),thumbnail?'#273342':'#344e69',thumbnail?undefined:'#e8eef3');
  for(const o of r.obstacles){
   const tone=planElementColours[o.kind==='keepout'?'keepout':o.topLayout?'annex':'obstacle'];
   poly(corners(o).map(v=>toWorld(v,r)),thumbnail?tone.fill:o.kind==='keepout'?'#f5dddd':'#bea48c',thumbnail?undefined:'#9b6a60');
  }
  if(thumbnail)continue;
  const [x,y]=xy(toWorld({x:-r.roof.width/2,z:-r.roof.depth/2},r));c.font=`${width/110}px sans-serif`;c.fillStyle='#303943';c.fillText(r.name,x,y-8);
 }
 if(!thumbnail){c.font=`${width/100}px sans-serif`;c.fillStyle='#303943';c.fillText(title,pad,canvas.height-pad/3);}
 return thumbnail?canvas.toDataURL('image/webp',.78):canvas.toDataURL('image/png');
}
