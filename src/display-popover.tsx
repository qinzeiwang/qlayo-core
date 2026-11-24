import {locationNote} from './location-presets';
import {SunDateTime} from './sun-controls';
import type {SunSettings} from './sun-position';
import type {PerformanceReport} from './render-options';
import {Icon} from './workbench-ui';
import {tx} from './i18n';
import {setColourBlind,useColourBlind} from './colour-vision';

type Props={
 directionMarkerStyle:import('./direction-marker-style').DirectionMarkerStyle;onDirectionMarkerStyle:(v:import('./direction-marker-style').DirectionMarkerStyle)=>void;
 arrayDimensions:boolean;onArrayDimensions:(v:boolean)=>void;
 showGrid:boolean;onShowGrid:(v:boolean)=>void;
 stressCount:3000|5000|10000;onStressCount:(value:3000|5000|10000)=>void;
 backgroundColor:string;groundColor:string;quality:import('./render-options').RenderQuality;guides:boolean;stress:boolean;running:boolean;
 progress:string;report:PerformanceReport|null;count:number;
 onBackground:(value:string)=>void;onGround:(value:string)=>void;onQuality:(value:import('./render-options').RenderQuality)=>void;
 onGuides:(value:boolean)=>void;onStartTest:()=>void;onStopTest:()=>void;onResetTest:()=>void;onClose:()=>void;
};

type SunProps={showWinterCheck:boolean;onShowWinterCheck:(v:boolean)=>void;sunSettings:SunSettings;onSunSettings:(v:SunSettings)=>void;previewTime:string|null;onPreviewTime:(time:string|null)=>void;showShadows:boolean;onShowShadows:(value:boolean)=>void;onClose:()=>void};
const devMode=()=>new URLSearchParams(location.search).has('dev');

/** Sun date/time and shadow view: these change the shadows, so they are kept apart from display settings. */
export function SunPopover(props:SunProps){
 const location=props.sunSettings.locationName??locationNote(props.sunSettings);
 return <section className="display-popover sun-popover" aria-label={tx('日照与阴影')}>
  <header><strong>{tx('日照与阴影')}</strong><button className="icon-button" title={tx('关闭日照与阴影')} aria-label={tx('关闭日照与阴影')} onClick={props.onClose}><Icon name="close"/></button></header>
  <p className="sun-readout">{location}</p>
  <label className="sun-layer"><span><i className="sun-swatch instant" aria-hidden="true"/>{tx('时刻阴影')}</span>
   <input type="checkbox" role="switch" checked={props.showShadows} onChange={e=>props.onShowShadows(e.target.checked)}/>
  </label>
  {props.showShadows&&<SunDateTime value={props.sunSettings} onChange={props.onSunSettings} previewTime={props.previewTime} onPreview={props.onPreviewTime}/>}
  <label className="sun-layer"><span><i className="sun-swatch winter" aria-hidden="true"/>{tx('冬至校核范围')}</span>
   <input type="checkbox" role="switch" checked={props.showWinterCheck} onChange={e=>props.onShowWinterCheck(e.target.checked)}/>
  </label>
  {props.showWinterCheck&&<p className="sun-readout">{tx('冬至 9–15 时 · 真太阳时')}{Math.abs(props.sunSettings.latitude)>=66.5&&<> · {tx('所在地冬至可能为极夜，当前冬至校核不适用，请另定设计时段。')}</>}</p>}
 </section>;
}

