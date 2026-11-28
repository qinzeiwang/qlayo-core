import type {RoofDesign} from './roof-project';
import {equalGableSpans} from './pitched-roof';
import {turnPitch,flipCarportSlope,longRidgeAxis} from './roof-direction';
import {Icon} from './workbench-ui';
import {NumberProperty} from './number-property';
import {ElementList,type ElementArraySpec,type ElementArrayPreview,type ElementCreation,type ElementEditRequest} from './element-list';
import {tx} from './i18n';

type Props={
 geometryOnly?:boolean;
 creatingRegion?:boolean;
 creatingObject?:ElementCreation;
 editRequest?:ElementEditRequest;onEditRequestHandled?:()=>void;
 region:RoofDesign;
 objectSelection:string[];
 disabled:boolean;
 onChange:(patch:Partial<RoofDesign>)=>void;
 onCutSpans?:()=>void;
 highlightedSpan?:number|null;
 onHighlightSpan?:(index:number|null)=>void;
 onObjectSelectionChange:(ids:string[])=>void;
 onAdd:(kind:'building'|'obstacle'|'keepout')=>void;
 onDeleteObjects:(ids:string[])=>void;
 onApplyObjectEdit:(ids:string[],patch:{name?:string;height?:number;width?:number;depth?:number;topLayout?:{enabled:boolean;tilt:number;edge:number}})=>void;
 onApplyObjectArray:(targetId:string,spec:ElementArraySpec)=>boolean;
 onPreviewObjectArray:(preview:ElementArrayPreview|null)=>void;
 onUngroupArray:(groupId:string)=>void;
};

/** Drawing properties use three peer rows, with the same label/input grid. */
function DrawingRegionProperties({creatingRegion,region:r,onChange}:{creatingRegion:boolean;region:RoofDesign;onChange:(patch:Partial<RoofDesign>)=>void}){
 const height=r.carport?.clearance??r.pitch?.eave??r.flatHeight??3.5;
 const shadingBuilding=!!r.shadingOnly&&!r.pitch&&!r.carport;
 return <section className="region-panel drawing-properties" aria-label={tx('屋面参数')}>
  <div className="element-heading" data-drawing-anchor="roof"><h2>{r.carport?tx('车棚参数'):shadingBuilding?tx('障碍建筑参数'):tx('屋面参数')}</h2></div>
  {creatingRegion&&<div className="property-row property-row-text"><Icon name="edit"/><span className="property-spacer">{tx('名称')}</span><input data-1p-ignore="true" aria-label={tx('区域名称')} value={r.name} onChange={event=>onChange({name:event.target.value})}/></div>}
  <NumberProperty textLabel={tx('高度')} label={r.carport?tx('最低净高 m'):r.pitch?tx('低檐高 m'):shadingBuilding?tx('建筑高度 m'):tx('屋面高度 m')} icon="height" unit="m" min={r.carport?2:1} max={r.carport?10:100} step={0.1} value={height} onChange={value=>onChange(r.carport?{carport:{...r.carport,clearance:value}}:r.pitch?{pitch:{...r.pitch,eave:value}}:{flatHeight:value})}/>
  {r.pitch?.kind==='gable'&&!r.pitch.spans&&<NumberProperty textLabel={tx('坡度')} label={tx('坡度 %')} icon="slope" unit="%" min={0} max={100} step={0.5} value={r.pitch.percent} onChange={percent=>onChange({pitch:{...r.pitch!,percent}})}/>}
  {r.carport?<NumberProperty textLabel={tx('倾角')} label={tx('倾角 °')} icon="slope" unit="°" min={0} max={16.6} step={.5} value={Number((Math.atan(r.carport.percent/100)*180/Math.PI).toFixed(2))} onChange={value=>onChange({carport:{...r.carport!,percent:Math.tan(value*Math.PI/180)*100}})}/>
   :!shadingBuilding&&<NumberProperty textLabel={tx('女儿墙高度')} label={tx('女儿墙高度 m')} hint={r.pitch?.kind==='gable'?tx('相对屋脊的高度，0 表示无女儿墙'):tx('0 表示无女儿墙')} icon="wall" unit="m" min={0} max={5} step={.05} value={r.wallHeight} onChange={wallHeight=>onChange({wallHeight})}/>}
 </section>;
}

