import {useEffect,useState} from 'react';
import {projectEdges} from './layout-state';
import {downloadScheme,schemeReport} from './scheme-report';
import {useDialog} from './use-dialog';
import {registerWorkbenchAddon,type AddonContext} from './workbench-addons';
import {Icon} from './workbench-ui';
import {tx} from './i18n';
/** Capacity report: switches to 3D, takes a picture, then previews the report (area, modules, capacity) with HTML download. */
function CapacityReport({project:p,capture3D,show3D,close}:AddonContext){
 const [html,setHtml]=useState('');const [error,setError]=useState('');const [saving,setSaving]=useState(false);
 useDialog('[aria-label="'+tx('装机量报告预览')+'"]',true,()=>{if(!saving)close();});
 useEffect(()=>{if(!capture3D)show3D();},[capture3D,show3D]);
 useEffect(()=>{
  if(!capture3D||html||error)return;
  // The 3D view may still be loading: try for a few seconds.
  let tries=0;const timer=setInterval(()=>{
   const picture=capture3D();tries++;
   if(!picture&&tries<30)return;
   clearInterval(timer);
   try{if(!picture)throw new Error(tx('三维图像尚未准备好'));setHtml(schemeReport(p.name,p.hasRegions?p.roofs:[],projectEdges(p),picture,p.address));}catch(e){setError((e as Error).message);}
  },200);
  return ()=>clearInterval(timer);
 },[capture3D,html,error,p]);
 const download=async()=>{setSaving(true);try{await downloadScheme(html,p.name);}catch(e){setError((e as Error).message);}finally{setSaving(false);}};
 return <div className="project-dialog-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget&&!saving)close();}}>
  <section className="report-preview" role="dialog" aria-modal="true" aria-label={tx('装机量报告预览')}>
   <div className="advanced-heading"><h2>{tx('装机量报告预览')}</h2><div>
    <button className="primary-action" disabled={!html||saving} onClick={()=>void download()}>{saving?tx('正在保存…'):tx('下载 HTML')}</button>
    <button className="icon-button" aria-label={tx('关闭报告')} title={tx('关闭报告')} onClick={close}><Icon name="close"/></button></div></div>
   {error?<p className="validation-error" role="alert">{error}</p>:html?<iframe title={tx('装机量报告')} srcDoc={html}/>:<p role="status">{tx('正在生成三维图像…')}</p>}
  </section>
 </div>;
}
registerWorkbenchAddon({id:'capacity-report',
 output:{icon:'file',title:tx('装机量报告'),note:()=>tx('面积、组件数量、装机量 · HTML / PDF'),action:tx('预览报告'),primary:true},
 panel:c=><CapacityReport {...c}/>});
