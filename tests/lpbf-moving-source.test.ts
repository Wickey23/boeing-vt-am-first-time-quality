import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
 MOVING_DEMO_INPUTS,MOVING_SOURCE_VERSION,validateMovingInputs,
 specificEnthalpy,temperatureFromEnthalpy,rasterPosition,gaussianWeights,
 movingEnthalpyStep,simulateMovingSource
} from "../lib/lpbf-moving-source";
const input={...MOVING_DEMO_INPUTS,ambientTemperatureC:25,plateTemperatureC:25,convectionWm2K:0};
function cubeStl(){
 const mesh=new THREE.BoxGeometry(2,2,2).toNonIndexed(),pos=mesh.getAttribute("position");
 const rows=["solid test"];
 for(let i=0;i<pos.count;i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);
  const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  rows.push("facet normal "+n.toArray().join(" "),"outer loop",
   ...[a,b,c].map(p=>"vertex "+p.toArray().join(" ")),"endloop","endfacet");
 }
 rows.push("endsolid test");
 return new TextEncoder().encode(rows.join("\n")).buffer;
}
test("Moving LPBF inputs reject invalid beam, mushy interval and latent heat",()=>{
 assert.throws(()=>validateMovingInputs({...input,beamRadiusMm:0}),/Beam radius/);
 assert.throws(()=>validateMovingInputs({...input,liquidusC:input.solidusC}),/Liquidus/);
 assert.throws(()=>validateMovingInputs({...input,latentHeatJKg:-1}),/Latent heat/);
});
test("Enthalpy is invertible below, within and above phase-change interval",()=>{
 for(const temp of [25,900,1599,1600,1620,1660,1695]){
  const energy=specificEnthalpy(temp,input),back=temperatureFromEnthalpy(energy,input);
  assert.ok(Math.abs(back-temp)<1e-9,"enthalpy at "+temp+": "+back);
 }
});
test("Latent heat reduces temperature rise at the same supplied energy",()=>{
 const withLatent=temperatureFromEnthalpy(specificEnthalpy(1660,input),input);
 const withoutLatent=temperatureFromEnthalpy(specificEnthalpy(1660,input),{...input,latentHeatJKg:0});
 assert.equal(withLatent,1660);
 assert.ok(withoutLatent>withLatent+200);
});
test("Serpentine raster advances along alternating X track directions",()=>{
 const b={minX:0,maxX:4,minY:0,maxY:2},h=1;
 const first=rasterPosition(0.5,b,h),second=rasterPosition(4.5,b,h);
 assert.ok(first.x<2&&first.row===0);
 assert.ok(second.x>2&&second.row===1);
 const weights=gaussianWeights([{x:0,y:0},{x:3,y:0}],0,.1,1);
 assert.ok(weights[0]>weights[1]);
 assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-12);
});
test("Energy-normalized moving heat source conserves a two-voxel enthalpy update",()=>{
 const cells:Array<[number,number,number]>=[[0,0,0],[0,0,1]];
 const neighbors=[new Int32Array([-1,-1,-1,-1,1,-1]),new Int32Array([-1,-1,-1,-1,-1,0])];
 const energy=new Float64Array(2),active=new Uint8Array([1,1]),heatJ=new Float64Array([2,0]);
 const out=movingEnthalpyStep({cells,neighbors,active,energy,heatJ,zBase:0,hM:.001,dt:1e-5,input});
 assert.equal(out.absorbedEnergyJ,2);
 assert.ok(Math.abs(energy[0]+energy[1]-out.absorbedEnergyJ+out.plateEnergyJ+out.convectiveEnergyJ)<1e-10);
});
test("Moving-source solver produces signed, bounded surface history and energy balance for closed cube",()=>{
 const r=simulateMovingSource(cubeStl(),1,{...input,laserPowerW:90,absorbedFraction:.1});
 assert.equal(r.engine,MOVING_SOURCE_VERSION);
 assert.ok(r.frames.length>=2);
 assert.ok(r.summary.absorbedEnergyJ>0);
 assert.ok(r.summary.peakSolidTemperatureC>25);
 assert.ok(r.summary.relativeEnergyImbalance<1e-4);
 assert.ok(r.frames.every(f=>f.field.values.length===36));
 assert.ok(r.limitations.some(x=>/porosity/.test(x)));
});
test("No laser and plate equal ambient preserves equilibrium",()=>{
 const r=simulateMovingSource(cubeStl(),1,{...input,absorbedFraction:0});
 assert.equal(r.summary.absorbedEnergyJ,0);
 assert.ok(r.frames.every(f=>Math.abs(f.maxC-input.ambientTemperatureC)<1e-9));
 assert.ok(r.summary.relativeEnergyImbalance<1e-4);
});
