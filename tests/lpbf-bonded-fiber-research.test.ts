import {test} from "node:test";
import assert from "node:assert/strict";
import {runBondedFiberResearch,type BondedFiberStep} from "../lib/lpbf-bonded-fiber-research";
const material={youngsModulusMPa:200000,yieldStressMPa:200,thermalExpansionPerK:1e-5,referenceTemperatureC:20,sourceLabel:"Synthetic benchmark"};
const fibers=[{id:"A",areaMm2:1,material},{id:"B",areaMm2:1,material}];
const fixed=(timeSeconds:number,temperaturesC:number[]):BondedFiberStep=>({timeSeconds,temperaturesC,constraint:"fixed-strain",prescribedTotalStrain:0});
const free=(timeSeconds:number,temperaturesC:number[]):BondedFiberStep=>({timeSeconds,temperaturesC,constraint:"zero-resultant-force"});
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`Expected ${b}, got ${a}`);
test("M11 free bonded fibers equilibrate differential thermal stress at common strain",()=>{
 const r=runBondedFiberResearch(fibers,[free(0,[20,20]),free(1,[70,20])]);
 close(r.steps[1].commonTotalStrain,.00025);
 close(r.steps[1].fibers[0].stressMPa,-50);
 close(r.steps[1].fibers[1].stressMPa,50);
 close(r.steps[1].resultantForceN,0);
});
test("M11 restrained heating, cooling and free axial release retain self-equilibrated stress",()=>{
 const r=runBondedFiberResearch(fibers,[fixed(0,[20,20]),fixed(1,[320,20]),fixed(2,[20,20]),free(3,[20,20])]);
 close(r.steps[1].fibers[0].plasticStrain,-.002);
 close(r.steps[2].resultantForceN,200);
 close(r.steps[3].commonTotalStrain,-.0005);
 close(r.steps[3].fibers[0].stressMPa,100);
 close(r.steps[3].fibers[1].stressMPa,-100);
 close(r.steps[3].resultantForceN,0);
 for(const s of r.steps)for(const f of s.fibers)close(s.commonTotalStrain,f.thermalStrain+f.elasticStrain+f.plasticStrain);
 assert.equal(r.productionActivationAuthorized,false);
});
test("M11 unequal fiber areas use force-weighted rather than mean stress equilibrium",()=>{
 const r=runBondedFiberResearch([fibers[0],{...fibers[1],areaMm2:3}],[free(0,[20,20]),free(1,[70,20])]);
 close(r.steps[1].commonTotalStrain,.000125);
 close(r.steps[1].fibers[0].stressMPa,-75);
 close(r.steps[1].fibers[1].stressMPa,25);
 close(r.steps[1].resultantForceN,0);
});
test("M11 nonunique perfect-plastic release and incompatible histories fail closed",()=>{
 assert.throws(()=>runBondedFiberResearch(fibers,[free(0,[20,20]),free(1,[520,20])]),/Nonunique/);
 assert.throws(()=>runBondedFiberResearch(fibers,[fixed(0,[20,20]),free(1,[20])]),/history/);
});
