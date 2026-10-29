import {test} from "node:test";
import assert from "node:assert/strict";
import {
 PHYSICAL_SCAN_HEADER,PHYSICAL_SCAN_VERSION,parsePhysicalScanCsv,
 auditPhysicalScanPlan,type PhysicalScanPlan
} from "../lib/lpbf-physical-schedule";
const digest="a".repeat(64),partDigest="b".repeat(64);
const shape={minX:-5,maxX:5,minY:-5,maxY:5,minZ:-5,maxZ:5};
function fixture(count=50){
 const rows=[PHYSICAL_SCAN_HEADER];
 let at=0;
 const record=(a:Array<number>)=>rows.push(a.join(","));
 for(let layer=0;layer<count;layer++){
  const z=Number((-5+(layer+1)*.2).toFixed(6));
  const t0=Number(at.toFixed(6)),t1=Number((at+.001).toFixed(6));
  const t2=Number((at+.006).toFixed(6)),t3=Number((at+.010).toFixed(6));
  record([layer,z,t0,t1,-2,0,-2,0,0]);
  record([layer,z,t1,t2,-2,0,2,0,70]);
  record([layer,z,t2,t3,2,0,-2,0,0]);
  at=t3;
 }
 return rows.join("\n");
}
function audit(plan:PhysicalScanPlan,opts?:Partial<Parameters<typeof auditPhysicalScanPlan>[1]>){
 return auditPhysicalScanPlan(plan,{
  sourceSha256:digest,partSha256:partDigest,geometry:shape,
  physicalLayerThicknessMm:.2,thermalVoxelWidthMm:10/6,
  occupiedVoxelZIndices:[0,1,2,3,4,5],...opts
 });
}
test("Explicit physical layer chronology totals laser-on/off command times and energy",()=>{
 const source=fixture(),plan=parsePhysicalScanCsv(source,"cube-physical-layers.csv"),report=audit(plan);
 assert.equal(plan.version,PHYSICAL_SCAN_VERSION);
 assert.equal(plan.commands.length,150);
 assert.equal(report.suppliedLayerCount,50);
 assert.equal(report.firstLayer,0);
 assert.equal(report.lastLayer,49);
 assert.equal(report.unrepresentedLayers.length,0);
 assert.equal(report.missingIntermediateLayerIndices.length,0);
 assert.equal(report.physicalLayerCountFromGeometry,50);
 assert.equal(report.virtualSlabCount,6);
 assert.ok(Math.abs(report.commandedTimeSeconds-.5)<1e-10);
 assert.ok(Math.abs(report.laserOnSeconds-.25)<1e-10);
 assert.ok(Math.abs(report.laserOffSeconds-.25)<1e-10);
 assert.ok(Math.abs(report.totalCommandedLaserEnergyJ-17.5)<1e-9);
 assert.ok(Math.abs(report.maxCommandedSpeedMmS-1000)<1e-6);
 assert.equal(report.layers.reduce((s,l)=>s+l.laserOnCommands,0),50);
 assert.equal(report.layers.reduce((s,l)=>s+l.laserOffCommands,0),100);
 assert.equal(report.simulationCompatibility,"NOT_APPLIED_TO_COARSE_THERMAL_SOLVER");
 assert.equal(report.qualification,"RESEARCH_ONLY_NOT_MACHINE_VERIFIED");
 assert.ok(report.warnings.some(s=>/NO thermal calculation/.test(s)));
 assert.deepEqual([...new Set(report.layers.map(x=>x.virtualSlab))],[0,1,2,3,4,5]);
});
test("Parser rejects malformed physical-layer tables and impossible timestamps",()=>{
 assert.throws(()=>parsePhysicalScanCsv("z,t,x\n1,2,3"),/exact header/);
 assert.throws(()=>parsePhysicalScanCsv(PHYSICAL_SCAN_HEADER+"\n0,0,0,1,0,0,1,0,Infinity"),/nine finite/);
 assert.throws(()=>parsePhysicalScanCsv(PHYSICAL_SCAN_HEADER+"\n0,0,0,0,0,0,1,0,90"),/positive absolute time interval/);
 assert.throws(()=>parsePhysicalScanCsv(PHYSICAL_SCAN_HEADER+"\n0,0,0,0.00001,0,0,1,0,90"),/speed exceeds/);
 assert.throws(()=>parsePhysicalScanCsv(PHYSICAL_SCAN_HEADER+"\n0,0,0,0.5,0,0,1,0,-2"),/0–1,000 W/);
});
test("Audit refuses missing dwell and disjoint beam position instead of inferring motion",()=>{
 const plan=parsePhysicalScanCsv(fixture(2));
 const jump={...plan,commands:plan.commands.map((c,i)=>i===2?{...c,x0Mm:5}:c)};
 assert.throws(()=>audit(jump),/position jumps/);
 const gap={...plan,commands:plan.commands.map((c,i)=>i===1?{...c,t0Seconds:c.t0Seconds+.0001}:c)};
 assert.throws(()=>audit(gap),/continuous, nonoverlapping times/);
 const fire={...plan,commands:plan.commands.map((c,i)=>i===3?{...c,powerW:10}:c)};
 assert.throws(()=>audit(fire),/transition must begin/);
});
test("Powered out-of-part segments and out-of-build Z are rejected",()=>{
 const plan=parsePhysicalScanCsv(fixture(2));
 assert.throws(()=>audit({...plan,commands:plan.commands.map((c,i)=>i===1?{...c,x1Mm:8}:c)}),/outside the part/);
 assert.throws(()=>audit({...plan,commands:plan.commands.map((c,i)=>i===3?{...c,zMm:45}:c)}),/Z command is outside/);
});
test("Partial physical histories and unoccupied slab mappings are explicit warnings",()=>{
 const plan=parsePhysicalScanCsv(fixture(6));
 const shifted={...plan,commands:plan.commands.map(c=>({...c,layer:c.layer+15}))};
 const report=audit(shifted,{occupiedVoxelZIndices:[1,2,3,4,5]});
 assert.equal(report.firstLayer,15);
 assert.ok(report.unrepresentedLayers.some(l=>l>=15));
 assert.ok(report.warnings.some(x=>/begins after layer 0/.test(x)));
});
