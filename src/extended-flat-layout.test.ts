import {it,expect} from 'vitest';
import {Vector3} from 'three';
import {autoLayout,tableSpacing} from './auto-layout';
import {geometry,detect,DEFAULT_FRONT_HEIGHT,type PVArray} from './domain';
import {instanceData} from './realistic';
import {newRoof} from './roof-project';
import {parseWorkspace} from './workspace-file';
import {photoRoofArrays} from './photo-roof';
import {MAX_FLAT_TABLE_ROWS} from './project-limits';
const options={portrait:true,tilt:10,edge:.5,gap:1,maxColumns:12,wallHeight:0,shadowLatitude:31.23};
for(const tableRows of [5,6,8,12,20,36,MAX_FLAT_TABLE_ROWS])it(`places and reopens ${tableRows} connected rows at a raised front height`,()=>{
 const r=newRoof();r.roof={width:100,depth:Math.max(150,tableRows*2.5)};r.wallHeight=0;r.layoutOptions={...options,tableRows,frontHeight:1.5,alignment:'center'};
 const result=autoLayout(r.roof,[],r.layoutOptions);r.arrays=result.arrays;
 expect(result.arrays.some(a=>a.rows===tableRows)).toBe(true);expect(detect(result.arrays,[],r.roof)).toEqual([]);
 const a=result.arrays.find(a=>a.rows===tableRows)!,g=geometry(a),low=g.panels.at(-1)!.y-g.l/2*Math.sin(g.tilt);
 expect(low).toBeCloseTo(1.5,9);expect(a.frontHeight).toBe(1.5);
 const p={version:3,name:'加高多连排',roofs:[r],activeId:r.id,solarHour:9,backgroundColor:'#ffffff',groundColor:'#dddddd'};
 const loaded=parseWorkspace(JSON.stringify(parseWorkspace(JSON.stringify(p)))).roofs[0];
 expect(loaded.layoutOptions.tableRows).toBe(tableRows);expect(loaded.arrays).toEqual(result.arrays);expect(photoRoofArrays(loaded)[0].frontHeight).toBe(1.5);
});
it('extends supports upward while leaving foundation pads on the roof',()=>{
 const a:PVArray={id:'a',name:'a',x:0,z:0,rows:8,columns:4,connectedRows:true,tilt:10,azimuth:180,portrait:true,elevation:5,frontHeight:.45};
 const low=instanceData([a]),high=instanceData([{...a,frontHeight:2.45}]);
 const position=(m:import('three').Matrix4)=>new Vector3().setFromMatrixPosition(m);
 low.frames.forEach((v,i)=>expect(position(high.frames[i].matrix).y-position(v.matrix).y).toBeCloseTo(2,9));
 low.pads.forEach((v,i)=>expect(high.pads[i].matrix.elements).toEqual(v.matrix.elements));
 expect(high.channels.some((v,i)=>new Vector3().setFromMatrixColumn(v.matrix,1).length()>new Vector3().setFromMatrixColumn(low.channels[i].matrix,1).length()+1)).toBe(true);
 for(const height of [.2,.3,1.5,10]){
  const data=instanceData([{...a,frontHeight:height,tilt:0}]);
  for(const item of [...data.steel,...data.purlins,...data.rafters,...data.channels,...data.pads])expect(item.matrix.determinant()).toBeGreaterThan(0);
 }
});
it('keeps legacy rendering unchanged and uses one consistent height for new layouts',()=>{
 const r=newRoof(),legacy:PVArray={id:'old',name:'old',x:0,z:0,rows:4,columns:2,connectedRows:true,tilt:0,azimuth:180,portrait:true};
 expect(geometry(legacy).panels[0].y).toBe(.3);
 expect(new Vector3().setFromMatrixPosition(instanceData([legacy]).frames[0].matrix).y).toBeCloseTo(DEFAULT_FRONT_HEIGHT,9);
 const a=autoLayout(r.roof,[],{...options,tableRows:4}).arrays[0];
 expect(a.frontHeight).toBe(DEFAULT_FRONT_HEIGHT);expect(new Vector3().setFromMatrixPosition(instanceData([a]).frames[0].matrix).y).toBeCloseTo(geometry(a).panels[0].y,9);
 expect(tableSpacing({...options,tableRows:8,frontHeight:.45})).toEqual(tableSpacing({...options,tableRows:8,frontHeight:2}));
});
it('rejects invalid front heights and out of range rows',()=>{
 for(const frontHeight of [-1,0,.19,10.1,NaN,Infinity])expect(()=>autoLayout({width:100,depth:100},[],{...options,frontHeight})).toThrow('前沿高度');
 for(const tableRows of [0,MAX_FLAT_TABLE_ROWS+1,4.5])expect(()=>autoLayout({width:100,depth:100},[],{...options,tableRows})).toThrow('连排');
 const r=newRoof();r.layoutOptions.frontHeight=-1;
 expect(()=>parseWorkspace(JSON.stringify({version:3,name:'invalid',roofs:[r],activeId:r.id,solarHour:9,backgroundColor:'#ffffff',groundColor:'#dddddd'}))).toThrow('前沿高度');
});
