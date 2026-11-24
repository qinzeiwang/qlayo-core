import {expect,it} from 'vitest';
import {defaultModuleCatalog} from './module-library';
import {blankDocument,documentFromWorkspace,workspaceFromDocument} from './project-document';
import './photo-project';
import {parseWorkspace} from './workspace-file';
const library=()=>{const items=defaultModuleCatalog();return {items,defaultId:items[0].id};};
it('starts a blank project with no photos and no site points',()=>{
 expect(blankDocument(library())).toMatchObject({photoViews:[],sitePoints:[]});
});
it('drops photo views of removed roofs when saving',()=>{
 const d=blankDocument(library()),r=d.roofs[0];
 const file=workspaceFromDocument({...d,photoViews:[{roofId:r.id} as never,{roofId:'gone'} as never]});
 expect(file.photoViews).toEqual([{roofId:r.id}]);
});
it('saves site points and point marks, and opens them again',()=>{
 const d=blankDocument(library()),roofId=d.roofs[0].id,url='data:image/png;base64,AAAA';
 const sites=[{id:'s1',name:'',x:1,z:2,h:2.8,source:'measured' as const}];
 const views=[{id:'v1',roofId,name:'p.png',url,width:100,height:80,roofSignature:'',method:'points' as const,marks:[{id:'site-s1',anchor:{kind:'site' as const,pointId:'s1'},at:{x:10,y:20},role:'fit' as const}]}];
 const back=documentFromWorkspace(parseWorkspace(JSON.stringify(workspaceFromDocument({...d,photoViews:views,sitePoints:sites}))));
 expect(back.sitePoints).toEqual(sites);expect(back.photoViews[0].method).toBe('points');expect(back.photoViews[0].marks[0].at).toEqual({x:10,y:20});
});
it('reads the one-photo-per-roof field of older files as photo views and drops it',()=>{
 const d=blankDocument(library()),{photoViews:_,...file}=workspaceFromDocument(d);
 const parsed=parseWorkspace(JSON.stringify({...file,photoMatches:[]}));
 expect(parsed.photoViews).toEqual([]);expect(parsed).not.toHaveProperty('photoMatches');
});
