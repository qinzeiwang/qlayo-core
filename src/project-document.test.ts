import {baseImageWorldOutline} from './base-image';
import {expect,it} from 'vitest';
import {defaultModuleCatalog} from './module-library';
import {blankDocument,documentFromWorkspace,workspaceFromDocument} from './project-document';
import {newRoof} from './roof-project';
import {parseWorkspace} from './workspace-file';
const library=()=>{const items=defaultModuleCatalog();return {items,defaultId:items[0].id};};
it('starts a blank project with one hidden roof that uses the default module',()=>{
 const lib=library(),d=blankDocument(lib);
 expect(d.roofs).toHaveLength(1);expect(d.activeId).toBe(d.roofs[0].id);expect(d.hasRegions).toBe(false);
 expect(d.roofs[0].moduleId).toBe(lib.defaultId);expect(d.roofs[0].moduleSpec).toEqual(lib.items[0].spec);
 expect(d.name).toBe('未命名项目');expect(d.solarHour).toBe(9);expect(d.moduleCatalog).toBe(lib.items);
});
it('opens a saved project with the same content',()=>{
 const d={...blankDocument(library()),name:'测试项目',hasRegions:true,globalEdge:.8,globalRidgeEdge:1.5,solarHour:13};
 const reopened=documentFromWorkspace(parseWorkspace(JSON.stringify(workspaceFromDocument(d))));
 expect(reopened).toEqual(d);
});
it('drops layout undo data when saving',()=>{
 const d=blankDocument(library()),r={...d.roofs[0],previous:[]};
 expect(workspaceFromDocument({...d,roofs:[r]}).roofs[0].previous).toBeNull();
});
it('fills in defaults for fields that older project files do not have',()=>{
 const r=newRoof();
 const d=documentFromWorkspace({version:3,name:'旧项目',roofs:[r],activeId:r.id,solarHour:11,backgroundColor:'#fff',groundColor:'#000'});
 expect(d).toMatchObject({address:'',hasRegions:true,globalEdge:.5,globalRidgeEdge:.5,imageOverlays:[]});
 expect(documentFromWorkspace({version:3,name:'旧项目',roofs:[r],activeId:r.id,solarHour:11,backgroundColor:'#fff',groundColor:'#000',globalEdge:.8}).globalRidgeEdge).toBe(.8);
 expect(()=>parseWorkspace(JSON.stringify({...workspaceFromDocument(blankDocument(library())),globalRidgeEdge:-1}))).toThrow();
 expect(d.moduleCatalog).toEqual(defaultModuleCatalog());
});
it('keeps the fields of add-ons that are not loaded, unchanged, when the project is saved again',()=>{
 const d=blankDocument(library()),file={...workspaceFromDocument(d),electrical:{groups:['g1']},photoMatches:[{roofId:'x'}]};
 const back=workspaceFromDocument(documentFromWorkspace(parseWorkspace(JSON.stringify(file))));
 expect(back).toMatchObject({electrical:{groups:['g1']},photoMatches:[{roofId:'x'}]});
});

it('persists an inset concave crop independently of source and calibration',()=>{
 const d=blankDocument(library());
 const crop=[{x:10,z:10},{x:90,z:10},{x:90,z:40},{x:50,z:40},{x:50,z:70},{x:10,z:70}];
 const base={name:'主底图',url:'data:image/png;base64,AA==',width:100,height:80,opacity:.4,visible:false,metersPerPixel:.05,northAngle:45,frame:{x:5,y:5,width:80,height:60},crop};
 const file=workspaceFromDocument({...d,baseImage:base});
 expect(parseWorkspace(JSON.stringify(file)).baseImage).toEqual(base);
 expect(baseImageWorldOutline(base)).toEqual(crop.map(p=>({x:(p.x-45)*.05,z:(p.z-35)*.05})));
 const crossed=[crop[0],crop[2],crop[1],crop[5]];
 expect(()=>parseWorkspace(JSON.stringify({...file,baseImage:{...base,crop:crossed}}))).toThrow('底图修剪轮廓无效');
});
