import {BaseImageClip} from './base-image-clip';
import {Icon} from './workbench-ui';
import type {BaseImage} from './base-image';
import type {ImageOverlay} from './image-overlays';
import {corners} from './domain';
import {roofRect,type RoofDesign} from './roof-project';
import {GROUND,compassAzimuth,horizonLine,projectSegment,type PhotoCamera,type PhotoSolve} from './photo-solve';
import type {PhotoLine,PhotoPoint,PhotoView} from './photo-match';
import {tx} from './i18n';
/** Line-method tools: the reference edge in the photo and on the plan, line sets that are parallel in reality, and check distances. */
export type LineTool='reference'|'plan'|'vertical'|'along'|'across'|'measure';
export const isLineTool=(t:string):t is LineTool=>['reference','plan','vertical','along','across','measure'].includes(t);
const colors:Record<LineTool,string>={reference:'#ff4f8b',plan:'#ff4f8b',vertical:'#ffad33',along:'#3fb2ff',across:'#4fd18b',measure:'#ffffff'};
const hints:Record<LineTool,()=>string>={
 reference:()=>tx('在照片中沿地面上一条直边点两下，例如车位线、路沿或墙脚；平面图上也要能找到这条边'),
 plan:()=>tx('在平面图上按同样顺序（1→2）点出这条边的两端；靠近屋面或车棚的角和边时会自动吸附'),
 vertical:()=>tx('沿竖直的边点两下：墙角、柱子、灯杆。至少两条，左右相距越远越好'),
 along:()=>tx('沿地面上互相平行的线点两下，例如两条车位线。至少两条'),
 across:()=>tx('可选：与地面线 A 垂直的另一组平行线，能让镜头焦距更准'),
 measure:()=>tx('可选：沿地面量一段已知长度，用来核对结果'),
};
const sectors=()=>[tx('北'),tx('东北'),tx('东'),tx('东南'),tx('南'),tx('西南'),tx('西'),tx('西北')];
// The guide's step for each tool, and the order the tools are worked through.
const order:LineTool[]=['reference','plan','vertical','along','across','measure'];
export function LineTools({view,tool,setTool,solve,change,northAngle,openGuide}:{view:PhotoView;tool:string;setTool:(t:LineTool)=>void;solve?:PhotoSolve;change:(patch:Partial<PhotoView>)=>void;northAngle:number;openGuide:(step:number)=>void}){
 const lines=view.lines??[],ref=view.reference??{},count=(k:PhotoLine['kind'])=>lines.filter(l=>l.kind===k).length;
 const done:Record<LineTool,boolean>={reference:!!(ref.a&&ref.b),plan:!!(ref.planA&&ref.planB),vertical:count('vertical')>=2,along:count('along')>=2,across:count('across')>=2,measure:lines.some(l=>l.kind==='measure'&&l.meters)};
 const next=isLineTool(tool)&&done[tool]?order[order.indexOf(tool)+1]:undefined,started=lines.length>0||!!ref.a;
 const rows:[LineTool,string,string][]=[
  ['reference',tx('参考线 · 照片'),`${[ref.a,ref.b].filter(Boolean).length}/2`],['plan',tx('参考线 · 平面图'),`${[ref.planA,ref.planB].filter(Boolean).length}/2`],
  ['vertical',tx('竖直线'),String(count('vertical'))],['along',tx('地面线 A'),String(count('along'))],['across',tx('地面线 B（可选）'),String(count('across'))],['measure',tx('量尺寸（可选）'),String(count('measure'))],
 ];
 const clear=(k:LineTool)=>k==='reference'?change({reference:{planA:ref.planA,planB:ref.planB}}):k==='plan'?change({reference:{a:ref.a,b:ref.b}}):change({lines:lines.filter(l=>l.kind!==k)});
 const camera=solve?.camera;
 return <div className="photo-lines">
  <button className={started?undefined:'photo-guide-open'} onClick={()=>openGuide(isLineTool(tool)?order.indexOf(tool):0)}><Icon name="info"/>{tx('看画线教程（示例）')}</button>
  {rows.map(([k,label,n],i)=><div className="photo-step" key={k}><button aria-pressed={tool===k} onClick={()=>setTool(k)}><span className="photo-step-number" style={{background:colors[k]}} aria-hidden="true">{done[k]?'✓':i+1}</span><span className="photo-step-label">{label}</span><span className="photo-step-count">{n}</span></button><button aria-label={tx('示例：{0}',label)} title={tx('示例：{0}',label)} onClick={()=>openGuide(i)}><Icon name="info"/></button><button aria-label={tx('清除{0}',label)} title={tx('清除{0}',label)} onClick={()=>clear(k)}><Icon name="trash"/></button></div>)}
  {isLineTool(tool)&&<small>{hints[tool]()}</small>}
  {next&&<button className="photo-next" onClick={()=>setTool(next)}>{tx('下一步：{0}',rows.find(r=>r[0]===next)![1])}<Icon name="next"/></button>}
  {lines.filter(l=>l.kind==='measure').map((l,i)=>{const check=solve?.checks.find(c=>c.id===l.id);return <label key={l.id}>{tx('尺寸 {0} · 实际长度 m',i+1)}<input data-1p-ignore type="number" min="0.1" max="500" step="0.01" value={l.meters??''} onChange={e=>{const meters=Number(e.target.value);change({lines:lines.map(x=>x.id===l.id?{...x,meters:meters>0&&meters<=500?meters:undefined}:x)});}}/>{check&&Number.isFinite(check.measured)&&<small>{tx('照片量得 {0} m，相差 {1}%',check.measured.toFixed(2),(Math.abs(check.measured/check.meters-1)*100).toFixed(1))}</small>}</label>;})}
  <LensField view={view} change={change}/>
  {camera&&<CameraInfo camera={camera} northAngle={northAngle} errorLabel={tx('线条误差 {0} px',camera.rmse.toFixed(1))}/>}
  {!!solve?.missing.length&&<div className="photo-missing"><strong>{tx('还需要：')}</strong><ol>{solve.missing.map(t=><li key={t}>{t}</li>)}</ol></div>}
  {solve?.warnings.map(t=><p className="photo-warning" key={t}>{t}</p>)}
 </div>;
}
/** Where the solved camera stands and how it looks: height, heading, tilt, lens and fit error. */
export function CameraInfo({camera,northAngle,errorLabel,measured=tx('线条测得')}:{camera:PhotoCamera;northAngle:number;errorLabel:string;measured?:string}){
 const azimuth=compassAzimuth(camera.forward,northAngle),source={measured,file:tx('照片信息'),typed:tx('手动填写'),assumed:tx('估计')};
  return <div className="photo-camera" role="status"><strong>{tx('相机')}</strong>
   <span>{tx('高度 {0} m',camera.height.toFixed(2))}{Number.isFinite(camera.heightError)&&camera.heightError<50?` ±${camera.heightError.toFixed(camera.heightError<1?2:1)}`:''}</span>
   <span>{tx('朝向 {0}° · {1}',azimuth.toFixed(0),sectors()[Math.round(azimuth/45)%8])}</span>
   <span>{tx('俯角 {0}°',camera.tilt.toFixed(1))}</span>
   <span>{tx('镜头 {0} mm（{1}）',camera.lens35.toFixed(0),source[camera.lens]+(camera.lens==='measured'&&camera.lensError>=.03?` ±${Math.round(camera.lensError*100)}%`:''))}</span>
   <span>{errorLabel}</span></div>;
}
/** The lens is found from the lines, or read from the photo file. Typing one is an advanced override, folded away; the value is kept only when
 * the typing is finished (blur or Enter), so "28" never passes through "2" or "8". */
