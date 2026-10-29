import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {voxelizePart} from "../lib/voxel-thermal";
import {MOVING_DEMO_INPUTS,simulateMovingSource} from "../lib/lpbf-moving-source";
import {parseScanCsv,validateScanPlan,positionOnScanSegment,SCAN_CSV_HEADER} from "../lib/lpbf-scan-plan";

const digest="a".repeat(64);
function cube(){
 const mesh=new THREE.BoxGeometry(2,2,2).toNonIndexed(),attr=mesh.getAttribute("position");
 const rows=["solid cube"];
 for(let i=0;i<attr.count;i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(attr,i),b=new THREE.Vector3().fromBufferAttribute(attr,i+1),
   c=new THREE.Vector3().fromBufferAttribute(attr,i+2),n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  rows.push("facet normal "+n.toArray().join(" "),"outer loop",...[a,b,c].map(v=>"vertex "+v.toArray().join(" ")),"endloop","endfacet");
 }
 rows.push("endsolid cube");
 return new TextEncoder().encode(rows.join("\n")).buffer;
}
function sample(layers:number,power=80){
 const rows=[SCAN_CSV_HEADER];
 for(let k=0;k<layers;k++){
  rows.push([k,-.7,0,.7,0,power,500].join(","));
  rows.push([k,.7,0,-.7,0,0,500].join(",")); // explicit laser-off return travel
 }
 return rows.join("\n");
}
test("CSV rejects missing/extra columns, malformed numbers, unordered slabs and bad travel",()=>{
 assert.throws(()=>parseScanCsv("bad\n0,1"),/header/);
 assert.throws(()=>parseScanCsv(SCAN_CSV_HEADER+"\n0,0,0,1,1,80,200,extra"),/seven finite/);
 assert.throws(()=>parseScanCsv(SCAN_CSV_HEADER+"\n0,0,0,1,1,Infinity,200"),/seven finite/);
 assert.throws(()=>parseScanCsv(SCAN_CSV_HEADER+"\n0,0,0,0,0,80,200"),/zero-length/);
 assert.throws(()=>parseScanCsv(SCAN_CSV_HEADER+"\n1,0,0,1,1,80,200\n0,0,0,1,1,80,200"),/nondecreasing/);
});
test("Scan path requires complete virtual slabs and stays inside part X/Y coordinates",()=>{
 const p=parseScanCsv(sample(6));
 assert.equal(validateScanPlan(p,6,{minX:-1,maxX:1,minY:-1,maxY:1}).segmentCount,12);
 assert.throws(()=>validateScanPlan(p,7,{minX:-1,maxX:1,minY:-1,maxY:1}),/every virtual/);
 assert.throws(()=>validateScanPlan(p,6,{minX:-.5,maxX:.5,minY:-1,maxY:1}),/outside uploaded STL/);
 const midpoint=positionOnScanSegment(p.segments[0],.5);
 assert.ok(Math.abs(midpoint.x)<1e-10);
});
test("Explicit bounded laser-on and laser-off travel controls real coupled energy, not uniform raster power",()=>{
 const geometry=cube();
 const mesh=voxelizePart(geometry,{x:0,y:0,z:0},1,6);
 const n=[...new Set(mesh.cells.map(c=>c[2]))].length;
 const text=sample(n,65),parsed=parseScanCsv(text,"synthetic-fixture.csv");
 const plan={...parsed,sha256:digest};
 const input={...MOVING_DEMO_INPUTS,resolution:6,absorbedFraction:.15,plateTemperatureC:25,ambientTemperatureC:25};
 const checked=validateScanPlan(plan,n,{minX:-1,maxX:1,minY:-1,maxY:1});
 const result=simulateMovingSource(geometry,1,input,undefined,plan);
 assert.equal(result.engine,"lpbf-imported-enthalpy-0.1");
 assert.equal(result.scanPlan?.sha256,digest);
 assert.equal(result.scanPlan?.segmentCount,n*2);
 assert.ok(Math.abs(result.summary.absorbedEnergyJ-input.absorbedFraction*checked.laserCommandEnergyJ)<1e-7);
 assert.ok(result.summary.relativeEnergyImbalance<1e-4);
 assert.ok(result.summary.peakSolidTemperatureC>25);
});
test("Imported powered scan with coordinates outside the part is rejected before solving",()=>{
 const mesh=voxelizePart(cube(),{x:0,y:0,z:0},1,6);
 const n=[...new Set(mesh.cells.map(c=>c[2]))].length;
 const parsed=parseScanCsv(sample(n));
 const plan={...parsed,sha256:digest};
 plan.segments[0]={...plan.segments[0],y0Mm:2,y1Mm:2};
 assert.throws(()=>validateScanPlan(plan,n,{minX:-1,maxX:1,minY:-1,maxY:1}),/outside uploaded STL/);
});
