import type {RoofDesign} from './roof-project';
import {defaultPitch} from './pitched-roof';
import {defaultCarport,carportPortrait} from './carport';
import {defaultModule} from './domain';
import {tx} from './i18n';
import {MAX_FLAT_TABLE_ROWS} from './project-limits';
import {longRidgeAxis} from './roof-direction';
export type RegionForm='flat'|'single'|'gable'|'multi-gable'|'single-carport'|'double-carport'|'obstacle-building';
export function initialRegionForm(region:RoofDesign,form:RegionForm):RoofDesign{
 if(form==='obstacle-building'){
  return applyRegionForm({...region,flatHeight:region.flatHeight??10,wallHeight:0},form,{creating:true});
 }
 if(form==='multi-gable'){
  const axis=longRidgeAxis(region.roof),span=axis==='x'?region.roof.width:region.roof.depth;
  const draft:RoofDesign={...region,wallHeight:0,shadingOnly:undefined,pitch:{...defaultPitch,kind:'gable',axis,eave:8,percent:10,spans:[{start:-span/2,end:span/2,percent:10}]}};
  return applyRegionForm(draft,form,{creating:true});
 }
 const draft=form==='gable'?{...region,wallHeight:0,shadingOnly:undefined,pitch:{...defaultPitch,kind:'gable' as const,eave:8,percent:10}}:region;
 return applyRegionForm(draft,form,{creating:true});
}

export function applyRegionForm(region:RoofDesign,form:RegionForm,{creating=false}:{creating?:boolean}={}):RoofDesign{
 if(region.roof.outline&&(form==='single'||form==='single-carport'||form==='double-carport'))throw new Error(tx('多段线轮廓仅支持平屋面、双坡屋面、连坡屋面和障碍建筑'));
 if(form==='obstacle-building'){
  return {...region,shadingOnly:true,carport:undefined,pitch:undefined,wallHeight:0,arrays:[],previous:null,layoutSignature:'',layoutMessage:'',layoutOptions:{...region.layoutOptions,layoutArea:undefined,layoutAreaEnabled:undefined}};
 }
 if(form==='single-carport'||form==='double-carport')return {...region,shadingOnly:undefined,pitch:undefined,carport:{...(region.carport??defaultCarport),double:form==='double-carport'},wallHeight:0,moduleSpec:{...(region.moduleSpec.kind==='lightweight'?defaultModule:region.moduleSpec),kind:'standard'},layoutOptions:{...region.layoutOptions,portrait:carportPortrait(region.roof),layoutArea:undefined,layoutAreaEnabled:undefined}};
 const pitch=region.pitch??defaultPitch;
 if(form==='multi-gable'){
  const axis=creating||!region.pitch?.spans?longRidgeAxis(region.roof):pitch.axis;
  const span=axis==='x'?region.roof.width:region.roof.depth;
  const spans=!creating&&region.pitch?.spans?.length?region.pitch.spans:[{start:-span/2,end:span/2,percent:pitch.percent}];
  return {...region,shadingOnly:undefined,layoutOptions:{...region.layoutOptions,tableRows:Math.min(6,region.layoutOptions.tableRows??1),layoutArea:undefined,layoutAreaEnabled:undefined},carport:undefined,pitch:{...pitch,kind:'gable',axis,spans},...(creating||!region.pitch?.spans?{wallHeight:0}:{})};
 }
 const newGable=form==='gable'&&(creating||region.pitch?.kind!=='gable'||!!region.pitch?.spans);
 return {...region,shadingOnly:undefined,layoutOptions:{...region.layoutOptions,tableRows:Math.min(form==='flat'?MAX_FLAT_TABLE_ROWS:6,region.layoutOptions.tableRows??1),...(form!=='flat'?{layoutArea:undefined,layoutAreaEnabled:undefined}:{})},carport:undefined,pitch:form==='flat'?undefined:{...pitch,kind:form,axis:newGable?longRidgeAxis(region.roof):pitch.axis,spans:undefined},...(form==='gable'&&(region.pitch?.kind!=='gable'||!!region.pitch?.spans)?{wallHeight:0}:{})};
}