export function LensField({view,change}:{view:PhotoView;change:(patch:Partial<PhotoView>)=>void}){
 const typed=!!view.lens35&&!view.lensFromFile;
 const commit=(text:string)=>{const v=Number(text);if(!text.trim())change({lens35:undefined,lensFromFile:false});else if(v>=8&&v<=800&&v!==view.lens35)change({lens35:v,lensFromFile:false});};
 return <details className="photo-lens" open={typed||undefined}>
  <summary>{tx('镜头焦距')}<span>{typed?tx('手动 {0} mm',view.lens35):view.lensFromFile&&view.lens35?tx('照片信息 {0} mm',view.lens35):tx('自动')}</span></summary>
  <small>{tx('一般不用填：程序会从照片信息或画的线自动算出。只有确切知道 35 mm 等效焦距时才填写。')}</small>
  <label>{tx('等效焦距 mm')}<input key={`${view.id}-${view.lens35??''}`} data-1p-ignore type="number" min="8" max="800" step="1" placeholder={tx('自动')} defaultValue={view.lens35??''} onBlur={e=>commit(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')commit(e.currentTarget.value);}}/></label>
  {typed&&<button onClick={()=>change({lens35:undefined,lensFromFile:false})}>{tx('改回自动')}</button>}
 </details>;
}
// Top of each area in world metres: carports at about panel height, buildings at the eave or flat roof.
const top=(r:RoofDesign)=>r.carport?GROUND+r.carport.clearance+.6:r.pitch?r.pitch.eave-3.5:(r.flatHeight??3.5)-3.5;
/** Drawn lines on the photo, plus the solved horizon and every roof and carport outline as a live wireframe check. */
export function PhotoLineOverlay({view,tool,unit,solve,roofs,pending}:{view:PhotoView;tool:string;unit:number;solve?:PhotoSolve;roofs:RoofDesign[];pending?:PhotoPoint}){
 const camera=solve?.camera,ref=view.reference??{},segments:{key:string;a:PhotoPoint;b:PhotoPoint;carport:boolean}[]=[];
 if(camera)for(const r of roofs){const ps=corners(roofRect(r)),h=top(r);ps.forEach((p,i)=>{const q=ps[(i+1)%ps.length];
  for(const [key,A,B] of [['g',[p.x,GROUND,p.z],[q.x,GROUND,q.z]],['t',[p.x,h,p.z],[q.x,h,q.z]],['v',[p.x,GROUND,p.z],[p.x,h,p.z]]] as const){const s=projectSegment(camera,[...A],[...B]);if(s)segments.push({key:`${r.id}${key}${i}`,a:s[0],b:s[1],carport:!!r.carport});}});}
 const horizon=camera&&horizonLine(camera,view.width),handle=(p:PhotoPoint,kind:string,index:number,end:'a'|'b',color:string,label?:string)=><g key={`${kind}${index}${end}`}><circle data-kind={kind} data-index={index} data-end={end} cx={p.x} cy={p.y} r={unit*7} fill={color} stroke="#102030" strokeWidth={unit*1.5}/>{label&&<text pointerEvents="none" x={p.x+unit*10} y={p.y-unit*9} fill="white" stroke="#153344" paintOrder="stroke" strokeWidth={unit*3} fontSize={unit*14}>{label}</text>}</g>;
 return <g>
  <g pointerEvents="none">{segments.map(s=><line key={s.key} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke={s.carport?'#5ce1e6':'#ffffff'} strokeOpacity={.8} strokeWidth={unit*1.5}/>)}
   {horizon&&<line x1={horizon[0].x} y1={horizon[0].y} x2={horizon[1].x} y2={horizon[1].y} stroke="#ffe066" strokeDasharray={`${unit*8} ${unit*6}`} strokeWidth={unit*1.5}/>}</g>
  {(view.lines??[]).map((l,i)=><g key={l.id}><line pointerEvents="none" x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke={colors[l.kind]} strokeWidth={unit*2.5} strokeDasharray={l.kind==='measure'?`${unit*6} ${unit*4}`:undefined}/>
   {tool===l.kind&&<>{handle(l.a,'line',i,'a',colors[l.kind])}{handle(l.b,'line',i,'b',colors[l.kind])}</>}</g>)}
  {ref.a&&ref.b&&<line pointerEvents="none" x1={ref.a.x} y1={ref.a.y} x2={ref.b.x} y2={ref.b.y} stroke={colors.reference} strokeWidth={unit*3}/>}
  {ref.a&&handle(ref.a,'ref',0,'a',colors.reference,'1')}{ref.b&&handle(ref.b,'ref',0,'b',colors.reference,'2')}
  {pending&&<circle pointerEvents="none" cx={pending.x} cy={pending.y} r={unit*5} fill={isLineTool(tool)?colors[tool]:'#fff'}/>}
 </g>;
}
/** The plan view in world metres (x right, z down), the same frame the base drawing is placed in. */
export function planBox(roofs:RoofDesign[],base:BaseImage|undefined,view:PhotoView|undefined,solve?:PhotoSolve){
 const points=roofs.flatMap(r=>corners(roofRect(r))).map(p=>({x:p.x,y:p.z}));
 // A real drawing frames the view; a blank sheet (kilometres of nothing) does not.
 if(base?.metersPerPixel&&!base.blank){const k=base.metersPerPixel,f=base.frame??{x:0,y:0,width:base.width,height:base.height},x=(-f.x-f.width/2)*k,y=(-f.y-f.height/2)*k;points.push({x,y},{x:x+base.width*k,y:y+base.height*k});}
 for(const p of [view?.reference?.planA,view?.reference?.planB])if(p)points.push({x:p.x,y:p.z});
 if(solve?.camera)points.push({x:solve.camera.C[0],y:solve.camera.C[2]});
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,pad=Math.max(w,h,20)*.06;
 return {x:x-pad,y:y-pad,w:w+2*pad,h:h+2*pad};
}
/** A plan click pulled onto the nearest roof or carport corner, else onto the nearest outline edge, within `reach` metres. */
export function snapPlan(p:{x:number;z:number},roofs:RoofDesign[],reach:number){
 let best:{x:number;z:number}|undefined,d=reach*1.5;
 for(const r of roofs)for(const q of corners(roofRect(r))){const e=Math.hypot(q.x-p.x,q.z-p.z);if(e<d){d=e;best={x:q.x,z:q.z};}}
 if(best)return best;d=reach;
 for(const r of roofs){const ps=corners(roofRect(r));ps.forEach((a,i)=>{const b=ps[(i+1)%ps.length],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1))),q={x:a.x+t*dx,z:a.z+t*dz},e=Math.hypot(q.x-p.x,q.z-p.z);if(e<d){d=e;best=q;}});}
 return best??p;
}
export function PlanOverlay({roofs,base,overlays,view,solve,unit,hover,transparent=false}:{roofs:RoofDesign[];base?:BaseImage;overlays?:ImageOverlay[];view?:PhotoView;solve?:PhotoSolve;unit:number;hover?:{x:number;z:number};transparent?:boolean}){
 const ref=view?.reference??{},camera=solve?.camera,k=base?.metersPerPixel,f=base?.frame??{x:0,y:0,width:base?.width??0,height:base?.height??0};
 let cone='';if(camera){const fw=camera.forward,l=Math.hypot(fw[0],fw[2])||1,dx=fw[0]/l,dz=fw[2]/l,half=Math.atan((view?.width??0)/2/camera.f),reach=Math.max(25,...roofs.map(r=>Math.hypot(r.x-camera.C[0],r.z-camera.C[2])))*.5;
  const ray=(s:number)=>{const c=Math.cos(s*half),n=Math.sin(s*half);return `${camera.C[0]+reach*(dx*c-dz*n)},${camera.C[2]+reach*(dz*c+dx*n)}`;};cone=`${camera.C[0]},${camera.C[2]} ${ray(-1)} ${ray(1)}`;}
 const handle=(p:{x:number;z:number},end:'a'|'b',label:string)=><g><circle data-kind="plan" data-index={0} data-end={end} cx={p.x} cy={p.z} r={unit*7} fill={colors.plan} stroke="#102030" strokeWidth={unit*1.5}/><text pointerEvents="none" x={p.x+unit*10} y={p.z-unit*9} fill="white" stroke="#153344" paintOrder="stroke" strokeWidth={unit*3} fontSize={unit*14}>{label}</text></g>;
 return <g>
  {!transparent&&<rect pointerEvents="none" x={-1e5} y={-1e5} width={2e5} height={2e5} fill="#f4f6f7"/>}
  {k&&!base!.blank&&base!.visible!==false&&<g transform={`translate(${(-f.x-f.width/2)*k} ${(-f.y-f.height/2)*k}) scale(${k})`}>
   <BaseImageClip crop={base!.crop} opacity={base!.opacity}><image pointerEvents="none" href={base!.url} width={base!.width} height={base!.height}/></BaseImageClip>
  </g>}
  {overlays?.filter(o=>o.visible).map(o=><image key={o.id} pointerEvents="none" href={o.url} preserveAspectRatio="none" opacity={o.opacity} transform={`translate(${o.x} ${o.z}) rotate(${-o.yaw*180/Math.PI})`} x={-o.width/2} y={-o.depth/2} width={o.width} height={o.depth}/>)}
  {roofs.map(r=><polygon key={r.id} pointerEvents="none" points={corners(roofRect(r)).map(p=>`${p.x},${p.z}`).join(' ')} fill={r.carport?'#5ce1e633':'#2484b522'} stroke={r.carport?'#1c9aa0':'#2484b5'} strokeWidth={unit*1.5}/>)}
  {roofs.map(r=>{const c=roofRect(r);return <text key={r.id} pointerEvents="none" x={c.x} y={c.z} dy=".35em" textAnchor="middle" fontSize={unit*13} fill="#153344" stroke="white" strokeWidth={unit*3} paintOrder="stroke">{r.name}</text>;})}
  {cone&&<g pointerEvents="none"><polygon points={cone} fill="#ffe06644" stroke="#d9a400" strokeWidth={unit*1.5}/><circle cx={camera!.C[0]} cy={camera!.C[2]} r={unit*6} fill="#d9a400"/><text x={camera!.C[0]+unit*9} y={camera!.C[2]+unit*16} fontSize={unit*14} fill="#6b5200">{tx('相机')}</text></g>}
  {ref.planA&&ref.planB&&<line pointerEvents="none" x1={ref.planA.x} y1={ref.planA.z} x2={ref.planB.x} y2={ref.planB.z} stroke={colors.plan} strokeWidth={unit*3}/>}
  {ref.planA&&handle(ref.planA,'a','1')}{ref.planB&&handle(ref.planB,'b','2')}
  {hover&&<circle pointerEvents="none" cx={hover.x} cy={hover.z} r={unit*9} fill="none" stroke={colors.plan} strokeWidth={unit*2}/>}
 </g>;
}
/** The photo, small, with its reference line: shown over the plan so the same edge is easy to find. */
export function PhotoInset({view}:{view:PhotoView}){
 const ref=view.reference??{},u=Math.max(view.width,view.height)/300;
 return <svg className="photo-plan-inset" viewBox={`0 0 ${view.width} ${view.height}`} aria-label={tx('照片中的参考线')}>
  <image href={view.url} width={view.width} height={view.height}/>
  {ref.a&&ref.b&&<line x1={ref.a.x} y1={ref.a.y} x2={ref.b.x} y2={ref.b.y} stroke={colors.reference} strokeWidth={u*3}/>}
  {([['1',ref.a],['2',ref.b]] as const).map(([label,p])=>p&&<g key={label}><circle cx={p.x} cy={p.y} r={u*6} fill={colors.reference} stroke="#102030" strokeWidth={u*1.5}/><text x={p.x+u*9} y={p.y-u*8} fill="white" stroke="#153344" paintOrder="stroke" strokeWidth={u*3} fontSize={u*14}>{label}</text></g>)}
 </svg>;
}
