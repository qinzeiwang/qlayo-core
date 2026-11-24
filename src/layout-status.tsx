import {defaultModule,type Params} from './domain';
import {ignoresShadows,locationNote} from './location-presets';
import {geographicYaw,type RoofDesign} from './roof-project';
import {recommendedGap} from './solar';
import type {SunSettings} from './sun-position';
import {tx} from './i18n';
type Props={
 active:RoofDesign;arrays:Params[];sunSettings:SunSettings;issues:{text:string}[];
 needsOutline:boolean;layoutStale:boolean;count:number;capacity:number;
 /** Unfinished shadow check: shown in this line instead of a banner at the top. */
 shadow?:{title:string;text:string};
};
/** Connected rows packed closer than the winter-solstice spacing. */
const shortSpacing=(a:Params,active:RoofDesign,latitude:number)=>{
 const module=a.module??defaultModule;
 return a.connectedRows&&(a.rowGap??0)<recommendedGap(a.rows*(a.portrait?module.length:module.width)+(a.rows-1)*module.gap,a.tilt,a.azimuth-geographicYaw(active)*180/Math.PI,latitude);
};
/** One-line layout status at the bottom of the operation panel; the checks open on click. */
export function LayoutStatus({active,arrays,sunSettings,issues,needsOutline,layoutStale,count,capacity,shadow}:Props){
 const noShadows=ignoresShadows(sunSettings);
 return <details className="result-detail">
  <summary className={needsOutline||!count?'idle':layoutStale?'pending':issues.length?'blocked':shadow?'pending':'ok'}>
   <span className="result-status">{needsOutline ? tx('请先标定并圈屋面') : layoutStale ? count ? tx('待更新 · 当前显示旧布置') : active.previous?.length ? tx('待更新布置') : tx('待自动布置') : issues.length ? tx('{0} 项占地冲突',issues.length) : shadow ? shadow.title : tx('无占地冲突')}</span>
   <span className="result-total">{count} {tx('块 ·')} <strong>{capacity.toFixed(2)} kWp</strong></span>
  </summary>
  <div>
   {shadow&&<p className="spacing-warning">{shadow.title}：{shadow.text}</p>}
   {issues.map((i,index) => <p key={index}>{i.text}</p>)}
   <p>{locationNote(sunSettings)}</p>
   {!noShadows&&<p>{tx('项目所在地冬至 · 真太阳时 09:00–15:00')}</p>}
   <p>{noShadows?tx('屋面边界、阵列、障碍物实体及禁布区校核；未校核阴影'):tx('屋面边界、阵列、障碍物及阴影禁布区校核')}</p>
   {!noShadows&&arrays.some(a=>shortSpacing(a,active,sunSettings.latitude)) && <p className="spacing-warning">{tx('部分阵列采用缩短间距，请在三维查看遮挡。')}</p>}
  </div>
 </details>;
}
