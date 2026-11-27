/** M06 offline integration experiment. Never invokes production simulation.
 * Recomputes geometry and registration from original bytes. Restricts existing
 * uniform-cell solver to fully sampled cells, full-height layers and tiny grids.
 */
import {slicePhysicalStl,type SliceOptions} from "./lpbf-physical-slicer";
import {registerPhysicalScan} from "./lpbf-scan-registration";
import {parsePhysicalScanCsv} from "./lpbf-physical-schedule";
import {runPartialLayerResearch,type PartialLayerInputs,type Cell3} from "./lpbf-partial-layer";
export type ResearchThermalConditions=Pick<PartialLayerInputs,
 "powerCouplingFraction"|"beamRadiusMm"|"densityKgM3"|"specificHeatJKgK"|"powderConductivityWmK"|"solidConductivityWmK"|"convectionWm2K"|"ambientTemperatureC"|"plateTemperatureC">;
export async function runRegisteredLayerExperiment(args:{
 stl:ArrayBuffer;csv:ArrayBuffer;expectedPartSha256:string;sliceOptions:SliceOptions;
 conditions:ResearchThermalConditions;acknowledgeUnvalidatedResearch:boolean;sourceName?:string;captureFrames?:boolean;timeStepScale?:number;absoluteTimeStepCeilingSeconds?:number;
}){
 if(!args.acknowledgeUnvalidatedResearch)throw Error("Explicit unvalidated research acknowledgment required.");
 // Snapshot inputs before any asynchronous hashing/processing.
 const stl=args.stl.slice(0),csv=args.csv.slice(0);
 const options={...args.sliceOptions,rotationDeg:args.sliceOptions.rotationDeg?{...args.sliceOptions.rotationDeg}:undefined,
  translationMm:args.sliceOptions.translationMm?{...args.sliceOptions.translationMm}:undefined};
 const conditions={...args.conditions};
 const slice=await slicePhysicalStl(stl,options);
 const registration=await registerPhysicalScan(csv,slice,args.expectedPartSha256,args.sourceName);
 if(registration.status!=="SAMPLED_REGISTRATION_REVIEW_REQUIRED")
  throw Error("Research registration blocked: "+registration.blockers.join(" "));
 if(slice.grid.physicalLayers<2||slice.grid.physicalLayers>40||slice.grid.representedCells<2||slice.grid.representedCells>1500)
  throw Error("Uniform-grid research solver accepts 2–40 layers and 2–1,500 cells only.");
 if(slice.layers.some(l=>l.partialCells!==0||l.cells.some(c=>c.coverage!==1)))
  throw Error("Partial occupancy is not supported; do not convert fractional cells to full-density cells.");
 // Tighten diagnostic discrepancy for this bounded experiment. This is a
 // chosen numerical screening criterion, NOT a qualified process tolerance.
 if(slice.geometry.relativeVolumeDifference>.01||slice.layers.some(l=>
  l.sectionCheck?.relativeDifference==null||l.sectionCheck.relativeDifference>.01))
  throw Error("Research experiment requires area and volume discrepancies at most 1%.");
 const cells:Cell3[]=slice.layers.flatMap(l=>l.cells.map(c=>[c.x,c.y,l.layer] as Cell3));
 const plan=parsePhysicalScanCsv(new TextDecoder("utf-8",{fatal:true}).decode(csv),args.sourceName);
 const thermal=runPartialLayerResearch({...conditions,
  pitchMm:slice.grid.xyPitchMm,layerHeightMm:slice.grid.layerThicknessMm,
  originMm:{...slice.grid.originMm},cells,partSha256:slice.partSha256,
  sourceSha256:registration.sourceSha256,scan:plan},undefined,{captureFrames:args.captureFrames??false,timeStepScale:args.timeStepScale,absoluteTimeStepCeilingSeconds:args.absoluteTimeStepCeilingSeconds});
 return {scope:"OFFLINE_UNVALIDATED_INTEGRATION_EXPERIMENT" as const,
  productionActivationAuthorized:false as const,geometry:slice,registration,conditions,thermal,
  limitations:["Uniform full-sampled cells only; four-ray occupancy and midpoint area checks do not prove cell-level fidelity.",
   "Conditions are supplied research inputs, not certified alloy or process parameters.",
   "This experiment does not authorize production solver activation, predict defects or demonstrate experimental agreement."]};
}
