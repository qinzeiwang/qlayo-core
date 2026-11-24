import {useLayoutEffect} from 'react';
import {useThree} from '@react-three/fiber';
import type {Scene} from 'three';
export function sceneReady(scene:Scene){let object=scene.getObjectByName('pvlane-realistic-ready');if(!object)return false;while(object){if(!object.visible)return false;object=object.parent??undefined;}return true;}
export function SceneReady({onReady}:{onReady?:(ready:boolean)=>void}){const {invalidate,gl}=useThree();useLayoutEffect(()=>{gl.shadowMap.needsUpdate=true;invalidate();onReady?.(true);return()=>onReady?.(false);},[invalidate,gl,onReady]);return onReady?null:<group name="pvlane-realistic-ready"/>;}
