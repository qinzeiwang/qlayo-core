import {Euler,Matrix4,Vector3} from 'three';
import {photoRoofHeight,photoRoofRay} from './photo-roof';
import type {RoofPitch} from './pitched-roof';
import {cornerProblem,usesHeightCalibration,type PhotoEdit} from './photo-match';
import {tx} from './i18n';
export type CameraFit={R:number[][];t:number[];f:number;principal:number[];rmse:number};
// Pivoted elimination is shared by the homography and damped least-squares steps.
export function linear(a:number[][],b:number[]){const n=b.length,m=a.map((r,i)=>[...r,b[i]]);for(let i=0;i<n;i++){let p=i;for(let k=i+1;k<n;k++)if(Math.abs(m[k][i])>Math.abs(m[p][i]))p=k;[m[i],m[p]]=[m[p],m[i]];if(Math.abs(m[i][i])<1e-14)throw Error(tx('标注退化，无法求解相机'));const v=m[i][i];for(let j=i;j<=n;j++)m[i][j]/=v;for(let k=0;k<n;k++)if(k!==i){const q=m[k][i];for(let j=i;j<=n;j++)m[k][j]-=q*m[i][j];}}return m.map(r=>r[n]);}
function rotation(t:number[]){const e=new Matrix4().makeRotationFromEuler(new Euler(t[0],t[1],t[2])).elements;return [[e[0],e[4],e[8]],[e[1],e[5],e[9]],[e[2],e[6],e[10]]];}
const dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+v*b[i],0);
export function fitPhotoCamera(m:PhotoEdit,width:number,depth:number,pitch?:RoofPitch):CameraFit{
 const enabled=usesHeightCalibration(m);if(m.corners.length!==4||cornerProblem(m.corners))throw Error(tx('请先按编号完成四角标注'));if(enabled&&m.heightPoints.length!==2)throw Error(tx('请完成高度线，或取消高度校准'));
 const Q=[[-width/2,depth/2,0],[width/2,depth/2,0],[width/2,-depth/2,0],[-width/2,-depth/2,0]],obs=m.corners.map(p=>[p.x,p.y]);const A:number[][]=[],b:number[]=[];
 Q.forEach(([x,y],i)=>{const [u,v]=obs[i];A.push([x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]);b.push(u,v);});const h=[...linear(A,b),1],H=[h.slice(0,3),h.slice(3,6),h.slice(6,9)];
 for(const q of Q)q[2]=photoRoofHeight(width,depth,pitch,q[0],-q[1]);
 if(enabled){let q=[...Q[m.anchor]];if(m.heightMode==='below')q[2]-=m.heightMeters;else{const p=m.heightPoints[0],v=linear(H,[p.x,p.y,1]);q=[v[0]/v[2],v[1]/v[2],m.heightMeters];}Q.push(q);obs.push([m.heightPoints[1].x,m.heightPoints[1].y]);}
 function project(t:number[]){const R=rotation(t),f=Math.exp(t[6]),cx=enabled?t[7]:m.width/2,cy=enabled?t[8]:m.height/2;return Q.map((original,index)=>{let q=original;
 if(enabled&&m.heightMode==='above'&&index===4){
  const base=m.heightPoints[0],cameraRay=[(base.x-cx)/f,(base.y-cy)/f,1];
  const origin=[0,1,2].map(j=>-R.reduce((s,r,i)=>s+r[j]*t[i+3],0));
  const ray=[0,1,2].map(j=>R.reduce((s,r,i)=>s+r[j]*cameraRay[i],0));
  const hit=photoRoofRay(origin,ray,width,depth,pitch);if(!hit)return [1e8,1e8,-1];q=[hit[0],hit[1],hit[2]+m.heightMeters];
 }
 const c=R.map((r,i)=>dot(r,q)+t[i+3]);return [f*c[0]/c[2]+cx,f*c[1]/c[2]+cy,c[2]];});}
 const residual=(t:number[])=>project(t).flatMap((p,i)=>[p[0]-obs[i][0],p[1]-obs[i][1]]),cost=(v:number[])=>dot(v,v);let best:CameraFit|undefined;
 const centers=enabled?[[m.width/2,m.height/2],[0,0],[m.width,m.height],[m.width/2,0],[0,m.height/2]]:[[m.width/2,m.height/2]];
 for(const factor of [.4,.8,1.5,3,6])for(const [cx,cy] of centers){const f=Math.max(m.width,m.height)*factor,B=H.map(r=>[...r]);for(let j=0;j<3;j++){B[0][j]=(H[0][j]-cx*H[2][j])/f;B[1][j]=(H[1][j]-cy*H[2][j])/f;}const c1=new Vector3(B[0][0],B[1][0],B[2][0]),c2=new Vector3(B[0][1],B[1][1],B[2][1]),scale=2/(c1.length()+c2.length());c1.normalize();c2.addScaledVector(c1,-c2.dot(c1)).normalize();const c3=new Vector3().crossVectors(c1,c2),e=new Euler().setFromRotationMatrix(new Matrix4().makeBasis(c1,c2,c3));let t=[e.x,e.y,e.z,...B.map(r=>r[2]*scale),Math.log(f),...(enabled?[cx,cy]:[])],lambda=.001;
 for(let iteration=0;iteration<150;iteration++){const err=residual(t),J=t.map((v,j)=>{const step=1e-5*Math.max(1,Math.abs(v)),s=[...t];s[j]+=step;return residual(s).map((v,i)=>(v-err[i])/step);}),N=J.map(a=>J.map(b=>dot(a,b)));let delta:number[];try{delta=linear(N.map((r,i)=>r.map((v,j)=>v+(i===j?lambda*Math.max(N[i][i],1e-8):0))),J.map(a=>-dot(a,err)));}catch{break;}const next=t.map((v,i)=>v+delta[i]);if(next[6]<Math.log(50)||next[6]>Math.log(200000)){lambda*=10;continue;}if(cost(residual(next))<cost(err)){t=next;lambda=Math.max(1e-9,lambda/3);if(Math.sqrt(cost(delta))<1e-7)break;}else lambda=Math.min(1e14,lambda*5);}
 const R=rotation(t),rmse=Math.sqrt(cost(residual(t))/Q.length),height=-R.reduce((s,r,i)=>s+r[2]*t[i+3],0);if(project(t).every(p=>p[2]>0)&&height>0&&Number.isFinite(rmse)&&(!best||rmse<best.rmse))best={R,t:t.slice(3,6),f:Math.exp(t[6]),principal:enabled?t.slice(7,9):[m.width/2,m.height/2],rmse};}
 if(!best)throw Error(tx('无法得到有效相机，请检查角点顺序和高度线'));return best;
}
