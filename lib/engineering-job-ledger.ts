/**
 * Local simulation job ledger. Every record is a frozen input snapshot plus a
 * monotonic event sequence. Browser IndexedDB is NOT a multi-user cloud backend.
 * No confidential CAD or uploaded document bytes are written by this module.
 */
import type {StudyKind} from "./engineering-runbook";
import type {ReviewedEvidence} from "./engineering-evidence";
import type {ApprovedParameterBinding} from "./engineering-parameter-binding";

export type JobStatus="queued"|"running"|"completed"|"failed"|"cancelled"|"interrupted"|"stale";
export type StepStatus="queued"|"running"|"completed"|"failed"|"cancelled";
export type JobStep={kind:StudyKind;status:StepStatus;startedAt?:string;finishedAt?:string;result?:{
 runId?:string;candidateId?:string;model?:string;summary:string;warnings:string[];
}};
export type JobEvent={at:string;stage:string;status:JobStatus;detail:string};
export type StudySnapshot={
 partSha256:string;partFileName:string;projectName:string;process:"PBF_LB_METAL"|"DED_LB_WIRE"|"DED_LB_POWDER";
 analysisMode?:"service-independent";
 machineSettings:Record<string,string|number|boolean>;
 serviceCase?:{id:string;name:string;input:Record<string,string|number|boolean|null>};
 thermalInput?:{conductivityWmK:number;baseTemperatureC:number;topFluxWm2:number;resolution:number};
 approvedAt:string;sourceIds:string[];
 reviewedEvidence?:ReviewedEvidence[];
 parameterBindings?:ApprovedParameterBinding[];
 modelScope:"research-not-qualified";
};
export type EngineeringJob={schema:1;id:string;createdAt:string;updatedAt:string;
 status:JobStatus;snapshot:StudySnapshot;steps:JobStep[];events:JobEvent[]};
