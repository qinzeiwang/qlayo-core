import {Icon} from './workbench-ui';
import type {BaseImage} from './base-image';
import type {ImageOverlay} from './image-overlays';
import {corners,geometry} from './domain';
import {roofHeight} from './pitched-roof';
import {carportColumnX} from './carport-frame';
import {roofRect,toLocal,toWorld,worldArray,type RoofDesign} from './roof-project';
import {GROUND,projectSegment,sitePosition,type PointSolve} from './photo-solve';
import type {PhotoPoint,PhotoView,SitePoint} from './photo-match';
import {CameraInfo,LensField,PlanOverlay,planBox} from './photo-lines';
import {coreEdition,tx} from './i18n';
/** Point-method tools: pick site points on the plan, then click the same points in the photo. */
export type PointTool='pointPlan'|'pointPhoto';
export const isPointTool=(t:string):t is PointTool=>t==='pointPlan'||t==='pointPhoto';
/** A model point a plan click can snap to, with the height of its top above the ground (the ground itself is always 0). `mid` marks the middle of an edge. */
export type SnapTarget={x:number;z:number;top:number;kind:'roof'|'panel'|'post';mid?:boolean};
type V=number[];
/** Carport panel fields: four corners at the real panel height, and the posts under them. Shared by snapping and the photo wireframe. */
function carportParts(r:RoofDesign){
 return r.arrays.map(a=>worldArray(a,r)).filter(a=>a.mounting==='carport'&&a.surface).map(a=>{
  const g=geometry(a),s=a.surface!,at=(x:number,z:number)=>toWorld({x,z},{x:a.x,z:a.z,yaw:g.yaw});
  const field=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>{const x=i*g.width/2,z=j*g.depth/2;return {...at(x,z),top:s.height+.045+s.sx*x+s.sz*z-GROUND};});
  const n=Math.max(1,Math.ceil(g.depth/5)),span=Math.max(0,g.depth-.5),px=carportColumnX(g.width,s.sx,a.carportFrame);
  const posts=Array.from({length:n+1},(_,i)=>({...at(px,-span/2+span*i/n),top:s.height+s.sx*px-.2-GROUND}));
  return {field,posts};
 });
}
/** Ridge ends of a gable roof, in roof-local metres. */
const ridgeEnds=(r:RoofDesign)=>r.pitch?.kind==='gable'&&!r.roof.outline?(r.pitch.axis==='x'?[{x:0,z:-r.roof.depth/2},{x:0,z:r.roof.depth/2}]:[{x:-r.roof.width/2,z:0},{x:r.roof.width/2,z:0}]):[];
const buildingTop=(r:RoofDesign,p:{x:number;z:number})=>r.pitch?roofHeight(r.roof,r.pitch,p.x,p.z)-GROUND:(r.flatHeight??3.5);
export function roofCornerTargets(roof:RoofDesign):SnapTarget[]{
 return corners(roofRect(roof)).map(p=>({...p,top:buildingTop(roof,toLocal(p,roof)),kind:'roof'}));
}
export function snapTargets(roofs:RoofDesign[]):SnapTarget[]{
 const out:SnapTarget[]=[];
 for(const r of roofs){
  if(r.carport){for(const {field,posts} of carportParts(r)){field.forEach((p,i)=>{const q=field[(i+1)%4];out.push({...p,kind:'panel'},{x:(p.x+q.x)/2,z:(p.z+q.z)/2,top:(p.top+q.top)/2,kind:'panel',mid:true});});posts.forEach(p=>out.push({...p,kind:'post'}));}continue;}
  const ps=corners(roofRect(r));
  ps.forEach((q,i)=>{const n=ps[(i+1)%ps.length],m={x:(q.x+n.x)/2,z:(q.z+n.z)/2};out.push({x:q.x,z:q.z,top:buildingTop(r,toLocal(q,r)),kind:'roof'},{...m,top:buildingTop(r,toLocal(m,r)),kind:'roof',mid:true});});
  for(const e of ridgeEnds(r))out.push({...toWorld(e,r),top:buildingTop(r,e),kind:'roof'});
 }
 return out;
}
export const nearestTarget=(p:{x:number;z:number},targets:SnapTarget[],reach:number)=>targets.reduce<{t?:SnapTarget;d:number}>((best,t)=>{const d=Math.hypot(t.x-p.x,t.z-p.z);return d<best.d?{t,d}:best;},{d:reach}).t;
/** A new point starts on the roof top, or on the ground under a carport (post feet are the easiest carport points to see). */
export const defaultHeight=(t?:SnapTarget)=>t?.kind==='roof'?t.top:0;
/** The model top at a site point's plan position, if the point sits on a model corner or post. */
export const topAt=(p:{x:number;z:number},targets:SnapTarget[])=>nearestTarget(p,targets,.05)?.top;
/** Every roof and carport as 3D segments: walls and roof edges, carport panel fields and posts. */
function siteWire(roofs:RoofDesign[]){
 const out:{key:string;A:V;B:V;carport:boolean}[]=[];
 for(const r of roofs){
  if(r.carport){carportParts(r).forEach(({field,posts},k)=>{
   field.forEach((p,i)=>{const q=field[(i+1)%4];out.push({key:`${r.id}f${k}${i}`,A:[p.x,GROUND+p.top,p.z],B:[q.x,GROUND+q.top,q.z],carport:true});});
   posts.forEach((p,i)=>out.push({key:`${r.id}p${k}${i}`,A:[p.x,GROUND,p.z],B:[p.x,GROUND+p.top,p.z],carport:true}));});continue;}
  const ps=corners(roofRect(r)),tops=ps.map(q=>buildingTop(r,toLocal(q,r))),ridge=ridgeEnds(r).map(e=>({...toWorld(e,r),top:buildingTop(r,e)}));
  ps.forEach((p,i)=>{const j=(i+1)%ps.length,q=ps[j];out.push({key:`${r.id}g${i}`,A:[p.x,GROUND,p.z],B:[q.x,GROUND,q.z],carport:false},{key:`${r.id}t${i}`,A:[p.x,GROUND+tops[i],p.z],B:[q.x,GROUND+tops[j],q.z],carport:false},{key:`${r.id}v${i}`,A:[p.x,GROUND,p.z],B:[p.x,GROUND+tops[i],p.z],carport:false});});
  if(ridge.length===2){out.push({key:`${r.id}r`,A:[ridge[0].x,GROUND+ridge[0].top,ridge[0].z],B:[ridge[1].x,GROUND+ridge[1].top,ridge[1].z],carport:false});
   // Each ridge end joins the two corners of its gable.
   ridge.forEach((e,k)=>ps.map((p,i)=>({p,i})).sort((a,b)=>Math.hypot(a.p.x-e.x,a.p.z-e.z)-Math.hypot(b.p.x-e.x,b.p.z-e.z)).slice(0,2).forEach(({p,i})=>out.push({key:`${r.id}e${k}${i}`,A:[e.x,GROUND+e.top,e.z],B:[p.x,GROUND+tops[i],p.z],carport:false})));}
 }
 return out;
}
// Error colours: good, check, wrong.
export const errorColor=(e?:number)=>e===undefined?'#c7ced4':e<3?'#2fbf71':e<8?'#ffad33':'#ff4f5e';
const label=(p:PhotoPoint,text:string,unit:number,color='white')=><text pointerEvents="none" x={p.x+unit*11} y={p.y-unit*10} fill={color} stroke="#153344" paintOrder="stroke" strokeWidth={unit*3} fontSize={unit*15} fontWeight={600}>{text}</text>;
const markOf=(v:PhotoView,id:string)=>v.marks.find(k=>k.anchor.kind==='site'&&k.anchor.pointId===id);
/** The next point to click in this photo: the first site point with no mark yet (skipped points have a mark without a position). */
export const nextPoint=(v:PhotoView,sites:SitePoint[],after?:string)=>{const i=after?sites.findIndex(p=>p.id===after):-1;return [...sites.slice(i+1),...sites.slice(0,i+1)].find(p=>!markOf(v,p.id));};
export function PointTools({view,sites,tool,setTool,active,setActive,solve,change,changeSites,northAngle,targets}:{view:PhotoView;sites:SitePoint[];tool:string;setTool:(t:PointTool)=>void;active?:string;setActive:(id?:string)=>void;solve?:PointSolve;
 change:(patch:Partial<PhotoView>)=>void;changeSites:(sites:SitePoint[],marks?:(v:PhotoView)=>PhotoView['marks'])=>void;northAngle:number;targets:SnapTarget[]}){
 const clicked=sites.filter(p=>markOf(view,p.id)?.at).length,skipped=sites.filter(p=>{const k=markOf(view,p.id);return k&&!k.at;}).length;
 const setHeight=(id:string,h:number)=>changeSites(sites.map(p=>p.id===id?{...p,h}:p));
 const remove=(id:string)=>{changeSites(sites.filter(p=>p.id!==id),v=>v.marks.filter(k=>!(k.anchor.kind==='site'&&k.anchor.pointId===id)));if(active===id)setActive(undefined);};
 const skip=(id:string)=>{const k=markOf(view,id);change({marks:k?view.marks.filter(m=>m!==k):[...view.marks,{id:`site-${id}`,anchor:{kind:'site',pointId:id},role:'fit'}]});if(!k&&active===id)setActive(nextPoint({...view,marks:[...view.marks,{id:'x',anchor:{kind:'site',pointId:id},role:'fit'}]},sites,id)?.id);};
 const hint=tool==='pointPlan'?tx('在平面图上点选屋角、车棚组件角或立柱，会自动吸附。尽量选高低不同、分散的点，至少 4 个，5–6 个更可靠'):tx('按编号在照片里点出同一个点；看不到的点可以跳过。点完 4 个后，虚线圈会提示其余点的位置');
 return <div className="photo-lines photo-points">
  {!coreEdition&&<><div className="photo-step"><button aria-pressed={tool==='pointPlan'} onClick={()=>setTool('pointPlan')}><span className="photo-step-number"  aria-hidden="true">{sites.length>=4?'✓':1}</span><span className="photo-step-label">{tx('平面图上选点')}</span><span className="photo-step-count">{sites.length}</span></button></div>
  <div className="photo-step"><button aria-pressed={tool==='pointPhoto'} disabled={!sites.length} onClick={()=>{setTool('pointPhoto');setActive(nextPoint(view,sites)?.id);}}><span className="photo-step-number"  aria-hidden="true">{solve?.camera?'✓':2}</span><span className="photo-step-label">{tx('照片里点同一点')}</span><span className="photo-step-count">{clicked}/{sites.length-skipped}</span></button></div>
  <small>{hint}</small>
  {tool==='pointPlan'&&sites.length>=4&&<button className="photo-next" onClick={()=>{setTool('pointPhoto');setActive(nextPoint(view,sites)?.id);}}>{tx('下一步：{0}',tx('照片里点同一点'))}<Icon name="next"/></button>}</>}
  {coreEdition&&sites.length>0&&<div className="photo-point-heading"><strong>{tx('对应点')}</strong><small>{clicked}/{sites.length-skipped}</small></div>}
  {sites.length>0&&<ol className="photo-point-list">{sites.map((p,i)=>{const k=markOf(view,p.id),e=solve?.errors[p.id],top=topAt(p,targets),kind=p.h===0?'ground':top!==undefined&&Math.abs(p.h-top)<.01?'top':'custom';
   return <li key={p.id} className={active===p.id?'active':undefined}>
    <button className="photo-point-pick" aria-pressed={active===p.id} title={tx('选中点 {0}',i+1)} onClick={()=>{setActive(p.id);if(tool!=='pointPlan')setTool('pointPhoto');}}><span className="photo-step-number" style={{background:k?.at?errorColor(e):'#e3e8ec'}}>{i+1}</span>
     <span className="photo-step-label">{coreEdition?(k?.at?(e!==undefined&&e>5?tx('{0} px',e.toFixed(1)):<Icon name="check"/>):k?<Icon name="eye-off"/>:null):k&&!k.at?tx('已跳过'):k?.at?(e!==undefined&&Number.isFinite(e)?tx('{0} px',e.toFixed(e<10?1:0)):tx('已点')):tx('未点')}</span></button>
    <select aria-label={tx('点 {0} 的高度',i+1)} value={kind} onChange={e=>setHeight(p.id,e.target.value==='ground'?0:e.target.value==='top'?top!:Math.max(.1,p.h))}>
     <option value="top" disabled={top===undefined}>{tx('顶')}{top!==undefined?` ${top.toFixed(2)} m`:''}</option><option value="ground">{tx('地面')}</option><option value="custom">{tx('自定义')}</option></select>
    {kind==='custom'&&<input aria-label={tx('点 {0} 离地高度 m',i+1)} data-1p-ignore type="number" min="0" max="500" step="0.1" defaultValue={p.h} key={`${p.id}-${p.h}`} onBlur={e=>{const h=Number(e.target.value);if(h>=0&&h<=500)setHeight(p.id,h);}}/>}
    <button aria-label={k&&!k.at?tx('取消跳过点 {0}',i+1):tx('跳过点 {0}',i+1)} title={k&&!k.at?tx('取消跳过'):tx('照片里看不到：跳过')} aria-pressed={!!k&&!k.at} onClick={()=>skip(p.id)}><Icon name="eye-off"/></button>
    <button aria-label={tx('删除点 {0}',i+1)} title={tx('删除这个点（所有照片）')} onClick={()=>remove(p.id)}><Icon name="trash"/></button>
   </li>;})}</ol>}
  {coreEdition&&clicked>0&&clicked<4&&clicked+skipped===sites.length&&<small role="status">{tx('至少配对 4 个点')}</small>}
  {!coreEdition&&<LensField view={view} change={change}/>}
  {!coreEdition&&solve?.camera&&<CameraInfo camera={solve.camera} northAngle={northAngle} errorLabel={tx('点位误差 {0} px',solve.camera.rmse.toFixed(1))} measured={tx('点位测得')}/>}
  {(!coreEdition||clicked>=4)&&!!solve?.missing.length&&<div className="photo-missing"><strong>{tx('还需要：')}</strong><ol>{solve.missing.map(t=><li key={t}>{t}</li>)}</ol></div>}
  {solve?.warnings.map(t=><p className="photo-warning" key={t}>{t}</p>)}
 </div>;
}
const roofCornerColor='#1478db';
function RoofCornerDot({point,unit,active}:{point:PhotoPoint;unit:number;active:boolean}){
 return <g pointerEvents="none">
  {active&&<circle cx={point.x} cy={point.y} r={unit*7} fill="none" stroke={roofCornerColor} strokeWidth={1} vectorEffect="non-scaling-stroke"/>}
  <circle cx={point.x} cy={point.y} r={unit*4} fill="white" stroke="#162b43" strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>
  <circle cx={point.x} cy={point.y} r={unit*1.5} fill={roofCornerColor}/>
 </g>;
}
/** The photo with its clicked points (coloured by error, with a thin line to where the camera expects them), dashed rings where the unclicked
 * points should be, and the whole site as a wireframe. */
