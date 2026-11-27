/** M07 matched XY refinement. Z layer thickness and realized time grid are unchanged. */
import {runRegisteredLayerExperiment} from "./lpbf-registered-layer-experiment";
type Result=Awaited<ReturnType<typeof runRegisteredLayerExperiment>>;
function compareNested(coarse:Result,fine:Result){
 const a=coarse.geometry.grid,b=fine.geometry.grid;
 if(Math.abs(a.xyPitchMm/b.xyPitchMm-2)>1e-9||a.physicalLayers!==b.physicalLayers||
  Math.abs(a.originMm.x-b.originMm.x)>1e-8||Math.abs(a.originMm.y-b.originMm.y)>1e-8||
  Math.abs(a.originMm.z-b.originMm.z)>1e-8)throw Error("Spatial refinement requires nested, aligned physical grids.");
 const map=new Map(fine.thermal.finalCells.map(c=>[[c.x,c.y,c.layer].join(","),c]));
 let sum=0,max=0;
 for(const c of coarse.thermal.finalCells){
  const sub=[];
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
   const v=map.get([2*c.x+dx,2*c.y+dy,c.layer].join(","));
   if(!v)throw Error("Refinement changed represented material; cannot compare nested cell means.");
   sub.push(v.temperatureC);
  }
  const diff=Math.abs(c.temperatureC-sub.reduce((s,t)=>s+t,0)/4);sum+=diff*diff;max=Math.max(max,diff);
 }
 if(fine.thermal.finalCells.length!==4*coarse.thermal.finalCells.length)throw Error("Refinement changed material support.");
 return {coarseCellMeanRmseC:Math.sqrt(sum/coarse.thermal.finalCells.length),maximumCellMeanDifferenceC:max};
}
export async function studyRegisteredSpatialRefinement(args:Parameters<typeof runRegisteredLayerExperiment>[0],absoluteTimeStepCeilingSeconds:number){
 const pitch=args.sliceOptions.xyPitchMm;
 const runs:Result[]=[];
 for(const scale of [1,.5,.25]){
  runs.push(await runRegisteredLayerExperiment({...args,sliceOptions:{...args.sliceOptions,xyPitchMm:pitch*scale},
   captureFrames:false,timeStepScale:1,absoluteTimeStepCeilingSeconds}));
 }
 const counts=runs[0].thermal.chronology.commandStepCounts;
 if(!counts||runs.some(r=>JSON.stringify(r.thermal.chronology.commandStepCounts)!==JSON.stringify(counts)))
  throw Error("Actual time grids differ; choose a smaller common time-step ceiling.");
 const summary=runs.map(r=>({xyPitchMm:r.geometry.grid.xyPitchMm,layerHeightMm:r.geometry.grid.layerThicknessMm,
  cells:r.thermal.grid.cellCount,commandStepCounts:r.thermal.chronology.commandStepCounts,
  actualMaxTimeStepSeconds:r.thermal.chronology.actualMaxTimeStepSeconds,
  energy:r.thermal.energy,maximumPeakC:Math.max(...r.thermal.finalCells.map(c=>c.peakTemperatureC))}));
 return {scope:"UNVALIDATED_XY_REFINEMENT_DIAGNOSTIC" as const,productionActivationAuthorized:false as const,
  partSha256:runs[0].thermal.partSha256,sourceSha256:runs[0].thermal.sourceSha256,runs:summary,
  coarseToMedium:compareNested(runs[0],runs[1]),mediumToFine:compareNested(runs[1],runs[2]),
  limitations:["Only XY pitch is refined; physical layer thickness, scan and actual integration time grid are fixed.",
   "Fine temperatures are volume-averaged into matching coarse cells; partial or nonnested material is rejected.",
   "No observed order, experimental accuracy or process qualification is implied."]};
}
