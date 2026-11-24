// "Qlayo" in the bottom-right corner of pictures made with the free version (photo match).
// The pro app turns it off at start (pro-main.tsx).
let on=true;
export function setPictureMark(show:boolean){on=show;}
export const pictureMarkOn=()=>on;
/** Draws the mark on a finished picture of size w × h. */
export function drawPictureMark(ctx:CanvasRenderingContext2D,w:number,h:number){
 if(!on)return;
 const size=Math.max(12,Math.round(Math.min(w,h)*.028)),pad=Math.round(size*.9);
 ctx.save();
 ctx.font=`700 ${size}px "Inter Variable", sans-serif`;ctx.textAlign='right';ctx.textBaseline='bottom';
 if('letterSpacing' in ctx)(ctx as CanvasRenderingContext2D&{letterSpacing:string}).letterSpacing=`${Math.round(size*.08)}px`;
 ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=size*.35;ctx.shadowOffsetY=size*.05;
 ctx.fillStyle='rgba(255,255,255,.82)';ctx.fillText('Qlayo',w-pad,h-pad);
 ctx.restore();
}
