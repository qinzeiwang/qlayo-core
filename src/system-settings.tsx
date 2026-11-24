import {useState} from 'react';
import type {BaseImage} from './base-image';
import type {SunSettings} from './sun-position';
import {locationResolved} from './location-presets';
import {ModuleLibraryPanel} from './module-library-panel';
import type {ModuleCatalogItem} from './module-library';
import {NumberProperty} from './number-property';
import type {ProjectLayoutDefaults} from './project-layout-defaults';
import {MAX_FLAT_TABLE_ROWS} from './project-limits';
import {useDialog} from './use-dialog';
import {Icon} from './workbench-ui';
import {tx} from './i18n';
import './system-settings.css';
import './workbench-preferences.css';

export type GlobalSettingsTab='library'|'params'|'project';
type Props={
 initialTab:GlobalSettingsTab;moduleItems:ModuleCatalogItem[];usedModuleIds:Set<string>;
 onModuleChange:(items:ModuleCatalogItem[])=>string|null;
 defaults:ProjectLayoutDefaults;onDefaults:(next:ProjectLayoutDefaults)=>void;
 edge:number;ridge:number;onEdge:(n:number)=>void;onRidge:(n:number)=>void;
 name:string;address:string;onName:(v:string)=>void;onAddress:(v:string)=>void;
 sunSettings:SunSettings;onSunSettings:(v:SunSettings)=>void;
 base?:BaseImage;busy:boolean;onScale:()=>void;onClose:()=>void;
};
function Coordinates({sunSettings:value,onSunSettings:onChange}:Pick<Props,'sunSettings'|'onSunSettings'>){
 const known=locationResolved(value);
 const [lon,setLon]=useState(known?String(value.longitude):'');
 const [lat,setLat]=useState(known?String(value.latitude):'');
 const valid=lon.trim()!==''&&lat.trim()!==''&&Number.isFinite(+lon)&&Number.isFinite(+lat)&&Math.abs(+lon)<=180&&Math.abs(+lat)<=90;
 function commit(){if(valid&&(!known||+lon!==value.longitude||+lat!==value.latitude))onChange({...value,longitude:+lon,latitude:+lat,locationMode:'manual',coordinateSource:'manual',locationName:undefined});}
 return <><label>{tx('经度 °')}<input data-1p-ignore type="number" min="-180" max="180" step="any" value={lon} onChange={e=>setLon(e.target.value)} onBlur={commit}/></label>
 <label>{tx('纬度 °')}<input data-1p-ignore type="number" min="-90" max="90" step="any" value={lat} onChange={e=>setLat(e.target.value)} onBlur={commit}/></label>
 {!valid&&(lon||lat)&&<small role="status">{tx('请完整填写经纬度；经度须在 ±180°、纬度须在 ±90° 以内。')}</small>}</>;
}
export function GlobalSettingsDialog(p:Props){
 const [tab,setTab]=useState(p.initialTab);
 useDialog('.workbench-preferences',true,p.onClose);
 const fields=[
  ['tableRows',tx('连排数量'),'layout-connected-rows','排',1,MAX_FLAT_TABLE_ROWS,1],
  ['maxColumns',tx('每排最多'),'layout-row-cap','块',1,100,1],
  ['tilt',tx('组件倾角'),'slope','°',0,60,.1],
  ['gap',tx('左右间距'),'gap-x','m',0,20,.1],
  ['edge',tx('屋面四周间距'),'layout-perimeter','m',0,20,.1],
  ['ridge',tx('屋脊间距'),'layout-ridge','m',0,20,.1],
 ] as const;
 return <div className="project-dialog-backdrop"><section className="workbench-preferences" role="dialog" aria-modal="true" aria-label={tx('全局设置')}>
 <header className="settings-heading"><h2>{tx('设置')}</h2><button aria-label={tx('关闭设置')} title={tx('关闭设置')} onClick={p.onClose}><Icon name="close"/></button></header>
 <nav className="preferences-tabs" role="tablist">{([['library',tx('组件库')],['params',tx('默认布置参数')],['project',tx('项目信息')]] as const).map(([id,label])=><button role="tab" key={id} aria-selected={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav>
 <div className="settings-body" role="tabpanel">
 {tab==='library'&&<ModuleLibraryPanel items={p.moduleItems} usedIds={p.usedModuleIds} onChange={p.onModuleChange}/>}
 {tab==='params'&&<div className="preferences-defaults">{fields.map(([key,label,icon,unit,min,max,step])=><NumberProperty key={key} label={label} textLabel={label} icon={icon} unit={tx(unit)} min={min} max={max} step={step}
 value={key==='edge'?p.edge:key==='ridge'?p.ridge:p.defaults[key]} onChange={v=>{if(step===1&&!Number.isInteger(v))return;if(key==='edge')p.onEdge(v);else if(key==='ridge')p.onRidge(v);else p.onDefaults({...p.defaults,[key]:v});}}/>)}</div>}
 {tab==='project'&&<div className="preferences-project">
 <label>{tx('项目名称')}<input data-1p-ignore value={p.name} onChange={e=>p.onName(e.target.value)} onBlur={()=>p.onName(p.name.trim()||tx('未命名项目'))}/></label>
 <label>{tx('项目地址')}<input data-1p-ignore value={p.address} onChange={e=>p.onAddress(e.target.value)}/></label>
 <Coordinates key={[p.sunSettings.longitude,p.sunSettings.latitude,p.sunSettings.coordinateSource].join('/')} sunSettings={p.sunSettings} onSunSettings={p.onSunSettings}/>
 <div className="preferences-calibrate"><span>{tx('图纸与方向')}</span><button disabled={p.busy||!p.base||p.base.blank} onClick={p.onScale}>{tx('重新标定')}</button></div>
 </div>}</div></section></div>;
}
