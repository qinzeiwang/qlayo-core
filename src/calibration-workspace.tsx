import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import type {BaseImage} from './base-image';
import {corners,type Point} from './domain';
import type {RoofDesign} from './roof-project';
import {roofRect} from './roof-project';
import {calibrationScale} from './drawing-calibration';
import {usePdfPatch,type PdfViewport} from './pdf-patch';
import {Icon} from './workbench-ui';
import {Compass} from './north-compass';
import {tx} from './i18n';
import './calibration-workspace.css';

type Props={
 base:BaseImage;
 recalibrating:boolean;
 roofs:RoofDesign[];
 onCancel:()=>void;
 onConfirm:(base:BaseImage)=>void;
};

export function CalibrationWorkspace({base,recalibrating,roofs,onCancel,onConfirm}:Props){
 const svg=useRef<SVGSVGElement>(null),lengthInput=useRef<HTMLInputElement>(null);
 const pan=useRef<{x:number;y:number;view:PdfViewport}|undefined>(undefined);
 const space=useRef(false);
 const [panMode,setPanMode]=useState(false),[panning,setPanning]=useState(false);
 const [points,setPoints]=useState<Point[]>([]),[northPoints,setNorthPoints]=useState<Point[]>([]);
 const [tool,setTool]=useState<'scale'|'north'>('scale');
 const [northMode,setNorthMode]=useState<'original'|'drawing'>('original');
 const [meters,setMeters]=useState(''),[hover,setHover]=useState<Point>();
 const [error,setError]=useState('');
 const [{width,height},setSize]=useState({width:1,height:1});
 const [view,setView]=useState<PdfViewport>({x:0,y:0,width:base.width,height:base.height});
 const patch=usePdfPatch(base,view,width);
 const originalNorth=base.northAngle??0;
 const [a,b]=northPoints;
 const north=a&&b?(Math.atan2(b.x-a.x,a.z-b.z)*180/Math.PI+360)%360:originalNorth;
 const measuredScale=calibrationScale(points,Number(meters));
 const scale=points.length?measuredScale:base.metersPerPixel;
 const ready=!!scale&&(northMode==='original'||northPoints.length===2);
 const unit=view.width/width;

 function fitted(w:number,h:number):PdfViewport{
  const unit=Math.max(base.width/Math.max(1,w-64),base.height/Math.max(1,h-100));
  const width=unit*w,height=unit*h;
  return {x:(base.width-width)/2,y:(base.height-height)/2-12*unit,width,height};
 }
 useLayoutEffect(()=>{
  const canvas=svg.current!;
  const resize=()=>{
   const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
   setSize({width:w,height:h});
   setView(fitted(w,h));
  };
  resize();
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  return()=>observer.disconnect();
 },[base.width,base.height]);
 useEffect(()=>{
  if(points.length===2)lengthInput.current?.focus({preventScroll:true});
 },[points.length]);
 useEffect(()=>{
  const canvas=svg.current!;
  const wheel=(event:WheelEvent)=>{
   event.preventDefault();
   const rect=canvas.getBoundingClientRect(),u=(event.clientX-rect.left)/rect.width,v=(event.clientY-rect.top)/rect.height;
   setView(old=>{
    const min=fitted(rect.width,rect.height).width/40,max=fitted(rect.width,rect.height).width*4;
    const width=Math.max(min,Math.min(max,old.width*Math.exp(Math.max(-150,Math.min(150,event.deltaY))*.002)));
    const height=old.height*width/old.width;
    return {x:old.x+(old.width-width)*u,y:old.y+(old.height-height)*v,width,height};
   });
  };
  canvas.addEventListener('wheel',wheel,{passive:false});
  return()=>canvas.removeEventListener('wheel',wheel);
 },[base.width,base.height]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();onCancel();}
   if(event.code==='Space'&&!(event.target instanceof HTMLElement&&event.target.closest('input,button'))){event.preventDefault();space.current=true;}
  };
  const release=()=>{space.current=false;};
  window.addEventListener('keydown',key,true);window.addEventListener('keyup',release);window.addEventListener('blur',release);
  return()=>{window.removeEventListener('keydown',key,true);window.removeEventListener('keyup',release);window.removeEventListener('blur',release);};
 },[onCancel]);

 function point(event:PointerEvent<SVGSVGElement>){
  const transform=event.currentTarget.getScreenCTM();
  if(!transform)return;
  const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(transform.inverse());
  if(p.x<0||p.y<0||p.x>base.width||p.y>base.height)return;
  return {x:p.x,z:p.y};
 }
 function pointerDown(event:PointerEvent<SVGSVGElement>){
  if(event.button===1||event.button===0&&(panMode||space.current)){
   event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
   pan.current={x:event.clientX,y:event.clientY,view};setPanning(true);return;
  }
  if(event.button!==0)return;
  const p=point(event);
  if(!p)return;
  const current=tool==='scale'?points:northPoints;
  if(current.length>=2)return;
  if(current.length&&Math.hypot(p.x-current[0].x,p.z-current[0].z)<Math.max(2,unit*4)){
   setError(tx('两点过近，请选择较长的已知尺寸'));return;
  }
  event.preventDefault();setError('');
  (tool==='scale'?setPoints:setNorthPoints)([...current,p]);
 }
 function pointerMove(event:PointerEvent<SVGSVGElement>){
  if(pan.current){
   const start=pan.current;
   setView({...start.view,x:start.view.x-(event.clientX-start.x)*unit,y:start.view.y-(event.clientY-start.y)*unit});
  }else setHover(point(event));
 }
 function pickScale(){
  setPoints([]);setMeters('');setError('');setHover(undefined);setTool('scale');setPanMode(false);
 }
 function pickNorth(mode:'original'|'drawing'){
  if(northMode!==mode||mode==='original')setNorthPoints([]);
  setNorthMode(mode);setError('');setHover(undefined);setTool(mode==='drawing'?'north':'scale');setPanMode(false);
 }
 function confirm(){
  if(!ready||!scale)return;
  try{onConfirm({...base,metersPerPixel:scale,northAngle:north,frame:base.frame??{x:0,y:0,width:base.width,height:base.height}});}
  catch(e){setError((e as Error).message);}
 }

 const scaleHint=points.length===2
  ?meters&&!measuredScale?tx('比例尺超出范围，请重新输入实际长度'):undefined
  :points.length?tx('点击距离的另一端'):tx('在图上选取一段已知距离的两个端点');
 const northHint=northMode==='drawing'&&northPoints.length<2
  ?northPoints.length?tx('点击朝北的一点'):tx('在图上点击北向起点')
  :undefined;
 const scaleEnd=points[1]??(tool==='scale'?hover:undefined),northEnd=b??(tool==='north'?hover:undefined);
 const rasterFrame=base.frame??{x:0,y:0,width:base.width,height:base.height};
 const title=recalibrating?tx('重新标定'):tx('标定底图');
 const exitLabel=recalibrating?tx('返回工作台'):tx('返回');
 const drawLine=(p:Point,q:Point,color:string,arrow?:boolean)=><line x1={p.x} y1={p.z} x2={q.x} y2={q.z}
  stroke={color} strokeWidth={1.7} vectorEffect="non-scaling-stroke" markerEnd={arrow?'url(#calibration-north-arrow)':undefined}/>;
 const drawPoint=(p:Point,i:number,color:string)=><g key={i}><circle cx={p.x} cy={p.z} r={5*unit}
  fill="white" stroke={color} strokeWidth={1.7} vectorEffect="non-scaling-stroke"/><circle cx={p.x} cy={p.z} r={1.4*unit} fill={color}/></g>;

 return <main className="calibration-workspace" aria-label={title}>
  <aside className="calibration-panel">
   <header><button className="icon-button" type="button" title={exitLabel} aria-label={exitLabel} onClick={onCancel}><Icon name="back"/></button>
    <h1>{title}</h1>
   </header>
   <div className="calibration-panel-body">
    <div className="calibration-file"><Icon name="underlay-plan"/><span title={base.name}>{base.name}</span></div>
    <section aria-labelledby="calibration-scale-heading">
     <div className="calibration-section-heading"><h2 id="calibration-scale-heading">{tx('图纸比例')}</h2>
      {(points.length>0||tool==='north')&&<button className="icon-button" type="button"
       aria-label={points.length?tx('重选端点'):tx('选取端点')} title={points.length?tx('重选端点'):tx('选取端点')}
       onClick={pickScale}><Icon name={points.length?'reset':'ruler'}/></button>}
     </div>
     <label className="calibration-field"><span>{tx('实际长度')}</span>
      <span className="calibration-value"><input ref={lengthInput} data-1p-ignore="true" type="number" min=".01" step="any" aria-label={tx('标定真实距离 m')}
       value={meters} disabled={points.length!==2} onChange={e=>{setMeters(e.target.value);setError('');}}/><span>m</span></span>
     </label>
     {scaleHint&&<p className="calibration-hint" role="status">{scaleHint}</p>}
    </section>
    <section aria-labelledby="calibration-north-heading">
     <div className="calibration-section-heading"><h2 id="calibration-north-heading">{tx('北向')}</h2>
      {northPoints.length>0?<button className="icon-button" type="button" aria-label={tx('重选北向')} title={tx('重选北向')}
       onClick={()=>{setNorthPoints([]);setHover(undefined);setTool('north');setPanMode(false);}}><Icon name="reset"/></button>:null}
     </div>
     <div className="seg-track calibration-north-options" role="group" aria-label={tx('北向')}>
      <button className="seg-btn" type="button" aria-pressed={northMode==='original'} onClick={()=>pickNorth('original')}>{originalNorth?tx('沿用北向'):tx('上方为北')}</button>
      <button className="seg-btn" type="button" aria-pressed={northMode==='drawing'} onClick={()=>pickNorth('drawing')}>{tx('图上选取')}</button>
     </div>
     {northHint&&<p className="calibration-hint" role="status">{northHint}</p>}
    </section>
   </div>
   <footer>
    {error&&<p className="calibration-error" role="alert">{error}</p>}
    {!error&&base.metersPerPixel&&measuredScale&&Math.abs(measuredScale/base.metersPerPixel-1)>1e-9&&roofs.some(roof=>roof.arrays.length>0)&&
     <p className="calibration-hint calibration-change-note">{tx('重标定后需重新布置')}</p>}
    <button className="calibration-confirm" type="button" disabled={!ready} onClick={confirm}><Icon name="check"/>{tx('完成标定')}</button>
   </footer>
  </aside>
  <section className="calibration-viewport">
   <div className="calibration-tools" role="toolbar" aria-label={tx('画布工具')}>
    <button type="button" className="icon-button" title={tx('平移画布')} aria-label={tx('平移画布')} aria-pressed={panMode} onClick={()=>setPanMode(v=>!v)}><Icon name="pan"/></button>
    <button type="button" className="icon-button" title={tx('适应窗口')} aria-label={tx('适应窗口')} onClick={()=>setView(fitted(width,height))}><Icon name="frame"/></button>
   </div>
   <svg ref={svg} aria-label={tx('底图标定画布')} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
    preserveAspectRatio="none" className={panning?'is-panning':panMode?'is-pan-mode':undefined}
    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerLeave={()=>setHover(undefined)}
    onPointerUp={()=>{pan.current=undefined;setPanning(false);}} onPointerCancel={()=>{pan.current=undefined;setPanning(false);}}>
    <defs><marker id="calibration-north-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
     <path d="M0 0 10 5 0 10Z" fill="#98703b"/>
    </marker></defs>
    <image href={base.url} width={base.width} height={base.height} pointerEvents="none"/>
    {patch&&<image href={patch.url} {...patch.view} pointerEvents="none"/>}
    <g pointerEvents="none">
     {recalibrating&&base.metersPerPixel&&roofs.map(roof=><polygon key={roof.id} points={corners(roofRect(roof)).map(p=>
      `${p.x/base.metersPerPixel!+rasterFrame.x+rasterFrame.width/2},${p.z/base.metersPerPixel!+rasterFrame.y+rasterFrame.height/2}`).join(' ')}
      fill="none" stroke="#526672" strokeOpacity=".48" strokeWidth={1} vectorEffect="non-scaling-stroke"/>)}
     {points[0]&&scaleEnd&&drawLine(points[0],scaleEnd,'#307c77')}
     {a&&northEnd&&drawLine(a,northEnd,'#98703b',true)}
     {points.map((p,i)=>drawPoint(p,i,'#307c77'))}
     {northPoints.map((p,i)=>drawPoint(p,i,'#98703b'))}
    </g>
   </svg>
   <Compass small angle={north}/>
  </section>
 </main>;
}
