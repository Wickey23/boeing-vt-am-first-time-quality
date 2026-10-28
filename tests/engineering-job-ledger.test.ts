import test from "node:test";
import assert from "node:assert/strict";
import {createEngineeringJob,applyJobEvent,markInterruptedAfterReload,summarizeJobForExport} from "../lib/engineering-job-ledger";
import type {StudySnapshot} from "../lib/engineering-job-ledger";
const snapshot:StudySnapshot={
 partSha256:"a".repeat(64),partFileName:"bracket.stl",projectName:"Mounting lug",process:"PBF_LB_METAL",
 machineSettings:{x:250,y:250,z:400,material:"Ti-6Al-4V"},approvedAt:"2026-10-27T14:00:00Z",
 sourceIds:["D1","D2"],modelScope:"research-not-qualified",
 serviceCase:{id:"case-1",name:"Test tension",input:{forceXN:500,forceYN:0,forceZN:0,poissonRatio:0.3,youngModulusMPa:110000,resolution:8}}
};
const start=()=>createEngineeringJob("job-1",snapshot,["geometry","service-structural","steady-conduction"],"2026-10-27T14:01:00Z");
test("records a frozen input snapshot that cannot mutate with UI settings",()=>{
 const job=start();
 assert.equal(job.status,"queued");
 assert.deepEqual(job.steps.map(s=>s.status),["queued","queued","queued"]);
 snapshot.machineSettings.x=999;
 assert.equal(job.snapshot.machineSettings.x,250);
 snapshot.machineSettings.x=250;
 assert.deepEqual(job.snapshot.sourceIds,["D1","D2"]);
});
test("forbids unapproved part identifiers and unsupported process",()=>{
 assert.throws(()=>createEngineeringJob("j",{...snapshot,partSha256:"unknown"},["geometry"]));
 assert.throws(()=>createEngineeringJob("j",{...snapshot,process:"DED_LB_WIRE" as never},["geometry"]));
 assert.throws(()=>createEngineeringJob("j",snapshot,["service-structural","geometry"]));
 assert.throws(()=>createEngineeringJob("j",snapshot,["geometry","geometry"]));
});
test("enforces a monotonic sequence of solver results before completion",()=>{
 let job=start();
 assert.throws(()=>applyJobEvent(job,{type:"complete",kind:"geometry",detail:"not running"}));
 assert.throws(()=>applyJobEvent(job,{type:"start",kind:"service-structural",detail:"out of order"}));
 job=applyJobEvent(job,{type:"start",kind:"geometry",detail:"worker launched",at:"2026-10-27T14:02:00Z"});
 assert.equal(job.status,"running");
 job=applyJobEvent(job,{type:"complete",kind:"geometry",detail:"72 candidates",result:{summary:"72 orientations",warnings:[]},at:"2026-10-27T14:02:10Z"});
 assert.equal(job.status,"running");
 job=applyJobEvent(job,{type:"start",kind:"service-structural",detail:"FEM start"});
 job=applyJobEvent(job,{type:"complete",kind:"service-structural",detail:"FEM done",result:{model:"voxel FEA",summary:"1 mm displacement",warnings:["research"]}});
 job=applyJobEvent(job,{type:"start",kind:"steady-conduction",detail:"thermal start"});
 job=applyJobEvent(job,{type:"complete",kind:"steady-conduction",detail:"thermal done",result:{model:"steady conduction",summary:"80 C",warnings:["not LPBF thermal history"]}});
 assert.equal(job.status,"completed");
 assert.equal(job.steps.filter(x=>x.status==="completed").length,3);
 assert.throws(()=>applyJobEvent(job,{type:"start",kind:"geometry",detail:"reuse closed job"}));
 const exportData=summarizeJobForExport(job);
 assert.equal(exportData.dataIncluded.rawStl,false);
 assert.equal(exportData.dataIncluded.sourceDocuments,false);
 assert.match(exportData.notice,/not aerospace qualification/);
});
test("cancellation and interruptions never create a successful record",()=>{
 const running=applyJobEvent(start(),{type:"start",kind:"geometry",detail:"started"});
 const cancelled=applyJobEvent(running,{type:"cancel",detail:"user cancelled"});
 assert.equal(cancelled.status,"cancelled");
 assert.equal(cancelled.steps[0].status,"cancelled");
 assert.throws(()=>applyJobEvent(cancelled,{type:"complete",kind:"geometry",detail:"late worker"}));
 const interrupted=markInterruptedAfterReload(running);
 assert.equal(interrupted.status,"interrupted");
 assert.equal(interrupted.steps[0].status,"cancelled");
 assert.equal(markInterruptedAfterReload(interrupted).status,"interrupted");
 const stale=applyJobEvent(running,{type:"stale",detail:"inputs changed"});
 assert.equal(stale.status,"stale");
});
