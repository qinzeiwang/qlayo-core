import {parsePhotoViews,parseSitePoints,viewsFromLegacy,type PhotoView,type SitePoint} from './photo-match';
import {registerProjectExtension} from './project-extras';
declare module './project-extras' {
 interface ProjectExtras{
  /** Site photos (any number per roof) and the measured points they can refer to. */
  photoViews:PhotoView[];sitePoints:SitePoint[];
 }
}
/** Project file fields of photo match. Site points come before photo views, which refer to them; both belong to the base drawing. */
registerProjectExtension({key:'sitePoints',blank:()=>[],clearWithBase:true,read:raw=>raw===undefined?undefined:parseSitePoints(raw),open:v=>v??[]});
// Older files kept one photo per roof as photoMatches.
registerProjectExtension({key:'photoViews',blank:()=>[],clearWithBase:true,legacy:['photoMatches'],
 read:(raw,file)=>raw!==undefined?parsePhotoViews(raw,file.sitePoints as SitePoint[]|undefined):file.photoMatches!==undefined?viewsFromLegacy(file.photoMatches):undefined,
 open:v=>v??[],save:(v,roofIds)=>(v as PhotoView[]).filter(p=>roofIds.includes(p.roofId))});
