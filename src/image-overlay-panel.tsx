import type {BaseImage} from './base-image';
import {newId} from './ids';
import {useEffect,useRef,useState} from 'react';
import {Icon} from './workbench-ui';
import {loadDrawing} from './drawing-import';
import {parseImageOverlays,type ImageOverlay} from './image-overlays';
import {tx} from './i18n';
type Props={mainBase?:BaseImage;onMainBaseChange:(patch:Pick<BaseImage,'opacity'|'visible'>)=>void;onCrop?:()=>void;onResetCrop?:()=>void;items:ImageOverlay[];selected:string|null;center:{x:number;z:number};initialWidth:number;onChange:(items:ImageOverlay[])=>void;onSelect:(id:string|null)=>void;onClose:()=>void};
export function ImageOverlayPanel({mainBase,onMainBaseChange,onCrop,onResetCrop,items,selected,center,initialWidth,onChange,onSelect,onClose}:Props){
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const input=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 // The header eye shows or hides every picture at once; each row's eye does one.
 const shown=items.some(o=>o.visible),current=items.find(o=>o.id===selected),patch=(p:Partial<ImageOverlay>)=>onChange(items.map(o=>o.id===selected?{...o,...p}:o));
 const load=async(file?:File)=>{if(!file)return;setBusy(true);setError('');try{if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error(tx('请选择 PNG、JPG 或 WebP 图片'));if(file.size>8000000)throw new Error(tx('单张图片不超过 8 MB'));const image=await loadDrawing(file),width=Math.min(1000,Math.max(5,initialWidth)),o:ImageOverlay={id:newId(),name:file.name,url:image.url,...center,yaw:0,width,depth:width*image.height/image.width,originalWidth:width,opacity:.55,visible:true};const next=parseImageOverlays([...items,o]);if(!alive.current)return;onChange(next);onSelect(o.id);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <section className="image-overlay-panel" aria-label={tx('叠加图片设置')}><header><strong>{tx('叠加图片')}</strong>{items.length>0&&<button className="icon-button" title={shown?tx('隐藏叠加图片'):tx('显示叠加图片')} aria-label={shown?tx('隐藏叠加图片'):tx('显示叠加图片')} aria-pressed={!shown} onClick={()=>onChange(items.map(o=>({...o,visible:!shown})))}><Icon name={shown?'eye':'eye-off'}/></button>}<button className="icon-button" aria-label={tx('完成图片调整')} title={tx('完成图片调整')} onClick={onClose}><Icon name="close"/></button></header><input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" aria-label={tx('导入叠加图片')} onChange={e=>{void load(e.target.files?.[0]);e.target.value='';}}/> {mainBase&&<div className="main-base-actions">
  <header><h3>{tx('主底图')}</h3><button className="icon-button" title={tx('显示主底图')} aria-label={tx('显示主底图')} aria-pressed={mainBase.visible!==false} onClick={()=>onMainBaseChange({visible:mainBase.visible===false})}><Icon name={mainBase.visible===false?'eye-off':'eye'}/></button></header>
  <label className="overlay-opacity">{tx('主底图透明度')} <output>{Math.round((1-(mainBase.opacity??1))*100)}%</output>
   <input aria-label={tx('主底图透明度')} type="range" min="0" max="100" value={Math.round((1-(mainBase.opacity??1))*100)} onChange={e=>onMainBaseChange({opacity:1-Number(e.target.value)/100})}/>
  </label>
  <button onClick={onCrop}><Icon name="crop"/>{tx('修剪底图')}</button>
  {onResetCrop&&<button onClick={onResetCrop}><Icon name="reset"/>{tx('恢复完整底图')}</button>}
 </div>}
 <button className="overlay-add" disabled={busy||items.length>=8} onClick={()=>input.current?.click()}><Icon name="plus"/>{busy?tx('正在导入…'):tx('导入图片')}</button>
 <div className="overlay-list">{items.map(o=><div key={o.id} className={o.id===selected?'selected':''}><button aria-label={tx('调整 ')+o.name} onClick={()=>onSelect(o.id)}>{o.name}</button><button className="icon-button" aria-label={(o.visible?tx('隐藏 '):tx('显示 '))+o.name} title={(o.visible?tx('隐藏 '):tx('显示 '))+o.name} onClick={()=>onChange(items.map(i=>i.id===o.id?{...i,visible:!i.visible}:i))}><Icon name={o.visible?'eye':'eye-off'}/></button></div>)}</div>
 {current&&<div className="overlay-fields"><label className="overlay-opacity">{tx('透明度')} <output>{Math.round((1-current.opacity)*100)}%</output><input aria-label={tx('图片透明度')} type="range" min="0" max="95" step="1" value={Math.round((1-current.opacity)*100)} onChange={e=>patch({opacity:1-Number(e.target.value)/100})}/></label>
 <label className="overlay-number-row"><span>{tx('比例 %')}</span><input aria-label={tx('图片比例')} type="number" min="1" max="10000" value={Number((current.width/current.originalWidth*100).toFixed(1))} onChange={e=>{const n=Number(e.target.value),w=current.originalWidth*n/100,d=w*current.depth/current.width;if(n>0&&w>=.1&&d>=.1&&w<=10000&&d<=10000)patch({width:w,depth:d});}}/></label>
 <label className="overlay-number-row"><span>{tx('旋转 °')}</span><input aria-label={tx('图片旋转角度')} type="number" step="1" value={Number((-current.yaw*180/Math.PI).toFixed(1))} onChange={e=>{const n=Number(e.target.value);if(e.target.value&&Number.isFinite(n))patch({yaw:-n*Math.PI/180});}}/></label>
 <label className="overlay-number-row"><span>{tx('宽度 m')}</span><input aria-label={tx('叠加图片宽度')} type="number" step="0.1" value={Number(current.width.toFixed(2))} onChange={e=>{const w=Number(e.target.value),d=w*current.depth/current.width;if(w>=.1&&w<=10000&&d>=.1&&d<=10000)patch({width:w,depth:d});}}/></label>
 <div className="overlay-number-row overlay-readonly-row"><span>{tx('长度 m')}</span><output aria-label={tx('叠加图片长度')}>{current.depth.toFixed(2)}</output></div>
 <small>{tx('拖动图片定位，拖动角点等比缩放')}</small><button className="overlay-delete" onClick={()=>{onChange(items.filter(o=>o.id!==selected));onSelect(null);}}>{tx('删除图片')}</button></div>}{error&&<p role="alert">{error}</p>}</section>;
}
