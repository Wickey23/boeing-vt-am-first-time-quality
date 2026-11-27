import {test} from "node:test";
import assert from "node:assert/strict";
import {initialJ2State,updateJ2Research,type Tensor6} from "../lib/lpbf-j2-material-research";
const m={youngsModulusMPa:200000,poissonRatio:.3,initialYieldMPa:200,hardeningMPa:1000,thermalExpansionPerK:1e-5,sourceLabel:"Synthetic analytical J2 benchmark"};
const G=m.youngsModulusMPa/(2*(1+m.poissonRatio));
const close=(a:number,b:number,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`Expected ${b}, got ${a}`);
test("M11 J2 free thermal expansion and hydrostatic restraint do not produce deviatoric yielding",()=>{
 const r=updateJ2Research(m,initialJ2State(),[.001,.001,.001,0,0,0],120,20);
 assert.ok(r.stressMPa.every(s=>Math.abs(s)<1e-8));
 const fixed=updateJ2Research(m,initialJ2State(),[0,0,0,0,0,0],120,20);
 const p=-m.youngsModulusMPa*.001/(1-2*m.poissonRatio);
 for(let i=0;i<3;i++)close(fixed.stressMPa[i],p);
 close(fixed.vonMisesMPa,0);close(fixed.plasticIncrement,0);
});
test("M11 J2 pure shear matches closed-form radial return with hardening",()=>{
 const shear=.004,qTrial=Math.sqrt(3)*2*G*shear,delta=(qTrial-m.initialYieldMPa)/(3*G+m.hardeningMPa);
 const r=updateJ2Research(m,initialJ2State(),[0,0,0,shear,0,0],20,20);
 close(r.plasticIncrement,delta);
 close(r.state.plasticStrain[3],Math.sqrt(3)/2*delta);
 close(r.vonMisesMPa,m.initialYieldMPa+m.hardeningMPa*delta);
 close(r.stressMPa[3],r.vonMisesMPa/Math.sqrt(3));
 close(r.plasticDissipationMPa,m.initialYieldMPa*delta);
 assert.equal(r.productionActivationAuthorized,false);
});
test("M11 J2 unloading retains plastic strain and reverse loading increases accumulated plastic strain",()=>{
 const first=updateJ2Research(m,initialJ2State(),[0,0,0,.004,0,0],20,20);
 const free=updateJ2Research(m,first.state,[...first.state.plasticStrain] as Tensor6,20,20);
 close(free.vonMisesMPa,0);close(free.plasticIncrement,0);
 assert.deepEqual(free.state,first.state);
 const reverse=updateJ2Research(m,free.state,[0,0,0,-.004,0,0],20,20);
 assert.ok(reverse.state.equivalentPlasticStrain>first.state.equivalentPlasticStrain);
 assert.ok(reverse.stressMPa[3]<0);
 close(reverse.vonMisesMPa,reverse.yieldStressMPa);
});
test("M11 J2 rejects inconsistent state and invalid material",()=>{
 assert.throws(()=>updateJ2Research(m,{plasticStrain:[.001,0,0,0,0,0],equivalentPlasticStrain:.01},[0,0,0,0,0,0],20,20),/history/);
 assert.throws(()=>updateJ2Research({...m,hardeningMPa:-1},initialJ2State(),[0,0,0,0,0,0],20,20),/material/);
});
