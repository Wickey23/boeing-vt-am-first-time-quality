import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {LPBF_DEMO_INPUTS,simulateLpbfTransient,validateLpbfInputs} from "../lib/lpbf-transient";
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
