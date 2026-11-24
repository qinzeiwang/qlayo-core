/** Canvas appearance from the approved independent UI study (07/08).
 * Rendering only: does not change engineering coordinates, geometry, or selection.
 */
export const canvasStyle={
 minorGrid:'#cbd0d6',majorGrid:'#bdc4cc',roof:'#f9faf9',
 planRoof:'#f9fafb',planObject:'#e5eaf0',planEdge:'#aeb8c5',
 planColumnEdge:'#776783',
 planRidge:'#929ba6',
 planObjectSelectedEdge:'#246763',planObjectSelectedFill:'#32948a',
} as const;
export const planElementColours={
 annex:{fill:canvasStyle.planObject,edge:canvasStyle.planEdge},
 obstacle:{fill:'#d9cddd',edge:'#9984a3'},
 keepout:{fill:'#c9bda5',edge:'#a79b84'},
} as const;
