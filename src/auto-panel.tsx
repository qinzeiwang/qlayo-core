import type {ReactNode} from 'react';
import {Icon} from './workbench-ui';
import {DEFAULT_WORKBENCH_ALIGNMENT,layoutAzimuth,layoutDirection,normalizeAzimuth,tableSpacing,type LayoutOptions} from './auto-layout';
import {NumberProperty} from './number-property';
import {tx} from './i18n';
import {DEFAULT_FRONT_HEIGHT} from './domain';
import {MAX_FLAT_TABLE_ROWS} from './project-limits';

type Props={
 options:LayoutOptions;
 onChange:(value:LayoutOptions)=>void;
 disabled:boolean;
 edge:number;
 ridgeEdge:number;
 onEdge:(value:number)=>void;
 onRidgeEdge:(value:number)=>void;
 onResetEdges?:()=>void;
 onEditArea:()=>void;
};

function Field({icon,label,mode,compact=false,children}:{icon:string;label:string;mode?:ReactNode;compact?:boolean;children:ReactNode}){
 return <div className={'layout-field'+(mode?' has-mode':'')+(compact?' has-compact-value':'')}>
  <span className="layout-field-label"><Icon name={icon}/><span>{label}</span></span>
  {mode}{mode?<div className="layout-mode-value">{children}</div>:children}
 </div>;
}

function ModeSwitch({checked,label,onToggle,offLabel=tx('自动'),onLabel=tx('手动')}:{checked:boolean;label:string;onToggle:()=>void;offLabel?:string;onLabel?:string}){
 return <button type="button" className="layout-mode-switch" role="switch" aria-label={label} aria-checked={checked} onClick={onToggle}>
  <i aria-hidden="true"/><span>{checked?onLabel:offLabel}</span>
 </button>;
}

