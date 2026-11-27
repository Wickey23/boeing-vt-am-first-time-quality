import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {slicePhysicalStl} from "../lib/lpbf-physical-slicer";
import {registerPhysicalScan} from "../lib/lpbf-scan-registration";
import {PHYSICAL_SCAN_HEADER} from "../lib/lpbf-physical-schedule";
const bytes=(s:string)=>new TextEncoder().encode(s).buffer as ArrayBuffer;
const cube=async()=>{
 const b=await readFile("public/verification/cube-10mm.stl");
 return slicePhysicalStl(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer,{unitScaleToMm:.1,xyPitchMm:.5,layerThicknessMm:.5,translationMm:{x:.5,y:.5,z:.5}});
};
test("M05 binds actual source bytes and full-sampled powered commands to physical layers without authorizing activation",async()=>{
 const slice=await cube();
 const source=bytes(PHYSICAL_SCAN_HEADER+"\n0,0.5,0,1,0.25,0.25,0.75,0.25,10\n1,1,1,2,0.75,0.25,0.75,0.25,0\n1,1,2,3,0.75,0.25,0.25,0.25,10");
 const result=await registerPhysicalScan(source,slice,slice.partSha256);
 assert.equal(result.sourceSha256,createHash("sha256").update(Buffer.from(source)).digest("hex"));
 assert.equal(result.status,"SAMPLED_REGISTRATION_REVIEW_REQUIRED");
 assert.equal(result.thermalActivationAuthorized,false);
 assert.deepEqual(result.missingPoweredLayers,[]);
 assert.equal(result.records[0].coverage,"full-sampled");
 assert.equal(result.records[0].zResidualMm,0);
 assert.equal(result.records[1].coverage,null);
 await assert.rejects(registerPhysicalScan(source,slice,"0".repeat(64)),/identity mismatch/);
});
test("M05 rejects wrong Z, missing layers, outside and boundary paths",async()=>{
 const slice=await cube();
 const result=await registerPhysicalScan(bytes(PHYSICAL_SCAN_HEADER+"\n0,0.7,0,1,0.25,0.25,1.25,0.25,10"),slice,slice.partSha256);
 assert.equal(result.status,"BLOCKED_RESEARCH_REGISTRATION");
 assert.equal(result.records[0].coverage,"empty-or-outside");
 assert.ok(result.records[0].reasons.some(r=>r.includes("Z is not registered")));
 assert.deepEqual(result.missingPoweredLayers,[0,1]);
 const boundary=await registerPhysicalScan(bytes(PHYSICAL_SCAN_HEADER+"\n0,0.5,0,1,0,0.25,0,0.75,10"),slice,slice.partSha256);
 assert.equal(boundary.records[0].coverage,"ambiguous-boundary");
 assert.equal(boundary.thermalActivationAuthorized,false);
});
test("M05 checks the entire segment, not only endpoints or bounding box",async()=>{
 const slice=await cube();
 // Deliberately remove an interior cell from a test-only layer to exercise traversal.
 slice.layers[0].cells=slice.layers[0].cells.filter(c=>!(c.x===1&&c.y===0));
 const result=await registerPhysicalScan(bytes(PHYSICAL_SCAN_HEADER+"\n0,0.5,0,1,0.25,0.25,0.75,0.25,10"),slice,slice.partSha256);
 assert.equal(result.records[0].coverage,"empty-or-outside");
 assert.equal(result.thermalActivationAuthorized,false);
});
