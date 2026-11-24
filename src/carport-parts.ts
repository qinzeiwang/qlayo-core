import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {PVArray} from './domain';
import {carportModel,PURLIN,type FrameProfile} from './carport-frame';
/** Site finishes, matte as built: white powder-coated frames, plates and nuts; hot-dip galvanised purlins and tie rods; mill-finish aluminium channels; black junction boxes; white road paint. */
export const CARPORT_FINISHES={
 white:{color:'#e4e4df',roughness:.75,metalness:0,envMapIntensity:.35},
 galvanised:{color:'#9da2a4',roughness:.72,metalness:.25,envMapIntensity:.3},
 aluminium:{color:'#bcc0c2',roughness:.6,metalness:.3,envMapIntensity:.35},
 black:{color:'#161819',roughness:.7,metalness:0,envMapIntensity:.5},
 paint:{color:'#e6e6e0',roughness:.9,metalness:0,envMapIntensity:.2},
};
export type CarportFinish=keyof typeof CARPORT_FINISHES;
/** One kind of carport part: a shared geometry placed by world matrices. */
export type CarportPart={name:string;geometry:T.BufferGeometry;finish:CarportFinish;matrices:T.Matrix4[];shadow:boolean};
/** Flange plates along the frame edge (all but the ground cut), as a thin ribbon on the inside of the outline. */
function flangeRibbon(points:[number,number][],width:number,t:number){
 let area=0;for(let i=0;i<points.length;i++){const [x,y]=points[i],[u,v]=points[(i+1)%points.length];area+=x*v-u*y;}
 const inward=area>0?1:-1,open=[...points.slice(1),points[0]],pos:number[]=[];
 const normal=(i:number)=>{const p=open[Math.max(0,i-1)],q=open[Math.min(open.length-1,i+1)],dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy)||1;return [-dy/l*inward,dx/l*inward];};
 const quad=(a:number[],b:number[],c:number[],d:number[])=>pos.push(...a,...b,...c,...a,...c,...d);
 for(let i=0;i+1<open.length;i++){const [x0,y0]=open[i],[x1,y1]=open[i+1],n0=normal(i),n1=normal(i+1),h=width/2;
  const o0=[x0,y0],o1=[x1,y1],i0=[x0+n0[0]*t,y0+n0[1]*t],i1=[x1+n1[0]*t,y1+n1[1]*t];
  quad([...o0,h],[...o0,-h],[...o1,-h],[...o1,h]);quad([...i0,-h],[...i0,h],[...i1,h],[...i1,-h]);
  quad([...o0,h],[...o1,h],[...i1,h],[...i0,h]);quad([...o0,-h],[...i0,-h],[...i1,-h],[...o1,-h]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}
/** One frame: the holed web plate plus its flanges, in the frame's x-y plane. */
function frameGeometry(p:FrameProfile,flange:number){
 const shape=new T.Shape(p.outline.map(([x,y])=>new T.Vector2(x,y)));
 for(const h of p.holes){const path=new T.Path();path.absarc(h.x,h.y,h.r,0,Math.PI*2,true);shape.holes.push(path);}
 const web=new T.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:false,curveSegments:16}).translate(0,0,-.006);web.deleteAttribute('uv');
 const ribbon=flangeRibbon(p.outline,flange,.014),merged=mergeGeometries([web,ribbon])!;web.dispose();ribbon.dispose();return merged;
}
/** A thin-walled profile in x-y, extruded 1 m along z and centred, for scaling to length. */
function profileGeometry(points:[number,number][]){const g=new T.ExtrudeGeometry(new T.Shape(points.map(([x,y])=>new T.Vector2(x,y))),{depth:1,bevelEnabled:false}).translate(0,0,-.5);g.deleteAttribute('uv');return g;}
/** U channel open at the top with small outward lips (water channels, gutter). */
const uChannel=(w:number,h:number,t:number,lip:number):[number,number][]=>[[-w/2+t,h/2],[-w/2-lip,h/2],[-w/2-lip,h/2-t],[-w/2,h/2-t],[-w/2,-h/2],[w/2,-h/2],[w/2,h/2-t],[w/2+lip,h/2-t],[w/2+lip,h/2],[w/2-t,h/2],[w/2-t,-h/2+t],[-w/2+t,-h/2+t]];
/** A folded sheet: an open centre line thickened to t (mitred corners), as a closed outline. */
function sheet(line:[number,number][],t:number):[number,number][]{
 const n=(a:[number,number],b:[number,number])=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return [-dy/l,dx/l];};
 const side=(s:number)=>line.map((p,i)=>{const n1=n(line[Math.max(0,i-1)],line[Math.max(1,i)]),n2=n(line[Math.min(i,line.length-2)],line[Math.min(i+1,line.length-1)]),mx=n1[0]+n2[0],my=n1[1]+n2[1],ml=Math.hypot(mx,my)||1,d=t/2/Math.max(.3,(mx*n1[0]+my*n1[1])/ml);return [p[0]+s*mx/ml*d,p[1]+s*my/ml*d] as [number,number];});
 return [...side(1),...side(-1).reverse()];
}
/** Main water channel as rolled: lipped top edges, sloped sides with a step, and two ridges along the bottom (open at the top). */
const mainChannel=(w:number,h:number):[number,number][]=>{const x=w/2,y=h/2,r=h*.28,b=w*.1;return [[-x-.018,y],[-x,y],[-x+.008,y-h*.45],[-x+.016,y-h*.5],[-x+.02,-y],
 [-3*b,-y],[-2.5*b,-y+r],[-1.5*b,-y+r],[-b,-y],[b,-y],[1.5*b,-y+r],[2.5*b,-y+r],[3*b,-y],
 [x-.02,-y],[x-.016,y-h*.5],[x-.008,y-h*.45],[x,y],[x+.018,y]];};
