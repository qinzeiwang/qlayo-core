import {useSyncExternalStore} from 'react';
import {tx} from './i18n';
/** Where north points on screen, in degrees clockwise from up. The canvas writes it on every view change; only the compass re-renders. */
export type NorthStore={get:()=>number;set:(degrees:number)=>void;subscribe:(listener:()=>void)=>()=>void};
export function createNorthStore():NorthStore{
 let value=0;const listeners=new Set<()=>void>();
 return {get:()=>value,set:v=>{if(!Number.isFinite(v)||Math.abs(v-value)<.05)return;value=v;listeners.forEach(l=>l());},subscribe:l=>{listeners.add(l);return ()=>{listeners.delete(l);};}};
}
/** The small canvas compass: in 3D it turns with the view, so N always points to real north. */
export function CanvasCompass({store}:{store:NorthStore}){
 return <Compass small angle={useSyncExternalStore(store.subscribe,store.get)}/>;
}
export function Compass({angle=0,small}:{angle?:number;small?:boolean;onClick?:()=>void}){
 const rad=angle*Math.PI/180;
 // The canvas mark is only the arrow (owner): a thin white edge keeps it readable on dark drawings and panels.
 if(small)return <div className="north-compass small" role="img" aria-label={tx('北方向 {0} 度',angle.toFixed(1))}><svg viewBox="0 0 64 64" aria-hidden="true"><g transform={`rotate(${angle} 32 32)`} stroke="white" strokeWidth="2.5" strokeLinejoin="round" paintOrder="stroke"><path d="M32 10 21 52 32 43Z" fill="#d97706"/><path d="M32 10 43 52 32 43Z" fill="#9ca3af"/></g></svg></div>;
 return <div className={small?'north-compass small':'north-compass'} role="img" aria-label={tx('北方向 {0} 度',angle.toFixed(1))}><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="34" r="24" fill="white" fillOpacity=".88" stroke="rgba(20,21,24,0.12)"/><g transform={`rotate(${angle} 32 34)`}><path d="M32 16 24 43 32 38Z" fill="#d97706"/><path d="M32 16 40 43 32 38Z" fill="#9ca3af"/></g><text x={32+27*Math.sin(rad)} y={37-27*Math.cos(rad)} textAnchor="middle" fill="#141518" fontSize="13" fontWeight="700" fontFamily="Inter, Segoe UI, sans-serif">N</text></svg></div>;
}
