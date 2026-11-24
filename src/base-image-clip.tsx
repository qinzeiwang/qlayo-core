import {useId,type ReactNode} from 'react';
import type {BaseImage} from './base-image';

/** Applies the saved crop in source pixels before any drawing or export transform. */
export function BaseImageClip({crop,opacity,children}:{crop:BaseImage['crop'];opacity?:number;children:ReactNode}){
 const id=useId();
 if(!crop)return opacity===undefined?<>{children}</>:<g opacity={opacity}>{children}</g>;
 return <>
  <defs><clipPath id={id}><polygon points={crop.map(p=>`${p.x},${p.z}`).join(' ')}/></clipPath></defs>
  <g opacity={opacity} clipPath={`url(#${id})`}>{children}</g>
 </>;
}