/** Lipped C purlin, opening sideways. */
const cPurlin=(w:number,h:number,t:number,l:number):[number,number][]=>[[w/2,h/2],[-w/2,h/2],[-w/2,-h/2],[w/2,-h/2],[w/2,-h/2+l],[w/2-t,-h/2+l],[w/2-t,-h/2+t],[-w/2+t,-h/2+t],[-w/2+t,h/2-t],[w/2-t,h/2-t],[w/2-t,h/2-l],[w/2,h/2-l]];
/** Every carport part with its geometry and finish: the one source for the 3D view, photo match and the Blender export. */
export function carportParts(arrays:PVArray[]):CarportPart[]{
 const m=carportModel(arrays);if(!m.columns.length)return [];
 const box=new T.BoxGeometry(1,1,1),part=(name:string,geometry:T.BufferGeometry,finish:CarportFinish,matrices:T.Matrix4[],shadow=true):CarportPart=>({name,geometry,finish,matrices,shadow});
 const parts=[
  ...m.frames.map((f,i)=>part('frame '+(i+1),frameGeometry(f.profile,f.flange),'white',f.matrices)),
  part('base and joint plates',box,'white',m.plates),part('anchor nuts',box,'white',m.bolts,false),
  part('column tubes',new T.CylinderGeometry(1,1,1,18),'white',m.tubes),
  part('C purlins',profileGeometry(cPurlin(.05,PURLIN,.004,.015)),'galvanised',m.purlins),
  part('main water channels',profileGeometry(sheet(mainChannel(.15,.06),.003)),'aluminium',m.mains),
  part('secondary water channels',profileGeometry(uChannel(.07,.035,.0025,.012)),'aluminium',m.seconds,false),
  part('gutters',profileGeometry(uChannel(.25,.18,.003,.025)),'aluminium',m.gutters),
  part('tie rods',new T.CylinderGeometry(1,1,1,6),'galvanised',m.rods,false),
  part('junction boxes',box,'black',m.junctions,false),
  part('parking lines',box,'paint',m.lines,false),
 ];
 for(const p of parts)if(!p.matrices.length&&p.geometry!==box)p.geometry.dispose();
 return parts.filter(p=>p.matrices.length);
}
export const disposeCarportParts=(parts:CarportPart[])=>new Set(parts.map(p=>p.geometry)).forEach(g=>g.dispose());
export const carportMaterials=()=>Object.fromEntries(Object.entries(CARPORT_FINISHES).map(([k,v])=>[k,new T.MeshStandardMaterial(v)])) as Record<CarportFinish,T.MeshStandardMaterial>;
/** Carport parts as plain instanced meshes, for scenes built without React (photo match: no painted lines, the real site may have none). */
export function carportMeshes(arrays:PVArray[]){
 const materials=carportMaterials();
 return carportParts(arrays).filter(p=>p.name!=='parking lines').map(p=>{const mesh=new T.InstancedMesh(p.geometry,materials[p.finish],p.matrices.length);p.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=p.shadow;mesh.receiveShadow=true;mesh.name='Carport '+p.name;return mesh;});
}
