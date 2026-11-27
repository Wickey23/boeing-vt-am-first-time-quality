import {test} from "node:test";
import assert from "node:assert/strict";
import {createRadiationBoundary,STEFAN_BOLTZMANN} from "../lib/lpbf-radiation-boundary";
import {runPartialLayerResearch,type PartialLayerInputs} from "../lib/lpbf-partial-layer";
import {PHYSICAL_SCAN_VERSION} from "../lib/lpbf-physical-schedule";
const radiation={emissivity:.8,environmentTemperatureC:25,maximumTemperatureC:1000,sourceLabel:"Synthetic numerical test"};
function input():PartialLayerInputs{
 return {pitchMm:.5,layerHeightMm:.5,originMm:{x:0,y:0,z:0},cells:[[0,0,0],[0,0,1]],
 partSha256:"a".repeat(64),sourceSha256:"b".repeat(64),scan:{version:PHYSICAL_SCAN_VERSION,sourceName:"synthetic",
 commands:[{layer:0,zMm:.5,t0Seconds:0,t1Seconds:.1,x0Mm:.25,y0Mm:.25,x1Mm:.25,y1Mm:.25,powerW:0},
 {layer:1,zMm:1,t0Seconds:.1,t1Seconds:.3,x0Mm:.25,y0Mm:.25,x1Mm:.25,y1Mm:.25,powerW:0}]},
 powerCouplingFraction:0,beamRadiusMm:.4,densityKgM3:7800,specificHeatJKgK:500,
 powderConductivityWmK:2,solidConductivityWmK:2,convectionWm2K:0,ambientTemperatureC:25,plateTemperatureC:800};
}
test("M08 gray radiation uses absolute temperature and signed flux",()=>{
 const boundary=createRadiationBoundary(radiation);
 assert.equal(boundary.fluxWm2(25),0);
 assert.ok(boundary.fluxWm2(0)<0);
 assert.ok(Math.abs(boundary.fluxWm2(800)-.8*STEFAN_BOLTZMANN*((800+273.15)**4-(25+273.15)**4))<1e-8);
 assert.throws(()=>boundary.fluxWm2(1001),/outside/);
 assert.throws(()=>createRadiationBoundary({...radiation,emissivity:1.1}),/Invalid/);
});
test("M08 radiative cooling reduces temperatures and closes signed energy ledger",()=>{
 const options={absoluteTimeStepCeilingSeconds:.0001};
 const a=runPartialLayerResearch(input(),undefined,options);
 const zero=runPartialLayerResearch(input(),undefined,{...options,radiation:{...radiation,emissivity:0}});
 const b=runPartialLayerResearch(input(),undefined,{...options,radiation});
 assert.deepEqual(zero.finalCells,a.finalCells);
 assert.equal(zero.energy.radiationExchangeJ,0);
 assert.ok(b.energy.radiationExchangeJ!>0);
 assert.ok(b.finalCells.every((c,i)=>c.temperatureC<a.finalCells[i].temperatureC));
 assert.ok(Math.abs(b.energy.absorbedJ-b.energy.plateExchangeJ-b.energy.convectionExchangeJ-b.energy.radiationExchangeJ!-b.energy.storedJ)<1e-10);
 assert.equal(b.radiationBoundary?.productionActivationAuthorized,false);
 const hotEnv=runPartialLayerResearch({...input(),plateTemperatureC:25},undefined,{...options,radiation:{...radiation,environmentTemperatureC:800}});
 assert.ok(hotEnv.energy.radiationExchangeJ!<0);
 assert.ok(hotEnv.energy.storedJ>0);
 assert.throws(()=>runPartialLayerResearch(input(),undefined,{radiation:{...radiation,maximumTemperatureC:799}}),/outside/);
});
