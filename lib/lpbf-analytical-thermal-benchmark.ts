/** Exact-in-time reference for the two-cell semi-discrete conduction equations.
 * This checks time integration and boundary/source signs, not continuum spatial
 * accuracy, LPBF heat deposition, or experimental validity.
 */
import {runPartialLayerResearch,type PartialLayerInputs} from "./lpbf-partial-layer";
import {PHYSICAL_SCAN_VERSION} from "./lpbf-physical-schedule";
export function benchmarkTwoCellPlateHeating(){
 const input:PartialLayerInputs={
  pitchMm:.5,layerHeightMm:.5,originMm:{x:0,y:0,z:0},
  cells:[[0,0,0],[0,0,1]],partSha256:"a".repeat(64),sourceSha256:"b".repeat(64),
  scan:{version:PHYSICAL_SCAN_VERSION,sourceName:"analytical-two-cell-synthetic",commands:[
   {layer:0,zMm:.5,t0Seconds:0,t1Seconds:.1,x0Mm:.25,y0Mm:.25,x1Mm:.25,y1Mm:.25,powerW:0},
   {layer:1,zMm:1,t0Seconds:.1,t1Seconds:.3,x0Mm:.25,y0Mm:.25,x1Mm:.25,y1Mm:.25,powerW:0}]},
  powerCouplingFraction:0,beamRadiusMm:.4,densityKgM3:7800,specificHeatJKgK:500,
  powderConductivityWmK:2,solidConductivityWmK:2,convectionWm2K:0,
  ambientTemperatureC:25,plateTemperatureC:100};
 // Cell-centered finite volume: plate face at half-cell distance, other
 // external faces insulated. For the first cell u'= -2*r*u, u=T-Tplate.
 // When the upper cell is activated, u'=r*[[-3,1],[1,-1]]u.
 const r=input.powderConductivityWmK/(input.densityKgM3*input.specificHeatJKgK*(input.layerHeightMm/1000)**2);
 const initial=input.ambientTemperatureC-input.plateTemperatureC;
 const u=initial*Math.exp(-2*r*.1),v=initial;
 const q=Math.SQRT2*r*.2,decay=Math.exp(-2*r*.2),c=Math.cosh(q),s=Math.sinh(q)/Math.SQRT2;
 const reference={firstCommandC:input.plateTemperatureC+u,
  finalLowerC:input.plateTemperatureC+decay*(c*u+s*(-u+v)),
  finalUpperC:input.plateTemperatureC+decay*(c*v+s*(u+v))};
 const runs=[.001,.0005,.00025].map(ceiling=>{
  const result=runPartialLayerResearch(input,undefined,{absoluteTimeStepCeilingSeconds:ceiling});
  const lower=result.finalCells[0].temperatureC,upper=result.finalCells[1].temperatureC;
  const first=result.layers[0].maximumTemperatureC;
  return {timeStepCeilingSeconds:ceiling,stepCounts:result.chronology.commandStepCounts,
   firstCommandC:first,finalLowerC:lower,finalUpperC:upper,
   maxAbsoluteErrorC:Math.max(Math.abs(first-reference.firstCommandC),Math.abs(lower-reference.finalLowerC),Math.abs(upper-reference.finalUpperC)),
   energy:result.energy};
 });
 return {scope:"SEMI_DISCRETE_ANALYTICAL_TIME_BENCHMARK" as const,reference,runs,
  productionActivationAuthorized:false as const,
  limitations:["Analytical solution of the two-cell semi-discrete ODE, not a continuum spatial reference.",
   "No laser heating, state switching, convection, or experimentally measured material behavior."]};
}
