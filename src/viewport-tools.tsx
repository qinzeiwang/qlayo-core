import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './workbench-ui';
import {AlignMenuButton} from './canvas-selection';
import type {AlignEdge} from './area-tools';
import type {LayoutImageOptions,LayoutImageOrientation,LayoutImageScope,Mode} from './domain';
import type {MeasureTool} from './measure';
import './viewport-tools.css';
import {tx} from './i18n';
const isMac=typeof navigator!=='undefined'&&/Mac|iPhone|iPad|iPod/i.test(navigator.platform||navigator.userAgent);
type Props={
 drawing?:boolean;
 /** Phones: hide the tools that change the project (sun time, photo match, image overlay). */
 viewOnly?:boolean;
 mode:Mode;navigationMode:'select'|'pan';running:boolean;
 /** 3D eye-level view (standing under the canopy). */
 eyeLevel:boolean;onToggleEyeLevel?:()=>void;
 displayOpen:boolean;sunOpen:boolean;overlayOpen:boolean;
 /** Buttons of the loaded modules (e.g. photo match, electrical), placed around the image overlay button. */
 tools:ViewportTool[];
 onTop:()=>void;on3d:()=>void;onSelectMode:()=>void;onTogglePan:()=>void;onFit:()=>void;
 viewRotation?:number;horizonActive?:boolean;onViewRotation?:(deg:number)=>void;onToggleHorizon?:()=>void;onResetRotation?:()=>void;
 onDownload:(options:LayoutImageOptions)=>void;downloadDisabled:boolean;
 downloadSiteId?:string;downloadHasBase:boolean;downloadBaseVisible:boolean;downloadGridVisible:boolean;
 onToggleDisplay?:()=>void;onToggleSun:()=>void;onToggleOverlay:()=>void;
 /** 2D measuring: the tool in use, how many measurements are shown, and their buttons. */
 measureTool:MeasureTool|null;measureCount:number;onMeasure:(tool:MeasureTool)=>void;onClearMeasures:()=>void;
 /** 2D: line up the picked areas (grey until two or more are picked). */
 align?:{count:number;keyName:string;onAlign:(edge:AlignEdge)=>void};
};
export type ViewportTool={key:string;icon:string;label:string;tooltip:string;disabled:boolean;beforeOverlay?:boolean;onClick:()=>void};
const toolButton=(t:ViewportTool)=><button key={t.key} className="icon-button" aria-label={t.label} data-tooltip={t.tooltip} disabled={t.disabled} onClick={t.onClick}><Icon name={t.icon}/></button>;
/** Centered floating canvas toolbar island: 2D/3D (+ eye level in 3D) | select, pan & fit | rotate canvas | align (2D) | measure | display & sun | photo match, overlay, electrical. */
export function ViewportTools(p:Props){
 return <div className="viewport-tools canvas-island" role="toolbar" aria-label={tx('画布工具')}>
  <nav className="island-seg" aria-label={tx('视角')}>
   <button title={tx('俯视布置')} aria-label={tx('俯视布置')} className={p.mode === "top" ? "active" : ""} disabled={p.drawing} onClick={p.onTop}>2D</button>
   <button title={tx('三维查看')} aria-label={tx('三维查看')} className={p.mode === "3d" ? "active" : ""} disabled={p.drawing} onClick={p.on3d}>3D</button>
  </nav>
  {p.mode==='3d'&&p.onToggleEyeLevel&&<button className={`icon-button ${p.eyeLevel?'active':''}`} data-tooltip={tx('人视角：站在地面看')} aria-label={tx('人视角')} aria-pressed={p.eyeLevel} disabled={p.running} onClick={p.onToggleEyeLevel}><Icon name="walk"/></button>}
  {p.mode==='top'&&<button className={`icon-button ${!p.drawing&&p.navigationMode==='select'&&!p.measureTool?'active':''}`} data-tooltip={tx('选择与移动')} aria-label={tx('选择与移动')} aria-pressed={!p.drawing&&p.navigationMode==='select'&&!p.measureTool} disabled={p.running||p.drawing} onClick={p.onSelectMode}><Icon name="pointer"/></button>}
  <button className={`icon-button ${p.navigationMode==='pan'?'active':''}`} data-tooltip={tx('平移画布')} aria-label={tx('平移画布')} aria-pressed={p.navigationMode==='pan'} disabled={p.running} onClick={p.onTogglePan}><Icon name="pan"/></button>
  <button className="icon-button" data-tooltip={tx('适应窗口')} aria-label={tx('适应窗口')} disabled={p.running} onClick={p.onFit}><Icon name="frame" /></button>
  {p.mode==='top'&&!p.viewOnly&&(p.onViewRotation||p.onToggleHorizon)&&<CanvasRotateMenu viewRotation={p.viewRotation??0} horizonActive={!!p.horizonActive} disabled={p.running||(!!p.drawing&&!p.horizonActive)} onViewRotation={p.onViewRotation} onToggleHorizon={p.onToggleHorizon} onResetRotation={p.onResetRotation}/>}
  {p.mode==='top'&&p.align&&<><span className="tool-divider" aria-hidden="true"/><AlignMenuButton className="icon-button" count={p.align.count} keyName={p.align.keyName} disabled={p.running||p.drawing} onAlign={p.align.onAlign}/></>}
  <span className="tool-divider" aria-hidden="true"/>
  <button className={`icon-button ${p.measureTool==='distance'?'active':''}`} data-tooltip={tx('测距离')} aria-label={tx('测距离')} aria-pressed={p.measureTool==='distance'} disabled={p.mode==='3d'||p.running||p.drawing} onClick={()=>p.onMeasure('distance')}><Icon name="ruler"/></button>
  <button className={`icon-button ${p.measureTool==='area'?'active':''}`} data-tooltip={tx('测面积')} aria-label={tx('测面积')} aria-pressed={p.measureTool==='area'} disabled={p.mode==='3d'||p.running||p.drawing} onClick={()=>p.onMeasure('area')}><Icon name="measure-area"/></button>
  {p.measureCount>0&&<button className="icon-button" data-tooltip={tx('清除测量')} aria-label={tx('清除测量')} disabled={p.drawing} onClick={p.onClearMeasures}><Icon name="eraser"/></button>}
  {(p.onToggleDisplay||(!p.viewOnly&&p.mode==='3d'))&&<span className="tool-divider" aria-hidden="true"/>}
  {p.onToggleDisplay&&<button className={`icon-button ${p.displayOpen?'active':''}`} data-display-trigger data-tooltip={tx('显示设置')} aria-label={tx('显示设置')} aria-expanded={p.displayOpen} disabled={p.drawing} onClick={p.onToggleDisplay}><Icon name="layers"/></button>}
  {!p.viewOnly&&<>{p.mode==='3d'&&<><button className={`icon-button ${p.sunOpen?'active':''}`} data-display-trigger data-tooltip={tx('日照与阴影')} aria-label={tx('日照与阴影')} aria-expanded={p.sunOpen} disabled={p.drawing} onClick={p.onToggleSun}><Icon name="sun"/></button>
  <span className="tool-divider" aria-hidden="true"/></>}
  {p.tools.filter(t=>t.beforeOverlay).map(t=>toolButton({...t,disabled:t.disabled||!!p.drawing}))}
  <button className={"icon-button"+(p.overlayOpen?" active":"")} aria-label={tx('叠加底图')} data-tooltip={tx('叠加底图')} aria-expanded={p.overlayOpen} disabled={p.drawing} onClick={p.onToggleOverlay}><Icon name="underlay-plan"/></button>
  {p.tools.filter(t=>!t.beforeOverlay).map(t=>toolButton({...t,disabled:t.disabled||!!p.drawing}))}</>}
  <LayoutImageMenu mode={p.mode} viewRotation={p.viewRotation??0} disabled={!!p.drawing||p.running||p.downloadDisabled} siteId={p.downloadSiteId} hasBase={p.downloadHasBase} baseVisible={p.downloadBaseVisible} gridVisible={p.downloadGridVisible} onDownload={p.onDownload}/>
 </div>;
}