export function PointPhotoOverlay({view,sites,solve,roofs,unit,active,tool,compact=false,roofCorners=false}:{view:PhotoView;sites:SitePoint[];solve?:PointSolve;roofs:RoofDesign[];unit:number;active?:string;tool:string;compact?:boolean;roofCorners?:boolean}){
 const camera=solve?.camera,wire=camera&&!compact?siteWire(roofs).flatMap(s=>{const q=projectSegment(camera,s.A,s.B);return q?[{...s,a:q[0],b:q[1]}]:[];}):[];
 const corners=roofCorners?sites.map(p=>markOf(view,p.id)?.at):[];
 const closed=corners.length===4&&corners.every(Boolean);
 const edges=corners.flatMap((a,i)=>{
  const b=corners[i+1]??(closed&&i===3?corners[0]:undefined);
  return a&&b?[{a,b,i}]:[];
 });
 return <g>
  <g pointerEvents="none" strokeLinecap="round">
   {edges.map(({a,b,i})=><g key={i} data-photo-roof-edge={i}>
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="white" strokeWidth={4} vectorEffect="non-scaling-stroke"/>
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={roofCornerColor} strokeWidth={1.6} vectorEffect="non-scaling-stroke"/>
   </g>)}
  </g>
  <g pointerEvents="none">{wire.map(s=><line key={s.key} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke={s.carport?'#5ce1e6':'#ffffff'} strokeOpacity={.8} strokeWidth={unit*1.5}/>)}</g>
  {sites.map((p,i)=>{const k=markOf(view,p.id),q=compact?undefined:solve?.predicted[p.id],on=active===p.id;
   if(k?.at&&roofCorners)return <g key={p.id}>
    <circle data-kind="pmark" data-point={p.id} cx={k.at.x} cy={k.at.y} r={unit*10} fill="transparent" pointerEvents={tool==='pointPhoto'?'all':'none'}/>
    <RoofCornerDot point={k.at} unit={unit} active={on}/>
    {label(k.at,String(i+1),unit*.8)}
   </g>;
   if(k?.at){const e=solve?.errors[p.id];return <g key={p.id}>{q&&<line pointerEvents="none" x1={k.at.x} y1={k.at.y} x2={q.x} y2={q.y} stroke="#ff4f5e" strokeWidth={unit*1.5}/>}
    {on&&<circle pointerEvents="none" cx={k.at.x} cy={k.at.y} r={unit*13} fill="none" stroke="#ffe066" strokeWidth={unit*2.5}/>}
    <circle data-kind="pmark" data-point={p.id} cx={k.at.x} cy={k.at.y} r={unit*7} fill={errorColor(e)} stroke="#102030" strokeWidth={unit*1.5} style={tool==='pointPhoto'?undefined:{pointerEvents:'none'}}/>{label(k.at,String(i+1),unit)}</g>;}
   if(!q||k)return null;
   return <g key={p.id} pointerEvents="none"><circle cx={q.x} cy={q.y} r={unit*(on?14:10)} fill="none" stroke={on?'#ffe066':'#ffffff'} strokeWidth={unit*(on?2.5:1.5)} strokeDasharray={`${unit*4} ${unit*3}`}/>{label(q,String(i+1),unit,on?'#ffe066':'#ffffffcc')}</g>;})}
 </g>;
}
/** Model corners and posts (small dots) and the picked site points (numbered) over the plan. */
export function PointPlanOverlay({sites,targets,unit,active,hover,numbered=true,roofCorners=false}:{sites:SitePoint[];targets:SnapTarget[];unit:number;active?:string;hover?:{x:number;z:number};numbered?:boolean;roofCorners?:boolean}){
 const dot={roof:'#2484b5',panel:'#1c9aa0',post:'#334250'};
 return <g>
  <g pointerEvents="none">{targets.map((t,i)=>t.mid?<circle key={i} cx={t.x} cy={t.z} r={unit*2.5} fill="white" stroke={dot[t.kind]} strokeWidth={unit}/>:<circle key={i} cx={t.x} cy={t.z} r={unit*(t.kind==='post'?2.5:3)} fill={dot[t.kind]}/>)}</g>
  {sites.map((p,i)=>roofCorners?<g key={p.id}>
   <RoofCornerDot point={{x:p.x,y:p.z}} unit={unit} active={active===p.id}/>
   {numbered&&label({x:p.x,y:p.z},String(i+1),unit*.8)}
  </g>:<g key={p.id}>{active===p.id&&<circle pointerEvents="none" cx={p.x} cy={p.z} r={unit*13} fill="none" stroke="#307c77" strokeWidth={unit*2.5}/>}
   <circle data-kind="site" data-point={p.id} cx={p.x} cy={p.z} r={unit*7} fill="#307c77" stroke="white" strokeWidth={unit*1.5}/>{numbered&&label({x:p.x,y:p.z},String(i+1),unit)}</g>)}
  {hover&&<circle pointerEvents="none" cx={hover.x} cy={hover.z} r={unit*9} fill="none" stroke="#307c77" strokeWidth={unit*2}/>}
 </g>;
}
/** A small plan in the corner of the photo, so the point to click next is easy to find. */
export function PlanInset({roofs,base,overlays,view,sites,solve,active}:{roofs:RoofDesign[];base?:BaseImage;overlays?:ImageOverlay[];view:PhotoView;sites:SitePoint[];solve?:PointSolve;active?:string}){
 const box=planBox(roofs,undefined,view,solve),xs=sites.map(p=>p.x),zs=sites.map(p=>p.z);
 const x=Math.min(box.x,...xs.map(v=>v-5)),y=Math.min(box.y,...zs.map(v=>v-5)),w=Math.max(box.x+box.w,...xs.map(v=>v+5))-x,h=Math.max(box.y+box.h,...zs.map(v=>v+5))-y,unit=Math.max(w,h)/260;
 return <svg className="photo-plan-inset photo-plan-inset-light" viewBox={`${x} ${y} ${w} ${h}`} aria-label={tx('平面图中的点位')}>
  <PlanOverlay roofs={roofs} base={base} overlays={overlays} view={view} solve={solve} unit={unit}/>
  {sites.map((p,i)=><g key={p.id}>{active===p.id&&<circle cx={p.x} cy={p.z} r={unit*12} fill="none" stroke="#307c77" strokeWidth={unit*3}/>}<circle cx={p.x} cy={p.z} r={unit*6} fill={active===p.id?'#ff4f8b':'#ff4f8b99'} stroke="#102030" strokeWidth={unit}/>{label({x:p.x,y:p.z},String(i+1),unit)}</g>)}
 </svg>;
}
/** The photo, small, with the clicked points: shown over the plan so the same point is easy to find. */
export function PointInset({view,sites,active}:{view:PhotoView;sites:SitePoint[];active?:string}){
 const u=Math.max(view.width,view.height)/300;
 return <svg className="photo-plan-inset" viewBox={`0 0 ${view.width} ${view.height}`} aria-label={tx('照片中的点位')}>
  <image href={view.url} width={view.width} height={view.height}/>
  {sites.map((p,i)=>{const at=markOf(view,p.id)?.at;return at&&<g key={p.id}>{active===p.id&&<circle cx={at.x} cy={at.y} r={u*12} fill="none" stroke="#ffe066" strokeWidth={u*3}/>}<circle cx={at.x} cy={at.y} r={u*6} fill="#307c77" stroke="white" strokeWidth={u*1.5}/>{label(at,String(i+1),u)}</g>;})}
 </svg>;
}
