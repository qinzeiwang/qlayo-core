import {DataTexture,RGBAFormat,UnsignedByteType,LinearFilter,LinearMipmapLinearFilter,RepeatWrapping} from 'three';
// Low-amplitude, broad variation affects reflections only, never the cell albedo.
export function photoGlassRoughness(){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const value=Math.round(211+9*Math.sin(x/size*Math.PI*2)*Math.cos(y/size*Math.PI*2)+5*Math.sin((x+y)/size*Math.PI*4));
  const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
 }
 const map=new DataTexture(data,size,size,RGBAFormat,UnsignedByteType);
 map.wrapS=map.wrapT=RepeatWrapping;map.magFilter=LinearFilter;map.minFilter=LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
 return map;
}
