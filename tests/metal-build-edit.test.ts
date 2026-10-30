import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";
import {assessMetalBuildEdit,emptyBuildEdit,exportMetalBuildStl,placeOnPlate,suggestMetalBuildEdits,type BuildEnvelope} from "../lib/metal-build-edit";

const envelope:BuildEnvelope={x:100,y:100,z:100};
const fixture=async()=>{
 const bytes=await readFile("public/verification/cube-10mm.stl");
 return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
};
test("A centered source cube must be deliberately placed in positive metal build frame",async()=>{
 const source=await fixture();
 const base=await assessMetalBuildEdit(source,1,emptyBuildEdit(),envelope);
 assert.equal(base.triangleCount,12);
 assert.equal(base.insideConfiguredEnvelope,false);
 assert.ok(Math.abs(base.estimatedVolumeMm3-1000)<1e-7);
 const edit=placeOnPlate(base.boundsMm,emptyBuildEdit(),envelope);
 const placed=await assessMetalBuildEdit(source,1,edit,envelope);
 assert.equal(placed.insideConfiguredEnvelope,true);
 assert.ok(Math.abs(placed.boundsMm.min.z)<1e-8);
 assert.ok(Math.abs(placed.boundsMm.min.x-45)<1e-8);
 assert.ok(Math.abs(placed.boundsMm.max.y-55)<1e-8);
 assert.equal(base.sourceSha256,placed.sourceSha256);
 assert.equal(placed.warnings.length,3);
});
test("Baked STL truly changes vertices, preserves dimensions and source hash, and remains a closed mesh",async()=>{
 const original=await fixture(),base=await assessMetalBuildEdit(original,1,emptyBuildEdit(),envelope);
 const edit=placeOnPlate(base.boundsMm,emptyBuildEdit(),envelope);
 edit.rotationDeg.z=90;
 const rotated=await assessMetalBuildEdit(original,1,edit,envelope);
 assert.equal(rotated.insideConfiguredEnvelope,true);
 const exported=await exportMetalBuildStl(original,1,edit,envelope);
 assert.match(exported.stl,/ORIENTAI_nonqualified_edited_mm/);
 assert.notEqual(exported.sourceSha256,exported.outputSha256);
 assert.ok(Math.abs(exported.assessment.estimatedVolumeMm3-1000)<1e-6);
 const newGeom=new STLLoader().parse(new TextEncoder().encode(exported.stl).buffer);
 newGeom.computeBoundingBox();
 assert.ok(Math.abs(newGeom.boundingBox!.min.z)<1e-6);
 assert.equal(newGeom.getAttribute("position").count,36);
 const still=await assessMetalBuildEdit(original,1,emptyBuildEdit(),envelope);
 assert.ok(still.boundsMm.min.x<0,"original bytes are never edited");
});
test("Automatic orientation suggestions compare numeric candidate build heights, not metal quality",async()=>{
 const ascii=new TextDecoder().decode(await fixture());
 const elongated=ascii.replace(/vertex\s+(-?5)\s+(-?5)\s+(-?5)/g,(_,a:string,b:string,c:string)=>
  `vertex ${Number(a)*.6} ${Number(b)*.2} ${Number(c)*2}`);
 const input=new TextEncoder().encode(elongated).buffer as ArrayBuffer;
 const recipe=emptyBuildEdit();
 const current=await assessMetalBuildEdit(input,1,recipe,envelope);
 assert.ok(Math.abs(current.boundsMm.dimensions.z-20)<1e-7);
 const options=await suggestMetalBuildEdits(input,1,recipe,envelope,current);
 const rotated=options.find(o=>o.id==="rotate-x");
 assert.ok(rotated?.proposal);
 assert.equal(rotated?.kind,"screening");
 assert.ok((rotated?.estimatedBuildHeightMm??Infinity)<20);
 assert.match(rotated!.explanation,/supports, thermal distortion/);
 const placed=await assessMetalBuildEdit(input,1,rotated!.proposal!,envelope);
 assert.ok(placed.insideConfiguredEnvelope);
});
test("Explicitly fail closed on nonwatertight meshes, unconfirmed units, out-of-envelope and invalid vectors",async()=>{
 const bytes=await readFile("public/verification/invalid-open-surface.stl");
 const bad=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
 const source=await fixture();
 const r=await assessMetalBuildEdit(bad,1,emptyBuildEdit(),envelope);
 assert.ok(r.sourceAudit.openEdges>0);
 await assert.rejects(exportMetalBuildStl(bad,1,emptyBuildEdit(),envelope),/open\/nonmanifold/);
 await assert.rejects(assessMetalBuildEdit(source,0,emptyBuildEdit(),envelope),/scale is required/);
 await assert.rejects(exportMetalBuildStl(source,1,emptyBuildEdit(),envelope),/exceeds the configured build volume/);
 await assert.rejects(assessMetalBuildEdit(source,1,{...emptyBuildEdit(),translationMm:{x:NaN,y:0,z:0}},envelope),/Invalid build position/);
});
