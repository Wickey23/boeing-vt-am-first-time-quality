import {test} from "node:test";
import assert from "node:assert/strict";
import {PHYSICAL_SCAN_VERSION,type PhysicalScanPlan} from "../lib/lpbf-physical-schedule";
import {runPartialLayerResearch,type PartialLayerInputs} from "../lib/lpbf-partial-layer";

function setup():PartialLayerInputs{
 const commands=[
  {layer:0,zMm:.2,t0Seconds:0,t1Seconds:.01,x0Mm:.5,y0Mm:.5,x1Mm:.5,y1Mm:.5,powerW:0},
  {layer:0,zMm:.2,t0Seconds:.01,t1Seconds:.03,x0Mm:.5,y0Mm:.5,x1Mm:1.5,y1Mm:.5,powerW:10},
  {layer:1,zMm:.4,t0Seconds:.03,t1Seconds:.04,x0Mm:1.5,y0Mm:.5,x1Mm:1.5,y1Mm:.5,powerW:0},
  {layer:1,zMm:.4,t0Seconds:.04,t1Seconds:.06,x0Mm:1.5,y0Mm:.5,x1Mm:.5,y1Mm:.5,powerW:10}
 ];
 return {
  pitchMm:1,layerHeightMm:.2,originMm:{x:0,y:0,z:0},
  cells:[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]],
  partSha256:"a".repeat(64),sourceSha256:"b".repeat(64),
  scan:{version:PHYSICAL_SCAN_VERSION,sourceName:"synthetic.csv",commands} as PhysicalScanPlan,
  powerCouplingFraction:.5,beamRadiusMm:.8,
  densityKgM3:7800,specificHeatJKgK:500,
  powderConductivityWmK:2,solidConductivityWmK:20,
  convectionWm2K:8,ambientTemperatureC:25,plateTemperatureC:25
 };
}
test("Commanded energy and physical-layer transitions are conserved",()=>{
 const result=runPartialLayerResearch(setup());
 assert.equal(result.validationStatus,"UNVALIDATED_GRID_RESEARCH");
 assert.equal(result.grid.layers,2);
 assert.equal(result.chronology.commands,4);
 assert.ok(Math.abs(result.energy.commandedJ-.4)<1e-10);
 assert.ok(Math.abs(result.energy.absorbedJ-.2)<1e-10);
 assert.ok(result.energy.relativeImbalance<1e-9);
 assert.equal(result.layers[0].activeCells,4);
 assert.equal(result.layers[2].activeCells,8);
 assert.equal(result.layers[0].consolidatedCells,0);
 assert.ok(result.layers[1].consolidatedCells>0);
 assert.ok(result.layers[3].consolidatedCells>result.layers[1].consolidatedCells);
 assert.ok(result.finalCells.some(c=>c.state==="powder"));
 assert.ok(result.finalCells.some(c=>c.state==="consolidated"));
 assert.ok(result.finalCells.every(c=>Number.isFinite(c.temperatureC)));
});
test("Zero laser at uniform ambient equals thermal equilibrium",()=>{
 const x=setup();
 x.scan.commands=x.scan.commands.map(c=>({...c,powerW:0}));
 const result=runPartialLayerResearch(x);
 assert.equal(result.energy.absorbedJ,0);
 assert.ok(Math.abs(result.energy.storedJ)<1e-10);
 assert.ok(result.finalCells.every(c=>Math.abs(c.temperatureC-25)<1e-10));
 assert.ok(result.finalCells.every(c=>c.state==="powder"));
});
test("Changing plate temperature retains signed energy accounting",()=>{
 const x=setup();x.plateTemperatureC=100;
 const result=runPartialLayerResearch(x);
 assert.ok(result.energy.plateExchangeJ<0);
 assert.ok(result.energy.relativeImbalance<1e-9);
});
test("Reject timeline gaps, layer Z mismatch and powered transition",()=>{
 const x=setup();
 x.scan.commands[1].t0Seconds+=.001;
 assert.throws(()=>runPartialLayerResearch(x),/continuous times/);
 const y=setup();y.scan.commands[2].zMm=.5;
 assert.throws(()=>runPartialLayerResearch(y),/registered/);
 const z=setup();z.scan.commands[2].powerW=2;
 assert.throws(()=>runPartialLayerResearch(z),/laser-off/);
});
test("Reject impossible footprint and unsafely underresolved beam",()=>{
 const x=setup();
 x.scan.commands[1]={...x.scan.commands[1],x0Mm:100,x1Mm:100};
 assert.throws(()=>runPartialLayerResearch(x),/continuous times|unrepresented grid/);
 const y=setup();y.beamRadiusMm=.1;
 assert.throws(()=>runPartialLayerResearch(y),/beam radius/);
});
test("Reject grid overlaps, unconnected layers and missing last layer",()=>{
 const x=setup();x.cells.push([0,0,0]);
 assert.throws(()=>runPartialLayerResearch(x),/Duplicate/);
 const y=setup();y.cells=y.cells.filter(c=>c[2]===0||c[0]===0&&c[1]===0&&c[2]===1);
 const result=runPartialLayerResearch(y);assert.equal(result.grid.cellCount,5);
 const z=setup();z.scan.commands=z.scan.commands.filter(c=>c.layer===0);
 assert.throws(()=>runPartialLayerResearch(z),/final modeled layer/);
});
