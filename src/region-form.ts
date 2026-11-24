import type {RoofDesign} from './roof-project';
import {defaultPitch} from './pitched-roof';
import {defaultCarport,carportPortrait} from './carport';
import {defaultModule} from './domain';
import {tx} from './i18n';
import {MAX_FLAT_TABLE_ROWS} from './project-limits';
import {longRidgeAxis} from './roof-direction';
export type RegionForm='flat'|'single'|'gable'|'single-carport'|'double-carport';
export function initialRegionForm(region:RoofDesign,form:RegionForm):RoofDesign{
 const draft=form==='gable'?{...region,wallHeight:0,pitch:{...defaultPitch,kind:'gable' as const,eave:8,percent:10}}:region;
 return applyRegionForm(draft,form,{creating:true});
}

export function applyRegionForm(region:RoofDesign,form:RegionForm,{creating=false}:{creating?:boolean}={}):RoofDesign{
 if(region.roof.outline&&form!=='flat')throw new Error(tx('多段线轮廓仅支持平屋面'));
 if(form==='single-carport'||form==='double-carport')return {...region,pitch:undefined,carport:{...(region.carport??defaultCarport),double:form==='double-carport'},wallHeight:0,moduleSpec:{...(region.moduleSpec.kind==='lightweight'?defaultModule:region.moduleSpec),kind:'standard'},layoutOptions:{...region.layoutOptions,portrait:carportPortrait(region.roof),layoutArea:undefined,layoutAreaEnabled:undefined}};
 const pitch=region.pitch??defaultPitch;
 const newGable=form==='gable'&&(creating||region.pitch?.kind!=='gable');
 return {...region,layoutOptions:{...region.layoutOptions,tableRows:Math.min(form==='flat'?MAX_FLAT_TABLE_ROWS:6,region.layoutOptions.tableRows??1),...(form!=='flat'?{layoutArea:undefined,layoutAreaEnabled:undefined}:{})},carport:undefined,pitch:form==='flat'?undefined:{...pitch,kind:form,axis:newGable?longRidgeAxis(region.roof):pitch.axis},...(form==='gable'&&region.pitch?.kind!=='gable'?{wallHeight:0}:{})};
}
