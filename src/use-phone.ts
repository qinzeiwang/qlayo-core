import {useSyncExternalStore} from 'react';
/** Phone-sized screen. Qlayo is view-only there (owner decision 2026-10-08): editing needs a tablet or computer. Same breakpoint as the CSS. */
export const phoneQuery='(max-width: 700px)';
function subscribe(listener:()=>void){const m=matchMedia(phoneQuery);m.addEventListener('change',listener);return ()=>m.removeEventListener('change',listener);}
export function usePhone(){return useSyncExternalStore(subscribe,()=>matchMedia(phoneQuery).matches,()=>false);}
