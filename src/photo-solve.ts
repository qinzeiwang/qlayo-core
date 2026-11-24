import {linear} from './photo-camera';
import type {PhotoLine,PhotoPoint,PhotoView,SitePoint} from './photo-match';
import {tx} from './i18n';
/** Ground level in Three.js world coordinates (the project's vertical datum). */
export const GROUND=-3.5;
type V=number[];
/** A pinhole camera in Three.js world coordinates. `R` turns world directions into camera axes (right, down, forward); `C` is where the camera stands.
 * `f`, `cx`, `cy` are in photo pixels. `lens` says where the focal length came from; `assumed` means the drawn lines could not fix it. */
export type PhotoCamera={R:number[][];C:V;f:number;cx:number;cy:number;rmse:number;lens:'measured'|'file'|'typed'|'assumed';lens35:number;
 /** Relative uncertainty of a measured focal length (0.1 = ±10%). */
 lensError:number;height:number;heightError:number;tilt:number;forward:V};
export type PhotoCheck={id:string;meters:number;measured:number};
export type PhotoSolve={camera?:PhotoCamera;missing:string[];warnings:string[];checks:PhotoCheck[]};
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V,b:V)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:V)=>{const n=Math.hypot(a[0],a[1],a[2]);return a.map(v=>v/n);};
const mul=(M:number[][],a:V)=>M.map(r=>dot(r,a));
const transpose=(M:number[][])=>M[0].map((_,j)=>M.map(r=>r[j]));
const matmul=(A:number[][],B:number[][])=>A.map(r=>B[0].map((_,j)=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));
function rodrigues(w:V){
 const t=Math.hypot(w[0],w[1],w[2]);if(t<1e-12)return [[1,0,0],[0,1,0],[0,0,1]];
 const [x,y,z]=w.map(v=>v/t),c=Math.cos(t),s=Math.sin(t),k=1-c;
 return [[c+x*x*k,x*y*k-z*s,x*z*k+y*s],[y*x*k+z*s,c+y*y*k,y*z*k-x*s],[z*x*k-y*s,z*y*k+x*s,c+z*z*k]];
}
// Eigenvector of the smallest eigenvalue of a symmetric 3×3 matrix (Jacobi rotations).
export function smallestEigenvector(A:number[][]){
 const a=A.map(r=>[...r]),v=[[1,0,0],[0,1,0],[0,0,1]];
 for(let sweep=0;sweep<50;sweep++)for(const [p,q] of [[0,1],[0,2],[1,2]]){
  if(Math.abs(a[p][q])<1e-18)continue;
  const th=(a[q][q]-a[p][p])/(2*a[p][q]),t=Math.sign(th||1)/(Math.abs(th)+Math.sqrt(th*th+1)),c=1/Math.sqrt(t*t+1),s=t*c;
  for(let k=0;k<3;k++){const kp=a[k][p],kq=a[k][q];a[k][p]=c*kp-s*kq;a[k][q]=s*kp+c*kq;}
  for(let k=0;k<3;k++){const pk=a[p][k],qk=a[q][k];a[p][k]=c*pk-s*qk;a[q][k]=s*pk+c*qk;}
  for(let k=0;k<3;k++){const kp=v[k][p],kq=v[k][q];v[k][p]=c*kp-s*kq;v[k][q]=s*kp+c*kq;}
 }
 const i=[0,1,2].reduce((m,j)=>a[j][j]<a[m][m]?j:m,0);return unit([v[0][i],v[1][i],v[2][i]]);
}
/** Where lines that are parallel in reality meet, as a homogeneous point in photo coordinates centred on (cx, cy) and divided by s. Undefined for fewer than two usable lines. */
function vanishing(lines:PhotoLine[],cx:number,cy:number,s:number){
 const ls=lines.map(l=>{const h=cross([(l.a.x-cx)/s,(l.a.y-cy)/s,1],[(l.b.x-cx)/s,(l.b.y-cy)/s,1]),n=Math.hypot(h[0],h[1]);return n>1e-9?h.map(v=>v/n):undefined;}).filter((l):l is V=>!!l);
 if(ls.length<2)return;
 if(ls.length===2){const v=cross(ls[0],ls[1]);return Math.hypot(v[0],v[1],v[2])>1e-12?unit(v):undefined;}
 return smallestEigenvector([0,1,2].map(i=>[0,1,2].map(j=>ls.reduce((sum,l)=>sum+l[i]*l[j],0))));
}
// A vanishing point inside about 20 photo widths of the centre; farther ones say little about the focal length.
const finite=(v:V)=>Math.abs(v[2])*20>Math.hypot(v[0],v[1]);
export function projectPoint(c:PhotoCamera,X:V):PhotoPoint|undefined{
 const p=mul(c.R,X.map((x,i)=>x-c.C[i]));return p[2]>1e-6?{x:c.f*p[0]/p[2]+c.cx,y:c.f*p[1]/p[2]+c.cy}:undefined;
}
/** A world segment in photo pixels, cut where it passes behind the camera. */
export function projectSegment(c:PhotoCamera,A:V,B:V):[PhotoPoint,PhotoPoint]|undefined{
 const near=.1,a=mul(c.R,A.map((x,i)=>x-c.C[i])),b=mul(c.R,B.map((x,i)=>x-c.C[i]));if(a[2]<near&&b[2]<near)return;
 const cut=(p:V,q:V)=>{const t=(near-p[2])/(q[2]-p[2]);return p.map((x,i)=>x+t*(q[i]-x));},pixel=(v:V)=>({x:c.f*v[0]/v[2]+c.cx,y:c.f*v[1]/v[2]+c.cy});
 return [pixel(a[2]<near?cut(a,b):a),pixel(b[2]<near?cut(b,a):b)];
}
/** The horizon across the photo width: pixels whose rays are level. */
export function horizonLine(c:PhotoCamera,width:number):[PhotoPoint,PhotoPoint]|undefined{
 const n=[c.R[0][1],c.R[1][1],c.R[2][1]],l=[n[0]/c.f,n[1]/c.f,n[2]-(c.cx*n[0]+c.cy*n[1])/c.f];if(Math.abs(l[1])<1e-12)return;
 const y=(x:number)=>-(l[0]*x+l[2])/l[1];return [{x:0,y:y(0)},{x:width,y:y(width)}];
}
/** The ground point seen at photo pixel p, or undefined above the horizon. */
export function groundPoint(c:PhotoCamera,p:PhotoPoint){
 const d=mul(transpose(c.R),[(p.x-c.cx)/c.f,(p.y-c.cy)/c.f,1]);if(d[1]>=-1e-9)return;
 const t=(GROUND-c.C[1])/d[1];return [c.C[0]+t*d[0],GROUND,c.C[2]+t*d[2]];
}
/** Compass direction of a world vector, 0° = north, 90° = east, using the drawing's north angle as sunPosition does. */
export function compassAzimuth(forward:V,northAngle=0){
 const n=northAngle*Math.PI/180,east=forward[0]*Math.cos(n)+forward[2]*Math.sin(n),south=-forward[0]*Math.sin(n)+forward[2]*Math.cos(n);
 return (Math.atan2(east,-south)*180/Math.PI+360)%360;
}
const FILM_DIAGONAL=43.27; // mm, the 35 mm film frame
/** Find the camera from what the user drew on one photo: line sets fix tilt, roll and lens; the reference line (photo + plan) fixes position, heading and scale. */
export function solvePhotoCamera(v:PhotoView):PhotoSolve{
 const W=v.width,H=v.height,cx=W/2,cy=H/2,s=Math.max(W,H),diag=Math.hypot(W,H),lines=v.lines??[],ref=v.reference??{};
 const of=(k:PhotoLine['kind'])=>lines.filter(l=>l.kind===k),along=of('along'),across=of('across'),vertical=of('vertical');
 const missing:string[]=[],warnings:string[]=[];
 if(!ref.a||!ref.b)missing.push(tx('在照片中画参考线：沿一条在平面图上也能找到的地面边线'));
 if(!ref.planA||!ref.planB)missing.push(tx('在平面图上画出同一条参考线'));
 if(vertical.length<2&&!(along.length>=2&&across.length>=2))missing.push(tx('画两条竖直线：墙角、柱子或灯杆'));
 if(missing.length)return {missing,warnings,checks:[]};
 const a=ref.a!,b=ref.b!,P1=[ref.planA!.x,GROUND,ref.planA!.z],P2=[ref.planB!.x,GROUND,ref.planB!.z],planLength=Math.hypot(P2[0]-P1[0],P2[2]-P1[2]);
 if(planLength<.1)return {missing:[tx('平面图上的参考线太短')],warnings,checks:[]};
 const vp={along:vanishing(along,cx,cy,s),across:vanishing(across,cx,cy,s),vertical:vanishing(vertical,cx,cy,s)};
 const known=v.lens35?v.lens35/FILM_DIAGONAL*diag:undefined,typical=26/FILM_DIAGONAL*diag,starts:number[]=[];
 if(known)starts.push(known);
 for(const [p,q] of [['along','vertical'],['across','vertical'],['along','across']] as const){const m=vp[p],n=vp[q];if(m&&n&&finite(m)&&finite(n)){const f2=-s*s*(m[0]*n[0]+m[1]*n[1])/(m[2]*n[2]);if(f2>(.15*s)**2&&f2<(8*s)**2)starts.push(Math.sqrt(f2));}}
 if(!known)starts.push(...[.45,.6,.8,1.1].map(k=>k*diag));
 let horizon=false;
 // Closed-form start: rays to the reference ends meet the ground; matching them to the plan line gives heading, position and scale.
 function initial(f:number){
  const dir=(k:'along'|'across'|'vertical')=>{const p=vp[k];return p&&unit([s*p[0],s*p[1],f*p[2]]);};
  let up=dir('vertical')??(vp.along&&vp.across?unit(cross(dir('along')!,dir('across')!)):undefined);if(!up)return;
  const r1=[(a.x-cx)/f,(a.y-cy)/f,1],r2=[(b.x-cx)/f,(b.y-cy)/f,1];
  // Up points toward the top of the photo and, when the camera looks down, backward (camera y is down, z forward).
  if(up[1]+up[2]>0)up=up.map(x=>-x);
  if(!(dot(r1,up)<0&&dot(r2,up)<0)){horizon=true;return;}
  const g1=r1.map(x=>-x/dot(r1,up!)),g2=r2.map(x=>-x/dot(r2,up!)),span=g2.map((x,i)=>x-g1[i]),photoLength=Math.hypot(span[0],span[1],span[2]);
  if(photoLength<1e-9)return;
  const e1=unit(span),E1=unit([P2[0]-P1[0],0,P2[2]-P1[2]]),Y=[0,1,0],cam=[e1,up,cross(e1,up)],world=[E1,Y,cross(E1,Y)];
  const M=[0,1,2].map(i=>[0,1,2].map(j=>world.reduce((sum,w,k)=>sum+w[i]*cam[k][j],0))),scale=planLength/photoLength;
  const C=P1.map((x,i)=>x-scale*mul(M,g1)[i]);
  const heading=(k:'along'|'across')=>{const d=dir(k);if(!d)return;const w=mul(M,d);return Math.atan2(w[2],w[0]);};
  return {R0:transpose(M),C,theta:heading('along')??(heading('across')??Math.PI/2)-Math.PI/2};
 }
 const dataCount=lines.filter(l=>l.kind!=='measure').length+4;
 // Parameters: rotation update (3), camera position (3), log focal length, heading of line set A. Line residuals are pixel distances from each
 // line's end to the line through its middle and the predicted vanishing point; the last entry is the focal-length prior, not data.
 // `sigma` is the spread of the focal-length prior in log units: tight around a known lens, near zero weight otherwise.
 const residualFor=(R0:number[][],sigma:number)=>(p:V)=>{
  const R=matmul(rodrigues(p.slice(0,3)),R0),C=p.slice(3,6),f=Math.exp(p[6]),theta=p[7],out:number[]=[];
  const dirs={along:[Math.cos(theta),0,Math.sin(theta)],across:[-Math.sin(theta),0,Math.cos(theta)],vertical:[0,1,0]};
  for(const l of lines){if(l.kind==='measure')continue;const r=mul(R,dirs[l.kind]),vh=[f*r[0]+cx*r[2],f*r[1]+cy*r[2],r[2]];
   const h=cross([(l.a.x+l.b.x)/2,(l.a.y+l.b.y)/2,1],vh),n=Math.hypot(h[0],h[1]);out.push(n<1e-12?0:dot(h,[l.a.x,l.a.y,1])/n);}
  for(const [pixel,X] of [[a,P1],[b,P2]] as const){const c=mul(R,X.map((x,i)=>x-C[i]));if(c[2]>1e-6)out.push(f*c[0]/c[2]+cx-pixel.x,f*c[1]/c[2]+cy-pixel.y);else out.push(1e4,1e4);}
  out.push((p[6]-Math.log(known??typical))/sigma);
  return out;
 };
 // First trust only the photo (and a known lens); lean on a typical phone lens only when the lines cannot fix the focal length.
 let sigma=known?.05:1000,best:{p:V;R0:number[][];cost:number}|undefined;
 for(const f0 of starts){
  const start=initial(f0);if(!start)continue;
  const fit=refine(residualFor(start.R0,sigma),[0,0,0,...start.C,Math.log(f0),start.theta]);
  if(Number.isFinite(fit.cost)&&(!best||fit.cost<best.cost))best={...fit,R0:start.R0};
 }
 if(!best)return {missing:[horizon?tx('参考线必须画在地面上、地平线以下'):tx('线条无法确定相机，请检查竖直线和地面线')],warnings,checks:[]};
 const rmseOf=(p:V)=>Math.sqrt(dot2(residualFor(best!.R0,sigma)(p).slice(0,dataCount))/dataCount);
 let lensError=spread(residualFor(best.R0,sigma),best.p,Math.max(rmseOf(best.p),1),6);
 // Keep a lens the lines only roughly fix (shown with its ±); assume a typical one only when they say almost nothing.
 if(!known&&lensError>=.5){sigma=.3;best={...refine(residualFor(best.R0,sigma),[...best.p.slice(0,6),Math.log(typical),best.p[7]]),R0:best.R0};}
 const {p,R0}=best,R=matmul(rodrigues(p.slice(0,3)),R0),C=p.slice(3,6),f=Math.exp(p[6]),rmse=rmseOf(p),noise=Math.max(rmse,1);
 const heightError=spread(residualFor(R0,sigma),p,noise,4);
 const lens=known?(v.lensFromFile?'file':'typed'):sigma===.3?'assumed':'measured';
 if(lens==='measured'&&lensError>=.15)warnings.push(tx('镜头焦距只能粗略确定（±{0}%），会影响距离和高度。可再画两条较长、方向与地面线 A 垂直的地面线 B，或填写等效焦距。',Math.round(lensError*100)));
 if(lens==='assumed')warnings.push(tx('线条无法确定镜头焦距，暂按常见手机主摄 26 mm 估算。可再画两条与地面线 A 垂直的地面线 B，或填写等效焦距。'));
 if(rmse>4)warnings.push(tx('线条与参考线不完全一致（平均误差 {0} px），请检查每条线是否画在正确的边上',rmse.toFixed(1)));
 if(planLength<3||Math.hypot(b.x-a.x,b.y-a.y)<.05*diag)warnings.push(tx('参考线较短，位置误差会较大；尽量选更长的边'));
 if(C[1]<GROUND+.2)warnings.push(tx('算出的相机低于地面，请检查参考线是否画在地面上'));
 const camera:PhotoCamera={R,C,f,cx,cy,rmse,lens,lens35:f/diag*FILM_DIAGONAL,lensError,height:C[1]-GROUND,heightError,tilt:Math.asin(Math.max(-1,Math.min(1,-R[2][1])))*180/Math.PI,forward:R[2]};
 const checks=lines.filter(l=>l.kind==='measure'&&l.meters).map(l=>{const p=groundPoint(camera,l.a),q=groundPoint(camera,l.b);return {id:l.id,meters:l.meters!,measured:p&&q?Math.hypot(p[0]-q[0],p[2]-q[2]):NaN};});
 return {camera,missing:[],warnings,checks};
}
/** Levenberg–Marquardt on a residual function; returns the best parameters found and their cost (sum of squares). */
function refine(residual:(p:V)=>number[],start:V,iterations=300){
 let p=start,lambda=1e-3,err=residual(p),cost=dot2(err);
 for(let iteration=0;iteration<iterations;iteration++){
  const J=jacobian(residual,p,err),N=J.map(x=>J.map(y=>dot2(x,y)));let delta:number[];
  try{delta=linear(N.map((r,i)=>r.map((x,j)=>x+(i===j?lambda*Math.max(N[i][i],1e-9):0))),J.map(x=>-dot2(x,err)));}catch{break;}
  const next=p.map((x,i)=>x+delta[i]),nextErr=residual(next),nextCost=dot2(nextErr);
  if(nextCost<cost){p=next;err=nextErr;cost=nextCost;lambda=Math.max(1e-12,lambda/3);if(Math.sqrt(dot2(delta))<1e-11)break;}else if((lambda=lambda*5)>1e12)break;
 }
 return {p,cost};
}
// How sure parameter i is, in its own units, for clicks about `noise` pixels off.
function spread(residual:(p:V)=>number[],p:V,noise:number,i:number){
 const err=residual(p),J=jacobian(residual,p,err),N=J.map(x=>J.map(y=>dot2(x,y)));
 try{return Math.sqrt(Math.max(0,linear(N,N.map((_,j)=>j===i?1:0))[i]))*noise;}catch{return Infinity;}
}
/** Point views: each error and predicted spot is keyed by site point id, so the list and the photo can show them. */
export type PointSolve=PhotoSolve&{errors:Record<string,number>;predicted:Record<string,PhotoPoint>};
/** A site point in Three.js world coordinates. */
export const sitePosition=(p:SitePoint)=>[p.x,GROUND+p.h,p.z];
/** Find the camera from point pairs: site points picked on the plan and clicked in the photo. Unknowns are where the camera stands (3), where it looks (3)
 * and the lens (1), so 4 points (8 numbers) are the minimum; every point beyond that checks the others. Starts from cameras all around the points, then keeps the best fit.
 * `near` (while a point is dragged) starts from that camera only, which is quick but skips the two-answers check. */