export function DisplayPopover(props:Props){
 const {backgroundColor,groundColor,quality,guides,stress,running,progress,report,count}=props;
 const colourBlind=useColourBlind();
 return <section className="display-popover" aria-label={tx('显示设置')}>
  <header><strong>{tx('显示设置')}</strong><button className="icon-button" aria-label={tx('关闭显示设置')} title={tx('关闭显示设置')} onClick={props.onClose}><Icon name="close"/></button></header>
  <label className="checkline"><input type="checkbox" checked={props.showGrid} onChange={e=>props.onShowGrid(e.target.checked)}/>{tx('参考网格')}</label>
  <span className="popover-label">{tx('场景颜色')}</span>
  <div className="color-presets"><button onClick={()=>{props.onBackground('#f0f1f2');props.onGround('#e4e6e7');}}>{tx('冷灰')}</button><button onClick={()=>{props.onBackground('#f2efe9');props.onGround('#e8e4dc');}}>{tx('暖灰')}</button></div>
  <div className="scene-colors"><label>{tx('背景')}<input aria-label={tx('背景颜色')} type="color" value={backgroundColor} onInput={e=>props.onBackground(e.currentTarget.value)} onChange={e=>props.onBackground(e.target.value)}/></label><label>{tx('地面')}<input aria-label={tx('地面颜色')} type="color" value={groundColor} onInput={e=>props.onGround(e.currentTarget.value)} onChange={e=>props.onGround(e.target.value)}/></label><button className="icon-button" aria-label={tx('恢复默认颜色')} title={tx('恢复默认颜色')} onClick={()=>{props.onBackground('#f0f1f2');props.onGround('#e4e6e7');}}><Icon name="reset"/></button></div>
  <span className="popover-label">{tx('渲染质量')}</span>
  <div className="quality-switch choice-segment" role="group" aria-label={tx('渲染质量')}>{([['simple',tx('简单')],['standard',tx('标准')],['fine',tx('精细')]] as const).map(([value,label])=><button key={value} aria-pressed={quality===value} className={quality===value?'selected':''} disabled={running} onClick={()=>props.onQuality(value)}>{label}</button>)}</div>
  <div className="direction-marker-setting"><span className="popover-label">{tx('方向标记')}</span><div className="quality-switch choice-segment" role="group" aria-label={tx('方向标记')}>{([['dark',tx('深色')],['light',tx('浅色')],['hidden',tx('不显示')]] as const).map(([value,label])=><button key={value} aria-pressed={props.directionMarkerStyle===value} className={props.directionMarkerStyle===value?'selected':''} onClick={()=>props.onDirectionMarkerStyle(value)}>{label}</button>)}</div></div>
  <label className="checkline"><input type="checkbox" checked={guides} disabled={running||stress} onChange={e=>props.onGuides(e.target.checked)}/>{tx('显示布置辅助线')}</label>
  <label className="checkline"><input type="checkbox" checked={props.arrayDimensions} onChange={e=>props.onArrayDimensions(e.target.checked)}/>{tx('阵列定位尺寸（试用）')}</label>
  {props.arrayDimensions&&<p className="sun-readout">{tx('2D 中选择阵列，显示角点到屋面两边的定位尺寸 · m')}</p>}
  <label className="checkline"><input type="checkbox" checked={colourBlind} onChange={e=>setColourBlind(e.target.checked)}/>{tx('色盲友好配色')}</label>
  {colourBlind&&<p className="sun-readout">{tx('画布与电气图换用红绿色盲也能分清的颜色')}</p>}
  {devMode()&&<details className="display-advanced"><summary>{tx('性能验证')}</summary><p>{stress?tx('当前：{0} 块独立测试场景',props.stressCount):tx('当前：项目场景，{0} 块组件',count)}</p><select aria-label={tx('测试组件数量')} disabled={running} value={props.stressCount} onChange={e=>props.onStressCount(Number(e.target.value) as 3000|5000|10000)}>{[3000,5000,10000].map(n=><option key={n} value={n}>{n} {tx('块')}</option>)}</select><button disabled={running} onClick={props.onStartTest}>{tx('开始测试')}</button>{running&&<button onClick={props.onStopTest}>{tx('停止测试')}</button>}{stress&&!running&&<button onClick={props.onResetTest}>{tx('返回项目场景')}</button>}<p role="status">{progress}</p>{report&&<div className="performance-result"><strong>{report.passed?tx('达到本轮目标'):tx('未达到本轮目标')}</strong><p>{tx('平均')} {report.medianFps.toFixed(1)} FPS · P95 {report.medianP95Ms.toFixed(1)} ms</p><p>{report.calls} {tx('次绘制 ·')} {report.triangles.toLocaleString()} {tx('三角形')}</p></div>}</details>}
 </section>;
}
