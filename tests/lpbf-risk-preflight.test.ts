import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {screenLpbfPreflight} from "../lib/lpbf-risk-preflight";

const hash="a".repeat(64);
const zero={x:0,y:0,z:0};
const machine={x:100,y:100,z:100};
async function source(path="public/verification/cube-10mm.stl"){
 const file=await readFile(path);
 return file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength) as ArrayBuffer;
}
test("closed cube on a plate is not falsely tagged as elevated unsupported geometry",async()=>{
 const r=screenLpbfPreflight(await source(),1,zero,machine,45,hash);
 assert.equal(r.geometry.triangles,12);
 assert.equal(r.audit.openEdges,0);
 assert.equal(r.audit.nonManifoldEdges,0);
 assert.ok(Math.abs(r.geometry.totalAreaMm2-600)<1e-5);
 assert.ok(Math.abs(r.geometry.bedContactAreaProxyMm2-100)<1e-5);
 assert.ok(r.geometry.elevatedDownFacingAreaMm2<1e-5);
 assert.equal(r.findings.some(x=>x.code==="ELEVATED_DOWNFACES"),false);
 assert.equal(r.findings.some(x=>x.severity==="blocker"),false);
 assert.ok(r.findings.some(x=>x.code==="PHYSICS_NOT_CALIBRATED"&&x.severity==="unassessed"));
});
test("tilting the cube flags precisely located elevated down-facing triangles",async()=>{
 const r=screenLpbfPreflight(await source(),1,{x:45,y:0,z:0},machine,45,hash);
 const item=r.findings.find(x=>x.code==="ELEVATED_DOWNFACES");
 assert.ok(item,"rotated cube should present surfaces beyond the lowest plate point");
 assert.ok(item!.triangleIds.length>0);
 assert.ok(item!.triangleIds.every(i=>Number.isInteger(i)&&i>=0&&i<12));
 assert.ok(r.geometry.elevatedDownFacingAreaMm2>0);
 assert.match(item!.evidence,/not unsupported-span verification/);
 assert.ok(r.geometry.elevatedDownFacingFraction<=1);
});
test("configured envelope violation is a geometric blocker, not a defect forecast",async()=>{
 const r=screenLpbfPreflight(await source(),1,zero,{x:8,y:8,z:8},45,hash);
 const f=r.findings.find(x=>x.code==="ENVELOPE_FIT");
 assert.equal(f?.severity,"blocker");
 assert.match(f!.evidence,/user-configured envelope/);
 assert.equal(r.findings.some(x=>/probability of (crack|porosity)/i.test(x.observation)),false);
});
test("open or nonmanifold STL is blocked, with no claim of validated print behavior",async()=>{
 const r=screenLpbfPreflight(await source("public/verification/invalid-open-surface.stl"),1,zero,machine,45,hash);
 assert.equal(r.findings.find(x=>x.code==="MESH_NOT_MANIFOLD")?.severity,"blocker");
 assert.ok(r.audit.openEdges>0);
});
test("units and source identity are required and unsupported inputs fail closed",async()=>{
 const bytes=await source();
 assert.throws(()=>screenLpbfPreflight(bytes,0,zero,machine,45,hash),/unit-to-mm/);
 assert.throws(()=>screenLpbfPreflight(bytes,1,zero,machine,45,"wrong"),/verified STL hash/);
 assert.throws(()=>screenLpbfPreflight(bytes,1,zero,{x:0,y:100,z:100},45,hash),/build envelope/);
});
