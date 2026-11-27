import {test} from "node:test";
import assert from "node:assert/strict";
import {createConductivityTable,type ConductivityTable} from "../lib/lpbf-conductivity-table";
import {runPartialLayerResearch,type PartialLayerInputs} from "../lib/lpbf-partial-layer";
import {PHYSICAL_SCAN_VERSION} from "../lib/lpbf-physical-schedule";
const table:ConductivityTable={materialLabel:"Synthetic",sourceLabel:"Numerical test only",sourceKind:"synthetic",
 points:[{temperatureC:25,powderWmK:2,exposedWmK:2},{temperatureC:100,powderWmK:4,exposedWmK:6}]};
function input():PartialLayerInputs{
 return {pitchMm:.5,layerHeightMm:.5,originMm:{x:0,y:0,z:0},cells:[[0,0,0],[0,0,1]],
 partSha256:"a".repeat(64),sourceSha256:"b".repeat(64),scan:{version:PHYSICAL_SCAN_VERSION,sourceName:"synthetic",
 commands:[{layer:0,zMm:.5,t0Seconds:0,t1Seconds:.1,x0Mm:.25,y0Mm:.25,x1Mm:.25,y1Mm:.25,powerW:0},
 {layer:1,zMm:1,t0Seconds:.1,t1Seconds:.3,x0Mm:.25,y0Mm:.25,x1Mm:.25,y1Mm:.25,powerW:0}]},
 powerCouplingFraction:0,beamRadiusMm:.4,densityKgM3:7800,specificHeatJKgK:500,
 powderConductivityWmK:2,solidConductivityWmK:2,convectionWm2K:0,ambientTemperatureC:25,plateTemperatureC:100};
}
test("M08 conductivity table interpolates both branches and rejects extrapolation",()=>{
 const m=createConductivityTable(table);
 assert.equal(m.at(62.5,false),3);
 assert.equal(m.at(62.5,true),4);
 assert.equal(m.maximumWmK,6);
 assert.throws(()=>m.at(101,true),/outside/);
 assert.throws(()=>createConductivityTable({...table,points:[...table.points].reverse()}),/unordered/);
 assert.throws(()=>createConductivityTable({...table,sourceLabel:""}),/required/);
});
test("M08 constant table recovers baseline; variable conductivity changes conserved heating",()=>{
 const options={absoluteTimeStepCeilingSeconds:.0001};
 const a=runPartialLayerResearch(input(),undefined,options);
 const constant={...table,points:table.points.map(p=>({...p,powderWmK:2,exposedWmK:2}))};
 const b=runPartialLayerResearch(input(),undefined,{...options,conductivityTable:constant});
 const c=runPartialLayerResearch(input(),undefined,{...options,conductivityTable:table});
 assert.deepEqual(a.finalCells,b.finalCells);
 assert.ok(c.finalCells[0].temperatureC>a.finalCells[0].temperatureC);
 assert.ok(c.energy.relativeImbalance<1e-9);
 assert.equal(c.conductivityClosure?.productionActivationAuthorized,false);
 assert.equal(c.conductivityClosure?.parameters.sourceKind,"synthetic");
 assert.throws(()=>runPartialLayerResearch({...input(),plateTemperatureC:101},undefined,{conductivityTable:table}),/outside/);
});
