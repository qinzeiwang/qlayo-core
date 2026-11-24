import {createPortal} from 'react-dom';
import {footprintArea} from './polygon';
import {projectStatistics} from './project-statistics';
import type {RoofDesign} from './roof-project';
import {Icon} from './workbench-ui';
import {useDialog} from './use-dialog';
import {tx} from './i18n';
import './layout-report.css';

type Metrics={count:number;capacity:number;area:number;moduleArea:number};
type Row=Metrics&{id:string;name:string;type:string;carport:boolean};

function summarize(rows:Row[]):Metrics{
 return rows.reduce((total,row)=>({
  count:total.count+row.count,capacity:total.capacity+row.capacity,
  area:total.area+row.area,moduleArea:total.moduleArea+row.moduleArea,
 }),{count:0,capacity:0,area:0,moduleArea:0});
}

export function LayoutReport({name,roofs,pending,onClose}:{name:string;roofs:RoofDesign[];pending:string[];onClose:()=>void}){
 useDialog('.layout-report-dialog',true,onClose);
 const rows=projectStatistics(roofs).regions.map((r,i):Row=>({
  id:r.id,name:r.name,type:r.type,carport:r.isCarport,
  count:r.count,capacity:r.capacity,area:footprintArea(roofs[i].roof),moduleArea:r.moduleArea,
 }));
 const groups=[{label:tx('屋面小计'),rows:rows.filter(r=>!r.carport)},{label:tx('车棚小计'),rows:rows.filter(r=>r.carport)}].filter(g=>g.rows.length);
 const total=summarize(rows);
 const columns=[
  {key:'count',label:tx('组件数量'),unit:tx('块')},
  {key:'capacity',label:tx('装机量'),unit:'kWp'},
  {key:'area',label:tx('区域面积'),unit:'m²'},
  {key:'moduleArea',label:tx('组件投影面积'),unit:'m²'},
 ] as const;
 const format=(value:Metrics,key:keyof Metrics)=>key==='count'?String(value.count):value[key].toFixed(2);
 const cells=(value:Metrics)=>columns.map(c=><td key={c.key}>{format(value,c.key)}</td>);
 return createPortal(<div className="layout-report-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="layout-report-dialog" role="dialog" aria-modal="true" aria-labelledby="layout-report-title">
   <div className="layout-report-actions">
    <button type="button" className="icon-button" title={tx('打印或另存为 PDF')} aria-label={tx('打印或另存为 PDF')} onClick={()=>window.print()}><Icon name="printer"/></button>
    <button type="button" className="icon-button" aria-label={tx('关闭报告')} title={tx('关闭报告')} onClick={onClose}><Icon name="close"/></button>
   </div>
   <article className="layout-report-sheet">
    <h1 id="layout-report-title">{tx('光伏布置报告')}</h1>
    <div className="layout-report-meta"><span>{name}</span>
     {pending.length>0&&<span role="status" title={pending.join('、')}>{tx('{0} 个区域待更新 · 按上次布置统计',pending.length)}</span>}
    </div>
    <h2>{tx('项目总计')}</h2>
    <dl className="layout-report-totals">{columns.map(c=><div key={c.key}><dt>{c.label}</dt><dd>{format(total,c.key)} <small>{c.unit}</small></dd></div>)}</dl>
    <h2>{tx('区域明细')}</h2>
    {groups.length?<div className="layout-report-table"><table>
     <thead><tr><th scope="col">{tx('区域名称')}</th>{columns.map(c=><th scope="col" key={c.key}>{c.label}<small>{c.unit}</small></th>)}</tr></thead>
     {groups.map(group=><tbody key={group.label}>
      {groups.length>1&&<tr className="layout-report-subtotal"><th scope="row">{group.label}</th>{cells(summarize(group.rows))}</tr>}
      {group.rows.map(r=><tr key={r.id}><th scope="row">{r.name}<small>{r.type}</small></th>{cells(r)}</tr>)}
     </tbody>)}
    </table></div>:<p>{tx('暂无区域')}</p>}
   </article>
  </section>
 </div>,document.body);
}
