import test from "node:test";
import assert from "node:assert/strict";
import {zipSync,unzipSync,strToU8,strFromU8} from "fflate";
import {DEFAULT_SETTINGS} from "../lib/analysis-workspace";
import {newJourney} from "../lib/engineering-journey";
import {createServicePlan} from "../lib/service-plan";
import {addProjectSource,blankKnowledge,updateSourceNotes} from "../lib/copilot-context";
import {exportEngineeringTeamBundle,importEngineeringTeamBundle} from "../lib/engineering-team-bundle";
const stl="solid cube\n facet normal 0 0 1\n outer loop\n vertex 0 0 0\n vertex 10 0 0\n vertex 0 10 0\n endloop\n endfacet\nendsolid cube\n";
const hash=async(f:File)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await f.arrayBuffer())),b=>b.toString(16).padStart(2,"0")).join("");
const asFile=(bytes:Uint8Array,name:string)=>{const buf=new ArrayBuffer(bytes.byteLength);new Uint8Array(buf).set(bytes);return new File([buf],name);};
async function sample(){
 const file=new File([stl],"cube.stl",{type:"model/stl"}),partKey=await hash(file);
 const doc=new File(["Frame F-04 mounts to the bulkhead; 500 N is UNVERIFIED."],"assembly.txt",{type:"text/plain"});
 const sources=await addProjectSource([],doc);
 const context={...blankKnowledge(partKey),sources,componentName:"Test fixture frame",assemblyContext:"Fuselage practice assembly"};
 return {file,doc,context};
}
test("roundtrip preserves correct STL hash, source bytes, context and service setup",async()=>{
 const {file,doc,context}=await sample();
 const encoded=await exportEngineeringTeamBundle({
  projectName:"Test frame",file,settings:DEFAULT_SETTINGS,result:null,selected:null,
  servicePlan:createServicePlan(),journey:newJourney(),knowledge:context,
  attachments:new Map([["D1",doc]])
 });
 assert.equal(encoded.included,1);assert.equal(encoded.notesOnly,0);
 const imported=await importEngineeringTeamBundle(new File([encoded.bytes],"frame.orientai.zip"));
 assert.equal(imported.project.file.name,"cube.stl");
 assert.equal(imported.project.name,"Test frame");
 assert.equal(imported.context.componentName,"Test fixture frame");
 assert.equal(imported.context.sources[0].id,"D1");
 assert.equal(imported.attachments.get("D1")?.name,"assembly.txt");
 assert.equal(await imported.attachments.get("D1")?.text(),await doc.text());
 assert.equal(imported.project.servicePlan.cases.length,1);
 assert.equal(imported.manifest.partSha256,await hash(file));
});
test("notes-only references remain explicit and never imply the original file is available",async()=>{
 const {file,context}=await sample();
 const notes={...context,sources:updateSourceNotes(context.sources,"D1","Engineer-entered annotation: not a verified flight load.")};
 const payload=await exportEngineeringTeamBundle({projectName:"Notes",file,settings:DEFAULT_SETTINGS,
  result:null,selected:null,servicePlan:createServicePlan(),journey:newJourney(),
  knowledge:notes,attachments:new Map()});
 assert.equal(payload.notesOnly,1);
 const imported=await importEngineeringTeamBundle(new File([payload.bytes],"notes.zip"));
 assert.equal(imported.attachments.size,0);
 assert.equal(imported.manifest.references[0].included,false);
 assert.match(imported.context.sources[0].engineerNotes,/annotation/);
});
test("tampered source bytes are rejected rather than accepted as source evidence",async()=>{
 const {file,doc,context}=await sample();
 const {bytes}=await exportEngineeringTeamBundle({projectName:"Tamper",file,settings:DEFAULT_SETTINGS,
  result:null,selected:null,servicePlan:createServicePlan(),journey:newJourney(),knowledge:context,
  attachments:new Map([["D1",doc]])});
 const archive=unzipSync(new Uint8Array(bytes));archive["references/D1.bin"]=strToU8("Modified reference bytes");
 const broken=zipSync(archive);
 await assert.rejects(importEngineeringTeamBundle(asFile(broken,"tampered.zip")) ,/reference|checksum|invalid/i);
});
test("rejects cross-part contexts, unexpected entries and manifest mismatch",async()=>{
 const {file,context}=await sample();
 await assert.rejects(exportEngineeringTeamBundle({projectName:"Mixed",file,settings:DEFAULT_SETTINGS,
  result:null,selected:null,servicePlan:createServicePlan(),journey:newJourney(),
  knowledge:{...context,partKey:"b".repeat(64)},attachments:new Map()}),/different STL fingerprint/);
 const {bytes}=await exportEngineeringTeamBundle({projectName:"Original",file,settings:DEFAULT_SETTINGS,
  result:null,selected:null,servicePlan:createServicePlan(),journey:newJourney(),knowledge:context,attachments:new Map()});
 const content=unzipSync(new Uint8Array(bytes));content["evil.js"]=strToU8("malicious");
 await assert.rejects(importEngineeringTeamBundle(asFile(zipSync(content),"evil.zip")),/unexpected/i);
 const clean=unzipSync(new Uint8Array(bytes));
 const manifest=JSON.parse(strFromU8(clean["manifest.json"]));
 manifest.partSha256="f".repeat(64);clean["manifest.json"]=strToU8(JSON.stringify(manifest));
 await assert.rejects(importEngineeringTeamBundle(asFile(zipSync(clean),"wrong.zip")),/fingerprint/i);
});
