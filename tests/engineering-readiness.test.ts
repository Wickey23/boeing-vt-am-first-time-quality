import test from "node:test";
import assert from "node:assert/strict";
import {assessEngineeringReadiness,type ReadinessContext} from "../lib/engineering-readiness";
const example:ReadinessContext={
 fileName:"fuselage-lug.stl",unitsConfirmed:false,process:"PBF_LB_METAL",
 componentName:"",assemblyContext:"",attachmentNotes:"",requirements:"",
 documentCount:0,reviewedEvidenceCount:0,hasNumericalServiceStudy:false,
 hasSteadyThermalStudy:false,hasLpbfGeometryCandidates:false
};
test("missing part and units remain blockers rather than becoming simulated success",()=>{
 const a=assessEngineeringReadiness({...example,fileName:null});
 assert.equal(a.gates[0].status,"needs-review");
 assert.equal(a.nextAction.step,"part");
 const b=assessEngineeringReadiness(example);
 assert.match(b.nextAction.reason,/Confirm the STL units/);
 assert.equal(b.counts.ready,0);
});
test("source evidence, assembly context and actual numerical workers are tracked separately",()=>{
 const a=assessEngineeringReadiness({...example,unitsConfirmed:true,componentName:"Mounting lug",
  assemblyContext:"Fixture station 20",attachmentNotes:"Bolted at one end",requirements:"500 N discussed",
  documentCount:2,reviewedEvidenceCount:0,hasNumericalServiceStudy:true,hasSteadyThermalStudy:true,
  hasLpbfGeometryCandidates:true});
 assert.equal(a.gates.find(x=>x.id==="service")?.status,"ready");
 assert.equal(a.gates.find(x=>x.id==="evidence")?.status,"needs-review");
 assert.equal(a.nextAction.step,"documents");
 assert.match(a.caveats.join(" "),/not metal-AM thermal-history/i);
});
test("DED service FEA never implies deposition pathing or printability",()=>{
 const a=assessEngineeringReadiness({...example,unitsConfirmed:true,componentName:"Frame",
  assemblyContext:"Fuselage",attachmentNotes:"Bolted",requirements:"Reviewed design loads",
  documentCount:1,reviewedEvidenceCount:1,hasNumericalServiceStudy:true,hasSteadyThermalStudy:true,
  process:"DED_LB_WIRE"});
 assert.equal(a.gates.find(x=>x.id==="service")?.status,"ready");
 assert.equal(a.gates.find(x=>x.id==="manufacturing")?.status,"not-available");
 assert.match(a.gates.find(x=>x.id==="manufacturing")?.detail??"",/not available/);
 assert.equal(a.counts.unavailable,1);
});
test("orientation geometric completion remains a review, never manufacturing qualification",()=>{
 const a=assessEngineeringReadiness({...example,unitsConfirmed:true,componentName:"Bracket",
  assemblyContext:"Aircraft test assembly",attachmentNotes:"Ends",requirements:"Reviewed 100 N",
  reviewedEvidenceCount:1,documentCount:1,hasNumericalServiceStudy:true,
  hasSteadyThermalStudy:true,hasLpbfGeometryCandidates:true});
 assert.equal(a.status,"research-ready");
 assert.equal(a.gates.find(x=>x.id==="manufacturing")?.status,"needs-review");
 assert.match(a.nextAction.reason,/not validated/);
});
