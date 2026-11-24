import type {RoofDesign} from './roof-project';
import type {SunSettings} from './sun-position';
import {ignoresShadows,locationMismatch} from './location-presets';
import {layoutSignatureFor,type Edges} from './layout-state';
import {winterRays} from './solar';
import {Icon} from './workbench-ui';
import {tx} from './i18n';
export function shadowNotice(s:SunSettings,roofs:RoofDesign[],edge:Edges=.5){
 const relevant=roofs.filter(r=>!r.carport&&(!r.pitch||r.obstacles.some(o=>o.kind!=='keepout')));
 if(!relevant.length)return undefined;
 // A roof with no panels yet has nothing to check, so only a missing location or polar night warns there.
 const affected=relevant.filter(r=>ignoresShadows(s)||!winterRays(s.latitude).length||(r.arrays.length>0&&(r.layoutOptions.shadowIgnored||r.layoutOptions.shadowLatitude!==s.latitude||r.layoutSignature!==layoutSignatureFor(r,edge))));
 if(!affected.length)return undefined;
 const names=affected.slice(0,3).map(r=>r.name).join('、')+(affected.length>3?tx('等 {0} 个屋面',affected.length):'');
 const reason=ignoresShadows(s)?tx('尚未确定项目坐标，必须补充地点或经纬度'):!winterRays(s.latitude).length?tx('所在地冬至无有效日照，当前校核时段不适用'):tx('尚未完成或需要更新当前参数的布置校核');
 const risks=[affected.some(r=>!r.pitch)?tx('平屋面排间及女儿墙'):undefined,affected.some(r=>r.pitch)?tx('坡屋面气楼、障碍物'):undefined].filter(Boolean).join('、');
 return {title:tx('未完成阴影校核'),text:tx('{0}：{1}。{2}可能遮挡组件；当前方案不能视为已满足防遮挡要求。',names,reason,risks),settings:ignoresShadows(s),fixable:!ignoresShadows(s)&&!!winterRays(s.latitude).length};
}
function CompactNotice({className='',title,text,action,onAction}:{className?:string;title:string;text:string;action?:string;onAction?:()=>void}){
 return <div className={'shadow-alert is-compact '+className} role="alert"><details><summary><Icon name="alert"/><strong>{title}</strong><span className="notice-more">{tx('详情')}</span></summary><p>{text}</p></details>{action&&onAction&&<button type="button" onClick={onAction}>{action}</button>}</div>;
}
export function LocationMismatchNotice({value,address,onSettings}:{value:SunSettings;address:string;onSettings?:()=>void}){
 const mismatch=locationMismatch(value,address);if(!mismatch)return null;
 return <CompactNotice className="location-mismatch-alert" title={tx('地点与经纬度可能不一致')} text={tx('坐标距{0}参考点约 {1} km，仍以经纬度计算。请核对地点、坐标顺序及正负号。',mismatch.city,Math.round(mismatch.distance))} action={tx('核对地点')} onAction={onSettings}/>;
}
/** One-line status; details open on click. `onFix` handles the layout case (coordinates go to `onSettings`). */
export function ShadowNotice({notice,onSettings,onFix}:{notice:ReturnType<typeof shadowNotice>;onSettings?:()=>void;onFix?:()=>void}){
 if(!notice)return null;
 return notice.settings?<CompactNotice title={notice.title} text={notice.text} action={tx('设置地点与经纬度')} onAction={onSettings}/>:<CompactNotice title={notice.title} text={notice.text} action={notice.fixable?tx('去更新布置'):undefined} onAction={onFix}/>;
}