function normalizeAngle(deg:number){
 let v=((deg+180)%360+360)%360-180;
 if(Math.abs(v)<.05)v=0;
 return Number(v.toFixed(2));
}

function CanvasRotateMenu({viewRotation,horizonActive,disabled,onViewRotation,onToggleHorizon,onResetRotation}:{
 viewRotation:number;horizonActive:boolean;disabled:boolean;onViewRotation?:(deg:number)=>void;onToggleHorizon?:()=>void;onResetRotation?:()=>void;
}){
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState(()=>String(Number(viewRotation.toFixed(1))));
 const anchor=useRef<HTMLDivElement>(null);
 const panel=useRef<HTMLElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const panelId=useId();
 useEffect(()=>{if(disabled||horizonActive)setOpen(false);},[disabled,horizonActive]);
 useEffect(()=>{setDraft(String(Number(viewRotation.toFixed(1))));},[viewRotation]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{
   if(event.target instanceof Node&&!anchor.current?.contains(event.target)&&!panel.current?.contains(event.target))setOpen(false);
  };
  const escape=(event:KeyboardEvent)=>{
   if(event.key!=='Escape')return;
   event.preventDefault();
   event.stopImmediatePropagation();
   setOpen(false);
   trigger.current?.focus({preventScroll:true});
  };
  document.addEventListener('pointerdown',outside,true);
  document.addEventListener('keydown',escape,true);
  return()=>{
   document.removeEventListener('pointerdown',outside,true);
   document.removeEventListener('keydown',escape,true);
  };
 },[open]);
 const rotated=Math.abs(viewRotation)>.05;
 const viewport=open?anchor.current?.closest('.viewport'):null;
 function close(){
  setOpen(false);
  trigger.current?.focus({preventScroll:true});
 }
 function commitDraft(raw:string){
  const n=Number(raw);
  if(Number.isFinite(n)&&onViewRotation){
   const next=normalizeAngle(n);
   onViewRotation(next);
   setDraft(String(Number(next.toFixed(1))));
  }else{
   setDraft(String(Number(viewRotation.toFixed(1))));
  }
 }
 return <div className="layout-image-anchor" ref={anchor}>
  <button ref={trigger} className={`icon-button${open||horizonActive||rotated?' active':''}`} type="button"
   aria-label={tx('旋转画布')} data-tooltip={horizonActive?tx('退出标定水平'):tx('旋转画布')}
   aria-haspopup="dialog" aria-controls={open?panelId:undefined} aria-expanded={open} disabled={disabled}
   onClick={()=>{
    if(horizonActive){onToggleHorizon?.();return;}
    if(!open)setDraft(String(Number(viewRotation.toFixed(1))));
    setOpen(v=>!v);
   }}><Icon name="level-view"/></button>
  {viewport&&createPortal(<section ref={panel} className="image-overlay-panel canvas-rotate-menu" id={panelId} role="dialog" aria-label={tx('旋转画布')}>
   <header><strong>{tx('旋转画布')}</strong><button className="icon-button" type="button" aria-label={tx('关闭')} onClick={close}><Icon name="close"/></button></header>
   <label className="canvas-rotate-field">
    <span>{tx('旋转角度')}</span>
    <span className="canvas-rotate-input">
     <input data-1p-ignore="true" type="number" min={-180} max={180} step={0.5} aria-label={tx('画布旋转角度 °')}
      value={draft}
      onChange={e=>{
       const val=e.target.value;
       setDraft(val);
       const n=Number(val);
       if(val.trim()!==''&&Number.isFinite(n)&&n>=-360&&n<=360)onViewRotation?.(normalizeAngle(n));
      }}
      onBlur={()=>commitDraft(draft)}
      onKeyDown={e=>{if(e.key==='Enter'){commitDraft(draft);close();}}}/>
     <small>°</small>
    </span>
   </label>
   <div className="canvas-rotate-actions">
    {onToggleHorizon&&<button type="button" className="canvas-rotate-action" onClick={()=>{setOpen(false);onToggleHorizon();}}><Icon name="horizon-pick"/><span>{tx('图上标定水平')}</span></button>}
    <button type="button" className="canvas-rotate-action" disabled={!rotated} onClick={()=>{onResetRotation?.();onViewRotation?.(0);close();}}><Icon name="reset"/><span>{tx('恢复正北')}</span></button>
   </div>
  </section>,viewport)}
 </div>;
}

