import type {CSSProperties} from 'react';
import {canvasStyle,planElementColours} from './canvas-style';
import './canvas-overlay.css';
import {tx} from './i18n';

export function CanvasLegend(){
 const {annex,obstacle,keepout}=planElementColours;
 const colours={
  '--legend-annex-fill':annex.fill,'--legend-annex-edge':annex.edge,
  '--legend-obstacle-fill':obstacle.fill,'--legend-obstacle-edge':obstacle.edge,
  '--legend-keepout-fill':keepout.fill,'--legend-keepout-edge':keepout.edge,
  '--legend-column':canvasStyle.planColumnEdge,
  '--legend-ridge':canvasStyle.planRidge,
 } as CSSProperties;
 return <div className="canvas-bottom-legend" style={colours} aria-label={tx('图例')}>
   <span><i className="leg-dot leg-panel" aria-hidden="true"/>{tx('光伏组件')}</span>
   <span><i className="leg-dot leg-annex" aria-hidden="true"/>{tx('附属建筑')}</span>
   <span><i className="leg-dot leg-obstacle" aria-hidden="true"/>{tx('障碍物')}</span>
   <span><i className="leg-dot leg-keepout" aria-hidden="true"/>{tx('禁布区')}</span>
   <details className="canvas-legend">
    <summary>{tx('图例')}</summary>
    <ul>{legend.map(([name,swatch])=><li key={name}><i className={'swatch '+swatch} aria-hidden="true"/>{name}</li>)}</ul>
   </details>
  </div>;
}
const legend:[string,string][]=[
 [tx('屋面轮廓'),'roof'],[tx('当前屋面'),'selected'],[tx('屋脊 / 高边'),'ridge'],[tx('单排车棚立柱边'),'column'],[tx('光伏组件'),'module'],
 [tx('阴影避让区（女儿墙、障碍物的冬至阴影）'),'shadow'],[tx('附属建筑'),'annex'],[tx('障碍物'),'obstacle'],[tx('禁布区'),'keepout'],[tx('占地冲突'),'conflict'],
];
