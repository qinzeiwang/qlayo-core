import {createRoofOcclusion} from './array-shadows';
import {layoutAreaIssues} from './layout-area';
import {carportBoundary} from './carport';
import {corners,detect,DEFAULT_FRONT_HEIGHT,PITCHED_PANEL_OFFSET,type Point} from './domain';
import {gableParapetPlan} from './gable-parapet';
import {neighborRoofShadowZones,neighborShadowCasters} from './neighbor-shadows';
import {cross,insidePolygon} from './polygon';
import {roofHeight} from './pitched-roof';
import {pitchedShadowZones} from './pitched-shadow-zones';
import {geographicYaw,toWorld,type RoofDesign} from './roof-project';
import {shadowZones,type ShadowZone} from './shadow-zones';
import type {SunRay} from './solar';
import {tx} from './i18n';
/** Shadow keep-out zones on one roof, in roof coordinates. Carports have none. */
export function roofShadowZones(r:RoofDesign,rays:readonly SunRay[],referenceHeight=0):ShadowZone[]{
 return r.carport?[]:r.pitch?pitchedShadowZones(r.roof,r.obstacles,r.pitch,geographicYaw(r),rays,referenceHeight,r.wallHeight):shadowZones(r.roof,r.obstacles,r.wallHeight,geographicYaw(r),rays,referenceHeight);
}
/** Conflicts on the active roof, as listed in the panel status. */
export function activeRoofIssues(r:RoofDesign,rays:readonly SunRay[],overlapping:RoofDesign[],roofs:readonly RoofDesign[]=[]){
 const model=createRoofOcclusion(r,rays,roofs);
 const shadowIssues=r.arrays.flatMap(a=>model.regions(a).map(zone=>({kind:"shadow" as const,ids:[a.id,zone.id],text:tx('{0} 进入{1}',a.name,zone.name)})));
 return [...layoutAreaIssues(r.arrays,r.layoutOptions),...detect(r.arrays,r.obstacles,carportBoundary(r.roof,r.carport,r.layoutOptions.portrait)),...shadowIssues,...overlapping.map(o=>({kind:"boundary" as const,ids:r.arrays.map(a=>a.id),text:tx('与 {0} 屋面重叠',o.name)}))];
}
/** Shadow zones of all roofs in world coordinates, for the canvas. */
export function worldShadowZones(roofs:RoofDesign[],rays:readonly SunRay[]){
 return roofs.flatMap(r=>roofShadowZones(r,rays).map(z=>({...z,id:`${r.id}/${z.id}`,topOnly:!!r.pitch,elevation:(r.flatHeight??3.5)-3.5,points:z.points.map(p=>toWorld(p,r))})));
}
/** Conflicts on all roofs for the canvas; ids are prefixed with the roof id. */
export function worldIssues(roofs:RoofDesign[],rays:readonly SunRay[],includeNeighbors=true){
 return roofs.flatMap(r=>{
  const issues=[...layoutAreaIssues(r.arrays,r.layoutOptions),...detect(r.arrays,r.obstacles,carportBoundary(r.roof,r.carport,r.layoutOptions.portrait))];
  if(rays.length){
   const model=createRoofOcclusion(r,rays,includeNeighbors?roofs:[]);
   for(const array of r.arrays)for(const zone of model.regions(array)){
    issues.push({kind:'shadow',ids:[array.id],text:zone.name});
   }
  }
  return issues.map(i=>({...i,ids:i.ids.map(id=>`${r.id}/${id}`)}));
 });
}
/** Actual shaded module surfaces, rather than a shadow mask on the roof below. */
export function worldPanelShadowZones(roofs:RoofDesign[],rays:readonly SunRay[],includeNeighbors=true){
 return roofs.flatMap(r=>{const model=createRoofOcclusion(r,rays,includeNeighbors?roofs:[]);return r.arrays.flatMap(a=>model.regions(a).map(z=>({...z,id:`${r.id}/${a.id}/${z.id}`,points:z.points.map(p=>toWorld(p,r))})));});
}

