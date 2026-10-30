import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {slicePhysicalStl} from "../lib/lpbf-physical-slicer";
import {registerPhysicalScanToSlices} from "../lib/lpbf-slice-registration";
import {PHYSICAL_SCAN_VERSION,type PhysicalScanPlan} from "../lib/lpbf-physical-schedule";
import {buildStlPartialLayerInputs,type ResearchMaterial} from "../lib/lpbf-stl-partial-layer";
import {runPartialLayerResearch} from "../lib/lpbf-partial-layer";

const file=async()=>{const b=await readFile("public/verification/cube-10mm.stl");return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
const hash=(a:ArrayBuffer)=>createHash("sha256").update(Buffer.from(a)).digest("hex");
const props:ResearchMaterial={
 powerCouplingFraction:.25,beamRadiusMm:2.5,densityKgM3:4420,specificHeatJKgK:560,
 powderConductivityWmK:2,solidConductivityWmK:15,convectionWm2K:10,
 ambientTemperatureC:22,plateTemperatureC:22
};
function syntheticScan():PhysicalScanPlan{
 const commands=[] as PhysicalScanPlan["commands"];
 for(let layer=0;layer<10;layer++){
  const t=layer*.02,z=-5+(layer+1);
  commands.push({layer,zMm:z,t0Seconds:t,t1Seconds:t+.005,
   x0Mm:-2,y0Mm:0,x1Mm:-2,y1Mm:0,powerW:0});
  commands.push({layer,zMm:z,t0Seconds:t+.005,t1Seconds:t+.012,
   x0Mm:-2,y0Mm:0,x1Mm:2,y1Mm:0,powerW:12});
  commands.push({layer,zMm:z,t0Seconds:t+.012,t1Seconds:t+.02,
   x0Mm:2,y0Mm:0,x1Mm:-2,y1Mm:0,powerW:0});
 }
 return {version:PHYSICAL_SCAN_VERSION,sourceName:"synthetic-lab-not-machine.csv",commands};
}
test("M06 real STL-slice-to-local FVM bridge conserves energy for bounded public cube fixture",async()=>{
 const stl=await file();
 const slices=await slicePhysicalStl(stl,{unitScaleToMm:1,xyPitchMm:5,layerThicknessMm:1});
 const scan=syntheticScan(),scanHash="c".repeat(64);
 const registration=registerPhysicalScanToSlices({slices,scan,scanSourceSha256:scanHash});
 assert.equal(registration.status,"GEOMETRY_REGISTERED_RESEARCH_ONLY");
 const input=buildStlPartialLayerInputs({slices,registration,scan,material:props});
 assert.equal(input.cells.length,40);
 assert.equal(input.cells[0][2],0);
 assert.equal(input.partSha256,hash(stl));
 const result=runPartialLayerResearch(input);
 assert.equal(result.validationStatus,"UNVALIDATED_GRID_RESEARCH");
 assert.equal(result.grid.layers,10);
 assert.equal(result.partSha256,hash(stl));
 assert.equal(result.sourceSha256,scanHash);
 assert.ok(result.energy.commandedJ>0);
 assert.ok(result.energy.relativeImbalance<1e-6);
 assert.ok(result.layers.length===30);
 assert.ok(result.finalCells.every(c=>Number.isFinite(c.temperatureC)));
});
test("M06 rejects physically unresolved fractional cells, invalid source binding and unmatched geometry",async()=>{
 const stl=await file(),scan=syntheticScan();
 const slices=await slicePhysicalStl(stl,{unitScaleToMm:1,xyPitchMm:5,layerThicknessMm:1});
 const reg=registerPhysicalScanToSlices({slices,scan,scanSourceSha256:"e".repeat(64)});
 const good={slices,registration:reg,scan,material:props};
 const frac={...slices,grid:{...slices.grid,boundaryCells:1},
  layers:slices.layers.map((l,i)=>i===0?{...l,partialCells:1,cells:l.cells.map((c,j)=>j===0?{...c,coverage:.5}:c)}:l)};
 assert.throws(()=>buildStlPartialLayerInputs({...good,slices:frac}),/Fractional boundary/);
 assert.throws(()=>buildStlPartialLayerInputs({...good,registration:{...reg,partSha256:"f".repeat(64)}}),/identity is stale/);
 assert.throws(()=>buildStlPartialLayerInputs({...good,slices:{...slices,geometry:{...slices.geometry,relativeVolumeDifference:.25}}}),/volume differs/);
 const badScan={...reg,status:"BLOCKED" as const,blockers:["laser-on pass in a void"]};
 assert.throws(()=>buildStlPartialLayerInputs({...good,registration:badScan}),/preflight is blocked/);
});
