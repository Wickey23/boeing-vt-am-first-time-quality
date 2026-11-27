/** Pure rendering adapter for offline research frames, never a solver.
 * A fixed temperature range across every frame avoids misleading auto-rescaling.
 * Empty cells and not-yet-active layers remain null, not ambient-temperature material.
 */
import type {PartialLayerResult} from "./lpbf-partial-layer";
import type {PhysicalSliceResult} from "./lpbf-physical-slicer";
export function prepareLayerTemperatureView(result:PartialLayerResult,slice:PhysicalSliceResult){
 if(result.partSha256!==slice.partSha256||result.grid.layers!==slice.grid.physicalLayers||
    result.grid.pitchMm!==slice.grid.xyPitchMm||result.grid.layerHeightMm!==slice.grid.layerThicknessMm)
  throw Error("Thermal field and geometry registration do not match.");
 const frames=result.frames;
 if(!frames?.length)throw Error("Run the bounded research experiment with frame capture enabled.");
 const {columns,rows,originMm,xyPitchMm}=slice.grid;
 let min=Infinity,max=-Infinity;
 for(const f of frames)for(const c of f.cells){
  if(!Number.isFinite(c.temperatureC))throw Error("Invalid captured temperature.");
  min=Math.min(min,c.temperatureC);max=Math.max(max,c.temperatureC);
 }
 if(!Number.isFinite(min)||!Number.isFinite(max))throw Error("No captured active-cell temperatures.");
 function layerFrame(frameIndex:number,layerIndex:number){
  if(!Number.isInteger(frameIndex)||frameIndex<0||frameIndex>=frames!.length||
     !Number.isInteger(layerIndex)||layerIndex<0||layerIndex>=slice.layers.length)
   throw Error("Invalid captured frame or physical layer index.");
  const frame=frames![frameIndex],layer=slice.layers[layerIndex];
  const values:Array<number|null>=Array(columns*rows).fill(null);
  for(const c of frame.cells)if(c.layer===layerIndex){
   if(c.x<0||c.x>=columns||c.y<0||c.y>=rows||!Number.isInteger(c.x)||!Number.isInteger(c.y))throw Error("Captured cell outside registered layer.");
   values[c.y*columns+c.x]=c.temperatureC;
  }
  return {commandIndex:frame.commandIndex,timeSeconds:frame.timeSeconds,layer:layerIndex,
   sampleZMm:layer.sampleZMm,originMm:{x:originMm.x,y:originMm.y},pitchMm:xyPitchMm,columns,rows,
   values,active:layerIndex<=frame.layer,colorRangeC:{min,max}};
 }
 return {frameCount:frames.length,layerCount:slice.layers.length,colorRangeC:{min,max},layerFrame,
  scope:"UNVALIDATED_RESEARCH_TEMPERATURE_VIEW" as const};
}
