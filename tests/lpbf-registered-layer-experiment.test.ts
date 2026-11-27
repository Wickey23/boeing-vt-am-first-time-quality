import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {runRegisteredLayerExperiment} from "../lib/lpbf-registered-layer-experiment";
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
