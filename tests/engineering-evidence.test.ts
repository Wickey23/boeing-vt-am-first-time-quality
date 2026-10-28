import test from "node:test";
import assert from "node:assert/strict";
import {addProjectSource,blankKnowledge,restoreKnowledge,updateSourceNotes} from "../lib/copilot-context";
import {
 acceptEngineeringEvidence,currentReviewedEvidence,evidenceIsCurrent,restoreReviewedEvidence,
 sourceRevision,suggestEngineeringEvidence
} from "../lib/engineering-evidence";
import {createEngineeringJob,type StudySnapshot} from "../lib/engineering-job-ledger";
test("candidate excerpts retain original local document locators and uncertainty",async()=>{
 const sources=await addProjectSource([],new File([
  "Frame F-04 mounts to a bulkhead at station 20.\n",
  "Nominal 500 N axial load remains UNVERIFIED.\n",
  "Material may be titanium alloy; no allowable is confirmed."
 ],"assembly-notes.txt"));
 const candidates=suggestEngineeringEvidence(sources);
 assert.equal(candidates.length,3);
 assert.equal(candidates[0].sourceId,"D1");
 assert.equal(candidates[0].locator,"L1");
 assert.equal(candidates[0].category,"fixture");
 assert.equal(candidates[1].category,"load");
 assert.equal(candidates[1].hasUncertainty,true);
 assert.match(candidates[1].excerpt,/UNVERIFIED/);
});
test("review demands engineering rationale; changing any source text invalidates the citation",async()=>{
 const sources=await addProjectSource([],new File(["Axial service load 500 N; assumption only"],"load.txt"));
 const candidate=suggestEngineeringEvidence(sources)[0];
 assert.throws(()=>acceptEngineeringEvidence(candidate,"ok"),/short engineer review note/);
 const accepted=acceptEngineeringEvidence(candidate,"Research example only; not a flight load.","2026-10-28T10:00:00Z");
 assert.equal(evidenceIsCurrent(accepted,sources),true);
 assert.equal(currentReviewedEvidence([accepted],sources).length,1);
 const edited=updateSourceNotes(sources,"D1","This note changes the source revision.");
 assert.notEqual(sourceRevision(sources[0]),sourceRevision(edited[0]));
 assert.equal(evidenceIsCurrent(accepted,edited),false);
 assert.deepEqual(currentReviewedEvidence([accepted],edited),[]);
 assert.equal(evidenceIsCurrent(accepted,[]),false);
});
test("old local projects restore without evidence and new projects retain approved source references",async()=>{
 const sources=await addProjectSource([],new File(["Bulkhead A bolted to frame"],"assembly.txt"));
 const review=acceptEngineeringEvidence(suggestEngineeringEvidence(sources)[0],"Confirmed applicable to example part.");
 const old={...blankKnowledge("part-key"),sources};
 delete (old as Partial<typeof old>).reviewedEvidence;
 assert.deepEqual(restoreKnowledge(old,"part-key").reviewedEvidence,[]);
 const updated={...blankKnowledge("part-key"),sources,reviewedEvidence:[review]};
 const restored=restoreKnowledge(updated,"part-key");
 assert.equal(restored.reviewedEvidence[0].sourceId,"D1");
 assert.deepEqual(restoreReviewedEvidence([{malicious:"yes"},review,review]),[review]);
});
test("job ledger freezes reviewed source text; it does not set forces or qualify material",()=>{
 const snapshot:StudySnapshot={partSha256:"e".repeat(64),partFileName:"lug.stl",projectName:"Public mounting lug",
  process:"PBF_LB_METAL",approvedAt:"2026-10-28T10:00:00Z",sourceIds:["D1"],machineSettings:{x:200},
  modelScope:"research-not-qualified",reviewedEvidence:[{
   key:"D1:extracted_text:L1:123",sourceId:"D1",sourceName:"assembly.txt",sourceRevision:"123",
   locator:"L1",excerpt:"Fixture at frame",category:"fixture",origin:"extracted_text",hasUncertainty:false,
   reviewerNote:"Checked against sample assembly.",reviewedAt:"2026-10-28T10:00:00Z"
  }]};
 const job=createEngineeringJob("job-abc",snapshot,["geometry"]);
 assert.equal(job.snapshot.reviewedEvidence?.length,1);
 snapshot.reviewedEvidence![0].excerpt="Modified after job creation";
 assert.equal(job.snapshot.reviewedEvidence![0].excerpt,"Fixture at frame");
 assert.equal(job.snapshot.serviceCase,undefined);
 assert.throws(()=>createEngineeringJob("job-bad",{...snapshot,sourceIds:[]},["geometry"]),/Invalid or unreviewed/);
});
