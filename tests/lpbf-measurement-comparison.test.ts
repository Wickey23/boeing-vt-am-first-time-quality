import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {simulateMovingSource,MOVING_DEMO_INPUTS} from "../lib/lpbf-moving-source";
import {
 parseLpbfTraceCsv,compareLpbfSurfaceTrace,LPBF_TRACE_CSV_HEADER,
 type TraceSample,type TraceLocation
} from "../lib/lpbf-measurement-comparison";
const hash="a".repeat(64),measuredHash="b".repeat(64);
function cube(){
 const g=new THREE.BoxGeometry(2,2,2).toNonIndexed(),p=g.getAttribute("position"),rows=["solid cube"];
 for(let i=0;i<p.count;i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),
  c=new THREE.Vector3().fromBufferAttribute(p,i+2),n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  rows.push("facet normal "+n.toArray().join(" "),"outer loop",...[a,b,c].map(x=>"vertex "+x.toArray().join(" ")),"endloop","endfacet");
 }
 rows.push("endsolid cube");
 return new TextEncoder().encode(rows.join("\n")).buffer;
}
const inputs={...MOVING_DEMO_INPUTS,ambientTemperatureC:25,plateTemperatureC:25,convectionWm2K:0,absorbedFraction:.1};
function fixture(){
 const file=cube(),model=simulateMovingSource(file,1,inputs),g=new THREE.BoxGeometry(2,2,2).toNonIndexed();
 const p=g.getAttribute("position"),i=Array.from({length:p.count},(_,i)=>i).find(i=>p.getZ(i)===-1)!;
 const location:TraceLocation={xMm:p.getX(i),yMm:p.getY(i),zMm:p.getZ(i)};
 const readings:TraceSample[]=model.frames.map(f=>({timeSeconds:f.timeSeconds,temperatureC:f.field.values[i],uncertaintyC:.5}));
 return {file,model,location,readings};
}
function toCsv(f:ReturnType<typeof fixture>,bias=0){
 return [LPBF_TRACE_CSV_HEADER,...f.readings.map(p=>[
  p.timeSeconds,p.temperatureC+bias,p.uncertaintyC,
  f.location.xMm,f.location.yMm,f.location.zMm
 ].join(","))].join("\n");
}
test("Thermal trace importer rejects inconsistent position, ordering, missing uncertainties and nonphysical units",()=>{
 assert.throws(()=>parseLpbfTraceCsv("wrong header\n1,2"),/exact header/);
 assert.throws(()=>parseLpbfTraceCsv(LPBF_TRACE_CSV_HEADER+"\n1,25,1,0,0,0"),/3–1,500/);
 const f=fixture();
 const rows=toCsv(f).split("\n");
 const wrong=rows.map((row,i)=>i===2?row.replace(/,0.5,/,",0,"):row).join("\n");
 assert.throws(()=>parseLpbfTraceCsv(wrong),/uncertainty/);
 const duplicate=rows.map((row,i)=>i===2?rows[1]:row).join("\n");
 assert.throws(()=>parseLpbfTraceCsv(duplicate),/increase strictly/);
 const shifted=rows.map((row,i)=>i===2?row.slice(0,row.lastIndexOf(","))+",0":row).join("\n");
 assert.throws(()=>parseLpbfTraceCsv(shifted),/ONE identical measured location/);
});
test("Identical synthetic trace has near-zero errors and is NOT identified as validation",()=>{
 const f=fixture(),trace=parseLpbfTraceCsv(toCsv(f),"synthetic-research.csv");
 const report=compareLpbfSurfaceTrace({
  meshBuffer:f.file,unitScale:1,partSha256:hash,result:f.model,
  trace,sourceSha256:measuredHash,dataClassification:"synthetic",
  sourceReference:"Generated directly from the same research solver",claimedTimingConfirmed:true
 });
 assert.equal(report.comparedCount,f.readings.length);
 assert.ok(report.rmseC<1e-8);
 assert.ok(report.maeC<1e-8);
 assert.equal(report.sourceSha256,measuredHash);
 assert.ok(report.registrationDistanceMm<1e-8);
 assert.ok(report.limitations.join(" ").includes("NOT reproduce"));
 assert.equal(report.dataClassification,"synthetic");
 assert.equal(report.validationStatus,"EXPLORATORY_NOT_VALIDATED");
 assert.equal(report.amBenchTamScrStatus,"NOT_COMPARABLE");
 assert.equal(report.defectPredictionAvailable,false);
 assert.equal(report.measurementSourceAuthenticated,false);
});
test("Explicit discrepancy metrics reproduce signed known offset without fitting time",()=>{
 const f=fixture(),trace=parseLpbfTraceCsv(toCsv(f,10));
 const report=compareLpbfSurfaceTrace({
  meshBuffer:f.file,unitScale:1,partSha256:hash,result:f.model,
  trace,sourceSha256:measuredHash,dataClassification:"reported-measurement",
  sourceReference:"User-reported illustrative instrument measurements; authenticity not verified",claimedTimingConfirmed:true
 });
 assert.ok(Math.abs(report.biasC+10)<1e-7);
 assert.ok(Math.abs(report.rmseC-10)<1e-7);
 assert.ok(Math.abs(report.maeC-10)<1e-7);
 assert.equal(report.withinReportedUncertaintyCount,0);
});
test("Comparison blocks unsupported surface coordinates, missing time alignment and no overlap",()=>{
 const f=fixture(),trace=parseLpbfTraceCsv(toCsv(f));
 const args={meshBuffer:f.file,unitScale:1,partSha256:hash,result:f.model,trace,
  sourceSha256:measuredHash,dataClassification:"synthetic" as const,
  sourceReference:"synthetic",claimedTimingConfirmed:true};
 assert.throws(()=>compareLpbfSurfaceTrace({...args,claimedTimingConfirmed:false}),/review STL alignment/);
 assert.throws(()=>compareLpbfSurfaceTrace({...args,trace:{...trace,location:{xMm:500,yMm:0,zMm:0}}}),/does not align/);
 assert.throws(()=>compareLpbfSurfaceTrace({...args,trace:{...trace,
  samples:trace.samples.map(s=>({...s,timeSeconds:s.timeSeconds+2000}))}}),/Fewer than three/);
});
