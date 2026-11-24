import type {RoofDesign} from './roof-project';
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
 return <section className="region-panel drawing-properties" aria-label={tx('屋面参数')}>
  <div className="element-heading" data-drawing-anchor="roof"><h2>{r.carport?tx('车棚参数'):tx('屋面参数')}</h2></div>
  {creatingRegion&&<div className="property-row property-row-text"><Icon name="edit"/><span className="property-spacer">{tx('名称')}</span><input data-1p-ignore="true" aria-label={tx('区域名称')} value={r.name} onChange={event=>onChange({name:event.target.value})}/></div>}
  <NumberProperty textLabel={tx('高度')} label={r.carport?tx('最低净高 m'):r.pitch?tx('低檐高 m'):tx('屋面高度 m')} icon="height" unit="m" min={r.carport?2:1} max={r.carport?10:100} step={0.1} value={height} onChange={value=>onChange(r.carport?{carport:{...r.carport,clearance:value}}:r.pitch?{pitch:{...r.pitch,eave:value}}:{flatHeight:value})}/>
  {r.pitch?.kind==='gable'&&<NumberProperty textLabel={tx('坡度')} label={tx('坡度 %')} icon="slope" unit="%" min={0} max={100} step={0.5} value={r.pitch.percent} onChange={percent=>onChange({pitch:{...r.pitch!,percent}})}/>}
  {r.carport?<NumberProperty textLabel={tx('倾角')} label={tx('倾角 °')} icon="slope" unit="°" min={0} max={16.6} step={.5} value={Number((Math.atan(r.carport.percent/100)*180/Math.PI).toFixed(2))} onChange={value=>onChange({carport:{...r.carport!,percent:Math.tan(value*Math.PI/180)*100}})}/>
   :<NumberProperty textLabel={tx('女儿墙高度')} label={tx('女儿墙高度 m')} hint={r.pitch?.kind==='gable'?tx('相对屋脊的高度，0 表示无女儿墙'):tx('0 表示无女儿墙')} icon="wall" unit="m" min={0} max={5} step={.05} value={r.wallHeight} onChange={wallHeight=>onChange({wallHeight})}/>}
 </section>;
}

/** Step ① 建模 Inspector: keeps the working roof fixed at the top, followed by its elements list and sub-editor. */
export function RegionPanel({editRequest,onEditRequestHandled,creatingObject,creatingRegion=false,geometryOnly=false,region:r,objectSelection,disabled,onChange,onObjectSelectionChange,onAdd,onDeleteObjects,onApplyObjectEdit,onApplyObjectArray,onPreviewObjectArray,onUngroupArray}:Props){
 const carport=!!r.carport,pitch=r.pitch;
 if(geometryOnly)return <DrawingRegionProperties creatingRegion={creatingRegion} region={r} onChange={onChange}/>;
 return <section className="region-panel">
  <section className="model-geometry fixed-properties" aria-label={tx('屋面参数')}>
   <div className="element-heading" data-drawing-anchor="roof"><h2>{carport?tx('车棚参数'):tx('屋面参数')}</h2></div>
   <div className="property-grid">
    {r.pitch?(
     <>
      <NumberProperty textLabel={tx('高度')} label={tx('低檐高 m')} icon="height" unit="m" min={1} max={100} step={0.1} disabled={disabled} value={r.pitch.eave} onChange={eave=>onChange({pitch:{...r.pitch!,eave}})}/>
      <NumberProperty textLabel={tx('坡度')} label={tx('坡度 %')} icon="slope" unit="%" min={0} max={100} step={0.5} disabled={disabled} value={r.pitch.percent} onChange={percent=>onChange({pitch:{...r.pitch!,percent}})}/>
      {pitch?.kind==='gable'&&<>
       <NumberProperty textLabel={tx('女儿墙高度')} label={tx('女儿墙高度 m')} hint={tx('相对屋脊的高度，0 表示无女儿墙')} icon="wall" unit="m" min={0} max={5} step={0.05} disabled={disabled} value={r.wallHeight} onChange={wallHeight=>onChange({wallHeight})}/>
       <div className="property-row">
        <Icon name="ridge-direction"/><span className="property-spacer">{tx('屋脊方向')}</span>
        <div className="seg-track edge-options" role="group" aria-label={tx('屋脊方向')}>
         {[tx('方向 1'),tx('方向 2')].map((label,index)=>{
          const selected=(pitch.axis===longRidgeAxis(r.roof))===(index===0);
          return <button type="button" className="seg-btn" key={label} disabled={disabled} aria-pressed={selected} onClick={()=>{if(!selected)onChange({pitch:turnPitch(pitch)});}}>{label}</button>;
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
      <NumberProperty textLabel={tx('高度')} label={tx('屋面高度 m')} icon="height" unit="m" min={1} max={100} step={0.1} disabled={disabled} value={r.flatHeight??3.5} onChange={flatHeight=>onChange({flatHeight})}/>
      <NumberProperty textLabel={tx('女儿墙高度')} label={tx('女儿墙高度 m')} hint={tx('0 表示无女儿墙')} icon="wall" unit="m" min={0} max={5} step={0.05} disabled={disabled} value={r.wallHeight} onChange={wallHeight=>onChange({wallHeight})}/>
     </>
    )}
   </div>

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

  {!carport&&<ElementList editRequest={editRequest} onEditRequestHandled={onEditRequestHandled} creation={creatingObject}
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
