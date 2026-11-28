import type {Point} from './domain';
import {maxRoofHeight,roofHeight,type RoofPitch} from './pitched-roof';

export const pitchSkinOffset=.025;
const ground=-3.5;
export const gableCopingHeight=(roof:{width:number;depth:number},pitch:RoofPitch,wallHeight:number)=>
 maxRoofHeight(roof,pitch)+pitchSkinOffset+wallHeight;

/** Grid shared by the shell and roof contacts. The two middle cells meet at the ridge. */
export function gableParapetPlan(roof:{width:number;depth:number},pitch:RoofPitch,wallHeight:number){
 const swap=pitch.axis==='x';
 const halfLength=(swap?roof.depth:roof.width)/2,halfSpan=(swap?roof.width:roof.depth)/2;
 const inset=.2;
 const x=[-halfLength,-halfLength+inset,halfLength-inset,halfLength];
 const z=[-halfSpan,-halfSpan+inset,0,halfSpan-inset,halfSpan];
 const point=(u:number,v:number):Point=>swap?{x:v,z:-u}:{x:u,z:v};
 const rect=(left:number,top:number,right:number,bottom:number)=>[point(x[left],z[top]),point(x[right],z[top]),point(x[right],z[bottom]),point(x[left],z[bottom])];
 const cells=z.slice(1).flatMap((_,j)=>x.slice(1).map((_,i)=>({i,j,outline:rect(i,j,i+1,j+1),deck:i===1&&(j===1||j===2)})));
 const outer=rect(0,0,3,4),deck=rect(1,1,2,3);
 const surface=(p:Point)=>roofHeight(roof,pitch,p.x,p.z)+pitchSkinOffset;
 const copingHeight=gableCopingHeight(roof,pitch,wallHeight);
 return {outer,deck,cells,surface,coping:()=>copingHeight};
}

/** The exterior goes straight from ground to coping. The roof begins at the inner wall face. */
export function gableParapetShell(roof:{width:number;depth:number},pitch:RoofPitch,wallHeight:number){
 const {cells,surface,coping}=gableParapetPlan(roof,pitch,wallHeight);
 const top:number[]=[],walls:number[]=[];
 const vertex=(p:Point,y:number)=>[p.x,y,p.z];
 const quad=(target:number[],a:number[],b:number[],c:number[],d:number[])=>target.push(...a,...b,...c,...a,...c,...d);
 const side=(a:Point,b:Point,bottom:(p:Point)=>number,upper:(p:Point)=>number)=>quad(walls,vertex(a,bottom(a)),vertex(b,bottom(b)),vertex(b,upper(b)),vertex(a,upper(a)));
 const base=()=>ground;
 for(const {i,j,outline:[a,b,c,d],deck} of cells){
  const level=deck?surface:coping;
  quad(top,vertex(a,level(a)),vertex(d,level(d)),vertex(c,level(c)),vertex(b,level(b)));
  quad(walls,vertex(a,ground),vertex(b,ground),vertex(c,ground),vertex(d,ground));
  if(j===0)side(b,a,base,coping);
  if(i===2)side(c,b,base,coping);
  if(j===3)side(d,c,base,coping);
  if(i===0)side(a,d,base,coping);
  if(deck){
   if(j===1)side(a,b,surface,coping);
   side(b,c,surface,coping);
   if(j===2)side(c,d,surface,coping);
   side(d,a,surface,coping);
  }
 }
 return {top,walls};
}
