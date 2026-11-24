import {useDialog} from './use-dialog';
import {Icon} from './workbench-ui';
import {tx} from './i18n';
/** A worked example of the line method: a drawn ground photo of a building and a carport row, and its plan, step by step. */
type V=[number,number,number];
const W=960,H=600,f=.62*Math.hypot(W,H),C:V=[6,1.6,12];
const norm=(v:V):V=>{const l=Math.hypot(...v);return [v[0]/l,v[1]/l,v[2]/l];},cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const fw=norm([0-C[0],2.6-C[1],-8-C[2]]),right=norm(cross(fw,[0,1,0])),down=cross(fw,right),R=[right,down,fw];
const cam=(X:V):V=>R.map(r=>r[0]*(X[0]-C[0])+r[1]*(X[1]-C[1])+r[2]*(X[2]-C[2])) as V;
const screen=(c:V)=>({x:f*c[0]/c[2]+W/2,y:f*c[1]/c[2]+H/2});
// World metres: x east, y up, z south; the ground is y = 0.
const g=(x:number,z:number,h=0):V=>[x,h,z];
// Polygons are cut at a plane just in front of the camera, so ground areas behind it still draw.
function poly(points:V[]){const c=points.map(cam),out:V[]=[],near=.5;
 c.forEach((p,i)=>{const q=c[(i+1)%c.length],pin=p[2]>=near,qin=q[2]>=near;if(pin)out.push(p);if(pin!==qin){const t=(near-p[2])/(q[2]-p[2]);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1]),near]);}});
 return out.map(screen).map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');}
