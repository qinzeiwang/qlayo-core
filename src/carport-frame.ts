import * as T from 'three';
import {geometry,type PVArray} from './domain';
/** Ground level of the 3D scene, local y. */
const GROUND=-3.5;
/** Purlin depth, m. */
export const PURLIN=.12;
/** Stack under the panel plane P(x), top down (as built): thin water channels along the run (top +0.02, 0.035 deep) under the panel side joints, main water channels down the slope (0.06) under the row joints, C purlins along the run (0.12), then the beam top. */
const CHANNEL_TOP=.02,SECOND_DEPTH=.035,MAIN_DEPTH=.06,MAIN_TOP=CHANNEL_TOP-SECOND_DEPTH,BEAM_TOP=MAIN_TOP-MAIN_DEPTH-PURLIN;
export type FrameProfile={outline:[number,number][];holes:{x:number;y:number;r:number}[];column:number;width:number;tube:number;joints:{x:number;y:number;angle:number;depth:number}[];tubeX?:number;tubeR?:number};
type FrameInput={top:(x:number)=>number;kinks:number[];left:number;right:number;column:number;columnWidth:number;deep:number;tip:number;knee:[number,number];/** Single frames: side the roof rises to (+1/-1); the tie tube then runs through the highest beam hole, not the column. */tie?:number};
/** Side outline of one frame in its own x-y plane: straight H column, arched knees, tapered beam with rounded tips, round web holes. */
export function frameProfile(o:FrameInput):FrameProfile{
 const {top,left,right,column:xc,columnWidth:cw,deep,tip}=o,a=xc+cw/2,b=xc-cw/2,G=GROUND;
 const depth=(x:number)=>x>=b&&x<=a?deep:x>a?deep+(tip-deep)*(x-a)/(right-a):deep+(tip-deep)*(b-x)/(b-left);
 const bottom=(x:number)=>top(x)-depth(x),mid=(x:number)=>top(x)-depth(x)/2;
 const out:[number,number][]=[],arc=(cx:number,cy:number,r:number,from:number,to:number,n=14)=>{for(let i=1;i<=n;i++){const t=from+(to-from)*i/n;out.push([cx+r*Math.cos(t),cy+r*Math.sin(t)]);}};
 // Knee arches: circles tangent to the column side and the beam bottom.
 const mR=(bottom(right)-bottom(a))/(right-a),kR=Math.hypot(1,mR),rR=Math.max(.1,Math.min(o.knee[1],(right-a)*.45,(bottom(a)-G)*.45));
 const cxR=a+rR,cyR=bottom(a)+mR*rR-rR*kR,endR=cxR-rR*mR/kR;
 const mL=(bottom(b)-bottom(left))/(b-left),kL=Math.hypot(1,mL),rL=Math.max(.1,Math.min(o.knee[0],(b-left)*.45,(bottom(b)-G)*.45));
 const cxL=b-rL,cyL=bottom(b)-mL*rL-rL*kL,endL=cxL-rL*mL/kL;
 const round=Math.min(tip*.9,.2);
 out.push([b,G],[a,G],[a,cyR]);arc(cxR,cyR,rR,Math.PI,Math.atan2(1,-mR));
 out.push([right-round,bottom(right-round)]);
 const tipR=Math.min(bottom(right-round)+round,top(right)-.01);arc(right-round,tipR,round,-Math.PI/2,0,8);out.push([right,top(right)]);
 for(const x of o.kinks.filter(x=>x<right&&x>left).sort((p,q)=>q-p))out.push([x,top(x)]);
 out.push([left,top(left)]);
 const tipL=Math.min(bottom(left+round)+round,top(left)-.01);out.push([left,tipL]);arc(left+round,tipL,round,Math.PI,Math.PI*1.5,8);
 out.push([endL,bottom(endL)+0]);
 const start=Math.atan2(1,-mL);for(let i=1;i<=14;i++){const t=start*(1-i/14);out.push([cxL+rL*Math.cos(t),cyL+rL*Math.sin(t)]);}
 // Holes: a row along the beam middle on both arms, a column of holes up the post.
 const holes:FrameProfile['holes']=[];
 for(let x=endR+.45;x<right-.45;x+=.9)holes.push({x,y:mid(x),r:Math.min(.075,depth(x)*.27)});
 for(let x=endL-.45;x>left+.45;x-=.9)holes.push({x,y:mid(x),r:Math.min(.075,depth(x)*.27)});
 const high=o.tie?holes.filter(h=>o.tie!*(h.x-xc)>0).sort((p,q)=>o.tie!*(q.x-p.x))[0]:undefined,knees=Math.min(cyL,cyR);for(let y=G+.7;y<knees-.3;y+=.65)holes.push({x:xc,y,r:Math.min(.08,cw*.22)});
 const joint=(x:number)=>({x,y:mid(x),angle:Math.atan((mid(x+.01)-mid(x))/.01),depth:depth(x)});
 return {outline:out,holes,column:xc,width:cw,...(high?{tube:high.y,tubeX:high.x,tubeR:high.r*.8}:{tube:knees-.15}),joints:[endR+.15<right-.3?joint(endR+.15):null,endL-.15>left+.3?joint(endL-.15):null].filter(j=>!!j)};
}
/** Single carport frame styles: straight H column with knees (default), or the curved "7" column on the low side with a back fin. */
export type CarportFrameStyle='curved';
/** Column centre of a single carport frame, wing-local x: low side, near the back end for the curved frame. */
export const carportColumnX=(width:number,sx:number,style?:CarportFrameStyle)=>-Math.sign(sx||1)*(style==='curved'?width/2+.03-Math.min(1.25,width*.21):width*.3);
const segmentDistance=(x:number,y:number,[ax,ay]:[number,number],[bx,by]:[number,number])=>{const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-ax-t*dx,y-ay-t*dy);};
const insideOutline=(pts:[number,number][],x:number,y:number)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
/** Hole fits in the web with some steel left around it. */
const holeFits=(pts:[number,number][],h:{x:number;y:number;r:number})=>insideOutline(pts,h.x,h.y)&&pts.every((p,i)=>segmentDistance(h.x,h.y,p,pts[(i+1)%pts.length])>h.r+.05);
/** Side outline of the curved "7" frame: one bent column near the low (back) end that leans back as it rises and sweeps forward into a cantilever beam thinning to the front tip, a concave fin behind the column, round web holes. Built with the tip toward +x, then mirrored when the roof rises toward -x. */
export function curvedProfile(o:{top:(x:number)=>number;width:number;sx:number}):FrameProfile{
 const dir=Math.sign(o.sx||1),top=(u:number)=>o.top(dir*u),G=GROUND,L=-o.width/2-.03,R=o.width/2+.03,xc=dir*carportColumnX(o.width,o.sx,'curved'),cw=.5,a=xc+cw/2,b=xc-cw/2,deep=.42,tip=.15,back=.24;
 const depth=(u:number)=>u<=a?back+(deep-back)*(u-L)/(a-L):deep+(tip-deep)*(u-a)/(R-a);
 const bottom=(u:number)=>top(u)-depth(u),mid=(u:number)=>top(u)-depth(u)/2;
 type P=[number,number];
 const bez=(p:P[],t:number):P=>{const s=1-t;return [0,1].map(i=>s*s*s*p[0][i]+3*s*s*t*p[1][i]+3*s*t*t*p[2][i]+t*t*t*p[3][i]) as P;};
 const out:P[]=[],sweep=(p:P[],n=24)=>{for(let i=1;i<=n;i++)out.push(bez(p,i/n));};
 // Front: the column leans well back off its base plate and bends forward on one long curve, running tangent into the beam bottom (a banana, no straight part).
 const m=(bottom(R)-bottom(a))/(R-a),k=Math.hypot(1,m),end=a+Math.max(1.2,Math.min(2.6,(R-a)*.45)),E:P=[end,bottom(end)],H=E[1]-G,h=Math.min(1.8,(end-a)*.9);
 const front:P[]=[[a,G],[a-Math.min(.5,H*.2),G+H*.45],[end-h/k,E[1]-h*m/k],E];
 // Back: a parallel side (same bend, column slightly wider at the top) up to where a concave fin from the beam's back end meets it.
 const tangent=(t:number):P=>{const s=1-t,d=[0,1].map(i=>3*s*s*(front[1][i]-front[0][i])+6*s*t*(front[2][i]-front[1][i])+3*t*t*(front[3][i]-front[2][i])),n=Math.hypot(d[0],d[1])||1;return [d[0]/n,d[1]/n];};
 const side=(t:number,w:number):P=>{const f=bez(front,t),d=tangent(t);return [f[0]-d[1]*w,f[1]+d[0]*w];},width=(t:number)=>cw+.2*t*t;
 const finTop=bottom(L),finY=Math.max(G+1.2,finTop-Math.max(.5,Math.min(.8,(finTop-G)*.3)));
 const backSide:P[]=[[b,G]];let cut=1;for(let i=1;i<=40;i++){const q=side(i/40,width(i/40));if(q[1]>=finY){cut=i/40;backSide.push(q);break;}if(q[1]>G+.05)backSide.push(q);}
 const Q=backSide[backSide.length-1];
 const round=Math.min(tip*.9,.2);
 out.push([b,G],[a,G]);sweep(front);
 out.push([R-round,bottom(R-round)]);
 const tipY=Math.min(bottom(R-round)+round,top(R)-.01),tipArc=(f:number,t:number)=>{for(let i=1;i<=8;i++){const s=f+(t-f)*i/8;out.push([R-round+round*Math.cos(s),tipY+round*Math.sin(s)]);}};
 tipArc(-Math.PI/2,0);out.push([R,top(R)],[L,top(L)],[L,bottom(L)]);
 const fin:P[]=[[L,finTop],[Q[0]-(Q[0]-L)*.15,finTop],[Q[0]-(Q[0]-L)*.05,(finTop+Q[1])/2],Q];sweep(fin,14);
 for(let i=backSide.length-2;i>=1;i--)out.push(backSide[i]);
 // Holes: a row along the beam and one in the fin, none in the column (as built); only those with steel around them.
 const holes:FrameProfile['holes']=[];
 for(let u=end+.45;u<R-.45;u+=.9)holes.push({x:u,y:mid(u),r:Math.min(.075,depth(u)*.27)});
 const centre=(t:number)=>side(t,width(t)/2);
 holes.push({x:L+(Q[0]-L)*.6,y:finTop-(finTop-Q[1])*.3,r:.06});
 const kept:FrameProfile['holes']=[];for(const h of holes)if(holeFits(out,h)&&kept.every(q=>Math.hypot(q.x-h.x,q.y-h.y)>q.r+h.r+.12))kept.push(h);
 const flip=(x:number)=>dir*x,ja=end+.15,angle=Math.atan((mid(ja+.01)-mid(ja))/.01);
 // Tie tube through the beam's front (highest) hole, as built; a slightly smaller tube so it fits the hole.
 const first=kept.filter(h=>h.x>end).sort((p,q)=>q.x-p.x)[0],c=centre(cut*.85),tie=first?{x:first.x,y:first.y,r:first.r*.8}:{x:c[0],y:c[1],r:.07};
 return {outline:out.map(([x,y])=>[flip(x),y]),holes:kept.map(h=>({...h,x:flip(h.x)})),column:flip(xc),width:cw,tube:tie.y,tubeX:flip(tie.x),tubeR:tie.r,joints:ja<R-.3?[{x:flip(ja),y:mid(ja),angle:dir*angle,depth:depth(ja)}]:[]};
}
export type CarportFrame={profile:FrameProfile;flange:number;matrices:T.Matrix4[]};
export type CarportModel={frames:CarportFrame[];plates:T.Matrix4[];bolts:T.Matrix4[];junctions:T.Matrix4[];purlins:T.Matrix4[];mains:T.Matrix4[];seconds:T.Matrix4[];gutters:T.Matrix4[];rods:T.Matrix4[];tubes:T.Matrix4[];columns:T.Vector3[];/** Painted parking lines on the ground. */lines:T.Matrix4[];/** One per parking bay, on the ground at its centre; local x runs along the car. */bays:T.Matrix4[]};
const Y=new T.Vector3(0,1,0),Zaxis=new T.Vector3(0,0,1);
const rootOf=(x:number,z:number,yaw:number)=>new T.Matrix4().compose(new T.Vector3(x,0,z),new T.Quaternion().setFromAxisAngle(Y,yaw),new T.Vector3(1,1,1));
const local=(x:number,y:number,z:number,sx=1,sy=1,sz=1,q=new T.Quaternion())=>new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(sx,sy,sz));
const roll=(angle:number,then?:T.Quaternion)=>{const q=new T.Quaternion().setFromAxisAngle(Zaxis,angle);return then?q.multiply(then):q;};
/** A unit cylinder (along y) stretched between two points. */
const between=(p:T.Vector3,q:T.Vector3,r:number)=>{const d=q.clone().sub(p);return local((p.x+q.x)/2,(p.y+q.y)/2,(p.z+q.z)/2,r,d.length(),r,new T.Quaternion().setFromUnitVectors(Y,d.normalize()));};
/** Frame stations along a run: one every ~5 m, as before. */
export const frameStations=(depth:number)=>{const n=Math.max(1,Math.ceil(depth/5)),span=Math.max(0,depth-.5);return Array.from({length:n+1},(_,i)=>-span/2+span*i/n);};
/** The other wing of a double carport: same run, opposite slope, side by side along the array's x. */
function partner(a:PVArray,arrays:PVArray[]){
 const g=geometry(a),ax=new T.Vector3(Math.cos(g.yaw),0,-Math.sin(g.yaw));
 return arrays.find(b=>{if(b===a||b.mounting!=='carport'||!b.surface||b.rows!==a.rows||Math.abs(b.surface.sx+a.surface!.sx)>1e-6||Math.abs(geometry(b).yaw-g.yaw)>1e-6)return false;
  const d=new T.Vector3(b.x-a.x,0,b.z-a.z),along=d.dot(ax),side=d.clone().addScaledVector(ax,-along).length();
  return side<.05&&along>g.width-.01&&along<g.width+.6;});
}
/** Everything under carport panels, in world matrices for unit parts (boxes, C/U profiles along z, cylinders along y). */
export function carportModel(arrays:PVArray[]):CarportModel{
 const m:CarportModel={frames:[],plates:[],bolts:[],junctions:[],purlins:[],mains:[],seconds:[],gutters:[],rods:[],tubes:[],columns:[],lines:[],bays:[]};
 const carports=arrays.filter(a=>a.mounting==='carport'&&a.surface),used=new Set<PVArray>();
 for(const a of carports){if(used.has(a))continue;used.add(a);
  const g=geometry(a),s=a.surface!,mate=s.sx<0?partner(a,carports):undefined;if(mate)used.add(mate);
  const wings=mate?[a,mate]:[a],stations=frameStations(g.depth);
  // Purlins, water channels and tie rods belong to each wing and follow its plane.
  for(const w of wings){const wg=geometry(w),ws=w.surface!,root=rootOf(w.x,w.z,wg.yaw),P=(x:number)=>ws.height+ws.sx*x,r=Math.atan(ws.sx),k=Math.sqrt(1+ws.sx*ws.sx);
   const mod=w.module,gap=mod?.gap??.02,colPitch=(wg.w+gap)/k,rowPitch=wg.l+gap,W=wg.width,L=wg.depth;
   const span=W-.5,n=Math.max(2,Math.ceil(span/1.4)+1);
   for(let i=0;i<n;i++){const x=-span/2+span*i/(n-1);m.purlins.push(root.clone().multiply(local(x,P(x)+BEAM_TOP+PURLIN/2,0,1,1,L+.2,roll(r))));}
   const rowsZ=Array.from({length:w.rows+1},(_,i)=>i===0?-L/2:i===w.rows?L/2:-L/2+i*rowPitch-gap/2);
   for(const z of rowsZ)m.mains.push(root.clone().multiply(local(0,P(0)+MAIN_TOP-MAIN_DEPTH/2,z,1,1,W*k+.1,roll(r,new T.Quaternion().setFromAxisAngle(Y,Math.PI/2)))));
   const colsX=[-W/2,...Array.from({length:w.columns-1},(_,i)=>(i+.5)*colPitch-(w.columns-1)*colPitch/2),W/2];
   for(const x of colsX)m.seconds.push(root.clone().multiply(local(x,P(x)+CHANNEL_TOP-SECOND_DEPTH/2,0,1,1,L+.1,roll(r))));
   const rodY=(x:number)=>P(x)+BEAM_TOP+PURLIN*.4,x1=-W/2+.35,x2=W/2-.35;
   for(let f=0;f+1<stations.length;f+=2)for(const [p,q] of [[x1,x2],[x2,x1]]){const from=new T.Vector3(p,rodY(p),stations[f]+.1).applyMatrix4(root),to=new T.Vector3(q,rodY(q),stations[f+1]-.1).applyMatrix4(root);m.rods.push(between(from,to,.009));}
   // A black junction box on each panel back, near its upper end, as seen from below.
   for(const p of wg.panels)m.junctions.push(root.clone().multiply(local(p.x,P(p.x)+.012,p.z+wg.l*.36,.14,.022,.09,roll(r))));
   if(!mate){const low=ws.sx>0?-W/2:W/2;m.gutters.push(root.clone().multiply(local(low,P(low)-.09,0,1,1,L+.2)));}
   // Parking bays under each wing: cars across the slope, dividing lines on the frame stations (columns stand on them) and between them, bays 2.2-4.4 m wide.
   const bay=Math.min(5.3,W-.2),edges:number[]=[];
   for(let f=0;f+1<stations.length;f++){const s=stations[f+1]-stations[f],k=Math.max(1,Math.floor(s/2.2));for(let i=0;i<k;i++)edges.push(stations[f]+s*i/k);}
   edges.push(stations[stations.length-1]);const run=edges[edges.length-1]-edges[0];
   for(const z of edges)m.lines.push(root.clone().multiply(local(0,GROUND+.004,z,bay,.008,.15)));
   for(const x of [-bay/2,bay/2])m.lines.push(root.clone().multiply(local(x,GROUND+.004,edges[0]+run/2,.15,.008,run+.15)));
   for(let i=0;i+1<edges.length;i++)m.bays.push(root.clone().multiply(local(0,GROUND,(edges[i]+edges[i+1])/2)));
  }
  // One frame per station: a single wing, or one T frame shared by both wings.
  let root:T.Matrix4,profile:FrameProfile,flange:number;
  if(mate){const ms=mate.surface!,D=Math.hypot(mate.x-a.x,mate.z-a.z),W=g.width,cx=(a.x+mate.x)/2,cz=(a.z+mate.z)/2;root=rootOf(cx,cz,g.yaw);
   const top=(x:number)=>(x<0?s.height+s.sx*(x+D/2):ms.height+ms.sx*(x-D/2))+BEAM_TOP;
   profile=frameProfile({top,kinks:[0],left:-D/2-W/2-.03,right:D/2+W/2+.03,column:0,columnWidth:.45,deep:.5,tip:.16,knee:[1.2,1.2]});flange=.22;
   const low=Math.min(s.height+s.sx*W/2,ms.height-ms.sx*W/2);m.gutters.push(root.clone().multiply(local(0,low-.11,0,1.4,1.2,g.depth+.2)));
  }else{root=rootOf(a.x,a.z,g.yaw);const W=g.width,dir=Math.sign(s.sx||1),xc=carportColumnX(W,s.sx);
   const top=(x:number)=>s.height+s.sx*x+BEAM_TOP;
   profile=a.carportFrame==='curved'?curvedProfile({top,width:W,sx:s.sx}):frameProfile({top,kinks:[],left:-W/2-.03,right:W/2+.03,column:xc,columnWidth:.35,deep:.45,tip:.16,knee:dir>0?[.6,1.1]:[1.1,.6],tie:dir});flange=.2;
  }
  const xc=profile.column,cw=profile.width;
  m.frames.push({profile,flange,matrices:stations.map(z=>root.clone().multiply(local(0,0,z)))});
  for(const z of stations){m.columns.push(new T.Vector3(xc,GROUND,z).applyMatrix4(root));
   m.plates.push(root.clone().multiply(local(xc,GROUND+.015,z,cw+.3,.03,flange+.34)));
   for(const sz of [-1,1])for(const sx of [-1,1]){m.bolts.push(root.clone().multiply(local(xc+sx*(cw/2+.08),GROUND+.05,z+sz*(flange/2+.11),.05,.04,.05)));}
   for(const j of profile.joints)m.plates.push(root.clone().multiply(local(j.x,j.y,z,.025,j.depth+.05,flange+.03,roll(j.angle))));
  }
  for(let f=0;f+1<stations.length;f++){const tx=profile.tubeX??xc;m.tubes.push(between(new T.Vector3(tx,profile.tube,stations[f]).applyMatrix4(root),new T.Vector3(tx,profile.tube,stations[f+1]).applyMatrix4(root),profile.tubeR??.07));}
 }
 return m;
}
