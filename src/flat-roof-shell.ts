import {BufferGeometry,Float32BufferAttribute,ShapeUtils,Vector2} from 'three';
import type {Footprint} from './polygon';
import {cross,insidePolygon,polygonContains,segmentDistance,signedArea} from './polygon';
import {corners,type Point} from './domain';

const EPS=1e-7;
function simpleLoop(p:Point[]){
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
  if(j===i+1||(i===0&&j===p.length-1))continue;
  const a=p[i],b=p[(i+1)%p.length],c=p[j],d=p[(j+1)%p.length];
  if((cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b))<EPS)return false;
 }
 return true;
}
function clean(points:Point[]){
 let p=points.map(v=>({...v}));
 let changed=true;
 while(changed&&p.length>3){changed=false;p=p.filter((b,i)=>{const a=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length];const cross=(b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x);if(Math.abs(cross)<EPS){changed=true;return false;}return true;});}
 if(signedArea(p)<0)p.reverse();
 return p;
}
/** Mitered inset; adjacent wall faces share the SAME corner rather than overlapping boxes.
 * If a narrow outline cannot contain 200 mm, reduce visual thickness explicitly.
 * No change is made to engineering/parapet exclusion geometry.
 */
export function insetRoof(outer:Point[],requested=.2){
 for(let attempt=0;attempt<12;attempt++){
  const thickness=requested*Math.pow(.5,attempt);
  const inner=outer.map((b,i)=>{
   const a=outer[(i+outer.length-1)%outer.length],c=outer[(i+1)%outer.length];
   const ux=b.x-a.x,uz=b.z-a.z,vx=c.x-b.x,vz=c.z-b.z;
   const ul=Math.hypot(ux,uz),vl=Math.hypot(vx,vz);
   const nx=-uz/ul-vz/vl,nz=ux/ul+vx/vl,den=1+(ux*vx+uz*vz)/(ul*vl);
   return {x:b.x+thickness*nx/den,z:b.z+thickness*nz/den};
  });
  if(inner.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&insidePolygon(p,outer))&&signedArea(inner)>EPS&&simpleLoop(inner)&&polygonContains(outer,inner)&&inner.every((p,i)=>{const q=inner[(i+1)%inner.length],a=outer[i],b=outer[(i+1)%outer.length];return (q.x-p.x)*(b.x-a.x)+(q.z-p.z)*(b.z-a.z)>EPS;}))return {inner,thickness};
 }
 throw new Error('屋面轮廓过窄，无法生成连续女儿墙内沿');
}

export function flatRoofFootprint(roof:Footprint,parapetHeight:number){
 const outer=clean(corners({...roof,x:0,z:0,yaw:0}));
 const inset=parapetHeight>0?insetRoof(outer):{inner:outer,thickness:0};
 return {outer,...inset};
}

/** Closed boundary: exterior spans ground-to-coping without any roof-level split.
 * Coping ring, interior wall and recessed roof meet at shared geometric vertices.
 */
export function flatRoofShell(roof:Footprint,height:number,parapetHeight:number,facadeCuts?:number[][]){
 const wall=Math.max(0,parapetHeight),top=height+wall;
 const {outer,inner,thickness}=flatRoofFootprint(roof,wall);
 const vertices:number[]=[],roofVertices:number[]=[];
 type V=[number,number,number];
 const v=(p:Point,y:number):V=>[p.x,y,p.z];
 function triangle(a:V,b:V,c:V,normal:V,target=vertices){
  const u=b.map((x,i)=>x-a[i]),w=c.map((x,i)=>x-a[i]);
  const dot=(u[1]*w[2]-u[2]*w[1])*normal[0]+(u[2]*w[0]-u[0]*w[2])*normal[1]+(u[0]*w[1]-u[1]*w[0])*normal[2];
  if(dot<0)target.push(...a,...c,...b);else target.push(...a,...b,...c);
 }
 function quad(a:V,b:V,c:V,d:V,n:V){triangle(a,b,c,n);triangle(a,c,d,n);}
 function surface(poly:Point[],y:number,n:V,target=vertices){
  const faces=ShapeUtils.triangulateShape(poly.map(p=>new Vector2(p.x,p.z)),[]);
  for(const t of faces)triangle(v(poly[t[0]],y),v(poly[t[1]],y),v(poly[t[2]],y),n,target);
 }
 for(let i=0;i<outer.length;i++){
  const a=outer[i],b=outer[(i+1)%outer.length];
  const normal:V=[b.z-a.z,0,a.x-b.x];
  const cuts=facadeCuts?.[i]??[0,1];
  const point=(t:number)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
  for(let j=1;j<cuts.length;j++){
   const left=point(cuts[j-1]),right=point(cuts[j]);
   quad(v(left,0),v(right,0),v(right,top),v(left,top),normal);
  }
 }
 if(wall>0){
  for(let i=0;i<inner.length;i++){
   const a=inner[i],b=inner[(i+1)%inner.length];
   quad(v(a,height),v(b,height),v(b,top),v(a,top),[a.z-b.z,0,b.x-a.x]);
  }
  const points=[...outer,...inner],faces=ShapeUtils.triangulateShape(outer.map(p=>new Vector2(p.x,p.z)),[inner.map(p=>new Vector2(p.x,p.z))]);
  for(const t of faces)triangle(v(points[t[0]],top),v(points[t[1]],top),v(points[t[2]],top),[0,1,0]);
 }
 surface(inner,height,[0,1,0]);surface(outer,0,[0,-1,0]);
 surface(inner,height,[0,1,0],roofVertices);
 function geometry(data:number[]){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(data,3));g.computeVertexNormals();return g;}
 return {geometry:geometry(vertices),roofGeometry:geometry(roofVertices),outer,inner,thickness,height,top};
}