const seg=(a:V,b:V)=>{const p=screen(cam(a)),q=screen(cam(b));return {x1:p.x,y1:p.y,x2:q.x,y2:q.y};};
// The site: a building 24 × 12 m and 7 m high, a carport row 14.4 × 5 m in front of it over six parking bays 2.4 m wide, and a kerb at z = 2.
const B={x0:-12,x1:12,z0:-24,z1:-12,h:7},P={x0:-7.2,x1:7.2,z0:-6,z1:-1,front:2.4,back:3.6},kerb=2,bays=Array.from({length:7},(_,i)=>-7.2+i*2.4);
type Mark={a:V;b:V;label?:[string,string]};
const marks:Record<string,Mark[]>={
 reference:[{a:g(-4,kerb),b:g(8,kerb),label:['1','2']}],
 vertical:[{a:g(B.x0,B.z1),b:g(B.x0,B.z1,B.h)},{a:g(P.x1,P.z1),b:g(P.x1,P.z1,P.front)},{a:g(B.x1,B.z1),b:g(B.x1,B.z1,B.h)}],
 along:[{a:g(B.x0,B.z1,B.h),b:g(B.x1,B.z1,B.h)},{a:g(P.x0,P.z1,P.front),b:g(P.x1,P.z1,P.front)}],
 across:[{a:g(bays[1],0),b:g(bays[1],-6)},{a:g(bays[5],0),b:g(bays[5],-6)}],
 measure:[{a:g(bays[0],0),b:g(bays[5],0),label:['','12 m']}],
};
const colors:Record<string,string>={reference:'#ff4f8b',vertical:'#ffad33',along:'#3fb2ff',across:'#4fd18b',measure:'#ffffff'};
type Step={key:string;title:()=>string;how:()=>string;good:()=>string;bad:()=>string;plan?:boolean};
const steps:Step[]=[
 {key:'reference',title:()=>tx('第 1 步 · 参考线（照片）'),how:()=>tx('在照片里找一条地面上的直边，在它的两端各点一下（先点 1，再点 2）。示例里用的是路沿。'),good:()=>tx('好的选择：路沿、车位线、墙脚。越长越好，而且平面图上也能找到。'),bad:()=>tx('不要用屋顶边、车棚顶边这类高处的线，参考线必须贴着地面。')},
 {key:'plan',plan:true,title:()=>tx('第 2 步 · 参考线（平面图）'),how:()=>tx('切到平面图，在同一条边上按同样顺序点 1 和 2。点完后程序就知道照片与平面图的对应关系。'),good:()=>tx('平面图上的 1 必须是照片里的 1。端点不必是真实的角，只要在这条边上、两边对应即可。'),bad:()=>tx('1、2 顺序反了，相机会被放到对面。')},
 {key:'vertical',title:()=>tx('第 3 步 · 竖直线'),how:()=>tx('沿竖直的东西画线：墙角、车棚柱、灯杆。每条线点两下：下端一下、上端一下。'),good:()=>tx('至少两条，最好三条；一条在左边、一条在右边，相距越远越准。线尽量画长。'),bad:()=>tx('不要用树、人或歪的杆子；也不要用离得很近的两根柱子。')},
 {key:'along',title:()=>tx('第 4 步 · 地面线 A'),how:()=>tx('找一组在现实中互相平行的水平线，每条点两下。示例用楼的檐口和车棚前沿，它们都是东西方向。'),good:()=>tx('至少两条。它们在照片里会“汇聚”，这正是程序需要的。可以在不同高度，只要是水平且同一方向。'),bad:()=>tx('不要把方向不同的线混在一组里。')},
 {key:'across',title:()=>tx('第 5 步 · 地面线 B（可选）'),how:()=>tx('再找一组与 A 垂直的平行水平线。示例用两条车位线，它们是南北方向。'),good:()=>tx('画了 B，镜头焦距会算得更准；照片没有焦距信息时特别有用。'),bad:()=>tx('B 必须与 A 垂直；不确定时可以不画。')},
 {key:'measure',title:()=>tx('第 6 步 · 量尺寸（可选）'),how:()=>tx('沿地面画一段你知道真实长度的线，在左侧填上实际长度。示例：5 个车位宽 = 12 m。'),good:()=>tx('程序会显示“照片量得多少米、相差多少”，相差 2% 以内说明标得很好。'),bad:()=>tx('这一步只用来核对，不改变相机。')},
 {key:'check',plan:true,title:()=>tx('第 7 步 · 检查结果'),how:()=>tx('画够后，左侧出现相机的高度、朝向和镜头。照片上会出现白色线框（房子）和青色线框（车棚），平面图上会出现相机位置。'),good:()=>tx('线框贴合照片里的房子和车棚，相机高度合理（手持拍摄约 1.5–1.8 m），就可以生成预览。'),bad:()=>tx('线框对不上时：先检查参考线 1、2 的顺序，再把竖直线画得更长、更分开。')},
];
export const guideSteps=steps.map(s=>s.key);
function Photo({active}:{active:string}){
 const shown=active==='check'?Object.keys(marks):guideSteps.slice(0,guideSteps.indexOf(active)+1).filter(k=>k in marks);
 const top=g,cols=[P.x0,0,P.x1];
 return <svg viewBox={`0 0 ${W} ${H}`} className="photo-guide-picture" aria-label={tx('示例照片')}>
  <rect width={W} height={H} fill="#b9d3ea"/>
  <polygon points={poly([g(-500,-500),g(500,-500),g(500,500),g(-500,500)])} fill="#9a9c97"/>
  <polygon points={poly([g(-60,kerb),g(60,kerb),g(60,30),g(-60,30)])} fill="#6f7377"/>
  {bays.map(x=><line key={x} {...seg(g(x,0),g(x,-6))} stroke="#f4f4f0" strokeWidth={3}/>)}
  <polygon points={poly([g(B.x0,B.z1),g(B.x1,B.z1),top(B.x1,B.z1,B.h),top(B.x0,B.z1,B.h)])} fill="#d8cfbf"/>
  {[-10,-4,2,8].map(x=><polygon key={x} points={poly([g(x,B.z1,2.6),g(x+3,B.z1,2.6),g(x+3,B.z1,4.4),g(x,B.z1,4.4)])} fill="#7d8c99"/>)}
  {cols.flatMap(x=>[P.z0,P.z1].map(z=><line key={`${x}${z}`} {...seg(g(x,z),g(x,z,z===P.z1?P.front:P.back))} stroke="#5d6166" strokeWidth={5}/>))}
  <polygon points={poly([top(P.x0,P.z1,P.front),top(P.x1,P.z1,P.front),top(P.x1,P.z0,P.back),top(P.x0,P.z0,P.back)])} fill="#2c4a6e" stroke="#c9d4de" strokeWidth={2}/>
  {shown.flatMap(k=>marks[k].map((m,i)=>{const s=seg(m.a,m.b),on=k===active||active==='check'||(active==='plan'&&k==='reference');return <g key={k+i} opacity={on?1:.35}>
   <line {...s} stroke={colors[k]} strokeWidth={on?4:3} strokeDasharray={k==='measure'?'10 6':undefined}/>
   {on&&<><circle cx={s.x1} cy={s.y1} r={7} fill={colors[k]} stroke="#102030" strokeWidth={1.5}/><circle cx={s.x2} cy={s.y2} r={7} fill={colors[k]} stroke="#102030" strokeWidth={1.5}/></>}
   {on&&m.label&&m.label.map((t,j)=>t&&<text key={j} x={(j?s.x2:s.x1)+10} y={(j?s.y2:s.y1)-12} fontSize={20} fontWeight={600} fill="white" stroke="#153344" strokeWidth={4} paintOrder="stroke">{t}</text>)}</g>;}))}
 </svg>;
}
function Plan({camera}:{camera:boolean}){
 const r=marks.reference[0],cone=(()=>{const d=Math.atan2(fw[2],fw[0]),half=Math.atan(W/2/f),L=14;return [C,...[-1,1].map(s=>[C[0]+L*Math.cos(d+s*half),0,C[2]+L*Math.sin(d+s*half)])].map(p=>`${p[0]},${p[2]}`).join(' ');})();
 return <svg viewBox="-20 -28 40 44" className="photo-guide-picture" aria-label={tx('示例平面图')}>
  <rect x={-20} y={-28} width={40} height={44} fill="#9a9c97"/><rect x={-20} y={kerb} width={40} height={14} fill="#6f7377"/>
  <rect x={B.x0} y={B.z0} width={B.x1-B.x0} height={B.z1-B.z0} fill="#d8cfbf" stroke="#8a8172" strokeWidth={.3}/>
  {bays.map(x=><line key={x} x1={x} y1={0} x2={x} y2={-6} stroke="#f4f4f0" strokeWidth={.25}/>)}
  <rect x={P.x0} y={P.z0} width={P.x1-P.x0} height={P.z1-P.z0} fill="#2c4a6ecc" stroke="#c9d4de" strokeWidth={.2}/>
  <line x1={r.a[0]} y1={r.a[2]} x2={r.b[0]} y2={r.b[2]} stroke={colors.reference} strokeWidth={.6}/>
  {[r.a,r.b].map((p,i)=><g key={i}><circle cx={p[0]} cy={p[2]} r={1} fill={colors.reference} stroke="#102030" strokeWidth={.2}/><text x={p[0]+1.2} y={p[2]-1.2} fontSize={2.4} fontWeight={600} fill="white" stroke="#153344" strokeWidth={.5} paintOrder="stroke">{i+1}</text></g>)}
  {camera&&<g><polygon points={cone} fill="#ffe06655" stroke="#d9a400" strokeWidth={.25}/><circle cx={C[0]} cy={C[2]} r={.8} fill="#d9a400"/><text x={C[0]-7} y={C[2]+3} fontSize={2.2} fill="#fff6c8">{tx('相机')}</text></g>}
 </svg>;
}
export function PhotoGuide({step,setStep,onClose}:{step:number;setStep:(n:number)=>void;onClose:()=>void}){
 useDialog('.photo-guide[role="dialog"]',true,onClose);
 const s=steps[step];
 return <div className="photo-guide-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="photo-guide" role="dialog" aria-modal="true" aria-label={tx('画线教程')}>
   <header><h2>{tx('画线教程')}</h2><span>{tx('示例：从地面拍的一栋楼和一排车棚')}</span><button className="icon-button" aria-label={tx('关闭教程')} title={tx('关闭教程')} onClick={onClose}><Icon name="close"/></button></header>
   <div className="photo-guide-body">
    <div className="photo-guide-pictures"><Photo active={s.key}/>{s.plan&&<Plan camera={s.key==='check'}/>}</div>
    <div className="photo-guide-text"><h3>{s.title()}</h3><p>{s.how()}</p><p className="photo-guide-good"><Icon name="check"/>{s.good()}</p><p className="photo-guide-bad"><Icon name="alert"/>{s.bad()}</p>
     <ol className="photo-guide-dots">{steps.map((x,i)=><li key={x.key}><button aria-label={x.title()} aria-current={i===step?'step':undefined} onClick={()=>setStep(i)}>{i+1}</button></li>)}</ol></div>
   </div>
   <footer><button disabled={!step} onClick={()=>setStep(step-1)}><Icon name="back"/>{tx('上一步')}</button>{step<steps.length-1?<button className="photo-save" data-dialog-initial-focus onClick={()=>setStep(step+1)}>{tx('下一步')}<Icon name="next"/></button>:<button className="photo-save" data-dialog-initial-focus onClick={onClose}>{tx('开始画线')}</button>}</footer>
  </section>
 </div>;
}
