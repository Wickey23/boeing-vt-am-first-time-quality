import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DEFAULT_SETTINGS} from "../lib/analysis-workspace";
import {exportPortableProject,importPortableProject} from "../lib/project-transfer";
test("project export/import preserves STL bytes and configuration",async()=>{
 const bytes=readFileSync("public/verification/cube-10mm.stl");
 const file=new File([bytes],"cube-10mm.stl",{type:"model/stl"});
 const packed=await exportPortableProject("Cube A",file,DEFAULT_SETTINGS,null,null);
 const restored=await importPortableProject(packed);
 assert.equal(restored.name,"Cube A");
 assert.equal(restored.file.size,file.size);
 assert.deepEqual(new Uint8Array(await restored.file.arrayBuffer()),new Uint8Array(await file.arrayBuffer()));
 assert.equal(restored.settings.unitScale,DEFAULT_SETTINGS.unitScale);
});
test("project import rejects tampered STL payload",async()=>{
 const file=new File(["solid invalid\nendsolid invalid\n"],"test.stl");
 const packed=JSON.parse(await exportPortableProject("Test",file,DEFAULT_SETTINGS,null,null));
 packed.stlBase64=btoa("altered");
 await assert.rejects(importPortableProject(JSON.stringify(packed)),/checksum mismatch/);
});
