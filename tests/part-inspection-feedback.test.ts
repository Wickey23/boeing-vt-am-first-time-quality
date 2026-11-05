import {test} from "node:test";
import assert from "node:assert/strict";
import {
 blankFeedbackDraft,recordInspectionFeedback,restoreInspectionFeedback,feedbackOverview,
 FEEDBACK_VERSION
} from "../lib/part-inspection-feedback";
const partHash="a".repeat(64),other="b".repeat(64);
const valid={...blankFeedbackDraft(),buildId:"BUILD-27",sourceReference:"INSPECT-001 Rev A",
 testMethod:"CT inspection",findingId:"MESH_TOPOLOGY",outcome:"observed" as const,
 observation:"Surface-connected porosity observed in scanned specimen region.",
 reviewedBy:"Engineer-A",userReviewedSource:true};
test("inspection feedback requires traceability and explicit source review",()=>{
 assert.throws(()=>recordInspectionFeedback(partHash,{...valid,userReviewedSource:false},[]),/reviewed the source/);
 assert.throws(()=>recordInspectionFeedback(partHash,{...valid,sourceReference:""},[]),/source\/revision/);
 assert.throws(()=>recordInspectionFeedback(partHash,{...valid,observation:"too short"},[]),/observation/);
 assert.throws(()=>recordInspectionFeedback("bad",valid,[]),/fingerprint/);
 const a=recordInspectionFeedback(partHash,valid,[],"2026-11-05T20:00:00Z");
 assert.equal(a.schema,FEEDBACK_VERSION);assert.equal(a.id,"F1");
 assert.equal(a.partHash,partHash);assert.equal(a.outcome,"observed");
});
test("feedback record IDs are stable across restored rows and scoped to the exact part hash",()=>{
 const first=recordInspectionFeedback(partHash,valid,[]);
 const second=recordInspectionFeedback(partHash,{...valid,outcome:"not-observed",observation:"No defects identified in the limited CT scan volume."},[first]);
 assert.equal(second.id,"F2");
 const recovered=restoreInspectionFeedback([first,second,first,{...first,partHash:other}],partHash);
 assert.equal(recovered.length,2);
 assert.deepEqual(recovered.map(x=>x.id),["F1","F2"]);
 assert.equal(restoreInspectionFeedback([first],other).length,0);
});
test("feedback comparison is counts only and not a calibrated model metric",()=>{
 const records=[recordInspectionFeedback(partHash,valid,[])];
 const summary=feedbackOverview(records,["MESH_TOPOLOGY"]);
 assert.equal(summary.linked,1);assert.equal(summary.observed,1);
 assert.equal(summary.notObserved,0);
 assert.match(summary.caveat,/not independently validated/i);
});
