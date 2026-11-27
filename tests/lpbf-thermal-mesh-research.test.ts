import {test} from "node:test";
import assert from "node:assert/strict";
import {solveThermalMeshResearch,type ThermalMeshInput} from "../lib/lpbf-thermal-mesh-research";
const base:ThermalMeshInput={cells:[{x:0,y:0,layer:0,temperatureC:70,referenceTemperatureC:20},{x:0,y:0,layer:1,temperatureC:70,referenceTemperatureC:20}],
 pitchMm:.5,layerHeightMm:.25,youngsModulusMPa:200000,poissonRatio:.3,thermalExpansionPerK:1e-5,yieldStressMPa:400,
 sourceLabel:"Synthetic isotropic elastic benchmark",constraint:"rigid-motion-pins"};
const close=(a:number,b:number,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`Expected ${b}, got ${a}`);
test("M11 rectangular tetrahedral mesh reproduces exact stress-free isotropic expansion",()=>{
 const r=solveThermalMeshResearch(base);
 assert.equal(r.tetrahedra,12);
 assert.equal(r.nodes.length,12);
 for(let i=0;i<r.nodes.length;i++)for(let d=0;d<3;d++)close(r.displacement[i][d],.0005*r.nodes[i][d]);
 assert.ok(r.maxVonMisesMPa<1e-5);
 assert.ok(r.elasticEnergyNmm<1e-12);
 assert.equal(r.productionActivationAuthorized,false);
});
test("M11 clamped thermal mesh retains stress and releases under rigid-motion-only constraints",()=>{
 const restrained=solveThermalMeshResearch({...base,constraint:"clamped-base"});
 const released=solveThermalMeshResearch(base);
 assert.ok(restrained.maxVonMisesMPa>1);
 assert.ok(restrained.elasticEnergyNmm>released.elasticEnergyNmm);
 for(let i=0;i<restrained.nodes.length;i++)if(restrained.nodes[i][2]===0)assert.deepEqual(restrained.displacement[i],[0,0,0]);
 assert.ok(Math.hypot(...restrained.equilibrium.reactionForceN)<1e-5);
 assert.ok(Math.hypot(...restrained.equilibrium.reactionMomentNmm)<1e-5);
 assert.ok(restrained.equilibrium.maxFreeForceN<1e-5);
});
test("M11 differential thermal strain produces compatible nonuniform elastic field",()=>{
 const r=solveThermalMeshResearch({...base,cells:base.cells.map((c,i)=>({...c,temperatureC:i===0?20:70}))});
 assert.ok(r.maxVonMisesMPa>1);
 assert.ok(r.elasticEnergyNmm>0);
 assert.ok(Math.hypot(...r.equilibrium.reactionForceN)<1e-5);
 assert.ok(r.equilibrium.maxFreeForceN<1e-5);
});
test("M11 zero-temperature change yields exact zero field; invalid or yielding meshes fail closed",()=>{
 const r=solveThermalMeshResearch({...base,cells:base.cells.map(c=>({...c,temperatureC:20}))});
 assert.equal(r.maxVonMisesMPa,0);assert.equal(r.maxDisplacementMm,0);
 assert.throws(()=>solveThermalMeshResearch({...base,cells:[base.cells[0],{...base.cells[1],layer:3}]}),/connectivity/);
 assert.throws(()=>solveThermalMeshResearch({...base,constraint:"clamped-base",yieldStressMPa:1}),/would yield/);
});
