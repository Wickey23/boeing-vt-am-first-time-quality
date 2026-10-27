import test from "node:test";
import assert from "node:assert/strict";
import {addProjectSource,blankKnowledge,findEvidence,localCopilotReply,nextEngineeringQuestion,restoreKnowledge,updateSourceNotes,validateSource} from "../lib/copilot-context";
test("reference source extraction retains source provenance and local exact words",async()=>{
 const project=blankKnowledge("sha256-test");
 const documents=await addProjectSource([],new File(["Fuselage frame location F-04\nAttaches at station 20\nNominal axial load 500 N, UNVERIFIED"],"assembly-notes.txt",{type:"text/plain"}));
 assert.equal(documents[0].id,"D1");
 assert.equal(documents[0].extraction,"local_text");
 assert.ok(documents[0].extractedText.includes("UNVERIFIED"));
 const hits=findEvidence(documents,"station 20 axial load",3);
 assert.ok(hits.length>0);
 assert.equal(hits[0].sourceId,"D1");
 assert.match(hits[0].line,/L\d/);
 const reply=localCopilotReply({...project,sources:documents},"What load applies at station 20?",{partName:"frame.stl",confirmed:true,hasOrientation:false,loadsReviewed:false,process:"PBF_LB_METAL"});
 assert.ok(reply.sourceIds.includes("D1"));
 assert.ok(reply.text.includes("Confirm applicability"));
});
test("PDF can be attached but is not falsely claimed as extracted text",async()=>{
 const files=await addProjectSource([],new File(["%PDF-1.4 sample"],"assembly.pdf",{type:"application/pdf"}));
 assert.equal(files[0].kind,"pdf");
 assert.equal(files[0].extraction,"not_extracted");
 assert.equal(files[0].extractedText,"");
 const notes=updateSourceNotes(files,"D1","Engineer excerpt p. 4: fixed at z-min");
 assert.equal(notes[0].extraction,"engineer_excerpt");
 assert.ok(findEvidence(notes,"fixed at z-min").length>0);
 assert.throws(()=>validateSource({name:"unknown.exe",size:100}),/Use PDF/);
 assert.throws(()=>validateSource({name:"assembly.pdf",size:3*1024*1024+1}),/3 MB/);
});
test("part context always requires confirmation of geometry, assembly and service inputs",()=>{
 const p=blankKnowledge("part1");
 const opts={partName:"fuselage.stl",confirmed:false,hasOrientation:false,loadsReviewed:false,process:"PBF_LB_METAL"};
 assert.match(nextEngineeringQuestion(p,opts),/confirm the STL units/i);
 const ready={...p,componentName:"Fuselage frame",assemblyContext:"Frame at station 20",attachmentNotes:"Fixed at 3 bolts",reviewedRequirements:"500 N axial"};
 assert.match(nextEngineeringQuestion(ready,{...opts,confirmed:true}),/load magnitudes/i);
 assert.match(nextEngineeringQuestion(ready,{...opts,confirmed:true,loadsReviewed:true}),/orientation screening/i);
});
test("project source scope and message persistence reject wrong part and malformed data",async()=>{
 const docs=await addProjectSource([],new File(["Station 1"],"spec.md",{type:"text/markdown"}));
 const state={...blankKnowledge("part-A"),sources:docs};
 assert.deepEqual(restoreKnowledge(state,"part-B"),blankKnowledge("part-B"));
 assert.equal(restoreKnowledge(state,"part-A").sources[0].name,"spec.md");
 const changed={...state,sources:[{...docs[0],extractedText:"x".repeat(35000)}]};
 assert.equal(restoreKnowledge(changed,"part-A").sources[0].extractedText.length,30000);
 assert.deepEqual(restoreKnowledge({...changed,schema:999},"part-A"),blankKnowledge("part-A"));
});
