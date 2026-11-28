import {validOutline} from './polygon';
import {layoutAreaProblem} from './layout-area';
import {rescaleGableSpans} from './pitched-roof';
import {validRoofSize} from './roof-limits';
import {type Rect,overlaps} from './domain';
import {type RoofDesign,roofRect,toLocal,toWorld} from './roof-project';
import {containsRect} from './drawing-geometry';
import {tx} from './i18n';
export function reshapeRegion(roofs:RoofDesign[],id:string,rect:Rect){
 const old=roofs.find(r=>r.id===id);if(!old)throw new Error(tx('区域不存在'));
 if(!validOutline(rect)||rect.outline&&(old.carport||(old.pitch&&old.pitch.kind!=='gable')))throw new Error(tx('多段线轮廓无效或当前屋面类型不支持多边形'));
 if(!validRoofSize(rect))throw new Error(tx('区域边长需在 2–500m 之间'));
 if(roofs.some(r=>r.id!==id&&overlaps(roofRect(r),rect)))throw new Error(tx('与其他区域重叠'));
 const pitch=old.pitch?.spans?{...old.pitch,spans:rescaleGableSpans(old.pitch.spans,old.pitch.axis==='x'?old.roof.width:old.roof.depth,old.pitch.axis==='x'?rect.width:rect.depth)}:old.pitch;
 const next={...old,pitch,x:rect.x,z:rect.z,yaw:rect.yaw,roof:{width:rect.width,depth:rect.depth,outline:rect.outline},layoutSignature:'',layoutMessage:tx('轮廓已修改，待更新布置')};
 if(old.layoutOptions.layoutArea){next.layoutOptions={...old.layoutOptions,layoutArea:old.layoutOptions.layoutArea.map(p=>toLocal(toWorld(p,old),next))};if(layoutAreaProblem(next.layoutOptions,next.roof))throw new Error(tx('新屋面未包含原限定布置区域，请先调整或清除布置区域'));}
 next.obstacles=old.obstacles.map(o=>({...o,...toLocal(toWorld(o,old),next),yaw:o.yaw+old.yaw-next.yaw}));
 if(next.obstacles.some(o=>!containsRect({x:0,z:0,yaw:0,...next.roof},o)))throw new Error(tx('新轮廓未包含原有障碍物或禁布区，请先调整它们'));
 next.arrays=rect.outline||old.roof.outline?[]:old.arrays.map(a=>({...a,...toLocal(toWorld(a,old),next),azimuth:a.azimuth+(next.yaw-old.yaw)*180/Math.PI}));
 next.previous=null;
 return roofs.map(r=>r.id===id?next:r);
}
