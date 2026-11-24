import {coreEdition,language,setLanguage,type Language} from './i18n';
const names:Record<Language,string>={zh:'中文',en:'English'};
/** 中文 / English. Each name is written in its own language so anyone can find it. Switching reloads the page. */
export function LanguageSwitch({beforeReload}:{beforeReload?:()=>unknown}){
 if(coreEdition)return null;
 return <div className="language-switch" role="group" aria-label="语言 / Language">
  {(['zh','en'] as const).map(l=><button key={l} type="button" lang={l==='zh'?'zh-CN':'en'} aria-pressed={language===l} onClick={()=>void setLanguage(l,beforeReload)}>{names[l]}</button>)}
 </div>;
}
/** The other language's name, for a one-click menu item. */
export const otherLanguage:Language=language==='zh'?'en':'zh';
export const otherLanguageName=names[otherLanguage];
