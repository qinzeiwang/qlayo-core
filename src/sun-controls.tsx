import './location-presets.css';
import {useEffect,useMemo,useRef,useState} from 'react';
import {daylightMinutes,sunPosition,validSunSettings,type SunSettings} from './sun-position';
import {cityPresets,locationResolved,locationMismatch,winterShadowFactor} from './location-presets';
import {Icon} from './workbench-ui';
import {IconPlayerPauseFilled,IconPlayerPlayFilled} from '@tabler/icons-react';
import {tx} from './i18n';
type Props={value:SunSettings;onChange:(s:SunSettings)=>void};
export function SunLocation({value,onChange,address='',onDraftChange}:Props&{address?:string;onDraftChange?:(editing:boolean)=>void}){
 const [editing,setEditingState]=useState(false),[lon,setLon]=useState(''),[lat,setLat]=useState('');
 const cityReference=useRef<HTMLDetailsElement>(null);
 const setEditing=(next:boolean)=>{setEditingState(next);onDraftChange?.(next);};
 const resolved=locationResolved(value);
 const mismatch=locationMismatch(value,address);
 const start=()=>{setLon(resolved?String(value.longitude):'');setLat(resolved?String(value.latitude):'');setEditing(true);};
 const ready=lon.trim()!==''&&lat.trim()!==''&&Number.isFinite(Number(lon))&&Number.isFinite(Number(lat))&&Math.abs(Number(lon))<=180&&Math.abs(Number(lat))<=90;
 const status=resolved?tx('经度 {0}° · 纬度 {1}°',value.longitude.toFixed(4),value.latitude.toFixed(4)):
  address.trim()?tx('未识别城市，请填写经纬度。'):tx('请输入城市或填写经纬度。');
 const applyCity=(city:(typeof cityPresets)[number])=>{
  const details=cityReference.current;
  if(details){details.open=false;details.querySelector('summary')?.focus({preventScroll:true});}
  setEditing(false);
  onChange({...value,longitude:city.longitude,latitude:city.latitude,utcOffset:8,locationMode:'preset',coordinateSource:'preset',locationName:city.name});
 };
 return <div className="location-choice">
  <div className="start-location-summary">
   <p role="status">{status}</p>
   {!editing&&<button type="button" className="start-location-edit" onClick={start}><Icon name="site"/>{resolved?tx('修改经纬度'):tx('填写经纬度')}</button>}
  </div>
  {mismatch&&<p className="location-warning" role="alert">{mismatch.message}</p>}
  {editing&&<div className="start-coordinate-editor">
   <div className="settings-fields">
    <label>{tx('经度 °')}<input data-1p-ignore autoFocus type="number" min="-180" max="180" step="any" value={lon} onChange={e=>setLon(e.target.value)}/></label>
    <label>{tx('纬度 °')}<input data-1p-ignore type="number" min="-90" max="90" step="any" value={lat} onChange={e=>setLat(e.target.value)}/></label>
   </div>
   <div className="start-coordinate-actions">
    <button type="button" className="icon-button" aria-label={tx('取消填写')} title={tx('取消填写')} onClick={()=>setEditing(false)}><Icon name="close"/></button>
    <button type="button" className="icon-button" disabled={!ready} aria-label={tx('应用经纬度')} title={tx('应用经纬度')} onClick={()=>{onChange({...value,longitude:Number(lon),latitude:Number(lat),locationMode:'manual',coordinateSource:'manual',locationName:undefined});setEditing(false);}}><Icon name="check"/></button>
   </div>
   {!ready&&lon.trim()!==''&&lat.trim()!==''&&<p className="location-warning" role="alert">{Math.abs(Number(lat))>90&&Math.abs(Number(lon))<=90?tx('纬度超过 ±90°，可能将经度、纬度填反了。'):tx('请完整填写经纬度；经度须在 ±180°、纬度须在 ±90° 以内。')}</p>}
  </div>}
  <details ref={cityReference} className="settings-secondary"><summary>{tx('城市坐标参考')}</summary><div className="city-reference"><table><thead><tr><th>{tx('城市')}</th><th>{tx('经度 / 纬度')}</th><th>{tx('投影 m')}</th><th>{tx('采用')}</th></tr></thead><tbody>{cityPresets.map(c=><tr key={c.name}><td>{c.name}</td><td>{c.longitude.toFixed(2)} / {c.latitude.toFixed(2)}</td><td title={tx('1 米高差、正南朝向，冬至真太阳时 9–15 时的南北阴影投影；不是完整影长。')}>{winterShadowFactor(c.latitude).toFixed(2)}</td><td><button type="button" aria-label={tx('采用{0}坐标',c.name)} onClick={()=>applyCity(c)}>{tx('采用')}</button></td></tr>)}</tbody></table></div><p className="settings-note">{tx('坐标来源：GeoNames，城市参考点，CC BY 4.0。')}</p></details>
 </div>;
}
function timeLabel(minute:number){
 return `${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
}

function nearestDaylight(minutes:number[],time:string){
 const [hour,minute]=time.split(':').map(Number),target=hour*60+minute;
 return minutes.reduce((best,m,i)=>Math.abs(m-target)<Math.abs(minutes[best]-target)?i:best,0);
}

export function SunDateTime({value,onChange,previewTime,onPreview}:Props&{
 previewTime:string|null;onPreview:(time:string|null)=>void;
}){
 const {date,latitude,longitude,utcOffset}=value;
 const minutes=useMemo(()=>daylightMinutes({date,latitude,longitude,utcOffset}),[date,latitude,longitude,utcOffset]);
 const [playing,setPlaying]=useState(false);
 const timer=useRef<number|undefined>(undefined);
 const drag=useRef<{pointer:number;time?:string}|null>(null);
 const last=minutes.length-1,time=previewTime??value.time;
 const index=nearestDaylight(minutes,time);
 const sun=sunPosition({...value,time});
 const update=useRef({value,onChange});
 update.current={value,onChange};

 useEffect(()=>()=>{
  window.clearInterval(timer.current);
  onPreview(null);
 },[onPreview]);

 const stop=()=>{
  window.clearInterval(timer.current);
  timer.current=undefined;
  setPlaying(false);
  onPreview(null);
 };
 const commitTime=(next:string)=>{
  stop();
  const latest=update.current;
  if(next!==latest.value.time)latest.onChange({...latest.value,time:next});
 };
 const finishScrub=useRef(commitTime);
 finishScrub.current=commitTime;
 useEffect(()=>{
  const finish=(event:PointerEvent)=>{
   if(drag.current?.pointer!==event.pointerId)return;
   const selected=drag.current.time;
   drag.current=null;
   if(selected)finishScrub.current(selected);
  };
  window.addEventListener('pointerup',finish);
  window.addEventListener('pointercancel',finish);
  return ()=>{
   window.removeEventListener('pointerup',finish);
   window.removeEventListener('pointercancel',finish);
  };
 },[]);
 const changeDate=(nextDate:string)=>{
  const next={...value,date:nextDate};
  if(!validSunSettings(next))return;
  stop();
  const daylight=daylightMinutes(next);
  if(daylight.length)next.time=timeLabel(daylight[nearestDaylight(daylight,time)]);
  onChange(next);
 };
 const play=()=>{
  if(playing){commitTime(time);return;}
  if(last<=0)return;
  const start=index===last?0:index,started=performance.now();
  const timeAt=(i:number)=>timeLabel(minutes[i]);
  setPlaying(true);
  onPreview(timeAt(start));
  timer.current=window.setInterval(()=>{
   const next=Math.min(last,start+Math.floor((performance.now()-started)*last/18000));
   if(next===last)commitTime(timeAt(last));
   else onPreview(timeAt(next));
  },90);
 };
 const playbackLabel=playing?tx('暂停阴影'):tx('播放阴影');
 return <div className="sun-controls">
  <label className="sun-date">{tx('光照日期')}<input aria-label={tx('光照日期')} type="date" min="1900-01-01" max="2100-12-31" value={date} onChange={e=>changeDate(e.target.value)}/></label>
  <div className="sun-time-title"><span>{tx('当地时间')}</span><output>{time}</output></div>
  <div className="sun-timeline">
   <button type="button" className="icon-button sun-play" aria-label={playbackLabel} title={playbackLabel} disabled={last<=0} onClick={play}>
    {playing?<IconPlayerPauseFilled className="ui-icon" aria-hidden="true"/>:<IconPlayerPlayFilled className="ui-icon" aria-hidden="true"/>}
   </button>
   <input type="range" aria-label={tx('光照时间')} aria-valuetext={last>=0?timeLabel(minutes[index]):undefined} min={0} max={Math.max(last,0)} step={1}
    value={index} disabled={last<=0}
    onPointerDown={e=>{stop();drag.current={pointer:e.pointerId};}}
    onChange={e=>{
     const next=timeLabel(minutes[e.target.valueAsNumber]);
     if(drag.current){drag.current.time=next;onPreview(next);}
     else commitTime(next);
    }}/>
   {last>=0&&<div className="sun-time-edges"><span>{timeLabel(minutes[0])}</span><span>{timeLabel(minutes[last])}</span></div>}
  </div>
  <p className="sun-readout" role="status" aria-live={playing?'off':'polite'}>{!locationResolved(value)?tx('地点未确定 · 光照仅为示意'):sun.daylight?tx('太阳高度 {0}° · 方位 {1}°',sun.elevation.toFixed(1),sun.azimuth.toFixed(1)):tx('太阳在地平线以下 · 无直射光')}</p>
 </div>;
}