/** Step ① 建模 Inspector: keeps the working roof fixed at the top, followed by its elements list and sub-editor. */
export function RegionPanel({editRequest,onEditRequestHandled,creatingObject,creatingRegion=false,geometryOnly=false,region:r,objectSelection,disabled,onChange,onCutSpans,highlightedSpan,onHighlightSpan,onObjectSelectionChange,onAdd,onDeleteObjects,onApplyObjectEdit,onApplyObjectArray,onPreviewObjectArray,onUngroupArray}:Props){
 const carport=!!r.carport,pitch=r.pitch,shading=!!r.shadingOnly;
 if(geometryOnly)return <DrawingRegionProperties creatingRegion={creatingRegion} region={r} onChange={onChange}/>;
 return <section className="region-panel">
  <section className="model-geometry fixed-properties" aria-label={tx('屋面参数')}>
   <div className="element-heading" data-drawing-anchor="roof"><h2>{carport?tx('车棚参数'):shading&&!pitch?tx('障碍建筑参数'):tx('屋面参数')}</h2>{shading&&<span className="shading-badge">{tx('仅遮挡')}</span>}</div>
   <div className="property-grid">
    {r.pitch?(
     <>
      <NumberProperty textLabel={tx('高度')} label={tx('低檐高 m')} icon="height" unit="m" min={1} max={100} step={0.1} disabled={disabled} value={r.pitch.eave} onChange={eave=>onChange({pitch:{...r.pitch!,eave}})}/>
      {!r.pitch.spans&&<NumberProperty textLabel={tx('坡度')} label={tx('坡度 %')} icon="slope" unit="%" min={0} max={100} step={0.5} disabled={disabled} value={r.pitch.percent} onChange={percent=>onChange({pitch:{...r.pitch!,percent}})}/>}
      {pitch?.kind==='gable'&&<>
       <NumberProperty textLabel={tx('女儿墙高度')} label={tx('女儿墙高度 m')} hint={tx('相对屋脊的高度，0 表示无女儿墙')} icon="wall" unit="m" min={0} max={5} step={0.05} disabled={disabled} value={r.wallHeight} onChange={wallHeight=>onChange({wallHeight})}/>
       <div className="property-row">
        <Icon name="ridge-direction"/><span className="property-spacer">{tx('屋脊方向')}</span>
        <div className="seg-track edge-options" role="group" aria-label={tx('屋脊方向')}>
         {[tx('方向 1'),tx('方向 2')].map((label,index)=>{
          const selected=(pitch.axis===longRidgeAxis(r.roof))===(index===0);
          return <button type="button" className="seg-btn" key={label} disabled={disabled} aria-pressed={selected} onClick={()=>{if(!selected)onChange({pitch:turnPitch(pitch,r.roof)});}}>{label}</button>;
         })}
        </div>
       </div>
      </>}
     </>
    ):r.carport?(
     <>
      <NumberProperty textLabel={tx('高度')} label={tx('最低净高 m')} icon="height" unit="m" min={2} max={10} step={0.1} disabled={disabled} value={r.carport.clearance} onChange={clearance=>onChange({carport:{...r.carport!,clearance}})}/>
      <NumberProperty textLabel={tx('倾角')} label={tx('倾角 °')} icon="slope" unit="°" min={0} max={16.6} step={0.5} disabled={disabled} value={Number((Math.atan(r.carport.percent/100)*180/Math.PI).toFixed(2))} onChange={n=>onChange({carport:{...r.carport!,percent:Math.tan(n*Math.PI/180)*100}})}/>
     </>
    ):(
     <>
      <NumberProperty textLabel={tx('高度')} label={shading?tx('建筑高度 m'):tx('屋面高度 m')} icon="height" unit="m" min={1} max={100} step={0.1} disabled={disabled} value={r.flatHeight??3.5} onChange={flatHeight=>onChange({flatHeight})}/>
      {!shading&&<NumberProperty textLabel={tx('女儿墙高度')} label={tx('女儿墙高度 m')} hint={tx('0 表示无女儿墙')} icon="wall" unit="m" min={0} max={5} step={0.05} disabled={disabled} value={r.wallHeight} onChange={wallHeight=>onChange({wallHeight})}/>}
     </>
    )}
   </div>

   {pitch?.kind==='gable'&&pitch.spans&&(
    <div className="multi-gable-controls" onMouseLeave={()=>onHighlightSpan?.(null)}>
     <div className="multi-gable-header">
      <span className="multi-gable-title">{tx('连坡分跨')} <small>{tx('{0} 跨',pitch.spans.length)}</small></span>
      {onCutSpans&&<button type="button" className="multi-gable-cut-btn" disabled={disabled} onClick={onCutSpans}><Icon name="cut-roof"/><span>{tx('图上切割')}</span></button>}
     </div>
     <div className="property-row">
      <Icon name="count"/><span className="property-spacer">{tx('快速等分')}</span>
      <div className="seg-track edge-options" role="group" aria-label={tx('快速等分跨数')}>
       {[2,3,4].map(n=>(
        <button type="button" key={n} className="seg-btn" disabled={disabled} aria-pressed={pitch.spans!.length===n}
         onClick={()=>onChange({pitch:{...pitch,spans:equalGableSpans(r.roof,pitch.axis,n,pitch.percent)}})}>{n}</button>
       ))}
      </div>
     </div>
     <div className="multi-gable-spans" role="list" aria-label={tx('各跨坡度')}>
      {pitch.spans.map((span,index)=>{
       const width=span.end-span.start;
       const ridgeH=pitch.eave+(width/2)*(span.percent/100);
       return <div key={index} role="listitem" className={`multi-gable-span-row${highlightedSpan===index?' is-highlighted':''}`}
        onMouseEnter={()=>onHighlightSpan?.(index)} onFocus={()=>onHighlightSpan?.(index)} onBlur={()=>onHighlightSpan?.(null)}>
        <div className="multi-gable-span-meta">
         <strong>{tx('跨 {0}',index+1)}</strong>
         <span>{tx('{0}m · 脊高 {1}m',width.toFixed(1),ridgeH.toFixed(1))}</span>
        </div>
        <label className="multi-gable-span-slope">
         <input data-1p-ignore="true" type="number" min={0} max={100} step={0.5} disabled={disabled}
          aria-label={tx('跨 {0} 坡度 %',index+1)}
          value={span.percent}
          onChange={e=>{
           const val=Number(e.target.value);
           if(!Number.isFinite(val)||val<0||val>100)return;
           const nextSpans=pitch.spans!.map((s,i)=>i===index?{...s,percent:val}:s);
           onChange({pitch:{...pitch,percent:nextSpans[0]?.percent??pitch.percent,spans:nextSpans}});
          }}/>
         <span>%</span>
        </label>
       </div>;
      })}
     </div>
    </div>
   )}

   {pitch?.kind==='single'&&(
    <div className="region-direction-row">
     <button type="button" className="subtle-action-row" disabled={disabled} onClick={()=>onChange({pitch:turnPitch(pitch)})}>
      <Icon name="slope-direction"/>
      <span>{tx('旋转坡向')}</span>
     </button>
    </div>
   )}

   {r.carport&&!r.carport.double&&(
    <div className="carport-extra-controls">
     <div className="seg-track" role="group" aria-label={tx('立柱样式')}>
      {([undefined,'curved'] as const).map(frame=>(
       <button type="button" className="seg-btn" key={frame??'straight'} title={frame?tx('弯柱'):tx('直柱')} aria-label={frame?tx('弯柱'):tx('直柱')} aria-pressed={r.carport!.frame===frame} disabled={disabled}
        onClick={()=>{if(r.carport!.frame!==frame)onChange({carport:{...r.carport!,frame},arrays:r.arrays.map(({carportFrame:_,...a})=>a.mounting==='carport'&&frame?{...a,carportFrame:frame}:a)});}}>
        <Icon name={frame?'carport-curved':'carport-straight'}/>
        <span>{frame?tx('弯柱'):tx('直柱')}</span>
       </button>
      ))}
     </div>
     <div className="property-row">
      <Icon name="slope-direction"/>
      <span className="property-spacer">{tx('车棚立柱边')}</span>
      <div className="seg-track edge-options" role="group" aria-label={tx('车棚立柱边')}>
       {([1,-1] as const).map((sign,index)=>{
        const selected=(r.carport!.slopeSign??1)===sign;
        return <button type="button" key={sign} className="seg-btn" disabled={disabled} aria-pressed={selected}
         onClick={()=>{if(!selected)onChange(flipCarportSlope(r));}}>{index===0?tx('方向 1'):tx('方向 2')}</button>;
       })}
      </div>
     </div>
    </div>
   )}
  </section>

  {!carport&&!shading&&<ElementList editRequest={editRequest} onEditRequestHandled={onEditRequestHandled} creation={creatingObject}
   roofId={r.id}
   items={r.obstacles}
   selection={objectSelection}
   disabled={disabled}
   onSelectionChange={onObjectSelectionChange}
   onAdd={onAdd}
   onDelete={onDeleteObjects}
   onApplyEdit={onApplyObjectEdit}
   onApplyArray={onApplyObjectArray}
   onPreviewArray={onPreviewObjectArray}
   onUngroup={onUngroupArray}
  />}
 </section>;
}
