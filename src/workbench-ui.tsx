import {IconCrop,IconRectangle,IconLogout,IconUser,IconMinus,IconArrowForwardUp,IconCheck,IconHome,IconMap,IconDots,IconChartBar,IconAdjustmentsHorizontal,IconPointer,IconArrowLeft,IconTrash,IconPlus,IconFolderOpen,IconDeviceFloppy,IconFileText,IconBox,IconLayoutGrid,IconAngle,IconArrowsHorizontal,IconLayoutGridAdd,IconSun,IconStack2,IconX,IconChevronDown,IconArrowBackUp,IconMaximize,IconInfoCircle,IconMenu2,IconHandMove,IconZoomIn,IconZoomOut,IconAlertTriangle,IconCopy} from '@tabler/icons-react';
import type { CSSProperties } from 'react';
import {IconRefresh,IconRuler2,IconPolygon,IconEraser,IconRotateRectangle,IconArrowBarDown,IconNavigation,IconCamera,IconPhotoPlus,IconPhotoOff,IconArrowRight,IconEye,IconEyeOff,IconWalk,IconPencil,IconSparkles,IconLanguage,IconBolt,IconMapPinPlus,IconLadder,IconShovel,IconServerBolt,IconArrowsMove} from '@tabler/icons-react';
const roofPaths:Record<string,string>={
 // A landscape photo, a folded plan, and a camera for capturing the canvas.
 'site-photo':'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2V6a2 2 0 0 1 2 -2z M3 16l5 -5 4 4 3 -3 6 6 M16.5 8.5h.01',
 'underlay-plan':'M5 4h11l5 5v9a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2V6a2 2 0 0 1 2 -2z M16 4v5h5 M7 8v8h8v-4h-4V8z',
 'capture-layout':'M5 7h3l2 -3h4l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2V9a2 2 0 0 1 2 -2z M15.5 13.5a3.5 3.5 0 1 1 -7 0a3.5 3.5 0 0 1 7 0z',
 'download':'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4',
 'measure-area':'M7 6l8.5 -1 M17.5 6.5l1 9 M17.5 17.5l-11 1 M5 17l1 -9.5 M10 14l4 -4 M7.5 6a1.5 1.5 0 1 1 -3 0a1.5 1.5 0 1 1 3 0 M18.5 5a1.5 1.5 0 1 1 -3 0a1.5 1.5 0 1 1 3 0 M20.5 17a1.5 1.5 0 1 1 -3 0a1.5 1.5 0 1 1 3 0 M6.5 18.5a1.5 1.5 0 1 1 -3 0a1.5 1.5 0 1 1 3 0',
 // Concave orthogonal footprint: a rectangle with its upper-right corner removed.
 'l-polygon':'M4 4h8v8h8v8H4z',
 // Drawn on Tabler's grid: 24px box, art within 3-21, 1.75px stroke, round joins, 2px corner radius.
 // Roof types share one building body; only the roof line changes.
 // Align: two blocks of different length lined up on one dashed edge.
 'align':'M4 3v2 M4 8v2 M4 13v2 M4 18v2 M7 6h9a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-9z M7 14h13a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-13z',
 // Any roof area: the shared building with panels on top.
 'roof':'M3 9h18 M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10 M6 6.5l4 -2.5 M14 6.5l4 -2.5 M10 21v-4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4',
 'flat-roof':'M3 8h18 M5 8v12h14V8 M3 5h18',
 'single-roof':'M3 10l18 -5 M5 9.5v10.5h14V5.5',
 'gable-roof':'M3 11l9 -7l9 7 M5 10v10h14V10',
 'multi-gable-roof':'M2 12l5 -5l5 5l5 -5l5 5 M4 11v9h16v-9',
 'obstacle-building':'M4 20h16 M6 20V5h12v15 M6 10l5 -5 M6 16l11 -11 M10 20l8 -8',
 'level-view':'M4.5 9.5a1.5 1.5 0 0 1 1.5 -1.5h8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1 -1.5 1.5h-8a1.5 1.5 0 0 1 -1.5 -1.5z M10 4a8 8 0 0 1 9.5 7.8 M17.2 9.5l2.3 2.5l2.2 -2.6',
 'horizon-pick':'M3 18h18 M6 13l12 -7 M6 13a1.2 1.2 0 1 0 0 .01 M18 6a1.2 1.2 0 1 0 0 .01',
 'cut-roof':'M4 5h16v14H4z M12 3v18 M8.5 9.5l-2 2.5l2 2.5 M15.5 9.5l2 2.5l-2 2.5',
 // Top views of the roof; arrows point down the slope.
 'ridge-direction':'M4 5.5a1.5 1.5 0 0 1 1.5 -1.5h13a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1 -1.5 1.5h-13a1.5 1.5 0 0 1 -1.5 -1.5z M4 12h16 M10 9l2 -2l2 2 M10 15l2 2l2 -2',
 'slope-direction':'M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z M12 8v8 M9 13l3 3l3 -3',
 // Carports as in the model: PV canopy on its posts; a single carport's posts stand on the low edge, the open front is high.
 'carport':'M3 6l18 5 M3 9l18 5 M17 13v8 M12 21h9',
 'single-carport':'M3 6l18 5 M3 9l18 5 M17 13v8 M12 21h9',
 'carport-straight':'M3 6l18 4 M16 9v12 M11 8l5 5 M3 21h18',
 'carport-curved':'M3 6l18 4 M19 21v-4c0 -5 -3 -8.5 -9 -9.5 M3 21h18',
 'double-carport':'M3 6l9 4l9 -4 M3 9l9 4l9 -4 M12 13v8 M7 21h10',
 // Solar module: framed panel with cell lines on a short stand (Tabler's panel reads as a globe at 20 px).
 'module':'M4 4h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M3 9.5h18 M9 4v11 M15 4v11 M12 15v5 M8 20h8',
 // Batch layout across all regions: layered PV array frames.
 'layout-all':'M4 4h11a1 1 0 0 1 1 1v7a1 1 0 0 1 -1 1H4a1 1 0 0 1 -1 -1V5a1 1 0 0 1 1 -1z M3 8.5h13 M9.5 4v9 M19 9h1a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1H9a1 1 0 0 1 -1 -1v-2',
 // Module front-edge clearance height: roof line, tilted module, vertical measure under front edge.
 'front-height':'M3 20h18 M9.5 11l11.5 -6 M6 11v9 M4 13.5l2 -2.5l2 2.5 M4 17.5l2 2.5l2 -2.5',
 // Keep-out area: hatched square.
 'forbidden':'M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z M4 12l8 -8 M5 19l14 -14 M12 20l8 -8',
 // Layout drawing: sheet with a plan and a title block.
 'drawing':'M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z M14 20v-5h7 M7 9a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1z',
 'building':'M4 20h16 M6 20V8h12v12 M9 4h6v4H9z',
 'height':'M7 4h10 M7 20h10 M12 7v10 M9.5 9.5l2.5 -2.5l2.5 2.5 M9.5 14.5l2.5 2.5l2.5 -2.5',
 'wall':'M4 20V5h4v11h12v4H4 M13 5h7 M17 5v7 M15 10l2 2l2 -2',
 'slope':'M4 18h16 M4 18l14 -12 M10 18a6 6 0 0 0 -1.4 -3.8',
 'printer':'M6 8V3h12v5 M6 17H3V8h18v9h-3 M6 14h12v7H6z M17 11h1',
 'layout-alignment':'M3 5h18v14H3z M8 9h8v6H8z M12 3v3 M12 18v3',
 'layout-connected-rows':'M4 4h16v5H4z M4 15h16v5H4z M7 9v6 M17 9v6',
 'layout-row-cap':'M3.5 7.5h5v9h-5z M11 7.5h5v9h-5z M20 5v14',
 'layout-perimeter':'M3 3h18v18H3z M8 8h8v8H8z',
 'layout-ridge':'M3 5h18v14H3z M3 12h18 M12 8v2 M12 14v2',
 'layout-limit':'M4 8V4h4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M8 8h8v8H8z',
 'gap-x':'M4 5v14 M20 5v14 M8 12h8 M10 10l-2 2 2 2 M14 10l2 2-2 2',
 'gap-y':'M4 3.5h16v3.5H4z M4 17h16v3.5H4z M12 9.5v5 M10 11l2 -1.5l2 1.5 M10 13l2 1.5l2 -1.5',
 'width-dim':'M4 7v10 M20 7v10 M6 12h12 M9 9l-3 3l3 3 M15 9l3 3l-3 3',
 'depth-dim':'M7 4h10 M7 20h10 M12 6v12 M9 9l3 -3l3 3 M9 15l3 3l3 -3',
 'region-add':'M4 20V5h13v7 M4 10h13 M8 7.5h1 M12 7.5h1 M8 14h1 M8 17h1 M4 20h8 M18 14v7 M14.5 17.5h7',
 'annex':'M5 9l7 -4l7 4l-7 4z M5 9v9l7 4l7 -4V9 M12 13v9',
 'annex-add':'M3 9l7 -4l7 4l-7 4z M3 9v9l7 4v-9 M10 22l3 -1.7 M17 9v3 M18 14v7 M14.5 17.5h7',
 'obstacle-obj':'M6 7c0 -2 12 -2 12 0s-12 2 -12 0 M6 7v11c0 2 12 2 12 0V7',
 'obstacle-add':'M4 7c0 -2 12 -2 12 0s-12 2 -12 0 M4 7v11c0 2 7 2 9 1 M16 7v5 M18 14v7 M14.5 17.5h7',
 'keepout-obj':'M5.5 5h13v15H5.5z M5.5 11l6 -6 M5.5 17l12 -12 M8.5 20l10 -10 M14.5 20l4 -4',
 'keepout-add':'M4 5h13v7 M4 5v15h8 M4 11l6 -6 M4 17l12 -12 M7 20l6 -6 M18 14v7 M14.5 17.5h7',
 'count':'M9 4l-3 16 M17 4l-3 16 M4 9h16 M3 15h16',
 'chevron-left':'M15 6l-6 6 6 6',
 'chevron-right':'M9 6l6 6-6 6',
 'play':'M7 5v14l11-7z',
};
const icons:Record<string,typeof IconHome>={crop:IconCrop,home:IconHome,rectangle:IconRectangle,copy:IconCopy,ruler:IconRuler2,polygon:IconPolygon,eraser:IconEraser,electrical:IconBolt,'panel-orientation':IconRotateRectangle,'start-edge':IconArrowBarDown,'module-direction':IconNavigation,language:IconLanguage,logout:IconLogout,user:IconUser,ai:IconSparkles,minus:IconMinus,camera:IconCamera,image:IconPhotoPlus,eye:IconEye,walk:IconWalk,'eye-off':IconEyeOff,redo:IconArrowForwardUp,check:IconCheck,site:IconMap,more:IconDots,chart:IconChartBar,settings:IconAdjustmentsHorizontal,pointer:IconPointer,back:IconArrowLeft,trash:IconTrash,plus:IconPlus,folder:IconFolderOpen,save:IconDeviceFloppy,file:IconFileText,box:IconBox,grid:IconLayoutGrid,angle:IconAngle,spacing:IconArrowsHorizontal,layout:IconLayoutGridAdd,sun:IconSun,layers:IconStack2,close:IconX,chevron:IconChevronDown,reset:IconArrowBackUp,refresh:IconRefresh,frame:IconMaximize,info:IconInfoCircle,menu:IconMenu2,pan:IconHandMove,'zoom-in':IconZoomIn,'zoom-out':IconZoomOut,alert:IconAlertTriangle,'no-image':IconPhotoOff,next:IconArrowRight,'place-pin':IconMapPinPlus,tray:IconLadder,duct:IconShovel,cabinet:IconServerBolt,move:IconArrowsMove};
export const iconNames=()=>[...new Set(['edit','region-draw',...Object.keys(icons),...Object.keys(roofPaths)])];
export function Icon({name,style}:{name:string;style?:CSSProperties}){
 // Area creation: three corner handles and a plus at the fourth corner, on Tabler's grid.
 if(name==='region-draw')return <svg className="ui-icon" data-icon={name} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M5.5 4h12 M19 5.5V10 M12 17H5.5 M4 15.5v-10"/>
  <rect x="2.5" y="2.5" width="3" height="3" rx=".5"/>
  <rect x="17.5" y="2.5" width="3" height="3" rx=".5"/>
  <rect x="2.5" y="15.5" width="3" height="3" rx=".5"/>
  <path d="M18 14v7 M14.5 17.5h7"/>
 </svg>;
 const Component=name==='edit'?IconPencil:roofPaths[name]?undefined:icons[name];
 return Component?<Component className="ui-icon" data-icon={name} style={style} size={24} stroke={1.75} aria-hidden="true"/>:<svg className="ui-icon" data-icon={name} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={roofPaths[name]??roofPaths['flat-roof']}/></svg>;
}