export function solvePointCamera(v:PhotoView,sites:SitePoint[],near?:PhotoCamera):PointSolve{
 const W=v.width,H=v.height,cx=W/2,cy=H/2,diag=Math.hypot(W,H),number=new Map(sites.map((p,i)=>[p.id,i+1])),byId=new Map(sites.map(p=>[p.id,p]));
 const pairs=v.marks.flatMap(k=>k.anchor.kind==='site'&&k.at&&k.role==='fit'&&byId.has(k.anchor.pointId)?[{point:k.anchor.pointId,X:sitePosition(byId.get(k.anchor.pointId)!),at:k.at}]:[]);
 const missing:string[]=[],warnings:string[]=[],none={missing,warnings,checks:[],errors:{},predicted:{}};
 if(sites.length<4)missing.push(tx('在平面图上选至少 4 个点（已选 {0} 个）',sites.length));
 if(pairs.length<4)missing.push(tx('在照片中点出至少 4 个点（已点 {0} 个）',pairs.length));
 if(missing.length)return none;
 const known=v.lens35?v.lens35/FILM_DIAGONAL*diag:undefined,typical=26/FILM_DIAGONAL*diag;
 // Parameters: rotation update (3), camera position (3), log focal length. The last residual is the focal-length prior, not data.
 const residualFor=(R0:number[][],sigma:number,use=pairs)=>(p:V)=>{
  const R=matmul(rodrigues(p.slice(0,3)),R0),C=p.slice(3,6),f=Math.exp(p[6]),out:number[]=[];
  for(const {X,at} of use){const c=mul(R,X.map((x,i)=>x-C[i]));if(c[2]>1e-6)out.push(f*c[0]/c[2]+cx-at.x,f*c[1]/c[2]+cy-at.y);else out.push(1e4,1e4);}
  out.push((p[6]-Math.log(known??typical))/sigma);
  return out;
 };
 const lookAt=(C:V,G:V)=>{const fw=unit(G.map((x,i)=>x-C[i])),right=unit(cross(fw,[0,1,0])),down=cross(fw,right);return [right,down,fw];};
 const G=[0,1,2].map(i=>pairs.reduce((s,q)=>s+q.X[i],0)/pairs.length),size=Math.max(3,...pairs.map(q=>Math.hypot(q.X[0]-G[0],q.X[2]-G[2])));
 let sigma=known?.05:1000;
 const starts:{R0:number[][];p:V}[]=[];
 for(const f of known?[known]:[.45,.6,.8,1.1,1.6].map(k=>k*diag))for(const d of [1.5,3,6,12])for(const h of [1.6,size*.5,size*1.5])for(let a=0;a<12;a++){
  const t=a*Math.PI/6,C=[G[0]+d*size*Math.cos(t),GROUND+h,G[2]+d*size*Math.sin(t)];starts.push({R0:lookAt(C,G),p:[0,0,0,...C,Math.log(f)]});
 }
 // A short fit from every start, then a full fit of the best few. Different end cameras with similar error mean the points allow two answers.
 if(near)starts.splice(0,starts.length,{R0:near.R,p:[0,0,0,...near.C,Math.log(known??near.f)]});
 const quick=starts.map(s=>({...s,...refine(residualFor(s.R0,sigma),s.p,12)})).filter(s=>Number.isFinite(s.cost)).sort((a,b)=>a.cost-b.cost).slice(0,8);
 let fits=quick.map(s=>({R0:s.R0,...refine(residualFor(s.R0,sigma),s.p)})).sort((a,b)=>a.cost-b.cost);
 const rmseOf=(fit:{R0:number[][];p:V})=>Math.sqrt(dot2(residualFor(fit.R0,sigma)(fit.p).slice(0,-1))/pairs.length);
 if(!fits.length||rmseOf(fits[0])>diag*.2)return {...none,missing:[tx('点位无法确定相机，请检查每个点是否与平面图上的点对应')]};
 let lensError=spread(residualFor(fits[0].R0,sigma),fits[0].p,Math.max(rmseOf(fits[0]),1),6);
 // Lean on a typical phone lens only when the points say almost nothing about it.
 if(!known&&lensError>=.5){sigma=.3;fits=fits.map(s=>({R0:s.R0,...refine(residualFor(s.R0,sigma),s.p)})).sort((a,b)=>a.cost-b.cost);}
 const best=fits[0],{p,R0}=best,R=matmul(rodrigues(p.slice(0,3)),R0),C=p.slice(3,6),f=Math.exp(p[6]),rmse=rmseOf(best),noise=Math.max(rmse,1);
 if(sigma!==.3)lensError=spread(residualFor(R0,sigma),p,noise,6);
 const lens=known?(v.lensFromFile?'file':'typed'):sigma===.3?'assumed':'measured';
 const camera:PhotoCamera={R,C,f,cx,cy,rmse,lens,lens35:f/diag*FILM_DIAGONAL,lensError,height:C[1]-GROUND,heightError:spread(residualFor(R0,sigma),p,noise,4),tilt:Math.asin(Math.max(-1,Math.min(1,-R[2][1])))*180/Math.PI,forward:R[2]};
 const errors:Record<string,number>={},predicted:Record<string,PhotoPoint>={};
 for(const site of sites){const q=projectPoint(camera,sitePosition(site));if(q&&Math.abs(q.x-cx)<W&&Math.abs(q.y-cy)<H)predicted[site.id]=q;}
 for(const k of v.marks)if(k.anchor.kind==='site'&&k.at){const q=predicted[k.anchor.pointId];errors[k.anchor.pointId]=q?Math.hypot(q.x-k.at.x,q.y-k.at.y):Infinity;}
 const distance=Math.hypot(C[0]-G[0],C[1]-G[1],C[2]-G[2]);
 if(fits.slice(1).some(s=>rmseOf(s)<Math.max(2*rmse,rmse+2)&&Math.hypot(...s.p.slice(3,6).map((x,i)=>x-C[i]))>.15*distance))warnings.push(tx('这些点可以对应两个不同的相机位置。请再加点，尽量分散在照片各处、高低不同。'));
 if(pairs.length===4)warnings.push(tx('只有 4 个点：能算出相机，但没有多余的点来检查。再加 1–2 个点更可靠。'));
 const heights=pairs.map(q=>q.X[1]);
 if(Math.max(...heights)-Math.min(...heights)<.3)warnings.push(tx('所有点高度相同，镜头和距离不易分开。加一个不同高度的点，例如柱脚、墙脚或屋檐角。'));
 // One wrong click spreads its error over every point, so find it by leaving each point out: the others then fit well and show where it should be.
 if(pairs.length>=6&&rmse>3){
  const out=pairs.map((q,i)=>{const use=pairs.filter((_,j)=>j!==i),fit=refine(residualFor(R0,sigma,use),p,100);return {q,rest:Math.sqrt(dot2(residualFor(R0,sigma,use)(fit.p).slice(0,-1))/use.length),fit};}).sort((a,b)=>a.rest-b.rest)[0];
  const others:PhotoCamera={...camera,R:matmul(rodrigues(out.fit.p.slice(0,3)),R0),C:out.fit.p.slice(3,6),f:Math.exp(out.fit.p[6])},q=projectPoint(others,out.q.X),miss=q?Math.hypot(q.x-out.q.at.x,q.y-out.q.at.y):Infinity;
  if(out.rest<rmse/2)warnings.push(tx('点 {0} 与其他点对不上（差 {1} px）：请检查照片里是否点错位置，或平面图上是否选错了点、选错了顶/地面',number.get(out.q.point)??'?',Number.isFinite(miss)?miss.toFixed(0):'?'));
  else warnings.push(tx('各点误差偏大（平均 {0} px）：请逐个检查点的位置和顶/地面',rmse.toFixed(1)));
 }else if(rmse>3)warnings.push(tx('各点误差偏大（平均 {0} px）：请逐个检查点的位置和顶/地面',rmse.toFixed(1)));
 if(lens==='measured'&&lensError>=.15)warnings.push(tx('镜头焦距只能粗略确定（±{0}%）。加高低不同、分散在照片各处的点，或填写等效焦距。',Math.round(lensError*100)));
 if(lens==='assumed')warnings.push(tx('点位无法确定镜头焦距，暂按常见手机主摄 26 mm 估算。加高低不同的点，或填写等效焦距。'));
 if(C[1]<GROUND+.2)warnings.push(tx('算出的相机低于地面，请检查各点的顶/地面是否选对'));
 return {camera,missing,warnings,checks:[],errors,predicted};
}
function dot2(a:number[],b=a){let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;}
// Columns of the forward-difference Jacobian, one per parameter.
function jacobian(residual:(p:V)=>number[],p:V,err:number[]){
 return p.map((x,j)=>{const step=1e-6*Math.max(1,Math.abs(x)),q=[...p];q[j]+=step;return residual(q).map((r,i)=>(r-err[i])/step);});
}
