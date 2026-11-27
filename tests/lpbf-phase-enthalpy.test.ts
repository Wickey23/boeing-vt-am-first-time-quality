import {test} from "node:test";
import assert from "node:assert/strict";
import {createPhaseEnthalpyModel} from "../lib/lpbf-phase-enthalpy";
import {runPartialLayerResearch,type PartialLayerInputs} from "../lib/lpbf-partial-layer";
import {PHYSICAL_SCAN_VERSION} from "../lib/lpbf-physical-schedule";
const phase={solidusC:40,liquidusC:60,latentHeatJKg:20000,solidSpecificHeatJKgK:500,liquidSpecificHeatJKgK:600,sourceLabel:"synthetic numerical benchmark only"};
test("M08 enthalpy and phase fraction are continuous, reversible and include latent energy",()=>{
 const model=createPhaseEnthalpyModel(phase);
 assert.equal(model.enthalpyJKg(60)-model.enthalpyJKg(40),30000);
 for(const t of [-20,25,40,50,60,100]){
  const s=model.state(model.enthalpyJKg(t));
  assert.ok(Math.abs(s.temperatureC-t)<1e-10);
  assert.equal(s.liquidFraction,Math.max(0,Math.min(1,(t-40)/20)));
 }
 assert.equal(model.minimumHeatCapacityJKgK,500);
 assert.throws(()=>createPhaseEnthalpyModel({...phase,liquidusC:40}),/Invalid/);
 assert.throws(()=>createPhaseEnthalpyModel({...phase,sourceLabel:""}),/Invalid/);
});
function input():PartialLayerInputs{
 return {pitchMm:.5,layerHeightMm:.5,originMm:{x:0,y:0,z:0},cells:[[0,0,0],[0,0,1]],
 partSha256:"a".repeat(64),sourceSha256:"b".repeat(64),scan:{version:PHYSICAL_SCAN_VERSION,sourceName:"synthetic",
 commands:[{layer:0,zMm:.5,t0Seconds:0,t1Seconds:.1,x0Mm:.25,y0Mm:.25,x1Mm:.25,y1Mm:.25,powerW:0},
 {layer:1,zMm:1,t0Seconds:.1,t1Seconds:.3,x0Mm:.25,y0Mm:.25,x1Mm:.25,y1Mm:.25,powerW:0}]},
 powerCouplingFraction:0,beamRadiusMm:.4,densityKgM3:7800,specificHeatJKgK:500,
 powderConductivityWmK:2,solidConductivityWmK:2,convectionWm2K:0,ambientTemperatureC:25,plateTemperatureC:100};
}
test("M08 zero latent heat and equal heat capacities reproduce original temperature results",()=>{
 const a=runPartialLayerResearch(input(),undefined,{captureFrames:true});
 const b=runPartialLayerResearch(input(),undefined,{captureFrames:true,phaseEnthalpy:{...phase,latentHeatJKg:0,liquidSpecificHeatJKgK:500}});
 for(let i=0;i<a.finalCells.length;i++)assert.ok(Math.abs(a.finalCells[i].temperatureC-b.finalCells[i].temperatureC)<1e-8);
 assert.equal(a.phaseClosure,undefined);
 assert.equal(b.phaseClosure?.productionActivationAuthorized,false);
});
test("M08 latent heat reduces temperature rise while conserving signed energy and retaining separate phase fields",()=>{
 const a=runPartialLayerResearch(input());
 const b=runPartialLayerResearch(input(),undefined,{captureFrames:true,phaseEnthalpy:phase});
 assert.ok(b.finalCells[0].temperatureC<a.finalCells[0].temperatureC);
 assert.ok(b.finalCells[0].liquidFraction!>0);
 assert.ok(b.finalCells.every(c=>c.liquidFraction!>=0&&c.liquidFraction!<=1&&c.peakLiquidFraction!>=c.liquidFraction!));
 assert.ok(b.finalCells.every(c=>c.state==="powder"));
 assert.ok(b.energy.relativeImbalance<1e-9);
 assert.ok(b.energy.plateExchangeJ<0&&b.energy.storedJ>0);
 const model=createPhaseEnthalpyModel(phase),mass=7800*(.0005**3);
 const independentlyStored=b.finalCells.reduce((sum,c)=>sum+mass*(model.enthalpyJKg(c.temperatureC)-model.enthalpyJKg(25)),0);
 assert.ok(Math.abs(independentlyStored-b.energy.storedJ)<1e-10);
 assert.equal(b.frames?.[0].cells.length,1);
 assert.throws(()=>runPartialLayerResearch(input(),undefined,{phaseEnthalpy:{...phase,solidSpecificHeatJKgK:501}}),/must match/);
});
