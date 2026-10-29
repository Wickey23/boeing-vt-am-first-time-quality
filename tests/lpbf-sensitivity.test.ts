import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {simulateMovingSource,MOVING_DEMO_INPUTS} from "../lib/lpbf-moving-source";
import {compareLpbfRuns,runLpbfSensitivity} from "../lib/lpbf-sensitivity";
import {parseScanCsv,SCAN_CSV_HEADER} from "../lib/lpbf-scan-plan";
import {voxelizePart} from "../lib/voxel-thermal";
function cubeStl(){
 const g=new THREE.BoxGeometry(2,2,2).toNonIndexed(),p=g.getAttribute("position"),lines=["solid cube"];
 for(let i=0;i<p.count;i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2),
   n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  lines.push("facet normal "+n.toArray().join(" "),"outer loop",...[a,b,c].map(x=>"vertex "+x.toArray().join(" ")),"endloop","endfacet");
 }
 lines.push("endsolid cube");return new TextEncoder().encode(lines.join("\n")).buffer;
}
const input={...MOVING_DEMO_INPUTS,ambientTemperatureC:25,plateTemperatureC:25,convectionWm2K:0,laserPowerW:80,absorbedFraction:.1};
test("Time-step and generated-grid sensitivity reports numerical differences without claiming convergence",()=>{
 const buffer=cubeStl(),baseline=simulateMovingSource(buffer,1,input);
 const stages:string[]=[];
 const study=runLpbfSensitivity(buffer,1,input,baseline,undefined,(stage)=>stages.push(stage));
 assert.equal(study.version,"lpbf-numerical-sensitivity-0.1");
 assert.equal(study.engine,baseline.engine);
 assert.equal(study.temporal.candidateStepScale,.5);
 assert.equal(study.temporal.candidateResolution,input.resolution);
 assert.ok(study.temporal.candidateTimeSteps>=study.temporal.baselineTimeSteps);
 assert.ok(study.temporal.surfaceRmsDifferenceC>=0);
 assert.ok(study.spatial||study.spatialSkippedReason);
 if(study.spatial){
  assert.equal(study.spatial.candidateResolution,input.resolution+2);
  assert.ok(study.spatial.surfaceRmsDifferenceC>=0);
 }
 assert.ok(stages.includes("time-step"));
 assert.ok(study.interpretation.join(" ").includes("not"));
 assert.ok(!("converged" in study));
});
test("Imported virtual-slab path uses time-step check only and retains scan hash",()=>{
 const buffer=cubeStl();
 const n=[...new Set(voxelizePart(buffer,{x:0,y:0,z:0},1,6).cells.map(c=>c[2]))].length;
 const rows=[SCAN_CSV_HEADER];
 for(let i=0;i<n;i++){rows.push([i,-.6,0,.6,0,80,600].join(","),[i,.6,0,-.6,0,0,600].join(","));}
 const plan={...parseScanCsv(rows.join("\n"),"research.csv"),sha256:"b".repeat(64)};
 const baseline=simulateMovingSource(buffer,1,input,undefined,plan);
 const report=runLpbfSensitivity(buffer,1,input,baseline,plan);
 assert.equal(report.sourceScanSha256,plan.sha256);
 assert.ok(report.temporal.surfaceRmsDifferenceC>=0);
 assert.equal(report.spatial,undefined);
 assert.match(report.spatialSkippedReason??"",/virtual voxel-slab indices/);
});
test("Refinement cannot compare different assumed laser model or original parameters",()=>{
 const buffer=cubeStl(),baseline=simulateMovingSource(buffer,1,input);
 assert.throws(()=>runLpbfSensitivity(buffer,1,{...input,laserPowerW:110},baseline,undefined),/inputs differ/);
 assert.throws(()=>compareLpbfRuns(baseline,{...baseline,frames:[]},"time-step"),/completed temperature fields/);
 assert.throws(()=>simulateMovingSource(buffer,1,input,undefined,undefined,.1),/time-step scaling/);
});
