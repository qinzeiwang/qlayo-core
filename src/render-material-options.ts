export type PanelFinish = 'blue-grey' | 'charcoal';
export type MetalRoofFinish = 'uniform' | 'varied';
// sRGB texture colours; the shared glass tint remains #d4d4d4.
export const panelCellColors: Record<PanelFinish, readonly [number, number, number]> = {
  'blue-grey': [51, 59, 75],
  charcoal: [47, 49, 51],
};
