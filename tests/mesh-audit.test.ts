import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {auditSTL} from "../lib/stl-mesh-audit";

const fixture=(name:string)=>{const bytes=readFileSync("public/verification/"+name);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);};

test("closed cube passes edge topology checks",()=>{
 const result=auditSTL(fixture("cube-10mm.stl"));
 assert.equal(result.openEdges,0);
 assert.equal(result.nonManifoldEdges,0);
 assert.equal(result.disconnectedShells,1);
 assert.ok(result.triangles>=12);
});

test("open sheet reports boundary edges and blocks physical meshing",()=>{
 const result=auditSTL(fixture("invalid-open-surface.stl"));
 assert.ok(result.openEdges>=3);
 assert.ok(result.findings.some(x=>x.code==="OPEN_SURFACE"&&x.level==="blocker"));
});

test("aerospace bracket and hollow nozzle sleeve remain connected",()=>{
 for(const name of ["aerospace-overhang-bracket.stl","aerospace-nozzle-sleeve.stl"]){
  const result=auditSTL(fixture(name));
  assert.equal(result.disconnectedShells,1,name);
  assert.equal(result.openEdges,0,name);
 }
});
