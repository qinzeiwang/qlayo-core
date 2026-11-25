import type {RefObject} from 'react';
import {Icon} from './workbench-ui';
import {BrandMark} from './brand-logo';
import {useAccount} from './account';
import {coreEdition,tx} from './i18n';
import {otherLanguage,otherLanguageName} from './language-switch';
/** Busy and selection state that decides which rail actions are enabled. */
export type TopBarState={importing:boolean;saving:boolean;running:boolean;imageOpen:boolean;stress:boolean};
type Props=TopBarState&{
 /** Phones: hide everything that edits the project. */
 viewOnly?:boolean;
 panel:string;
 collapsed:boolean;
 onSelectStep:(step:string)=>void;
 /** Result of the last save: success fades by itself, an error stays until closed. */
 saveNotice?:{text:string;error?:boolean;id:number}|null;onDismissSaveNotice?:()=>void;
 fileInput:RefObject<HTMLInputElement|null>;
 onHome:()=>void;onDeliver?:()=>void;onSave:()=>void;onSettings:()=>void;
 onNewProject:()=>void;
 /** Opens the AI design page with this project; left out when that page is not part of the app (free version). */
 onAiLayout?:()=>void;onLogout:()=>void;onLanguage?:()=>void;
 onOpenFile:(file?:File)=>void;
};
/** Run a project-menu action and close the menu first. */
const menuAction=(action:()=>void)=>(e:{currentTarget:Element})=>{e.currentTarget.closest('details')?.removeAttribute('open');action();};
/** Narrow 56px Left Rail: Display-only Logo | Stage Tabs (区域 / 布置 / 报告) | Save | Global Settings | Project Menu. */
export function TopBar(p:Props){
 const {importing,saving,running,imageOpen,stress}=p;
 const account=useAccount();
 const steps:[string,string,string][]=[['roof',tx('区域'),'region-draw'],['layout',tx('布置'),'module'],['report',tx('报告'),'file']];
 return <nav inert={p.imageOpen} className="icon-rail topbar" aria-label={tx('工作阶段')}>
  <div className="rail-brand qlayo-rail-brand">
   <BrandMark/>
  </div>
  {!p.viewOnly&&<div className="rail-group design-tabs" role="navigation" aria-label={tx('设计步骤')}>
   {steps.map(([id,label,icon])=>{
    const active=p.panel===id&&!p.collapsed;
    return <button key={id} data-tone={id} className={`rail-tab${active?' active':''}`} aria-label={label} title={label} aria-haspopup={id==='report'&&coreEdition?'dialog':undefined} aria-current={p.panel===id?'step':undefined} onClick={()=>p.onSelectStep(id)}>
     <Icon name={icon}/>
     <small>{label}</small>
    </button>;
   })}
  </div>}
  <div className="rail-group rail-bottom top-actions">
   {!p.viewOnly&&<div className="rail-save-wrap rail-save-action">
    <button className={`rail-btn rail-tab rail-utility icon-button${p.saveNotice?.error?' is-error':''}`} disabled={saving||importing} aria-label={saving?tx('保存中…'):tx('保存项目')} aria-busy={saving} data-tooltip={saving?tx('保存中…'):`${tx('保存项目')} · Ctrl+S`} onClick={p.onSave}>
     <Icon name="save"/><small>{tx('保存')}</small>
    </button>
    {p.saveNotice&&<p key={p.saveNotice.id} className={`save-notice${p.saveNotice.error?' is-error':''}`} role={p.saveNotice.error?'alert':'status'}><Icon name={p.saveNotice.error?'alert':'check'}/><span>{p.saveNotice.text}</span>{p.saveNotice.error&&<button className="icon-button" aria-label={tx('关闭')} title={tx('关闭')} onClick={p.onDismissSaveNotice}><Icon name="close"/></button>}</p>}
   </div>}
   {!p.viewOnly&&<button className="rail-btn rail-tab rail-utility icon-button" aria-label={tx('全局设置')} title={tx('全局设置')} onClick={p.onSettings}><Icon name="settings"/><small>{tx('设置')}</small></button>}
   <details className="project-menu">
    <summary className="rail-btn rail-tab rail-utility icon-button" title={tx('更多')} aria-label={tx('更多')}><Icon name="more"/><small>{tx('更多')}</small></summary>
    <div>
     <button onClick={menuAction(p.onHome)}><Icon name="home"/>{tx('返回首页')}</button>
     {!p.viewOnly&&<button disabled={stress||running||importing||saving} onClick={menuAction(p.onNewProject)}><Icon name="plus"/>{tx('新建项目')}</button>}
     <button disabled={stress||running||importing||saving} onClick={menuAction(()=>p.fileInput.current?.click())}><Icon name="folder"/>{tx('打开项目')}</button>
     {!p.viewOnly&&(p.onDeliver||p.onAiLayout)&&<><hr className="rail-menu-divider"/>
      {p.onDeliver&&<button onClick={menuAction(p.onDeliver)}><Icon name="file"/>{tx('交付成果')}</button>}
      {p.onAiLayout&&<button disabled={running||importing||saving||imageOpen} onClick={menuAction(p.onAiLayout)}><Icon name="ai"/>{tx('AI 自动方案')}</button>}</>}
     {(p.onLanguage||account)&&<hr className="rail-menu-divider"/>}
     {p.onLanguage&&<button lang={otherLanguage==='zh'?'zh-CN':'en'} onClick={menuAction(p.onLanguage)}><Icon name="language"/>{otherLanguageName}</button>}
     {account&&<><span className="menu-account"><Icon name="user"/>{account.name}</span>
      <button disabled={saving} onClick={menuAction(p.onLogout)}><Icon name="logout"/>{tx('退出登录')}</button></>}
    </div>
   </details>
   <input ref={p.fileInput} type="file" accept=".json" hidden onChange={e=>{p.onOpenFile(e.target.files?.[0]);e.target.value='';}}/>
  </div>
 </nav>;
}
