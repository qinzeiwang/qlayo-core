/** The 35 mm-equivalent focal length a phone or camera wrote into a JPEG (EXIF tag 0xA405). Screenshots and chat copies usually drop it. */
export function exifLens35(bytes:Uint8Array):number|undefined{
 try{
  if(bytes[0]!==0xff||bytes[1]!==0xd8)return;
  for(let i=2;i+9<bytes.length;){
   if(bytes[i]!==0xff)return;
   const marker=bytes[i+1],length=bytes[i+2]<<8|bytes[i+3];
   if(marker===0xda||marker===0xd9)return;
   if(marker===0xe1&&String.fromCharCode(...bytes.subarray(i+4,i+8))==='Exif')return tiffLens35(bytes.subarray(i+10,i+2+length));
   i+=2+length;
  }
 }catch{/* truncated or malformed EXIF: no lens */}
}
function tiffLens35(b:Uint8Array){
 const view=new DataView(b.buffer,b.byteOffset,b.byteLength),little=b[0]===0x49;
 const u16=(o:number)=>view.getUint16(o,little),u32=(o:number)=>view.getUint32(o,little);
 const entry=(ifd:number,tag:number)=>{const n=u16(ifd);for(let k=0;k<n;k++){const e=ifd+2+k*12;if(u16(e)===tag)return e;}};
 const exif=entry(u32(4),0x8769);if(exif===undefined)return;
 const lens=entry(u32(exif+8),0xa405);if(lens===undefined)return;
 const value=u16(lens+8);return value>=8&&value<=800?value:undefined;
}
/** Bytes of a base64 data URL. */
export function dataUrlBytes(url:string){
 const text=atob(url.slice(url.indexOf(',')+1)),bytes=new Uint8Array(text.length);
 for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
 return bytes;
}
