import {PhotoMatchPanel} from './photo-match-panel';
import {registerWorkbenchAddon} from './workbench-addons';
import './photo-project';
import {tx} from './i18n';
/** Photo match on the canvas toolbar: pick roof corners on a site photo and show the 3D design in it. */
registerWorkbenchAddon({id:'photo',
 tool:{icon:'site-photo',label:tx('实景匹配'),beforeOverlay:true,
  tooltip:()=>tx('实景匹配'),
  disabled:({project,running})=>!project.hasRegions||running},
 panel:({project:p,active,setExtra,save,close})=><PhotoMatchPanel sunSettings={p.sunSettings} roofs={p.roofs} site={p.roofs} initialId={active.id} base={p.baseImage} overlays={p.imageOverlays} items={p.photoViews} sitePoints={p.sitePoints}
  onSave={(photoViews,sitePoints)=>save({photoViews,sitePoints})} onApply={(views,sites)=>{setExtra('sitePoints',sites);setExtra('photoViews',views);}} onClose={close}/>});
