/** Time-discretization sensitivity on an unchanged registered geometry and scan.
 * This is a numerical comparison, not experimental validation or spatial convergence.
 */
import {runRegisteredLayerExperiment} from "./lpbf-registered-layer-experiment";
import type {PartialLayerResult} from "./lpbf-partial-layer";
function compare(a:PartialLayerResult,b:PartialLayerResult){
 const map=new Map(b.finalCells.map(c=>[[c.x,c.y,c.layer].join(","),c]));
 if(map.size!==a.finalCells.length||map.size!==b.finalCells.length||a.layers.length!==b.layers.length)
  throw Error("Time refinement must use the same registered cells and commands.");
 let maxFinalDifferenceC=0,maxPeakDifferenceC=0,sumSquared=0,stateChanges=0,maxCommandEndDifferenceC=0;
 for(const c of a.finalCells){
  const d=map.get([c.x,c.y,c.layer].join(","));
  if(!d)throw Error("Time refinement cell identity mismatch.");
  const delta=Math.abs(c.temperatureC-d.temperatureC);
  maxFinalDifferenceC=Math.max(maxFinalDifferenceC,delta);
  maxPeakDifferenceC=Math.max(maxPeakDifferenceC,Math.abs(c.peakTemperatureC-d.peakTemperatureC));
  sumSquared+=delta**2;
  if(c.state!==d.state)stateChanges++;
 }
 for(let i=0;i<a.layers.length;i++){
  if(a.layers[i].layer!==b.layers[i].layer||Math.abs(a.layers[i].timeSeconds-b.layers[i].timeSeconds)>1e-8)
   throw Error("Time refinement command chronology mismatch.");
  maxCommandEndDifferenceC=Math.max(maxCommandEndDifferenceC,Math.abs(a.layers[i].maximumTemperatureC-b.layers[i].maximumTemperatureC));
 }
 return {maxFinalDifferenceC,finalRmseC:Math.sqrt(sumSquared/a.finalCells.length),maxPeakDifferenceC,maxCommandEndDifferenceC,stateChanges};
}
export async function studyRegisteredTimeRefinement(args:Parameters<typeof runRegisteredLayerExperiment>[0]){
 // Fixed predeclared three-level refinement; no adaptive tuning after viewing results.
 const scales=[1,.5,.25] as const;
 const runs=[];
 for(const timeStepScale of scales){
  runs.push(await runRegisteredLayerExperiment({...args,timeStepScale,captureFrames:false}));
 }
 const a=runs[0].thermal,b=runs[1].thermal,c=runs[2].thermal;
 if(!(a.chronology.timeSteps<b.chronology.timeSteps&&b.chronology.timeSteps<c.chronology.timeSteps))
  throw Error("Time refinement did not increase actual step count; no comparison reported.");
 const coarseToMedium=compare(a,b),mediumToFine=compare(b,c);
 const summary=runs.map((r,i)=>({scale:scales[i],timeSteps:r.thermal.chronology.timeSteps,
  stableStepCeilingSeconds:r.thermal.chronology.maxTimeStepSeconds,energy:r.thermal.energy,
  maximumPeakC:Math.max(...r.thermal.finalCells.map(c=>c.peakTemperatureC))}));
 return {scope:"UNVALIDATED_TIME_REFINEMENT_DIAGNOSTIC" as const,partSha256:a.partSha256,sourceSha256:a.sourceSha256,
  runs:summary,coarseToMedium,mediumToFine,productionActivationAuthorized:false as const,
  limitations:["Fixed spatial grid and model parameters; spatial discretization error is not measured.",
   "Heuristic state switching can be discontinuous in time; no assumed order of convergence or extrapolated exact answer.",
   "Differences are numerical sensitivities, not experimental errors or process tolerances."]};
}
