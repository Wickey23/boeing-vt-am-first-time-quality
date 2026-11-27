import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {runRegisteredLayerExperiment} from "../lib/lpbf-registered-layer-experiment";
import {studyRegisteredSpatialRefinement} from "../lib/lpbf-spatial-refinement";
import {studyRegisteredTimeRefinement} from "../lib/lpbf-time-refinement";
import {prepareLayerTemperatureView} from "../lib/lpbf-layer-temperature-view";
import {PHYSICAL_SCAN_HEADER} from "../lib/lpbf-physical-schedule";
const bytes=(s:string)=>new TextEncoder().encode(s).buffer as ArrayBuffer;
async function setup(){
 const b=await readFile("public/verification/cube-10mm.stl");
 const stl=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
 return {stl,expectedPartSha256:createHash("sha256").update(b).digest("hex"),
  csv:bytes(PHYSICAL_SCAN_HEADER+"\n0,0.5,0,0.01,0.25,0.25,0.75,0.25,0.1\n1,1,0.01,0.02,0.75,0.25,0.75,0.25,0\n1,1,0.02,0.03,0.75,0.25,0.25,0.25,0.1"),
  sliceOptions:{unitScaleToMm:.1,xyPitchMm:.5,layerThicknessMm:.5,translationMm:{x:.5,y:.5,z:.5}},
  conditions:{powerCouplingFraction:.5,beamRadiusMm:.4,densityKgM3:7800,specificHeatJKgK:500,
   powderConductivityWmK:2,solidConductivityWmK:20,convectionWm2K:8,ambientTemperatureC:25,plateTemperatureC:25},
  acknowledgeUnvalidatedResearch:true};
}
test("M06 offline original STL and CSV execute a bounded two-layer thermal experiment",async()=>{
 const input=await setup();
 const result=await runRegisteredLayerExperiment(input);
 assert.equal(result.scope,"OFFLINE_UNVALIDATED_INTEGRATION_EXPERIMENT");
 assert.equal(result.productionActivationAuthorized,false);
 assert.equal(result.registration.thermalActivationAuthorized,false);
 assert.equal(result.thermal.partSha256,input.expectedPartSha256);
 assert.equal(result.thermal.sourceSha256,createHash("sha256").update(Buffer.from(input.csv)).digest("hex"));
 assert.equal(result.thermal.grid.cellCount,8);
 assert.equal(result.thermal.grid.layers,2);
 assert.ok(Math.abs(result.thermal.energy.commandedJ-.002)<1e-10);
 assert.ok(Math.abs(result.thermal.energy.absorbedJ-.001)<1e-10);
 assert.ok(result.thermal.energy.relativeImbalance<1e-9);
 assert.ok(result.thermal.finalCells.every(c=>Number.isFinite(c.temperatureC)));
});
test("M06 refuses missing acknowledgment, mismatched identity and unregistered scans",async()=>{
 const input=await setup();
 await assert.rejects(runRegisteredLayerExperiment({...input,acknowledgeUnvalidatedResearch:false}),/acknowledgment required/);
 await assert.rejects(runRegisteredLayerExperiment({...input,expectedPartSha256:"0".repeat(64)}),/identity mismatch/);
 await assert.rejects(runRegisteredLayerExperiment({...input,csv:bytes(PHYSICAL_SCAN_HEADER+"\n0,0.6,0,0.01,0.25,0.25,1.25,0.25,0.1")}),/registration blocked/);
});
test("M06 never rounds partial-height layers into a uniform thermal grid",async()=>{
 const input=await setup();
 await assert.rejects(runRegisteredLayerExperiment({...input,sliceOptions:{...input.sliceOptions,layerThicknessMm:.6}}),/Partial-height layer/);
});

test("M06 thermal frames reflect actual command-end fields and omit inactive layers",async()=>{
 const input=await setup();
 const withFrames=await runRegisteredLayerExperiment({...input,captureFrames:true});
 const plain=await runRegisteredLayerExperiment(input);
 const frames=withFrames.thermal.frames!;
 assert.equal(frames.length,3);
 assert.equal(plain.thermal.frames,undefined);
 assert.deepEqual(withFrames.thermal.finalCells,plain.thermal.finalCells);
 assert.deepEqual(withFrames.thermal.energy,plain.thermal.energy);
 assert.deepEqual(frames.map(f=>f.commandIndex),[0,1,2]);
 assert.deepEqual(frames.map(f=>f.cells.length),[4,8,8]);
 assert.ok(frames[0].cells.every(c=>c.layer===0));
 assert.ok(Math.abs(frames[0].timeSeconds-.01)<1e-9);
 assert.ok(Math.abs(frames[2].timeSeconds-.03)<1e-9);
 assert.deepEqual(frames[2].cells,withFrames.thermal.finalCells);
 for(let i=0;i<frames.length;i++){
  assert.ok(frames[i].cells.every(c=>Number.isFinite(c.temperatureC)&&c.peakTemperatureC>=c.temperatureC));
  assert.equal(Math.max(...frames[i].cells.map(c=>c.temperatureC)),withFrames.thermal.layers[i].maximumTemperatureC);
 }
});

