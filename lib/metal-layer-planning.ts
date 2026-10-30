/**
 * Conceptual metal PBF layer-line/hatch screening and build-time SCENARIO.
 *
 * No machine toolpath is emitted. Raster sampled occupancy and sampled grid
 * perimeters form low-fidelity proxies, NOT actual physical CAD contours.
 * Hatch lines are for visualization of coverage geometry only.
 */
import type {PhysicalSliceResult,PhysicalSliceLayer} from "./lpbf-physical-slicer";
export const METAL_LAYER_PLAN_VERSION="orientai-geometry-time-screen-v0.1";
export type LayerPlanAssumptions={
 hatchSpacingMm:number;hatchSpeedMmS:number;contourSpeedMmS:number;
 secondsPerRecoat:number;setupSeconds:number;cooldownSeconds:number;
};
export type HatchLine={x0Mm:number;y0Mm:number;x1Mm:number;y1Mm:number};
export type GeometryTimeLayer={layer:number;areaMm2:number;sampledEdgeLengthMm:number;
 estimatedHatchLengthMm:number;estimatedHatchSeconds:number;
 estimatedContourSeconds:number;recoatSeconds:number;estimatedLayerSeconds:number};
export type GeometryTimeScenario={
 version:typeof METAL_LAYER_PLAN_VERSION;
 partSha256:string;type:"UNVALIDATED_GEOMETRY_ONLY_SCENARIO";
 totalSeconds:number;laserTravelProxySeconds:number;recoatSeconds:number;
 overheadSeconds:number;
 sampleVolumeDeviationFraction:number;
 layerDetails:GeometryTimeLayer[];
 warnings:string[];
};
const valid=(n:number,min:number,max:number,label:string)=>{
 if(!Number.isFinite(n)||n<min||n>max)throw Error(label+" is outside planning bounds.");
};
export function estimateLayerBuildTime(slices:PhysicalSliceResult,assumptions:LayerPlanAssumptions):GeometryTimeScenario{
 const {hatchSpacingMm:h,hatchSpeedMmS:v,contourSpeedMmS:vc,
  secondsPerRecoat:recoat,setupSeconds:setup,cooldownSeconds:cool}=assumptions;
 valid(h,.04,5,"Hatch spacing");
 valid(v,1,5000,"Hatch scan speed");
 valid(vc,1,5000,"Contour scan speed");
 valid(recoat,0,600,"Recoat time");
 valid(setup,0,86400,"Setup time");
 valid(cool,0,86400,"Cooldown time");
 if(!slices.layers.length||slices.layers.length>600)throw Error("No bounded physical layers available.");
 const pitch=slices.grid.xyPitchMm,cols=slices.grid.columns;
 const perimeters=(layer:PhysicalSliceLayer)=>{
  const occupied=new Set(layer.cells.map(c=>c.y*cols+c.x));
  let edges=0;
  for(const c of layer.cells){
   const p=c.y*cols+c.x;
   if(!occupied.has(p-1)||c.x===0)edges++;
   if(c.x===cols-1||!occupied.has(p+1))edges++;
   if(c.y===0||!occupied.has(p-cols))edges++;
   if(c.y===slices.grid.rows-1||!occupied.has(p+cols))edges++;
  }
  return edges*pitch;
 };
 const layers=slices.layers.map(l=>{
  // All terms represent optimistic coverage proxies, not actual machine motion.
  const edge=perimeters(l),hatchLength=l.areaMm2/h;
  const hatchSeconds=hatchLength/v,contourSeconds=edge/vc;
  return {layer:l.layer,areaMm2:l.areaMm2,sampledEdgeLengthMm:edge,
   estimatedHatchLengthMm:hatchLength,estimatedHatchSeconds:hatchSeconds,
   estimatedContourSeconds:contourSeconds,recoatSeconds:recoat,
   estimatedLayerSeconds:hatchSeconds+contourSeconds+recoat};
 });
 const laserTravelProxySeconds=layers.reduce((sum,x)=>sum+x.estimatedHatchSeconds+x.estimatedContourSeconds,0);
 const recoatSeconds=layers.length*recoat;
 return {version:METAL_LAYER_PLAN_VERSION,partSha256:slices.partSha256,
  type:"UNVALIDATED_GEOMETRY_ONLY_SCENARIO",
  totalSeconds:laserTravelProxySeconds+recoatSeconds+setup+cool,
  laserTravelProxySeconds,recoatSeconds,overheadSeconds:setup+cool,
  sampleVolumeDeviationFraction:slices.geometry.relativeVolumeDifference,
  layerDetails:layers,
  warnings:[
   "This is an engineer-assumption scenario based on sampled XY coverage and grid-edge length. It is NOT a sliced LPBF machine time, generated hatch/contour strategy or validated print duration.",
   "Actual scan ordering, jump/reposition time, laser modulation, hatch rotation, multi-laser strategies, stripe/island scans, support exposure and real contour loops are not represented.",
   "Laser duty cycle, acceleration, thermal holds, machine recoating, shielding gas, machine setup, cooldown, build plate and postprocessing are site/process dependent.",
   "Part layerlines use raster cell boundaries rather than exact CAD polygon intersection. Thin walls/holes and geometry below cell resolution may be incorrect.",
   "A metal printing time scenario cannot indicate material strength, porosity, cracking, distortion, print success or aerospace certification."
  ]};
}
/** Short, bounded scanline geometry illustration, NOT a machine hatch command. */
export function previewIllustrativeLayerHatches(
 slices:PhysicalSliceResult,layerNumber:number,hatchSpacingMm:number
):HatchLine[]{
 valid(hatchSpacingMm,.04,5,"Hatch spacing");
 const layer=slices.layers[layerNumber];
 if(!layer||!Number.isInteger(layerNumber))throw Error("Select a sampled physical layer.");
 if(layer.cells.length>4500)throw Error("Layer is too dense for conceptual hatch preview.");
 const {columns,originMm,xyPitchMm:p}=slices.grid;
 const occupied=new Set(layer.cells.map(c=>c.y*columns+c.x));
 const minY=Math.floor(layerNumber>=0?Math.min(...layer.cells.map(c=>c.y),0):0);
 const maxY=Math.max(0,...layer.cells.map(c=>c.y));
 // Draw along raster row centers; hatchSpacing may be finer than the
 // raster pitch, so spacing below pitch has no additional geometric validity.
 const step=Math.max(1,Math.ceil(hatchSpacingMm/p));
 const result:HatchLine[]=[];
 for(let row=Math.max(0,minY);row<=maxY;row+=step){
  let run=-1;
  for(let col=0;col<=columns;col++){
   const on=col<columns&&occupied.has(row*columns+col);
   if(on&&run<0)run=col;
   if(!on&&run>=0){
    result.push({x0Mm:originMm.x+run*p,x1Mm:originMm.x+col*p,
     y0Mm:originMm.y+(row+.5)*p,y1Mm:originMm.y+(row+.5)*p});
    run=-1;
    if(result.length>1200)return result;
   }
  }
 }
 return result;
}
