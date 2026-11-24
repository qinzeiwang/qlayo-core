import {useEffect,useState} from 'react';
// The logged-in user from the Qlayo server. The Vite dev server has no login, so this stays null there.
export type Account={name:string;admin:boolean};
let pending:Promise<Account|null>|undefined;
export const loadAccount=()=>pending??=fetch('/api/auth/me').then(r=>r.ok&&r.headers.get('content-type')?.includes('json')?r.json():null).catch(()=>null);
export function useAccount(){const [account,setAccount]=useState<Account|null>(null);useEffect(()=>{let live=true;loadAccount().then(a=>{if(live)setAccount(a);});return()=>{live=false;};},[]);return account;}
export async function logout(beforeLeave?:()=>void|Promise<void>){
 try{await beforeLeave?.();}catch{}
 await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});
 location.replace('/login.html');
}
/** Where to go after login: only a page on this site, never back to the login page. */
export function safeNext(search:string){const next=new URLSearchParams(search).get('next')??'/';return next.startsWith('/')&&!next.startsWith('//')&&!next.startsWith('/\\')&&!next.startsWith('/login.html')?next:'/';}
