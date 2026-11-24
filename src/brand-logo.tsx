import './brand.css';
import logo from './assets/qlayo-logo.svg';
import mark from './assets/qlayo-mark.svg';
let proEdition=false;
/** The pro app calls this before it renders, so every logo carries the PRO tag; the free app never does. */
export function markProEdition(){proEdition=true;}
export function BrandLogo({pro=proEdition}:{pro?:boolean}){
 return <span className="qlayo-brand" role="img" aria-label={pro?'Qlayo Pro · 速构':'Qlayo · 速构'}><img className="qlayo-logo" src={logo} alt="" draggable={false}/><span className="qlayo-chinese" aria-hidden="true">速构</span>{pro&&<span className="qlayo-pro" aria-hidden="true">PRO</span>}</span>;
}
export function BrandMark(){return <img className="qlayo-mark" src={mark} alt="Qlayo" draggable={false}/>;}
