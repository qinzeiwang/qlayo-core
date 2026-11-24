import {describe,expect,it} from 'vitest';
import {GROUND,compassAzimuth,groundPoint,sitePosition,smallestEigenvector,solvePhotoCamera,solvePointCamera} from './photo-solve';
import type {PhotoLine,PhotoView,SitePoint} from './photo-match';
import {exifLens35} from './photo-exif';
const W=4000,H=3000,diag=Math.hypot(W,H);
type Shot={C:number[];yaw:number;pitch:number;roll:number;f:number};
// Camera rows: right, down, forward (OpenCV), built from a compass-like yaw (0 = looking toward -Z), downward pitch and roll, all in degrees.
function rotation({yaw,pitch,roll}:Shot){
 const r=Math.PI/180,fw=[Math.sin(yaw*r)*Math.cos(pitch*r),-Math.sin(pitch*r),-Math.cos(yaw*r)*Math.cos(pitch*r)];
 const n=(v:number[])=>{const l=Math.hypot(...v);return v.map(x=>x/l);},cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const right=n(cross(fw,[0,1,0])),down=cross(fw,right),c=Math.cos(roll*r),s=Math.sin(roll*r);
 return [right.map((x,i)=>c*x+s*down[i]),down.map((x,i)=>c*x-s*right[i]),fw];
}
function photo(shot:Shot,noise=0){
 const R=rotation(shot);let seed=1;const jitter=()=>{seed=(seed*16807)%2147483647;return (seed/2147483647-.5)*2*noise;};
 const at=(X:number[])=>{const c=R.map(row=>row.reduce((s,v,i)=>s+v*(X[i]-shot.C[i]),0));expect(c[2]).toBeGreaterThan(0);return {x:shot.f*c[0]/c[2]+W/2+jitter(),y:shot.f*c[1]/c[2]+H/2+jitter()};};
 const g=(x:number,z:number,h=0)=>[x,GROUND+h,z];
 const line=(id:string,kind:PhotoLine['kind'],A:number[],B:number[],meters?:number):PhotoLine=>({id,kind,a:at(A),b:at(B),...(meters?{meters}:{})});
 return {at,g,line,base:{id:'v',roofId:'r',name:'p.jpg',url:'',width:W,height:H,marks:[],roofSignature:'',method:'lines'} as PhotoView};
}
// A parking area north of the camera: stall lines run east-west (A), aisles north-south (B), posts are 3 m tall.
function scene(shot:Shot,{across=false,noise=0,lens35}:{across?:boolean;noise?:number;lens35?:number}={}):PhotoView{
 const {g,line,base,at}=photo(shot,noise);
 const lines=[line('a1','along',g(-10,0),g(10,0)),line('a2','along',g(-10,-12),g(10,-12)),line('v1','vertical',g(-6,-3),g(-6,-3,3)),line('v2','vertical',g(7,-8),g(7,-8,3)),line('m','measure',g(-3,-4),g(2,-4),5)];
 if(across)lines.push(line('b1','across',g(-8,4),g(-8,-15)),line('b2','across',g(8,4),g(8,-15)));
 return {...base,lines,reference:{a:at(g(-6,5)),b:at(g(8,-8)),planA:{x:-6,z:5},planB:{x:8,z:-8}},...(lens35?{lens35}:{})};
}
const phone:Shot={C:[1,GROUND+1.6,22],yaw:15,pitch:8,roll:2,f:.75*diag};
describe('camera from photo lines',()=>{
 it('finds position, height, lens and heading of a handheld photo from ground lines, two posts and one reference line',()=>{
  const {camera,missing,warnings,checks}=solvePhotoCamera(scene(phone));
  expect(missing).toEqual([]);expect(warnings).toEqual([]);
  expect(camera!.lens).toBe('measured');expect(camera!.f/phone.f).toBeCloseTo(1,3);
  camera!.C.forEach((x,i)=>expect(x).toBeCloseTo(phone.C[i],2));
  expect(camera!.height).toBeCloseTo(1.6,3);expect(camera!.tilt).toBeCloseTo(8,2);
  expect(compassAzimuth(camera!.forward)).toBeCloseTo(15,2);
  expect(checks[0].measured).toBeCloseTo(5,3);
 });
 it('solves a drone photo looking steeply down',()=>{
  const drone={C:[-5,GROUND+40,45],yaw:-10,pitch:38,roll:-1,f:.6*diag},{camera}=solvePhotoCamera(scene(drone,{across:true}));
  expect(camera!.lens).toBe('measured');expect(camera!.height).toBeCloseTo(40,2);expect(camera!.f/drone.f).toBeCloseTo(1,3);
 });
 it('says the lens is only assumed when a level phone leaves it open, and fixes it with a second ground direction or the lens from the file',()=>{
  const level={...phone,pitch:0,roll:0};
  const open=solvePhotoCamera(scene(level));
  expect(open.camera!.lens).toBe('assumed');expect(open.warnings.join()).toContain('26 mm');
  const crossed=solvePhotoCamera(scene(level,{across:true}));
  expect(crossed.camera!.lens).toBe('measured');expect(crossed.camera!.f/level.f).toBeCloseTo(1,3);expect(crossed.camera!.height).toBeCloseTo(1.6,3);
  const lens35=level.f/diag*43.27,typed=solvePhotoCamera({...scene(level,{lens35}),lensFromFile:true});
  expect(typed.camera!.lens).toBe('file');expect(typed.camera!.height).toBeCloseTo(1.6,2);
 });
 it('stays close with one-pixel clicking errors and reports how sure the height is',()=>{
  const {camera}=solvePhotoCamera(scene(phone,{noise:1,across:true}));
  expect(Math.abs(camera!.height-1.6)).toBeLessThan(.1);expect(Math.hypot(camera!.C[0]-phone.C[0],camera!.C[2]-phone.C[2])).toBeLessThan(.5);
  expect(camera!.heightError).toBeGreaterThan(0);expect(camera!.heightError).toBeLessThan(.3);expect(camera!.rmse).toBeLessThan(2);
 });
 it('lists what is still missing and refuses a reference line drawn above the horizon',()=>{
  const v=scene(phone);
  expect(solvePhotoCamera({...v,reference:undefined}).missing).toHaveLength(2);
  expect(solvePhotoCamera({...v,lines:v.lines!.filter(l=>l.kind!=='vertical')}).missing).toHaveLength(1);
  expect(solvePhotoCamera({...v,reference:{...v.reference,a:{x:100,y:10},b:{x:3000,y:20}}}).missing[0]).toContain('地平线');
 });
 it('maps photo pixels back onto the ground',()=>{
  const {camera}=solvePhotoCamera(scene(phone)),{at,g}=photo(phone),p=groundPoint(camera!,at(g(3,-7)))!;
  expect(p[0]).toBeCloseTo(3,2);expect(p[2]).toBeCloseTo(-7,2);expect(groundPoint(camera!,{x:W/2,y:0})).toBeUndefined();
 });
});
it('finds the common point of three or more lines',()=>{
 const lines=[[1,0,-2],[0,1,-3],[1,1,-5]].map(l=>{const n=Math.hypot(l[0],l[1]);return l.map(x=>x/n);});
 const v=smallestEigenvector([0,1,2].map(i=>[0,1,2].map(j=>lines.reduce((s,l)=>s+l[i]*l[j],0))));
 expect(v[0]/v[2]).toBeCloseTo(2,6);expect(v[1]/v[2]).toBeCloseTo(3,6);
});
it('reads the 35 mm lens from JPEG EXIF and ignores files without it',()=>{
 // Little-endian TIFF: IFD0 with one ExifIFD pointer, Exif IFD with FocalLengthIn35mmFilm = 26.
 const tiff=[0x49,0x49,42,0,8,0,0,0, 1,0, 0x69,0x87,4,0,1,0,0,0,26,0,0,0, 0,0,0,0, 1,0, 0x05,0xa4,3,0,1,0,0,0,26,0,0,0, 0,0,0,0];
 const app1=[0x45,0x78,0x69,0x66,0,0,...tiff],jpeg=new Uint8Array([0xff,0xd8,0xff,0xe1,(app1.length+2)>>8,(app1.length+2)&255,...app1,0xff,0xd9]);
 expect(exifLens35(jpeg)).toBe(26);
 expect(exifLens35(new Uint8Array([0xff,0xd8,0xff,0xd9]))).toBeUndefined();
 expect(exifLens35(new Uint8Array([0x89,0x50,0x4e,0x47]))).toBeUndefined();
 expect(exifLens35(jpeg.slice(0,30))).toBeUndefined();
});
// Point pairs: a carport row and a building, seen from the ground and from above. Points are site points; marks are where they show in the photo.
describe('camera from point pairs',()=>{
 const sites:SitePoint[]=[[-12,-4,2.9],[12,-4,2.9],[12,-9,2.4],[-12,-9,2.4],[-10,-6,0],[10,-6,0],[-20,-30,8],[5,-30,8],[5,-30,0],[-20,-30,0]].map(([x,z,h],i)=>({id:`p${i+1}`,name:'',x,z,h,source:'measured'}));
 function view(shot:Shot,use:number[],{noise=0,off,lens35}:{noise?:number;off?:{index:number;dx:number};lens35?:number}={}):PhotoView{
  const {at,base}=photo(shot,noise);
  return {...base,method:'points',...(lens35?{lens35}:{}),marks:use.map(i=>{const p=sites[i],q=at([p.x,GROUND+p.h,p.z]);if(off?.index===i)q.x+=off.dx;return {id:`m${i}`,anchor:{kind:'site',pointId:p.id},at:q,role:'fit'};})};
 }
 const ground:Shot={C:[3,GROUND+1.6,18],yaw:-5,pitch:4,roll:1,f:.7*diag},drone:Shot={C:[-25,GROUND+35,25],yaw:40,pitch:40,roll:0,f:.6*diag};
 it('gives back the exact camera from six points at different heights',()=>{
  const s=solvePointCamera(view(ground,[0,1,2,3,4,5]),sites);
  expect(s.missing).toEqual([]);const c=s.camera!;
  c.C.forEach((x,i)=>expect(x).toBeCloseTo(ground.C[i],2));expect(c.f/ground.f).toBeCloseTo(1,3);expect(c.rmse).toBeLessThan(.05);expect(c.lens).toBe('measured');
  expect(Math.max(...Object.values(s.errors))).toBeLessThan(.1);expect(s.warnings).toEqual([]);
 });
 it('works from four points but warns that nothing checks them',()=>{
  const s=solvePointCamera(view(drone,[0,1,6,8]),sites);
  s.camera!.C.forEach((x,i)=>expect(x).toBeCloseTo(drone.C[i],1));
  expect(s.warnings.join()).toMatch(/只有 4 个点/);
 });
 it('warns when every point is at the same height',()=>{
  expect(solvePointCamera(view(drone,[4,5,8,9]),sites).warnings.join()).toMatch(/高度相同/);
 });
 it('stays close with one-pixel click noise and predicts the unclicked points',()=>{
  const s=solvePointCamera(view(ground,[0,1,2,3,4,5,6,8],{noise:1}),sites),c=s.camera!;
  expect(Math.hypot(...c.C.map((x,i)=>x-ground.C[i]))).toBeLessThan(.3);expect(c.rmse).toBeLessThan(2);
  const truth=photo(ground).at(sitePosition(sites[7])),q=s.predicted.p8;expect(Math.hypot(q.x-truth.x,q.y-truth.y)).toBeLessThan(5);
 });
 it('names the point that was clicked in the wrong place',()=>{
  const s=solvePointCamera(view(ground,[0,1,2,3,4,5,6],{off:{index:2,dx:60}}),sites);
  expect(s.warnings.join()).toMatch(/点 3 与其他点对不上（差 6\d px）/);
 });
 it('uses a lens read from the photo file',()=>{
  const lens35=ground.f/diag*43.27,s=solvePointCamera({...view(ground,[0,1,2,3,4]),lens35,lensFromFile:true},sites);
  expect(s.camera!.lens).toBe('file');s.camera!.C.forEach((x,i)=>expect(x).toBeCloseTo(ground.C[i],1));
 });
 it('asks for more points first',()=>{
  expect(solvePointCamera(view(ground,[0,1,2]),sites).missing.join()).toMatch(/已点 3 个/);
 });
});