export function AutoPanel({options,onChange,disabled,edge,ridgeEdge,onEdge,onRidgeEdge,onResetEdges,onEditArea}:Props){
 if(options.carport)return null;
 const lightweight=options.module?.kind==='lightweight';
 const rows=options.tableRows??1;
 const centered=(options.alignment??DEFAULT_WORKBENCH_ALIGNMENT)==='center';
 const limited=options.layoutAreaEnabled!==false&&!!options.layoutArea;
 const quickRows=options.pitch?6:4;
 const azimuth=layoutAzimuth(options);
 const manualAzimuth=options.azimuthMode==='manual';
 const manualSpacing=options.spacingMode==='manual';
 const spacing=lightweight||options.pitch?undefined:tableSpacing(options);
 const yaw=(options.roofYaw??0)*180/Math.PI;
 const rotated=Math.abs(Math.sin(2*(options.roofYaw??0)))>1e-7;
 const directions=[['180',tx('南')],['90',tx('东')],['270',tx('西')],['0',tx('北')]] as const;
 const edges=[['A',2],['B',3],['C',0],['D',1]] as const;
 const direction=options.azimuth===undefined&&rotated
  ? edges.find(([,index])=>index===layoutDirection(options))?.[0]??'C'
  : String(normalizeAzimuth(Math.round(azimuth)));
 const setDirection=(value:string)=>{
  const edgeDirection=edges.find(([letter])=>letter===value);
  if(edgeDirection){
   onChange({...options,direction:edgeDirection[1],azimuth:undefined,azimuthMode:undefined});
  }else{
   onChange({...options,azimuth:Number(value),azimuthMode:'auto'});
  }
 };
 const setAzimuthMode=()=>{
  if(manualAzimuth){
   const choices=[...directions.map(([value])=>({value,degrees:Number(value)})),
    ...(rotated?edges.map(([value,index])=>({value,degrees:normalizeAzimuth(180+90*index-yaw)})):[])];
   const distance=(degrees:number)=>Math.abs(normalizeAzimuth(degrees-azimuth+180)-180);
   setDirection(choices.reduce((a,b)=>distance(a.degrees)<=distance(b.degrees)?a:b).value);
  }else onChange({...options,azimuth,azimuthMode:'manual'});
 };
 const numeric=(key:'tilt'|'maxColumns'|'gap'|'rowGap'|'tableRows'|'frontHeight',label:string,icon:string,unit:string,min:number,max:number,step:number,value:number)=>
  <NumberProperty icon={icon} label={label} textLabel={label} unit={unit} min={min} max={max} step={step} value={value} onChange={n=>{if(step!==1||Number.isInteger(n))onChange({...options,[key]:n});}}/>;
 const orientation=<Field icon="panel-orientation" label={tx('组件朝向')}>
  <div className="seg-track edge-options" role="group" aria-label={tx('组件朝向')}><button type="button" className="seg-btn" aria-pressed={options.portrait} onClick={()=>{if(!options.portrait)onChange({...options,portrait:true});}}>{tx('垂直边 A')}</button><button type="button" className="seg-btn" aria-pressed={!options.portrait} onClick={()=>{if(options.portrait)onChange({...options,portrait:false});}}>{tx('平行边 A')}</button></div>
 </Field>;

 return <section className="auto-settings"><fieldset disabled={disabled}>
  <section className="layout-parameter-section">
   <div className="element-heading"><h2>{tx('阵列参数')}</h2></div>
   {!lightweight&&<>
    <Field icon="layout-connected-rows" label={tx('连排数量')}>
     {rows>quickRows?<output className="layout-unit-field">{tx('{0} 排',rows)}</output>:<div className="layout-row-segments seg-track" role="group" aria-label={tx('同一斜面连排数')}>
      {Array.from({length:quickRows},(_,i)=>i+1).map(n=><button type="button" className="seg-btn" key={n} aria-label={tx('{0} 排',n)} aria-pressed={rows===n} onClick={()=>onChange({...options,tableRows:n})}>{n}</button>)}
     </div>}
    </Field>
    {numeric('maxColumns',tx('每排最多'), 'layout-row-cap',tx('块'),1,100,1,options.maxColumns)}
    {!options.pitch&&numeric('tilt',tx('组件倾角'),'slope','°',0,60,.1,options.tilt)}
   </>}
   {lightweight||options.pitch?orientation:<Field icon="module-direction" label={tx('组件朝向')} mode={<ModeSwitch checked={manualAzimuth} label={tx('组件朝向手动模式')} onToggle={setAzimuthMode}/>}>
    {manualAzimuth?<div className="layout-inline-number"><NumberProperty icon="module-direction" label={tx('方位角')} unit="°" min={0} max={360} step={.1} value={azimuth} onChange={n=>onChange({...options,azimuth:normalizeAzimuth(n)})}/></div>
      :<select className="layout-direction-select" aria-label={tx('自动朝向')} value={direction} onChange={e=>setDirection(e.target.value)}>
        {directions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        {rotated&&edges.map(([letter])=><option key={letter} value={letter}>{letter}</option>)}
       </select>}
   </Field>}
   {spacing&&<Field icon="gap-y" label={tx('前后净距')} mode={<ModeSwitch checked={manualSpacing} label={tx('前后净距手动模式')} onToggle={()=>onChange({...options,spacingMode:manualSpacing?'solar':'manual',rowGap:manualSpacing?0:Math.min(100,Number(spacing.actual.toFixed(2)))})}/>}>
    {manualSpacing?<div className="layout-inline-number">{numeric('rowGap',tx('手动净距'),'gap-y','m',0,100,.1,options.rowGap??0)}</div>
      :<output className="layout-unit-field">{spacing.actual.toFixed(2)}<small>m</small></output>}
   </Field>}
   {options.pitch&&!lightweight&&numeric('rowGap',tx('前后组间距'),'gap-y','m',0,100,.1,options.rowGap??0)}
   {numeric('gap',lightweight?tx('检修通道'):tx('左右间距'),'gap-x','m',0,20,.1,options.gap)}
  </section>
  <details className="layout-more-settings">
   <summary>{tx('更多布置设置')}</summary>
   {!lightweight&&numeric('tableRows',tx('最大排数'),'layout-connected-rows',tx('排'),1,options.pitch?6:MAX_FLAT_TABLE_ROWS,1,rows)}
   <NumberProperty icon="layout-perimeter" label={tx('屋面四周间距')} textLabel={tx('屋面四周间距')} min={0} max={20} value={edge} onChange={onEdge}/>
   {options.pitch&&<NumberProperty icon="layout-ridge" label={options.pitch.kind==='gable'?tx('屋脊间距'):tx('高侧间距')} textLabel={options.pitch.kind==='gable'?tx('屋脊间距'):tx('高侧间距')} min={0} max={20} value={ridgeEdge} onChange={onRidgeEdge}/>}
   {onResetEdges&&<button type="button" className="layout-setback-reset" onClick={onResetEdges}>{tx('恢复项目默认边距')}</button>}
   {(options.pitch?.kind==='gable'||!options.pitch&&!lightweight)&&<Field icon="layout-alignment" label={tx('布置对齐')}>
     <div className="seg-track edge-options" role="group" aria-label={tx('布置对齐')}><button type="button" className="seg-btn" aria-pressed={centered} onClick={()=>{if(!centered)onChange({...options,alignment:'center'});}}>{tx('居中')}</button><button type="button" className="seg-btn" aria-pressed={!centered} onClick={()=>{if(centered)onChange({...options,alignment:'edge'});}}>{tx('靠边')}</button></div>

    </Field>}
   {!options.pitch&&!lightweight&&<>
    {numeric('frontHeight',tx('组件前沿高度'),'front-height','m',.2,10,.05,options.frontHeight??DEFAULT_FRONT_HEIGHT)}
    <button type="button" className="layout-limit-action" data-drawing-anchor="layout-limit" onClick={onEditArea}>
     <Icon name="layout-limit"/><span>{tx('限定布置区域')}</span>{limited&&<Icon name="check"/>}<Icon name="chevron-right"/>
    </button>
   </>}
  </details>
 </fieldset></section>;
}
