import * as T from 'three';
import {panelCellColors,type PanelFinish} from './render-material-options';

// Procedural visual study, not a product-specific cell layout or a photo texture.
export function referenceCells(finish?:PanelFinish) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1536;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#666b70';
  ctx.fillRect(0, 0, 768, 1536);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const x = col * 128 + 1.8, y = row * 128 + 1.8;
      const tone = 34 + ((row * 7 + col * 3) % 4);
      const rgb=finish?panelCellColors[finish].map(v=>v+tone-35):[tone,tone+1,tone+2];
      ctx.fillStyle = `rgb(${rgb.join(',')})`;
      ctx.fillRect(x, y, 124.4, 124.4);
      // Fine fingers fade into the surface at aerial scale.
      ctx.strokeStyle = 'rgba(145,151,157,.18)';
      ctx.lineWidth = .65;
      for (let k = 1; k < 28; k++) {
        ctx.beginPath();ctx.moveTo(x, y + k * 4.44);ctx.lineTo(x + 124.4, y + k * 4.44);ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(172,177,182,.3)';
      ctx.lineWidth = .8;
      for (let k = 1; k <= 5; k++) {
        ctx.beginPath();ctx.moveTo(x + k * 20.7, y);ctx.lineTo(x + k * 20.7, y + 124.4);ctx.stroke();
      }
    }
  }
  if(finish){ctx.fillStyle=finish==='blue-grey'?'#97999b':'#555759';ctx.fillRect(0,1536*(.5-.003),768,1536*.006);}
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return map;
}

export function referenceGlass(map: T.Texture) {
  return new T.MeshPhysicalMaterial({
    map, color: '#d4d4d4', metalness: 0,
    roughness: .28, ior: 1.5, clearcoat: .45,
    clearcoatRoughness: .22, envMapIntensity: .55,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
}
