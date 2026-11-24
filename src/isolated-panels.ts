import {corners,geometry,type PVArray,type Point} from './domain';
import {polygonsOverlap,segmentDistance} from './polygon';

const distanceLimit=2;
const cellSize=4;
type Footprint={array:number;points:Point[];minX:number;maxX:number;minZ:number;maxZ:number};

function panelFootprints(array:PVArray,index:number):Footprint[]{
 const g=geometry(array),c=Math.cos(g.yaw),s=Math.sin(g.yaw);
 const width=g.w*Math.cos(g.roll),depth=g.l*Math.cos(g.tilt);
 return g.panels.map(panel=>{
  const points=corners({...panel,width,depth,yaw:0}).map(p=>({x:array.x+p.x*c+p.z*s,z:array.z-p.x*s+p.z*c}));
  return {array:index,points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
 });
}

function nearby(a:Footprint,b:Footprint){
 if(a.maxX+distanceLimit<b.minX||b.maxX+distanceLimit<a.minX||a.maxZ+distanceLimit<b.minZ||b.maxZ+distanceLimit<a.minZ)return false;
 const reaches=(p:Point[],other:Point[])=>p.some(point=>other.some((edge,i)=>segmentDistance(point,edge,other[(i+1)%other.length])<=distanceLimit+1e-8));
 return polygonsOverlap(a.points,b.points)||reaches(a.points,b.points)||reaches(b.points,a.points);
}

function* cells(panel:Footprint,padding:number){
 for(let x=Math.floor((panel.minX-padding)/cellSize);x<=Math.floor((panel.maxX+padding)/cellSize);x++){
  for(let z=Math.floor((panel.minZ-padding)/cellSize);z<=Math.floor((panel.maxZ+padding)/cellSize);z++)yield `${x},${z}`;
 }
}

/** Remove separate groups of one or two modules, using horizontal edge-to-edge distances. */
export function removeIsolatedPanels(arrays:PVArray[]){
 const counts=arrays.map(a=>a.rows*a.columns);
 const small=counts.map(count=>count<=2);
 if(!counts.some(count=>count<=2))return arrays;
 const parent=counts.map((_,i)=>i);
 const root=(i:number):number=>{
  while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}
  return i;
 };
 const panels=arrays.flatMap(panelFootprints),grid=new Map<string,Footprint[]>();
 for(const panel of panels)for(const cell of cells(panel,0)){
  const bin=grid.get(cell);
  if(bin)bin.push(panel);else grid.set(cell,[panel]);
 }
 for(const panel of panels){
  if(!small[panel.array])continue;
  const surface=arrays[panel.array].hostObstacleId;
  for(const cell of cells(panel,distanceLimit)){
   for(const other of grid.get(cell)??[]){
    const a=root(panel.array),b=root(other.array);
    if(a===b||surface!==arrays[other.array].hostObstacleId||!nearby(panel,other))continue;
    parent[b]=a;counts[a]+=counts[b];
   }
  }
 }
 return arrays.filter((_,i)=>counts[root(i)]>2);
}
