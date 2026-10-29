import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {LPBF_DEMO_INPUTS,simulateLpbfTransient,transientHeatStep,validateLpbfInputs} from "../lib/lpbf-transient";
function cubeStl(){
 const mesh=new THREE.BoxGeometry(2,2,2).toNonIndexed();
 const p=mesh.getAttribute("position"),text=["solid cube"];
 for(let i=0;i<p.count;i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
  const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  text.push("facet normal "+normal.toArray().join(" "),"outer loop",...[a,b,c].map(v=>"vertex "+v.toArray().join(" ")),"endloop","endfacet");
 }
 text.push("endsolid cube");
 return new TextEncoder().encode(text.join("\n")).buffer;
}
const base={...LPBF_DEMO_INPUTS,recoatSecondsPerLayer:0,ambientTemperatureC:25,plateTemperatureC:25,resolution:6};
test("LPBF transient inputs reject nonphysical or incomplete settings",()=>{
 assert.throws(()=>validateLpbfInputs({...base,absorbedFraction:-.1}),/absorbedFraction/);
 assert.throws(()=>validateLpbfInputs({...base,layerThicknessMm:0}),/layerThicknessMm/);
 assert.throws(()=>validateLpbfInputs({...base,resolution:2}),/resolution/);
});
test("solid-state heat worker conserves energy for zero laser input",()=>{
 const out=simulateLpbfTransient(cubeStl(),1,{...base,absorbedFraction:0});
 assert.ok(out.frames.length>=2);
 assert.equal(out.summary.absorbedEnergyJ,0);
 assert.ok(out.frames.every(f=>Math.abs(f.maxC-25)<1e-6));
 assert.ok(out.summary.relativeEnergyImbalance<1e-4);
 assert.ok(!out.summary.exceedsSolidus);
});
test("coupled laser energy drives temperature above the zero-power baseline, without predicting defects",()=>{
 const out=simulateLpbfTransient(cubeStl(),1,{...base,absorbedFraction:.08,laserPowerW:110});
 assert.ok(out.summary.absorbedEnergyJ>0);
 assert.ok(out.summary.peakSolidTemperatureC>25);
 assert.ok(out.summary.relativeEnergyImbalance<1e-4);
 assert.ok(out.frames.every(x=>x.field.values.length===36));
 assert.ok(out.limitations.some(x=>/porosity/.test(x)));
 assert.ok(out.mesh.nominalLayers>out.mesh.virtualSlabs);
});

test("two-voxel explicit finite volume update matches hand-calculated heat flux",()=>{
 const h=.001,dt=.0001,k=7,rho=4430,cp=600;
 const cells:Array<[number,number,number]>=[[0,0,0],[0,0,1]];
 const a=new Int32Array([-1,-1,-1,-1,1,-1]),b=new Int32Array([-1,-1,-1,-1,-1,0]);
 const t=new Float64Array([20,0]);
 const input={...base,conductivityWmK:k,densityKgM3:rho,specificHeatJKgK:cp,plateTemperatureC:0,ambientTemperatureC:0,convectionWm2K:0};
 const C=rho*cp*h**3,face=k*h;
 transientHeatStep({cells,temp:t,active:new Uint8Array([1,1]),neighbors:[a,b],zBase:0,cellSizeM:h,dt,input});
 assert.ok(Math.abs(t[0]-(20+(-face*20-2*face*20)*dt/C))<1e-10);
 assert.ok(Math.abs(t[1]-(face*20*dt/C))<1e-10);
});

test("high coupling is flagged as outside solid-state validity, never labeled as a melt-pool prediction",()=>{
 const result=simulateLpbfTransient(cubeStl(),1,{
  ...base,laserPowerW:950,absorbedFraction:.9,solidusC:400
 });
 assert.equal(result.summary.exceedsSolidus,true);
 assert.ok(result.frames.some(frame=>frame.aboveSolidus));
 assert.ok(result.limitations.some(line=>/OUTSIDE.*validity/.test(line)));
});
