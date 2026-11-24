import {en} from './i18n-en';
// UI language. Chinese text in the code is the key (wrapped in `tx`); `en` holds the English. Text without an entry stays Chinese.
// Changing language saves (the caller flushes autosave) and reloads the page, so text built at module load is right too.
// Customer documents (proposal, drawing sheets) and AI prompts stay Chinese for now.
export type Language='zh'|'en';
const english:Record<string,string>={...en};
/** Adds English for text of modules loaded on top of the core (pro); call before their text is shown. */
export function addEnglish(more:Record<string,string>){Object.assign(english,more);}
const storageKey='pvlane.language';
function read():Language{try{return localStorage.getItem(storageKey)==='en'?'en':'zh';}catch{return 'zh';}}
export const coreEdition=typeof document!=='undefined'&&document.documentElement.dataset.edition==='core';
export const language:Language=coreEdition||typeof localStorage==='undefined'?'zh':read();
if(typeof document!=='undefined')document.documentElement.lang=language==='en'?'en':'zh-CN';
/** Translate one piece of UI text. `{0}`, `{1}`… in the text are filled with `args` in both languages. */
export function tx(text:string,...args:unknown[]):string{
 const out=language==='en'?english[text]??text:text;
 return args.length?out.replace(/\{(\d+)\}/g,(m,i)=>i<args.length?String(args[Number(i)]):m):out;
}
/** For status messages checked by their start: true when `message` starts with the fixed part (before any {0}) of key `text`, in either language. */
export function startsWithText(message:string,text:string){const head=(s:string)=>s.split('{')[0];return message.startsWith(head(text))||message.startsWith(head(english[text]??text));}
export async function setLanguage(next:Language,beforeReload?:()=>unknown){
 if(next===language)return;
 try{localStorage.setItem(storageKey,next);}catch{return;}
 try{sessionStorage.setItem(switchKey,'1');}catch{/* no cover then */}
 const cover=document.createElement('div');cover.id='pv-switch-cover';cover.style.opacity='0';document.body.appendChild(cover);
 requestAnimationFrame(()=>requestAnimationFrame(()=>{cover.style.opacity='1';}));
 try{await Promise.all([Promise.race([beforeReload?.(),new Promise(r=>setTimeout(r,1500))]),new Promise(r=>setTimeout(r,260))]);}catch{/* reload anyway; the save error was shown already */}
 location.reload();
}
// The reload passes through a blank page, the start page, the loading canvas and an empty plan. A plain cover (index.html) hides all of
// that and fades out once the project is drawn: the canvas is up, nothing is still loading, and the drawing had a moment to appear.
const switchKey='pvlane.switching';
function revealAfterSwitch(){
 const cover=document.getElementById('pv-switch-cover');if(!cover)return;
 try{sessionStorage.removeItem(switchKey);}catch{/* cover still goes */}
 const start=Date.now();let readySince=0;
 const tick=()=>{
  const restoring=document.querySelector('.project-start [role=status]'),ready=!restoring&&!document.querySelector('.loading')&&(!!document.querySelector('canvas')||!!document.querySelector('.project-start'));
  readySince=ready?readySince||Date.now():0;
  if(readySince&&Date.now()-readySince>(document.querySelector('canvas')?700:100)||Date.now()-start>6000){cover.style.opacity='0';setTimeout(()=>cover.remove(),300);return;}
  setTimeout(tick,100);
 };
 tick();
}
if(typeof document!=='undefined')revealAfterSwitch();