test("M06 temperature view preserves layer registration and a fixed scale across time",async()=>{
 const input=await setup();
 const result=await runRegisteredLayerExperiment({...input,captureFrames:true});
 const view=prepareLayerTemperatureView(result.thermal,result.geometry);
 assert.equal(view.frameCount,3);
 assert.equal(view.layerCount,2);
 const inactive=view.layerFrame(0,1),active=view.layerFrame(2,1);
 assert.equal(inactive.active,false);
 assert.ok(inactive.values.every(v=>v===null));
 assert.equal(active.active,true);
 assert.equal(active.sampleZMm,.75);
 assert.ok(active.values.every(v=>typeof v==="number"&&Number.isFinite(v)));
 assert.deepEqual(inactive.colorRangeC,active.colorRangeC);
 assert.throws(()=>view.layerFrame(3,0),/Invalid captured frame/);
 const altered={...result.geometry,partSha256:"0".repeat(64)};
 assert.throws(()=>prepareLayerTemperatureView(result.thermal,altered),/do not match/);
});

test("M07 fixed time refinements preserve commanded energy and report numerical differences without a validation claim",async()=>{
 const input=await setup();
 const report=await studyRegisteredTimeRefinement(input);
 assert.equal(report.scope,"UNVALIDATED_TIME_REFINEMENT_DIAGNOSTIC");
 assert.equal(report.productionActivationAuthorized,false);
 assert.deepEqual(report.runs.map(r=>r.scale),[1,.5,.25]);
 assert.ok(report.runs[0].timeSteps<report.runs[1].timeSteps);
 assert.ok(report.runs[1].timeSteps<report.runs[2].timeSteps);
 for(const r of report.runs){
  assert.ok(Math.abs(r.energy.commandedJ-.002)<1e-10);
  assert.ok(Math.abs(r.energy.absorbedJ-.001)<1e-10);
  assert.ok(r.energy.relativeImbalance<1e-9);
  assert.ok(Number.isFinite(r.maximumPeakC));
 }
 for(const pair of [report.coarseToMedium,report.mediumToFine]){
  assert.ok(Number.isFinite(pair.maxFinalDifferenceC)&&pair.maxFinalDifferenceC>=0);
  assert.ok(Number.isFinite(pair.finalRmseC)&&pair.finalRmseC>=0);
  assert.ok(Number.isFinite(pair.maxPeakDifferenceC));
  assert.ok(Number.isFinite(pair.maxCommandEndDifferenceC));
  assert.ok(Number.isInteger(pair.stateChanges));
 }
 await assert.rejects(runRegisteredLayerExperiment({...input,timeStepScale:2}),/research time-step scale/);
});

test("M07 nested XY refinement compares matched cell means on identical integration time grids",async()=>{
 const input=await setup();
 // Keep the path inside the same physical domain but away from every nested grid boundary.
 input.csv=bytes(PHYSICAL_SCAN_HEADER+"\n0,0.5,0,0.01,0.27,0.27,0.73,0.27,0.1\n1,1,0.01,0.02,0.73,0.27,0.73,0.27,0\n1,1,0.02,0.03,0.73,0.27,0.27,0.27,0.1");
 const report=await studyRegisteredSpatialRefinement(input,1e-5);
 assert.equal(report.scope,"UNVALIDATED_XY_REFINEMENT_DIAGNOSTIC");
 assert.equal(report.productionActivationAuthorized,false);
 assert.deepEqual(report.runs.map(r=>r.xyPitchMm),[.5,.25,.125]);
 assert.deepEqual(report.runs.map(r=>r.cells),[8,32,128]);
 for(const r of report.runs){
  assert.equal(r.layerHeightMm,.5);
  assert.deepEqual(r.commandStepCounts,report.runs[0].commandStepCounts);
  assert.ok(r.actualMaxTimeStepSeconds!<=1e-5+1e-12);
  assert.ok(Math.abs(r.energy.commandedJ-.002)<1e-10);
  assert.ok(Math.abs(r.energy.absorbedJ-.001)<1e-10);
  assert.ok(r.energy.relativeImbalance<1e-9);
 }
 for(const pair of [report.coarseToMedium,report.mediumToFine]){
  assert.ok(Number.isFinite(pair.coarseCellMeanRmseC)&&pair.coarseCellMeanRmseC>=0);
  assert.ok(Number.isFinite(pair.maximumCellMeanDifferenceC)&&pair.maximumCellMeanDifferenceC>=pair.coarseCellMeanRmseC-1e-12);
 }
});
