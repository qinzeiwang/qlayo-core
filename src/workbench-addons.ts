import type {ReactNode,SetStateAction} from 'react';
import type {ProjectDocument} from './project-document';
import type {ProjectExtras} from './project-extras';
import type {RoofDesign} from './roof-project';
/** What the workbench tells an add-on about the project and lets it do. */
export type AddonContext={
 /** The open project; `roofs` holds every roof, including the placeholder before the first region is drawn. */
 project:ProjectDocument;active:RoofDesign;running:boolean;
 setExtra:<K extends keyof ProjectExtras>(key:K,value:SetStateAction<ProjectExtras[K]>)=>void;
 /** Saves the project, with `changes` applied to the add-on fields first. */
 save:(changes?:Partial<ProjectExtras>)=>Promise<boolean>;
 /** A picture of the 3D view, when it is shown. */
 capture3D?:()=>string|undefined;
 /** Switches the canvas to the 3D view. */
 show3D:()=>void;
 close:()=>void;
};
/** A module that plugs into the workbench: an output on the Deliver step and/or a canvas tool, which open its panel. */
export type WorkbenchAddon={
 id:string;
 output?:{icon:string;title:string;note:(c:AddonContext)=>string;action:string;primary?:boolean;
  /** The project location must be set first. */
  needsLocation?:boolean};
 tool?:{icon:string;label:string;tooltip:(c:AddonContext)=>string;disabled:(c:AddonContext)=>boolean;
  /** Placed before the image overlay button instead of after it. */
  beforeOverlay?:boolean};
 /** The panel goes under the workbench dialogs (it is drawn before them) instead of over them. */
 early?:boolean;
 /** Other add-ons this one takes the place of (e.g. a fuller report replaces the capacity report). */
 replaces?:string[];
 /** Opens when a design arrives from the AI page. */
 openAfterAi?:boolean;
 panel?:(c:AddonContext)=>ReactNode;
 /** Sections added to the design parameters dialog. */
 settings?:(c:AddonContext)=>ReactNode;
};
const addons:WorkbenchAddon[]=[];
export function registerWorkbenchAddon(a:WorkbenchAddon){if(!addons.some(x=>x.id===a.id))addons.push(a);}
/** The AI design page (ai-design.html) belongs to pro: its entries on the start page and in the menu show only once pro turns them on. */
let aiDesign=false;
export function enableAiDesign(){aiDesign=true;}
export const aiDesignOn=()=>aiDesign;
export const workbenchAddons=():readonly WorkbenchAddon[]=>addons.filter(a=>!addons.some(b=>b.replaces?.includes(a.id)));