function LayoutImageMenu({mode,viewRotation,disabled,siteId,hasBase,baseVisible,gridVisible,onDownload}:{
 mode:Mode;viewRotation:number;disabled:boolean;siteId?:string;hasBase:boolean;baseVisible:boolean;gridVisible:boolean;onDownload:(options:LayoutImageOptions)=>void;
}){
 const [open,setOpen]=useState(false);
 const [scope,setScope]=useState<LayoutImageScope>('fit');
 const [orientation,setOrientation]=useState<LayoutImageOrientation>('north');
 const [includeBase,setIncludeBase]=useState(false);
 const [includeLabels,setIncludeLabels]=useState(true);
 const [includeGrid,setIncludeGrid]=useState(true);
 const anchor=useRef<HTMLDivElement>(null);
 const panel=useRef<HTMLElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const panelId=useId();
 useEffect(()=>setOpen(false),[mode,disabled]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{
   if(event.target instanceof Node&&!anchor.current?.contains(event.target)&&!panel.current?.contains(event.target))setOpen(false);
  };
  const escape=(event:KeyboardEvent)=>{
   if(event.key!=='Escape')return;
   event.preventDefault();
   event.stopImmediatePropagation();
   setOpen(false);
   trigger.current?.focus({preventScroll:true});
  };
  document.addEventListener('pointerdown',outside,true);
  document.addEventListener('keydown',escape,true);
  return()=>{
   document.removeEventListener('pointerdown',outside,true);
   document.removeEventListener('keydown',escape,true);
  };
 },[open]);
 const top=mode==='top';
 const selectedScope=scope==='site'&&(!top||!siteId)?'fit':scope;
 const viewport=open?anchor.current?.closest('.viewport'):null;
 function close(){
  setOpen(false);
  trigger.current?.focus({preventScroll:true});
 }
 function download(){
  close();
  onDownload({scope:selectedScope,siteId:selectedScope==='site'?siteId:undefined,includeBase:top&&hasBase&&includeBase,includeLabels:top&&includeLabels,includeGrid,orientation:top?orientation:'north'});
 }
 const rotated=Math.abs(viewRotation)>.05;
 return <div className="layout-image-anchor" ref={anchor}>
  <button ref={trigger} className={'icon-button'+(open?' active':'')} type="button" aria-label={tx('下载图片')} data-tooltip={tx('下载图片')} aria-haspopup="dialog" aria-controls={open?panelId:undefined} aria-expanded={open} disabled={disabled}
   onClick={()=>{if(!open){setScope('fit');setOrientation('north');setIncludeBase(baseVisible);setIncludeLabels(true);setIncludeGrid(gridVisible);}setOpen(v=>!v);}}><Icon name="capture-layout"/></button>
  {viewport&&createPortal(<section ref={panel} className="image-overlay-panel layout-image-menu" id={panelId} role="dialog" aria-label={tx('下载图片')}>
   <header><strong>{tx('下载图片')}</strong><button className="icon-button" type="button" aria-label={tx('关闭')} onClick={close}><Icon name="close"/></button></header>
   <div className="seg-track layout-image-scope" role="group" aria-label={tx('导出范围')}>
    <button className="seg-btn" type="button" aria-pressed={selectedScope==='fit'} onClick={()=>setScope('fit')}>{tx('适应窗口')}</button>
    <button className="seg-btn" type="button" aria-pressed={selectedScope==='screen'} onClick={()=>setScope('screen')}>{tx('当前屏幕')}</button>
    {top&&<button className="seg-btn" type="button" aria-pressed={selectedScope==='site'} disabled={!siteId} onClick={()=>setScope('site')}>{tx('当前屋面')}</button>}
   </div>
   {top&&<div className="seg-track layout-image-scope" role="group" aria-label={tx('导出方向')}>
    <button className="seg-btn" type="button" aria-pressed={orientation==='north'} onClick={()=>setOrientation('north')}>{tx('按正北方向')}</button>
    <button className="seg-btn" type="button" aria-pressed={orientation==='current'} disabled={!rotated} onClick={()=>setOrientation('current')}>{tx('按当前视角')}</button>
   </div>}
   <div className="layout-image-options">
    {top&&<>
    <label>{tx('包含底图')}<input type="checkbox" checked={includeBase&&hasBase} disabled={!hasBase} onChange={e=>setIncludeBase(e.target.checked)}/></label>
    <label>{tx('包含屋面标签')}<input type="checkbox" checked={includeLabels} onChange={e=>setIncludeLabels(e.target.checked)}/></label>
    </>}
    <label>{tx('包含网格')}<input type="checkbox" checked={includeGrid} onChange={e=>setIncludeGrid(e.target.checked)}/></label>
   </div>
   <button className="layout-image-submit" type="button" onClick={download}>{tx('下载 PNG')}</button>
  </section>,viewport)}
 </div>;
}

