import {test} from "node:test";
import assert from "node:assert/strict";
import {createExternalThermalBoundary} from "../lib/lpbf-external-thermal-boundary";
import {runPartialLayerResearch,type PartialLayerInputs} from "../lib/lpbf-partial-layer";
import {PHYSICAL_SCAN_VERSION} from "../lib/lpbf-physical-schedule";
const external={powderConductivityWmK:.2,powderPathMm:1,powderReservoirTemperatureC:25,
 substrateConductivityWmK:10,substrateThicknessMm:1,contactResistanceM2KW:.0001,sourceLabel:"Synthetic resistance benchmark"};
function input():PartialLayerInputs{
 return {pitchMm:.5,layerHeightMm:.5,originMm:{x:0,y:0,z:0},cells:[[0,0,0],[0,0,1]],
 partSha256:"a".repeat(64),sourceSha256:"b".repeat(64),scan:{version:PHYSICAL_SCAN_VERSION,sourceName:"synthetic",
 commands:[{layer:0,zMm:.5,t0Seconds:0,t1Seconds:.1,x0Mm:.25,y0Mm:.25,x1Mm:.25,y1Mm:.25,powerW:0},
 {layer:1,zMm:1,t0Seconds:.1,t1Seconds:.3,x0Mm:.25,y0Mm:.25,x1Mm:.25,y1Mm:.25,powerW:0}]},
 powerCouplingFraction:0,beamRadiusMm:.4,densityKgM3:7800,specificHeatJKgK:500,
 powderConductivityWmK:2,solidConductivityWmK:2,convectionWm2K:0,ambientTemperatureC:25,plateTemperatureC:100};
}
test("M08 external resistances match series conduction and reject invalid inputs",()=>{
 const b=createExternalThermalBoundary(external);
 assert.ok(Math.abs(b.powderCoefficient(2,.00025)-1/(.00025/2+.001/.2))<1e-10);
 assert.ok(Math.abs(b.substrateCoefficient(2,.00025)-1/(.00025/2+.001/10+.0001))<1e-10);
 assert.throws(()=>createExternalThermalBoundary({...external,powderPathMm:0}),/Invalid/);
});
test("M08 substrate resistance and powder exchange agree with a one-cell exact reference and conserve energy",()=>{
 const b=createExternalThermalBoundary(external),x=input();
 const result=runPartialLayerResearch(x,undefined,{externalBoundary:external,absoluteTimeStepCeilingSeconds:.0001,captureFrames:true});
 // First command has four powder sides, no bottom powder flux and insulated top.
 const area=.0005**2,C=7800*.0005**3*500;
 const Gp=4*area*b.powderCoefficient(2,.00025),Gb=area*b.substrateCoefficient(2,.00025);
 const equilibrium=(Gp*25+Gb*100)/(Gp+Gb);
 const exact=equilibrium+(25-equilibrium)*Math.exp(-(Gp+Gb)*.1/C);
 assert.ok(Math.abs(result.frames![0].cells[0].temperatureC-exact)<.03);
 assert.ok(result.energy.powderExchangeJ!>0);
 assert.ok(result.energy.plateExchangeJ<0);
 assert.equal(result.energy.convectionExchangeJ,0);
 assert.ok(Math.abs(result.energy.absorbedJ-result.energy.plateExchangeJ-result.energy.convectionExchangeJ-result.energy.powderExchangeJ!-result.energy.storedJ)<1e-10);
 assert.equal(result.externalBoundary?.productionActivationAuthorized,false);
 const equilibriumRun=runPartialLayerResearch({...x,plateTemperatureC:25},undefined,{externalBoundary:external});
 assert.ok(equilibriumRun.finalCells.every(c=>c.temperatureC===25));
 const hot=runPartialLayerResearch({...x,plateTemperatureC:25},undefined,{externalBoundary:{...external,powderReservoirTemperatureC:100}});
 assert.ok(hot.energy.powderExchangeJ!<0);
});