/** Portion of an edge covered by another counterclockwise convex shadow. */
function coveredInterval(a:Point,b:Point,polygon:Point[],preferOther:boolean){
 let start=0,end=1;
 for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length];
  const from=cross(p,q,a),to=cross(p,q,b);
  if(Math.abs(from)<1e-8&&Math.abs(to)<1e-8){
   // Opposite directions share an interior seam. Identical directions keep one copy.
   if(!preferOther&&(q.x-p.x)*(b.x-a.x)+(q.z-p.z)*(b.z-a.z)>0)return;
   continue;
  }
  if(from<0&&to<0)return;
  if(from<0)start=Math.max(start,from/(from-to));
  else if(to<0)end=Math.min(end,from/(from-to));
  if(start>=end)return;
 }
 return {start,end};
}

function winterBoundary(roof:RoofDesign,rays:readonly SunRay[],roofs:readonly RoofDesign[]){
 const samples=new Map<string,Point[][]>();
 const frontHeight=roof.pitch?PITCHED_PANEL_OFFSET:roof.layoutOptions.frontHeight??DEFAULT_FRONT_HEIGHT;
 const hasGableParapet=roof.pitch?.kind==='gable'&&roof.wallHeight>0;
 const neighbors=neighborShadowCasters(roof,roofs,rays);
 for(const ray of rays){
  for(const zone of [...roofShadowZones(roof,[ray],frontHeight),...neighborRoofShadowZones(roof,neighbors,[ray],frontHeight)]){
   // Treat the four connected sides as one shadow when outlining the envelope.
   const id=hasGableParapet&&/^shadow-wall-[0-3]$/.test(zone.id)?'gable-parapet':zone.id;
   const polygons=samples.get(id)??[];
   polygons.push(zone.points);
   samples.set(id,polygons);
  }
 }
 const segments:[Point,Point][]=[];
 for(const polygons of samples.values()){
  polygons.forEach((polygon,index)=>polygon.forEach((a,i)=>{
   const b=polygon[(i+1)%polygon.length];
   const covered=polygons.flatMap((other,j)=>{
    const interval=j===index?undefined:coveredInterval(a,b,other,j<index);
    return interval?[interval]:[];
   }).sort((l,r)=>l.start-r.start);
   const at=(t:number)=>({x:a.x+t*(b.x-a.x),z:a.z+t*(b.z-a.z)});
   let cursor=0;
   for(const {start,end} of covered){
    if(start-cursor>1e-8)segments.push([at(cursor),at(start)]);
    cursor=Math.max(cursor,end);
   }
   if(1-cursor>1e-8)segments.push([at(cursor),b]);
  }));
 }
 return segments;
}

/** Roof-local winter envelope boundaries, clipped to the footprint and draped over the ridge. */
export function winterCheckLines(roofs:RoofDesign[],rays:readonly SunRay[],includeNeighbors=true){
 const positions:number[]=[];
 for(const roof of roofs){
  const pitch=roof.pitch;
  const footprint=pitch?.kind==='gable'&&roof.wallHeight>0
   ?gableParapetPlan(roof.roof,pitch,roof.wallHeight).deck
   :corners({...roof.roof,x:0,z:0,yaw:0});
  for(const [a,b] of winterBoundary(roof,rays,includeNeighbors?roofs:[])){
   const dx=b.x-a.x,dz=b.z-a.z;
   const cuts=[0,1];
   for(let j=0;j<footprint.length;j++){
    const c=footprint[j],d=footprint[(j+1)%footprint.length];
    const ex=d.x-c.x,ez=d.z-c.z,den=dx*ez-dz*ex;
    if(Math.abs(den)<1e-9)continue;
    const x=c.x-a.x,z=c.z-a.z,t=(x*ez-z*ex)/den,u=(x*dz-z*dx)/den;
    if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
   }
   if(pitch?.kind==='gable'&&a[pitch.axis]*b[pitch.axis]<0){
    cuts.push(a[pitch.axis]/(a[pitch.axis]-b[pitch.axis]));
   }
   cuts.sort((a,b)=>a-b);
   const at=(t:number)=>({x:a.x+t*dx,z:a.z+t*dz});
   for(let j=1;j<cuts.length;j++){
    const start=cuts[j-1],end=cuts[j];
    if(end-start<1e-9||!insidePolygon(at((start+end)/2),footprint))continue;
    for(const t of [start,end]){
     const local=at(t),world=toWorld(local,roof);
     const y=pitch?roofHeight(roof.roof,pitch,local.x,local.z):(roof.flatHeight??3.5)-3.5;
     positions.push(world.x,y+.035,world.z);
    }
   }
  }
 }
 return new Float32Array(positions);
}