type ClusterProps={
 viewOnly?:boolean;
 total:{count:number;capacity:number};
 regionCount:number;
 history:{undo:()=>void;redo:()=>void;canUndo:boolean;canRedo:boolean};
 disabled:boolean;
};
/** Top-right live KPI pill (total capacity + module count) and Undo/Redo pill. */
export function TopRightCluster({viewOnly,total,regionCount,history,disabled}:ClusterProps){
 return <div className="top-right-cluster">
  <div className="kpi-pill" title={tx('总装机量')+' · '+regionCount+' '+tx('个区域')}>
   <span className="kpi-dot" aria-hidden="true"/>
   <span className="kpi-item"><strong>{total.capacity.toFixed(1)}</strong><span>kWp</span></span>
   <span className="kpi-sep" aria-hidden="true"/>
   <span className="kpi-item"><strong>{total.count}</strong><span>{tx('块')}</span></span>
  </div>
  {!viewOnly&&<div className="history-pill history-actions">
   <button className="icon-button" data-tooltip={isMac?`${tx('撤销')} · ⌘Z`:tx('撤销 · Ctrl+Z')} aria-label={tx('撤销')} disabled={!history.canUndo||disabled} onClick={history.undo}><Icon name="reset"/></button>
   <button className="icon-button" data-tooltip={isMac?`${tx('重做')} · ⇧⌘Z`:tx('重做 · Ctrl+Shift+Z')} aria-label={tx('重做')} disabled={!history.canRedo||disabled} onClick={history.redo}><Icon name="redo"/></button>
  </div>}
 </div>;
}