const DB="orientai-engineering-jobs-v1",STORE="jobs",LIMIT=20;
const isHash=(value:string)=>/^[0-9a-f]{64}$/i.test(value);
const stamp=(date?:string)=>date??new Date().toISOString();
export function createEngineeringJob(id:string,snapshot:StudySnapshot,kinds:StudyKind[],at?:string):EngineeringJob{
 if(!id.trim()||!isHash(snapshot.partSha256))throw Error("A verified STL fingerprint is required before a study can be scheduled.");
 if(!snapshot.partFileName.toLowerCase().endsWith(".stl")||
  !["PBF_LB_METAL","DED_LB_WIRE","DED_LB_POWDER"].includes(snapshot.process))
  throw Error("Only confirmed metal AM STL studies are currently supported.");
 if(snapshot.process!=="PBF_LB_METAL"&&snapshot.analysisMode!=="service-independent")
  throw Error("DED uploaded-part deposition and orientation planning are unsupported.");
 if(snapshot.reviewedEvidence&&(
  !Array.isArray(snapshot.reviewedEvidence)||snapshot.reviewedEvidence.length>30||
  snapshot.reviewedEvidence.some(e=>!snapshot.sourceIds.includes(e.sourceId)||!e.reviewedAt||!e.reviewerNote)
 ))throw Error("Invalid or unreviewed source references in the study snapshot.");
 if(snapshot.parameterBindings&&(
  !Array.isArray(snapshot.parameterBindings)||snapshot.parameterBindings.length>40||
  snapshot.parameterBindings.some(b=>!b.independentlyVerified||!Number.isFinite(b.value)||
   !snapshot.sourceIds.includes(b.sourceId)||
   !snapshot.reviewedEvidence?.some(e=>e.key===b.evidenceKey&&e.sourceId===b.sourceId&&e.sourceRevision===b.sourceRevision)||
   b.serviceCaseId!==snapshot.serviceCase?.id||
   snapshot.serviceCase.input[b.target]!==b.value)
 ))throw Error("Unreviewed, stale or mismatched source-to-solver parameter binding.");
 if(kinds.length===0||(
    snapshot.analysisMode==="service-independent"?
      kinds.join(",")!=="service-structural,steady-conduction":
      kinds[0]!=="geometry"
   )||new Set(kinds).size!==kinds.length||
  kinds.some(kind=>!["geometry","service-structural","steady-conduction"].includes(kind)))
  throw Error("Invalid solver order.");
 const when=stamp(at);
 return {schema:1,id,createdAt:when,updatedAt:when,status:"queued",
  snapshot:JSON.parse(JSON.stringify(snapshot)) as StudySnapshot,
  steps:kinds.map(kind=>({kind,status:"queued"})),
  events:[{at:when,stage:"Approval",status:"queued",detail:"Engineer reviewed the frozen research-model inputs and limitations."}]};
}
export function applyJobEvent(job:EngineeringJob,event:{
 type:"start"|"complete"|"fail"|"cancel"|"interrupt"|"stale";kind?:StudyKind;detail:string;
 result?:JobStep["result"];at?:string
}):EngineeringJob{
 const time=stamp(event.at),newJob:EngineeringJob={...job,updatedAt:time,
  steps:job.steps.map(s=>({...s})),events:[...job.events]};
 if(newJob.events.length>=120)throw Error("Job event history limit exceeded.");
 const closed=["completed","failed","cancelled","interrupted","stale"].includes(job.status);
 if(closed)throw Error("Closed jobs are immutable. Start a new job for another run.");
 if(event.type==="start"||event.type==="complete"){
  const i=newJob.steps.findIndex(x=>x.kind===event.kind);
  if(i<0)throw Error("Unscheduled study type.");
  const current=newJob.steps[i];
  if(event.type==="start"){
   if(current.status!=="queued"||newJob.steps.slice(0,i).some(x=>x.status!=="completed"))
    throw Error("A study cannot start out of order.");
   current.status="running";current.startedAt=time;newJob.status="running";
  }else{
   if(current.status!=="running")throw Error("Only running study steps can complete.");
   current.status="completed";current.finishedAt=time;current.result=event.result;
   newJob.status=newJob.steps.every(x=>x.status==="completed")?"completed":"running";
  }
 }else{
  if(event.type==="fail"&&newJob.status!=="running")throw Error("Only a running job can fail.");
  if(event.type==="interrupt"&&newJob.status!=="running")throw Error("Only a running job can be marked interrupted.");
  newJob.status=event.type==="fail"?"failed":event.type==="cancel"?"cancelled":event.type==="stale"?"stale":"interrupted";
  newJob.steps=newJob.steps.map(step=>step.status==="running"?{...step,status:event.type==="fail"?"failed":"cancelled",finishedAt:time}:step);
 }
 newJob.events.push({at:time,stage:event.kind??event.type,status:newJob.status,detail:event.detail.slice(0,550)});
 return newJob;
}
export function markInterruptedAfterReload(job:EngineeringJob):EngineeringJob{
 return job.status==="running"?applyJobEvent(job,{type:"interrupt",detail:"Browser session closed while the study was running. No resume or completed result is implied."}):job;
}
function openDb():Promise<IDBDatabase>{
 if(typeof indexedDB==="undefined")return Promise.reject(Error("IndexedDB is unavailable."));
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{const db=request.result;
   if(!db.objectStoreNames.contains(STORE)){
    const store=db.createObjectStore(STORE,{keyPath:"id"});store.createIndex("byPart","snapshot.partSha256",{unique:false});
   }
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error??Error("Could not open study ledger."));
 });
}
export async function saveEngineeringJob(job:EngineeringJob):Promise<void>{
 const db=await openDb();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(job);
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??Error("Could not write study ledger."));
  tx.onabort=()=>reject(tx.error??Error("Study ledger transaction aborted."));
 });}finally{db.close();}
}
export async function loadEngineeringJobs(partSha256:string):Promise<EngineeringJob[]>{
 if(!isHash(partSha256))return [];
 const db=await openDb();
 try{const rows=await new Promise<EngineeringJob[]>((resolve,reject)=>{
  const tx=db.transaction(STORE,"readonly");
  const req=tx.objectStore(STORE).index("byPart").getAll(partSha256);
  req.onsuccess=()=>resolve(req.result as EngineeringJob[]);req.onerror=()=>reject(req.error??Error("Could not load study ledger."));
 });
  const latest=rows.filter(x=>x.schema===1&&x.snapshot?.partSha256===partSha256)
   .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,LIMIT);
  const repaired=latest.map(markInterruptedAfterReload);
  for(const job of repaired)if(job.status==="interrupted"&&!rows.find(x=>x.id===job.id&&x.status==="interrupted"))
   await saveEngineeringJob(job);
  return repaired;
 }finally{db.close();}
}
export function summarizeJobForExport(job:EngineeringJob){
 return {...job,dataIncluded:{rawStl:false,sourceDocuments:false,fullFieldArrays:false},
  notice:"Research calculations and user-approved assumptions; not aerospace qualification."};
}
