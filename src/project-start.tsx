import {locationResolved} from './location-presets';
import {SunLocation} from './sun-controls';
import type {SunSettings} from './sun-position';
import {BrandLogo} from './brand-logo';
import {LanguageSwitch} from './language-switch';
import {useRef,useState} from 'react';
import {Icon} from './workbench-ui';
import {formatSavedTime,type RecentProject} from './recent-projects';
import {logout,useAccount} from './account';
import {aiDesignOn} from './workbench-addons';
import './project-start.css';
import {tx} from './i18n';

export function ProjectStart({sunSettings,onSunSettings,pendingDrawing,name,address,onName,onAddress,phone,creating,message,busy,recent,restoring,onOpenRecent,onRemoveRecent,onNew,onBack,onOpen,onCreate}:{sunSettings:SunSettings;onSunSettings:(v:SunSettings)=>void;pendingDrawing?:string;name:string;address:string;onName:(v:string)=>void;onAddress:(v:string)=>void;phone?:boolean;creating:boolean;message:string;busy:boolean;recent:RecentProject[];restoring:boolean;onOpenRecent:(id:string)=>void;onRemoveRecent:(id:string)=>void;onNew:()=>void;onBack:()=>void;onOpen:(file?:File)=>Promise<void>;onCreate:(mode:'blank'|'drawing',file?:File)=>void}){
 const [coordinateDraft,setCoordinateDraft]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 const [opening,setOpening]=useState(false);
 const drawingInput=useRef<HTMLInputElement>(null);
 const [removing,setRemoving]=useState<string>();
 const account=useAccount();
 const canCreate=!busy&&!coordinateDraft&&locationResolved(sunSettings);
 if(restoring)return <main className="project-start"><div className="start-brand"><BrandLogo/></div><LanguageSwitch/><p className="start-message" role="status">{tx('正在恢复上次打开的项目…')}</p></main>;
 return <main className={creating?'project-start is-creating':'project-start'}>
  <div className="start-brand"><BrandLogo/></div><LanguageSwitch/>
  {account&&<div className="start-account"><span><Icon name="user"/>{account.name}</span><button onClick={()=>void logout()}>{tx('退出登录')}</button></div>}
  <section className="start-card">
   {creating?<header className="start-create-heading">
    <button type="button" className="icon-button" aria-label={tx('返回首页')} title={tx('返回首页')} disabled={busy} onClick={()=>{setCoordinateDraft(false);onBack();}}><Icon name="back"/></button>
    <h1>{tx('新建项目')}</h1>
   </header>:<><h1>{tx('开始一个光伏项目')}</h1><p className="start-lead">{tx('光伏布置与效果预览')}</p></>}
   {creating?<>
    <div className="start-project-fields">
     <label>{tx('项目名称')}<input data-1p-ignore aria-label={tx('新建项目名称')} value={name} onChange={e=>onName(e.target.value)} onBlur={()=>{if(!name.trim())onName(tx('未命名项目'));}}/></label>
     <label>{tx('项目地点')}<input data-1p-ignore aria-label={tx('新建项目地点')} placeholder={tx('例如：北京市海淀区')} value={address} onChange={e=>onAddress(e.target.value)}/></label>
     <SunLocation address={address} onDraftChange={setCoordinateDraft} value={sunSettings} onChange={onSunSettings}/>
    </div>
    <div className="start-actions start-create-actions">
     <button type="button" className="start-entry-button" title={pendingDrawing??tx('支持图片/PDF')} disabled={!canCreate} onClick={()=>pendingDrawing?onCreate('drawing'):drawingInput.current?.click()}><Icon name="underlay-plan"/>{busy?tx('正在导入…'):pendingDrawing?tx('继续标定'):tx('导入底图')}</button>
     <button type="button" className="start-entry-button" disabled={!canCreate} onClick={()=>onCreate('blank')}><Icon name="no-image"/>{tx('无底图')}</button>
    </div>
    <input ref={drawingInput} hidden type="file" accept="application/pdf,.pdf,image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f&&canCreate)onCreate('drawing',f);}}/>
   </>:<div className="start-options start-actions start-options-home">
    {phone?<p className="start-phone-note" role="note">{tx('手机上可以打开和查看项目；新建和编辑请使用电脑或平板。')}</p>:<button type="button" className="start-entry-button" onClick={onNew}><Icon name="plus"/>{tx('新建项目')}</button>}
    <button type="button" className="start-entry-button" disabled={opening} onClick={()=>input.current?.click()}><Icon name="folder"/>{opening?tx('正在打开…'):tx('打开项目')}</button>
    {!phone&&aiDesignOn()&&<a href="/ai-design.html" className="start-option-link"><span className="start-option-icon"><Icon name="ai"/></span><strong>{tx('AI 自动方案')}</strong><small>{tx('上传图片、图纸或文字，AI 识别并自动布置')}</small></a>}
   </div>}
   {!creating&&recent.length>0&&<section className="start-recent" aria-labelledby="start-recent-title">
    <h2 id="start-recent-title">{account?tx('我的项目'):tx('最近项目')}</h2>
    <ul>{recent.map(r=><li key={r.id}>{removing===r.id?<div className="start-recent-confirm" role="group" aria-label={tx('删除 {0}',r.name)}><span>{account?<>{tx('删除“')}{r.name}{tx('”？删除后可请管理员从回收站找回。')}</>:<>{tx('从本浏览器删除“')}{r.name}{tx('”？未另存为文件的内容将无法找回。')}</>}</span><button className="danger" onClick={()=>{setRemoving(undefined);onRemoveRecent(r.id);}}>{tx('删除')}</button><button onClick={()=>setRemoving(undefined)}>{tx('取消')}</button></div>:<>
     <button className="start-recent-open" onClick={()=>onOpenRecent(r.id)}>
      <span className="start-recent-thumb" aria-hidden="true">{r.planThumbnail?<img src={r.planThumbnail} alt="" loading="lazy" decoding="async"/>:<Icon name="underlay-plan"/>}</span>
      <strong>{r.name}</strong><small>{r.capacity>0?`${r.capacity.toFixed(1)} kWp`:tx('尚未布置')} · {r.regions} {tx('个区域')}{r.address?` · ${r.address}`:''}</small><time dateTime={new Date(r.updatedAt).toISOString()}>{formatSavedTime(r.updatedAt)}</time>
     </button>
     <button className="start-recent-remove" aria-label={account?tx('删除项目 {0}',r.name):tx('从最近项目删除 {0}',r.name)} title={account?tx('删除项目'):tx('从列表删除')} onClick={()=>setRemoving(r.id)}><Icon name="close"/></button></>}</li>)}</ul>
    <p className="start-recent-note">{account?tx('项目自动保存在服务器上，换一台电脑登录也能打开。'):tx('项目自动保存在本浏览器中；重要项目请另存为文件。')}</p>
   </section>}
   <input ref={input} hidden type="file" accept=".json" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';setOpening(true);try{await onOpen(f);}finally{setOpening(false);}}}/>
   {message&&(/失败|错误|无法|fail|error|cannot|could not/i.test(message)?<p className="start-error" role="alert">{message}</p>:<p className="start-message" role="status">{message}</p>)}
  </section>
 </main>;
}
