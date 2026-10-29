/**
 * Numerical sensitivity diagnostics only, not experimental validation.
 * Holds physical input parameters fixed while changing explicit time-step size
 * and (for generated paths only) a spatial voxel resolution.
 *
 * Spatial comparison for generated raster is CONFOUNDED: coarse virtual layer
 * grouping and discretized effective beam radius change with mesh resolution.
 * It must never be described as demonstrated mesh convergence.
 */
import {simulateMovingSource,type MovingInputs} from "./lpbf-moving-source";
import type {LpbfResult} from "./lpbf-transient";
import type {ScanPlan} from "./lpbf-scan-plan";
export const SENSITIVITY_VERSION="lpbf-numerical-sensitivity-0.1";
export type SensitivityMetric={
 caseName:string;baselineResolution:number;candidateResolution:number;
 baselineStepScale:number;candidateStepScale:number;
 baselineTimeSteps:number;candidateTimeSteps:number;
 peakDifferenceC:number;finalMeanDifferenceC:number;surfaceRmsDifferenceC:number;
 absorbedEnergyDifferenceJ:number;baselineEnergyImbalance:number;candidateEnergyImbalance:number;
 summary:string;
};
export type SensitivityStudy={
 version:typeof SENSITIVITY_VERSION;engine:string;sourceScanSha256:string|null;
 baseline:{peakC:number;finalMeanC:number;cells:number;steps:number};
 temporal:SensitivityMetric;
 spatial?:SensitivityMetric;
 spatialSkippedReason?:string;
 interpretation:string[];
};
export function compareLpbfRuns(
 baseline:LpbfResult,candidate:LpbfResult,caseName:string
):SensitivityMetric{
 if(!baseline.frames.length||!candidate.frames.length)
  throw Error("Sensitivity comparison requires completed temperature fields.");
 const b=baseline.frames[baseline.frames.length-1],c=candidate.frames[candidate.frames.length-1];
 const bValues=b.field.values,cValues=c.field.values;
 if(bValues.length!==cValues.length||!bValues.length)
  throw Error("Surface fields do not share the original STL vertex sampling; cannot compare.");
 if(bValues.some(v=>!Number.isFinite(v))||cValues.some(v=>!Number.isFinite(v)))
  throw Error("Cannot compare non-finite surface temperatures.");
 const root=Math.sqrt(bValues.reduce((sum,value,i)=>sum+(value-cValues[i])**2,0)/bValues.length);
 const output:SensitivityMetric={
  caseName,baselineResolution:baseline.inputs.resolution,candidateResolution:candidate.inputs.resolution,
  baselineStepScale:baseline.numerics?.stepScale??1,candidateStepScale:candidate.numerics?.stepScale??1,
  baselineTimeSteps:baseline.summary.timeSteps,candidateTimeSteps:candidate.summary.timeSteps,
  peakDifferenceC:Math.abs(baseline.summary.peakSolidTemperatureC-candidate.summary.peakSolidTemperatureC),
  finalMeanDifferenceC:Math.abs(b.meanC-c.meanC),surfaceRmsDifferenceC:root,
  absorbedEnergyDifferenceJ:Math.abs(baseline.summary.absorbedEnergyJ-candidate.summary.absorbedEnergyJ),
  baselineEnergyImbalance:baseline.summary.relativeEnergyImbalance,
  candidateEnergyImbalance:candidate.summary.relativeEnergyImbalance,
  summary:caseName==="time-step"?
   "Only explicit time-step limit was reduced with the mesh, geometry, scan commands and physics inputs held fixed. Reported differences are numerical sensitivity, not proof of convergence.":
   "Voxel resolution changed. Generated virtual layer grouping, source discretization, effective numerical beam radius and time-step bound can also change. This is a spatial sensitivity indicator, NOT a controlled mesh-convergence result."
 };
 if(Object.values(output).some(v=>typeof v==="number"&&!Number.isFinite(v)))
  throw Error("Non-finite numerical sensitivity result withheld.");
 return output;
}
export function runLpbfSensitivity(
 buffer:ArrayBuffer,unitScale:number,input:MovingInputs,
 baseline:LpbfResult,scanPlan:ScanPlan|undefined,
 onStage?:(stage:"time-step"|"spatial",completed:number,total:number)=>void
):SensitivityStudy{
 if(baseline.engine!==(scanPlan?"lpbf-imported-enthalpy-0.1":"lpbf-raster-enthalpy-0.1"))
  throw Error("Baseline engine does not match approved thermal mode.");
 if(JSON.stringify(baseline.inputs)!==JSON.stringify(input))
  throw Error("Sensitivity baseline inputs differ from current inputs. Rerun the approved study.");
 if((baseline.scanPlan?.sha256??null)!==(scanPlan?.sha256??null))
  throw Error("Sensitivity baseline scan-path identity differs from current CSV.");
 if((baseline.numerics?.stepScale??1)!==1)
  throw Error("Sensitivity baseline must use default numerical time-step.");
 const baseFinal=baseline.frames.at(-1);
 if(!baseFinal)throw Error("No baseline frame to compare.");
 const finerTime=simulateMovingSource(buffer,unitScale,input,
  (done,total)=>onStage?.("time-step",done,total),scanPlan,.5);
 const temporal=compareLpbfRuns(baseline,finerTime,"time-step");
 let spatial:SensitivityMetric|undefined,spatialSkippedReason:string|undefined;
 if(scanPlan){
  spatialSkippedReason="Imported scan paths use source-specified virtual voxel-slab indices. Altering voxel resolution changes the number of slabs, so spatial comparison is disabled until a documented physical-layer-to-slab re-mapping exists.";
 }else if(input.resolution>=15){
  spatialSkippedReason="Reference voxel resolution is too close to the 16-cell research mesh limit to support a larger bounded comparison.";
 }else{
  const finerResolution=Math.min(16,input.resolution+2);
  try{
   const spatialInputs={...input,resolution:finerResolution};
   const finerMesh=simulateMovingSource(buffer,unitScale,spatialInputs,
    (done,total)=>onStage?.("spatial",done,total));
   spatial=compareLpbfRuns(baseline,finerMesh,"spatial");
  }catch(error){
   spatialSkippedReason="Spatial sensitivity not reported: "+(error instanceof Error?error.message:"solver did not finish");
  }
 }
 return {
  version:SENSITIVITY_VERSION,engine:baseline.engine,
  sourceScanSha256:scanPlan?.sha256??null,
  baseline:{peakC:baseline.summary.peakSolidTemperatureC,finalMeanC:baseFinal.meanC,
   cells:baseline.mesh.cells,steps:baseline.summary.timeSteps},
  temporal,spatial,spatialSkippedReason,
  interpretation:[
   "These comparisons use the same idealized research heat equation, not measured temperatures. A small difference does not establish validity, accuracy or defect prediction.",
   "Time-step sensitivity compares the original mesh with a half-size maximum explicit time step. No automatic converged/not-converged or numerical accuracy claim is made.",
   "Generated-path spatial comparisons are confounded by changes in slab aggregation and unresolved laser spot versus voxel size. Neither Richardson extrapolation nor a grid-convergence index is valid here.",
   "Imported-path spatial comparisons are intentionally disabled: the CSV describes specific virtual slab indices rather than physical layers.",
   "Real validation requires a documented machine scan path, measured material and beam data, and an independent thermal benchmark with experimental uncertainty."
  ]
 };
}
