import {it,expect} from 'vitest';
import {applyEdit,cornerProblem,editOf,parsePhotoViews,parseSitePoints,usesHeightCalibration,viewsFromLegacy,type PhotoEdit,type PhotoView} from './photo-match';
import './photo-project';
import {newRoof} from './roof-project';
import {parseWorkspace} from './workspace-file';
const url='data:image/jpeg;base64,AAAA';
const m={roofId:'r',name:'a.jpg',url,width:100,height:100,corners:[{x:5,y:5},{x:95,y:5},{x:95,y:75},{x:5,y:75}],heightPoints:[],heightMeters:10,heightMode:'below' as const,anchor:0,roofSignature:'test'};
const view=(patch:Partial<PhotoView>={}):PhotoView=>({id:'v1',roofId:'r',name:'a.jpg',url,width:100,height:100,marks:[],roofSignature:'test',...patch});
const workspace=(extra:object)=>{const r=newRoof();return {r,text:JSON.stringify({version:3,name:'标注',roofs:[r],activeId:r.id,solarHour:9,backgroundColor:'#ffffff',groundColor:'#dddddd',...extra})};};
it('旧项目的单张照片标注校验并转换为照片视图',()=>{
 const [v]=viewsFromLegacy([m]);
 expect(v).toMatchObject({id:'photo-r',roofId:'r',name:'a.jpg',width:100,height:100,roofSignature:'test'});
 expect(editOf(v)).toMatchObject({corners:m.corners,heightPoints:[],heightCalibration:false});
 expect(v.marks.map(k=>k.anchor)).toEqual([0,1,2,3].map(index=>({kind:'corner',roofId:'r',index})));
 expect(editOf(viewsFromLegacy([{...m,corners:[]}])[0]).corners).toEqual([]);
 for(const item of [{...m,width:0},{...m,url:'https://example.com'},{...m,corners:[{x:-1,y:2}]},{...m,heightMeters:0}])expect(()=>viewsFromLegacy([item])).toThrow();
 expect(()=>viewsFromLegacy([m,m])).toThrow();
 expect(cornerProblem(m.corners)).toBe('');expect(cornerProblem([m.corners[0],m.corners[2],m.corners[1],m.corners[3]])).not.toBe('');
});
it('旧项目打开后照片在 photoViews 中，没有照片的项目保持为空',()=>{
 const empty=workspace({});expect(parseWorkspace(empty.text).photoViews).toBeUndefined();
 const {r,text}=workspace({photoMatches:[{...m,roofId:'R'}]});
 const p=parseWorkspace(text.replace('"R"',JSON.stringify(r.id)));
 expect(p.photoViews).toHaveLength(1);expect(p.photoViews![0].roofId).toBe(r.id);expect('photoMatches' in p).toBe(false);
});
it('高度校准开关保留标注并兼容旧项目',()=>{
 const legacy={...m,heightPoints:[{x:5,y:5},{x:5,y:95}]};
 expect(usesHeightCalibration(m)).toBe(false);
 expect(usesHeightCalibration(legacy)).toBe(true);
 for(const enabled of [false,true]){
  const restored=editOf(parseWorkspace(workspace({photoMatches:[{...legacy,heightCalibration:enabled}]}).text).photoViews![0]);
  expect(usesHeightCalibration(restored)).toBe(enabled);
  expect(restored.heightPoints).toEqual(legacy.heightPoints);
 }
 expect(()=>viewsFromLegacy([{...m,heightCalibration:'false'}])).toThrow();
});
it('实景品质天气和太阳设置随项目保存，拒绝无效参数',()=>{
 const renderOptions={quality:'fine' as const,weather:'overcast' as const,sun:{latitude:31.2,longitude:121.5,date:'2026-09-20',time:'11:00',utcOffset:8}};
 expect(parseWorkspace(workspace({photoViews:[view({renderOptions})]}).text).photoViews![0].renderOptions).toEqual(renderOptions);
 expect(()=>parsePhotoViews([view({renderOptions:{...renderOptions,quality:'ultra' as never}})])).toThrow();
 expect(()=>parsePhotoViews([view({renderOptions:{...renderOptions,sun:{...renderOptions.sun,latitude:100}}})])).toThrow();
});
it('前景遮挡区域可随项目保存，旧项目和非法坐标处理正确',()=>{
 const polygon=[{x:10,y:10},{x:80,y:10},{x:80,y:60},{x:10,y:60}];
 expect(parseWorkspace(workspace({photoViews:[view({occlusions:[polygon]})]}).text).photoViews![0].occlusions).toEqual([polygon]);
 expect(parsePhotoViews([view()])[0].occlusions).toBeUndefined();
 for(const occlusions of [[[polygon[0],polygon[1]]],[[...polygon,{x:101,y:2}]],'bad'])expect(()=>parsePhotoViews([view({occlusions:occlusions as never})])).toThrow();
});
it('同一屋面可保存多张不同角度的照片，各自标注互不影响',()=>{
 const a=applyEdit(view({id:'roof-shot'}),{...editOf(view()),corners:m.corners});
 const b=applyEdit(view({id:'ground-shot',name:'b.jpg'}),{...editOf(view()),corners:m.corners.slice(0,2)});
 const views=parseWorkspace(workspace({photoViews:[a,b]}).text).photoViews!;
 expect(views.map(v=>v.id)).toEqual(['roof-shot','ground-shot']);
 expect(views.map(v=>editOf(v).corners.length)).toEqual([4,2]);
 expect(()=>parsePhotoViews([a,{...b,id:'roof-shot'}])).toThrow();
 expect(()=>parsePhotoViews(Array.from({length:51},(_,i)=>view({id:`v${i}`})))).toThrow();
});
it('四角与高度线的编辑可以往返，其他标注保持不变',()=>{
 const check={id:'extra',anchor:{kind:'corner' as const,roofId:'other',index:2},at:{x:40,y:40},role:'check' as const};
 const forms:PhotoEdit[]=[
  {...editOf(view()),corners:m.corners,heightCalibration:true,heightMode:'below',anchor:2,heightMeters:12,heightPoints:[m.corners[2],{x:95,y:99}]},
  {...editOf(view()),corners:m.corners,heightCalibration:true,heightMode:'above',heightMeters:3,heightPoints:[{x:50,y:50},{x:50,y:30}]},
  {...editOf(view()),corners:m.corners,heightCalibration:true,heightMode:'above',heightMeters:3,heightPoints:[{x:50,y:50}]},
  {...editOf(view()),corners:m.corners.slice(0,3),heightCalibration:false,heightPoints:[]},
 ];
 for(const form of forms){
  const v=parsePhotoViews([applyEdit(view({marks:[check]}),form)])[0];
  expect(editOf(v)).toEqual(form);
  expect(v.marks.find(k=>k.id==='extra')).toEqual(check);
 }
 // Turning height calibration off keeps the clicked line as a check mark.
 const off=applyEdit(view(),{...forms[0],heightCalibration:false});
 expect(off.marks.find(k=>k.id==='height')).toMatchObject({role:'check',at:{x:95,y:99}});
});
it('现场测量点随项目保存，标注只能引用已有测量点',()=>{
 const sitePoints=[{id:'p1',name:'车位线角',x:3,z:-4,h:0,source:'measured' as const}];
 const v=view({marks:[{id:'s',anchor:{kind:'site',pointId:'p1'},at:{x:10,y:20},role:'fit'}]});
 const p=parseWorkspace(workspace({sitePoints,photoViews:[v]}).text);
 expect(p.sitePoints).toEqual(sitePoints);expect(p.photoViews![0].marks).toEqual(v.marks);
 expect(()=>parsePhotoViews([v])).toThrow();
 for(const bad of [[{...sitePoints[0],h:NaN}],[{...sitePoints[0],source:'guess'}],[sitePoints[0],sitePoints[0]],'bad'])expect(()=>parseSitePoints(bad)).toThrow();
 for(const anchor of [{kind:'corner',roofId:'r',index:-1},{kind:'corner',roofId:'r',index:0,drop:0},{kind:'rise',roofId:'r',meters:3,base:{x:101,y:0}},{kind:'roof'}])expect(()=>parsePhotoViews([view({marks:[{id:'k',anchor:anchor as never,role:'fit'}]})])).toThrow();
});
