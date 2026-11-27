import {test} from "node:test";
import assert from "node:assert/strict";
import {solveThermalSectionResearch,type SectionFiber} from "../lib/lpbf-thermal-section-research";
const material={youngsModulusMPa:200000,yieldStressMPa:200,thermalExpansionPerK:1e-5,referenceTemperatureC:20,sourceLabel:"Synthetic section benchmark"};
function fibers(temperaturesC:number[],inelastic=[0,0,0]):SectionFiber[]{
 return [-1,0,1].map((zMm,i)=>({id:String(i),zMm,areaMm2:1,material,temperatureC:temperaturesC[i],prescribedInelasticStrain:inelastic[i]}));
}
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`Expected ${b}, got ${a}`);
test("M11 uniform heating gives free expansion and no curvature or residual stress",()=>{
 const r=solveThermalSectionResearch(fibers([70,70,70]),{kind:"free"});
 close(r.axialStrainAtOrigin,.0005);close(r.curvaturePerMm,0);
 assert.ok(r.fibers.every(f=>Math.abs(f.stressMPa)<1e-8));
});
test("M11 linear through-height temperature gradient gives exact free curvature",()=>{
 const r=solveThermalSectionResearch(fibers([20,70,120]),{kind:"free"});
 close(r.axialStrainAtOrigin,.0005);close(r.curvaturePerMm,.0005);
 close(r.resultantForceN,0);close(r.resultantMomentAboutCenterNmm,0);
 assert.ok(r.fibers.every(f=>Math.abs(f.stressMPa)<1e-8));
});
test("M11 nonlinear prescribed inelastic strain leaves self-equilibrated section stress",()=>{
 const r=solveThermalSectionResearch(fibers([20,20,20],[0,-.0012,0]),{kind:"free"});
 close(r.curvaturePerMm,0);close(r.axialStrainAtOrigin,-.0004);
 close(r.fibers[0].stressMPa,-80);close(r.fibers[1].stressMPa,160);close(r.fibers[2].stressMPa,-80);
 close(r.resultantForceN,0);close(r.resultantMomentAboutCenterNmm,0);
 assert.equal(r.productionActivationAuthorized,false);
});
test("M11 fixed section returns force and moment; free release is coordinate invariant",()=>{
 const f=fibers([20,45,70]);
 const r=solveThermalSectionResearch(f,{kind:"fixed",axialStrainAtOrigin:0,curvaturePerMm:0});
 close(r.resultantForceN,-150);close(r.resultantMomentAboutCenterNmm,-100);
 const a=solveThermalSectionResearch(f,{kind:"free"});
 const b=solveThermalSectionResearch(f.map(x=>({...x,zMm:x.zMm+25})),{kind:"free"});
 close(a.curvaturePerMm,b.curvaturePerMm);close(a.axialStrainAtCentroid,b.axialStrainAtCentroid);
 for(let i=0;i<f.length;i++)close(a.fibers[i].stressMPa,b.fibers[i].stressMPa);
});
test("M11 rejects singular section and predicted yielding in elastic release",()=>{
 assert.throws(()=>solveThermalSectionResearch(fibers([20,20,20]).map(f=>({...f,zMm:0})),{kind:"free"}),/distinct/);
 assert.throws(()=>solveThermalSectionResearch(fibers([20,20,20],[0,-.01,0]),{kind:"free"}),/would yield/);
});
