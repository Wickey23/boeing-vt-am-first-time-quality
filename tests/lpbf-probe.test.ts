import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {simulateMovingSource,MOVING_DEMO_INPUTS} from "../lib/lpbf-moving-source";
import {nominalLayerMap} from "../lib/lpbf-layer-mapping";
import {parseScanCsv,SCAN_CSV_HEADER} from "../lib/lpbf-scan-plan";
function cubeStl(){
 const g=new THREE.BoxGeometry(2,2,2).toNonIndexed(),p=g.getAttribute("position"),rows=["solid cube"];
 for(let i=0;i<p.count;i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
  const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  rows.push("facet normal "+n.toArray().join(" "),"outer loop",...[a,b,c].map(v=>"vertex "+v.toArray().join(" ")),"endloop","endfacet");
 }
 rows.push("endsolid cube");return new TextEncoder().encode(rows.join("\n")).buffer;
}
const input={...MOVING_DEMO_INPUTS,ambientTemperatureC:25,plateTemperatureC:25,recoatSecondsPerLayer:0,absorbedFraction:.15};
test("Voxel probe records inside-slab samples, per-step maximum, and preserves global energy balance",()=>{
 const buffer=cubeStl(),ordinary=simulateMovingSource(buffer,1,input);
 const result=simulateMovingSource(buffer,1,input,undefined,undefined,1,{xMm:0,yMm:0,zMm:0});
 const probe=result.probe!;
 assert.ok(probe);
 assert.equal(probe.model,"INTERNAL_THERMAL_VOXEL_PROBE_UNVALIDATED");
 assert.ok(probe.sampledPoints.length>result.frames.length);
 assert.ok(probe.sampledPoints.length<=2050);
 assert.ok(probe.voxelActivationTimeSeconds>=0);
 assert.ok(probe.registrationOffsetMm<=probe.voxelWidthMm*.9);
 assert.ok(probe.observedStepPeakC>=probe.sampledPeakC-1e-8);
 assert.ok(probe.sampledPoints.some(p=>p.laserActive));
 assert.ok(probe.sampledPoints.every((p,i)=>i===0||p.timeSeconds>probe.sampledPoints[i-1].timeSeconds));
 assert.ok(Math.abs(ordinary.summary.absorbedEnergyJ-result.summary.absorbedEnergyJ)<1e-8);
 assert.ok(Math.abs(ordinary.summary.peakSolidTemperatureC-result.summary.peakSolidTemperatureC)<1e-8);
 assert.ok(result.summary.relativeEnergyImbalance<1e-4);
 assert.equal(result.layerMapping?.physicalLayerCount,Math.ceil(2/input.layerThicknessMm));
 assert.ok(probe.maximumSampleGapSeconds>0);
});
test("Internal probe refuses locations outside geometry or nonfinite STL coordinates",()=>{
 const f=cubeStl();
 assert.throws(()=>simulateMovingSource(f,1,input,undefined,undefined,1,{xMm:99,yMm:0,zMm:0}),/not within 0.9 voxel/);
 assert.throws(()=>simulateMovingSource(f,1,input,undefined,undefined,1,{xMm:NaN,yMm:0,zMm:0}),/finite STL-aligned/);
});
test("Imported powered and zero-power travel remain distinguishable in captured probe history",()=>{
 const f=cubeStl(),rows=[SCAN_CSV_HEADER];
 for(let slab=0;slab<6;slab++){
  rows.push([slab,-.6,0,.6,0,80,500].join(","));
  rows.push([slab,.6,0,-.6,0,0,500].join(","));
 }
 const plan={...parseScanCsv(rows.join("\n")),sha256:"c".repeat(64)};
 const result=simulateMovingSource(f,1,input,undefined,plan,1,{xMm:0,yMm:0,zMm:0});
 const readings=result.probe?.sampledPoints??[];
 assert.equal(result.engine,"lpbf-imported-enthalpy-0.1");
 assert.ok(readings.some(s=>s.laserActive&&s.laserPowerW===80));
 assert.ok(readings.some(s=>!s.laserActive&&s.laserPowerW===0));
 assert.ok(result.summary.absorbedEnergyJ>0);
});
test("Nominal geometric physical-layer centers map once to occupied virtual slab indices",()=>{
 const map=nominalLayerMap({buildHeightMm:2,physicalLayerThicknessMm:.2,virtualCellHeightMm:1/3,
  occupiedZIndices:[0,1,2,3,4,5]});
 assert.equal(map.physicalLayerCount,10);
 assert.equal(map.slabs.reduce((a,s)=>a+s.nominalPhysicalLayerIndices.length,0),10);
 assert.equal(map.unmappedNominalIndices.length,0);
 assert.deepEqual(map.slabs.flatMap(s=>s.nominalPhysicalLayerIndices),[0,1,2,3,4,5,6,7,8,9]);
 const gap=nominalLayerMap({buildHeightMm:2,physicalLayerThicknessMm:.2,virtualCellHeightMm:1/3,
  occupiedZIndices:[0,1,3,4,5]});
 assert.ok(gap.unmappedNominalIndices.length>0);
 assert.throws(()=>nominalLayerMap({buildHeightMm:2,physicalLayerThicknessMm:.2,virtualCellHeightMm:1/3,
  occupiedZIndices:[0,1,1,3]}),/strictly increasing/);
});
