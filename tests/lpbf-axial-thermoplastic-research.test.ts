import {test} from "node:test";
import assert from "node:assert/strict";
import {runAxialThermoplasticResearch,type AxialThermoplasticStep} from "../lib/lpbf-axial-thermoplastic-research";
const material={youngsModulusMPa:200000,yieldStressMPa:200,thermalExpansionPerK:1e-5,referenceTemperatureC:20,sourceLabel:"Synthetic analytical benchmark; not alloy data"};
const fixed=(timeSeconds:number,temperatureC:number):AxialThermoplasticStep=>({timeSeconds,temperatureC,constraint:"fixed-strain",prescribedTotalStrain:0});
const free=(timeSeconds:number,temperatureC:number):AxialThermoplasticStep=>({timeSeconds,temperatureC,constraint:"traction-free"});
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`Expected ${b}, got ${a}`);
test("M11 free expansion produces zero stress and reversible thermal strain",()=>{
 const r=runAxialThermoplasticResearch(material,[free(0,20),free(1,320),free(2,20)]);
 close(r.steps[1].totalStrain,.003);
 assert.ok(r.steps.every(s=>s.stressMPa===0&&s.plasticStrain===0));
 close(r.steps[2].totalStrain,0);
});
test("M11 elastic restrained cycle returns to zero stress",()=>{
 const r=runAxialThermoplasticResearch(material,[fixed(0,20),fixed(1,70),fixed(2,20)]);
 close(r.steps[1].stressMPa,-100);
 close(r.steps[2].stressMPa,0);
 assert.equal(r.steps[2].plasticStrain,0);
});
test("M11 compression yielding, reverse yielding and idealized release match closed-form strain cycle",()=>{
 const r=runAxialThermoplasticResearch(material,[fixed(0,20),fixed(1,320),fixed(2,20),free(3,20)]);
 close(r.steps[1].stressMPa,-200);
 close(r.steps[1].plasticStrain,-.002);
 close(r.steps[2].stressMPa,200);
 close(r.steps[2].plasticStrain,-.001);
 close(r.steps[2].accumulatedPlasticStrain,.003);
 close(r.steps[3].stressMPa,0);
 close(r.steps[3].totalStrain,-.001);
 assert.equal(r.productionActivationAuthorized,false);
 assert.ok(r.steps.every(s=>Math.abs(s.totalStrain-s.thermalStrain-s.elasticStrain-s.plasticStrain)<1e-10));
});
test("M11 fails closed on inconsistent boundary conditions or initial states",()=>{
 assert.throws(()=>runAxialThermoplasticResearch(material,[fixed(0,20),fixed(0,70)]),/unordered/);
 assert.throws(()=>runAxialThermoplasticResearch(material,[fixed(0,30),fixed(1,70)]),/stress-free/);
 assert.throws(()=>runAxialThermoplasticResearch(material,[fixed(0,20),{...free(1,70),prescribedTotalStrain:0}]),/cannot also prescribe/);
});
