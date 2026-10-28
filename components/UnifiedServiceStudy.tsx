"use client";
import {useEffect,useRef,useState} from "react";
import {useAnalysis} from "./AnalysisProvider";
import {activeServiceCase,serviceInputKey} from "@/lib/service-plan";
import {END_FACES,type EndFace,validateServiceSetup} from "@/lib/service-load";
import type {StructuralField} from "@/lib/voxel-structural";
import type {ThermalField,ThermalInput} from "@/lib/voxel-thermal";
import type {ReviewedEvidence} from "@/lib/engineering-evidence";
import {
 createEngineeringJob,applyJobEvent,loadEngineeringJobs,saveEngineeringJob,summarizeJobForExport,
 type EngineeringJob,type JobStep
} from "@/lib/engineering-job-ledger";

export type ServiceStudyResults={partSha256:string;unitScale:number;process:string;
 structural?:StructuralField;thermal?:ThermalField;jobId:string};
type Phase="idle"|"structural"|"thermal"|"complete"|"failed"|"cancelled";
const defaultThermal:ThermalInput={conductivityWmK:6.7,baseTemperatureC:20,topFluxWm2:1000,resolution:12};
const axisRotation={x:0,y:0,z:0};
function thermalValid(t:ThermalInput){
 return Number.isFinite(t.conductivityWmK)&&t.conductivityWmK>0&&t.conductivityWmK<=10000&&
 Number.isFinite(t.baseTemperatureC)&&t.baseTemperatureC>=-273.15&&
 Number.isFinite(t.topFluxWm2)&&t.topFluxWm2>=0&&t.topFluxWm2<=1e8&&
 Number.isInteger(t.resolution)&&t.resolution>=6&&t.resolution<=24;
}
function structuralValid(value:Parameters<typeof validateServiceSetup>[0]):boolean{
 try{validateServiceSetup(value);const f=value as {forceXN:number;forceYN?:number;forceZN:number};
 return Math.abs(f.forceXN)+Math.abs(f.forceYN??0)+Math.abs(f.forceZN)>0;}catch{return false;}
}
export default function UnifiedServiceStudy({partSha256,verified,reviewedEvidence,sourceIds,onResults,onOpenResults}:{
 partSha256?:string;verified:boolean;reviewedEvidence:ReviewedEvidence[];sourceIds:string[];
 onResults:(value:ServiceStudyResults|null)=>void;onOpenResults:()=>void;
}){
 const a=useAnalysis(),service=activeServiceCase(a.servicePlan);
 const [thermal,setThermal]=useState<ThermalInput>(defaultThermal);
 const [approved,setApproved]=useState(false);
 const [phase,setPhase]=useState<Phase>("idle"),[error,setError]=useState("");
 const [latest,setLatest]=useState<ServiceStudyResults|null>(null);
 const [job,setJob]=useState<EngineeringJob|null>(null),[history,setHistory]=useState<EngineeringJob[]>([]);
 const [storageError,setStorageError]=useState("");
 const seq=useRef(0),worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const jobRef=useRef<EngineeringJob|null>(null),write=useRef<Promise<void>>(Promise.resolve());
 const serviceKey=serviceInputKey(service.input);
 const fingerprintReady=typeof partSha256==="string"&&/^[0-9a-f]{64}$/.test(partSha256);
 const active=phase==="structural"||phase==="thermal";
 const canRun=verified&&!!a.file&&fingerprintReady&&structuralValid(service.input)&&thermalValid(thermal)&&approved&&!active&&a.journey.mode!=="ded-example";
 function release(){if(timer.current)clearTimeout(timer.current);timer.current=null;worker.current?.terminate();worker.current=null;}
 function persist(next:EngineeringJob){
  jobRef.current=next;setJob(next);
  setHistory(items=>[next,...items.filter(x=>x.id!==next.id)].slice(0,20));
  write.current=write.current.catch(()=>{}).then(()=>saveEngineeringJob(next)).catch(()=>{
   setStorageError("Browser storage failed. Export the study record before leaving.");
  });
 }
 function transition(type:"start"|"complete"|"fail"|"cancel"|"stale",detail:string,kind?:JobStep["kind"],result?:JobStep["result"]){
  if(!jobRef.current)return;
  try{persist(applyJobEvent(jobRef.current,{type,detail,kind,result}));}
  catch(e){setStorageError(e instanceof Error?e.message:"Study history could not be updated.");}
 }
 function invalidate(){
  seq.current++;release();
  if(jobRef.current?.status==="running")transition("stale","Inputs or part changed; previous unfinished calculation invalidated.");
  setLatest(null);onResults(null);setApproved(false);setPhase("idle");
 }
 // Jobs are specific to this exact STL, its units, process label, and service case.
 useEffect(()=>{invalidate();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[a.file,a.settings.unitScale,a.journey.process,serviceKey,service.id,partSha256]);
 useEffect(()=>{
  let alive=true;
  if(!fingerprintReady||!partSha256){setHistory([]);return;}
  loadEngineeringJobs(partSha256).then(items=>{if(alive)setHistory(items);})
   .catch(()=>{if(alive)setStorageError("Previous jobs could not be loaded from this browser.");});
  return()=>{alive=false;};
 },[partSha256,fingerprintReady]);
 useEffect(()=>()=>{seq.current++;release();},[]);
 function changeThermal<K extends keyof ThermalInput>(key:K,value:ThermalInput[K]){
  if(active)return;
  setThermal(prev=>({...prev,[key]:value}));setApproved(false);setLatest(null);onResults(null);
 }
 function changeService(key:keyof typeof service.input,value:number|string){
  if(active)return;
  a.setServiceSetup({...service.input,[key]:value});setApproved(false);setLatest(null);onResults(null);
 }
 function cancel(){
  if(!active)return;
  seq.current++;release();transition("cancel","Engineer cancelled the service analysis.");
  setPhase("cancelled");
 }
 async function solve<T>(kind:"structural"|"thermal",input:unknown,token:number):Promise<T>{
  if(!a.file)throw Error("No STL available.");
  const buffer=await a.file.arrayBuffer();
  if(token!==seq.current)throw Error("Study cancelled or inputs changed.");
  return await new Promise<T>((resolve,reject)=>{
   const w=kind==="structural"?
    new Worker(new URL("../workers/structural.worker.ts",import.meta.url)):
    new Worker(new URL("../workers/thermal.worker.ts",import.meta.url));
   worker.current=w;
   timer.current=setTimeout(()=>{release();reject(Error(kind+" solver exceeded the 120-second time limit."));},120000);
   w.onmessage=(message:MessageEvent<{ok:boolean;field?:T;error?:string}>)=>{
    if(token!==seq.current)return;
    release();
    if(message.data.ok&&message.data.field)resolve(message.data.field);
    else reject(Error(message.data.error??kind+" solver returned no result."));
   };
   w.onerror=()=>{release();reject(Error(kind+" worker failed."));};
   w.postMessage({file:buffer,rotation:axisRotation,unitScale:a.settings.unitScale,input},[buffer]);
  });
 }
 async function run(){
  if(!canRun||!a.file||!partSha256)return;
  const input={...service.input},heat={...thermal};
  const jobId=crypto.randomUUID();
  const process=a.journey.process;
  if(!["PBF_LB_METAL","DED_LB_WIRE","DED_LB_POWDER"].includes(process))return;
  try{
   const next=createEngineeringJob(jobId,{
    partSha256,partFileName:a.file.name,projectName:a.projectName,
    process:process as "PBF_LB_METAL"|"DED_LB_WIRE"|"DED_LB_POWDER",
    analysisMode:"service-independent",machineSettings:{unitScale:a.settings.unitScale},
    serviceCase:{id:service.id,name:service.name,input:JSON.parse(JSON.stringify(input))},
    thermalInput:heat,approvedAt:new Date().toISOString(),sourceIds,
    reviewedEvidence:reviewedEvidence.map(x=>({...x})),
    modelScope:"research-not-qualified"
   },["service-structural","steady-conduction"]);
   persist(next);
  }catch(e){setError(e instanceof Error?e.message:"Cannot create study record.");return;}
  const token=++seq.current;
  setLatest(null);onResults(null);setError("");setPhase("structural");
  transition("start","Structural worker calculating stress and displacement on the uploaded part.","service-structural");
  try{
   const structural=await solve<StructuralField>("structural",input,token);
   if(token!==seq.current)return;
   const first:ServiceStudyResults={partSha256,unitScale:a.settings.unitScale,process,jobId,structural};
   setLatest(first);onResults(first);
   transition("complete","Stress and displacement fields computed by one structural worker.","service-structural",{
    candidateId:"original-part",model:structural.solver.model,
    summary:"Max von Mises "+structural.solver.maxVonMisesMPa.toPrecision(5)+" MPa; max displacement "+structural.solver.maxDisplacementMm.toPrecision(5)+" mm.",
    warnings:structural.limitations
   });
   setPhase("thermal");
   transition("start","Steady conduction worker calculating the service-temperature field.","steady-conduction");
   const temperature=await solve<ThermalField>("thermal",heat,token);
   if(token!==seq.current)return;
   const full={...first,thermal:temperature};
   setLatest(full);onResults(full);
   transition("complete","Steady solid-conduction field computed.","steady-conduction",{
    candidateId:"original-part",model:temperature.solver.model,
    summary:"Steady temperature "+temperature.min.toPrecision(5)+"–"+temperature.max.toPrecision(5)+" °C.",
    warnings:temperature.limitations
   });
   setPhase("complete");
  }catch(e){
   if(token!==seq.current)return;
   release();transition("fail",e instanceof Error?e.message:"Numerical solver failed.");
   setError(e instanceof Error?e.message:"Numerical solver failed.");setPhase("failed");
  }
 }
 function exportJob(){
  if(!job)return;
  const bytes=new Blob([JSON.stringify(summarizeJobForExport(job),null,2)],{type:"application/json"});
  const u=URL.createObjectURL(bytes),anchor=document.createElement("a");
  anchor.href=u;anchor.download="orientai-service-study-"+job.id+".json";
  document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
 }
 return <section className="unifiedStudy" aria-label="Run all service analyses">
  <header className="unifiedStudyHead"><h3>Service analysis · one coordinated run</h3>
   <p>One structural solve yields <strong>stress and displacement</strong>. A second solve yields <strong>steady temperature</strong>. Both use the uploaded part in its original coordinates, independent of LPBF or DED printing strategy.</p></header>
  <div className="unifiedStudyCards" aria-label="Available study outputs">
   <div><b>Service stress</b><span>{latest?.structural?latest.structural.solver.maxVonMisesMPa.toPrecision(4)+" MPa":"Structural solver"}</span></div>
   <div><b>Displacement</b><span>{latest?.structural?latest.structural.solver.maxDisplacementMm.toPrecision(4)+" mm":"Same structural solve"}</span></div>
   <div><b>Steady temperature</b><span>{latest?.thermal?latest.thermal.min.toFixed(2)+"–"+latest.thermal.max.toFixed(2)+" °C":"Conduction solver"}</span></div>
  </div>
  <div className="unifiedStudyInputs">
   <h4>1 · Confirm engineering conditions</h4>
   <p>Values below are illustrative until checked against your design requirements. The current structural model fixes an entire extreme part face and loads the opposite face. It does not resolve real bolts or contact.</p>
   <div className="runbookFields">
    <label>Fixed original-part end
     <select aria-label="Analysis fixed face" disabled={active} value={service.input.fixedFace??"z-min"} onChange={e=>changeService("fixedFace",e.target.value as EndFace)}>
      {END_FACES.map(face=><option key={face} value={face}>{face}</option>)}
     </select></label>
    {([
     ["forceXN","X force (N)"],["forceYN","Y force (N)"],["forceZN","Z force (N)"],
     ["youngModulusMPa","Young's modulus (MPa)"],["poissonRatio","Poisson ratio"],["resolution","Structural resolution (6–12)"]
    ] as const).map(([key,label])=><label key={key}>{label}
      <input type="number" step="any" aria-label={label} disabled={active} value={service.input[key]??0}
       onChange={e=>changeService(key,Number(e.target.value))}/></label>)}
   </div>
   <h4>2 · Confirm thermal conditions</h4>
   <p>Base temperature is fixed on the bottom plane; a steady inward heat flux is applied on the upper plane. This is not transient deposition heating or print distortion.</p>
   <div className="runbookFields">{([
    ["conductivityWmK","Conductivity (W/m·K)"],["baseTemperatureC","Base temperature (°C)"],
    ["topFluxWm2","Upper-face heat flux (W/m²)"],["resolution","Thermal resolution (6–24)"]
   ] as const).map(([key,label])=><label key={key}>{label}<input type="number" step="any" aria-label={label} disabled={active}
    value={thermal[key]} onChange={e=>changeThermal(key,Number(e.target.value))}/></label>)}</div>
  </div>
  <label className="unifiedStudyApproval"><input type="checkbox" disabled={active} checked={approved} onChange={e=>setApproved(e.target.checked)}/>
    I have reviewed the geometry, fixtures, forces, elastic properties and thermal boundary conditions. I understand these may be illustrative research inputs, not qualified specifications.</label>
  {!verified&&<p role="status" className="runbookBlocker">Confirm STL dimensions and units in the Part step first.</p>}
  {!structuralValid(service.input)&&<p role="status" className="runbookBlocker">Enter valid elastic properties and at least one nonzero service force.</p>}
  {!thermalValid(thermal)&&<p role="status" className="runbookBlocker">Enter valid conductivity, temperatures, heat flux, and thermal mesh resolution.</p>}
  {a.journey.process!=="PBF_LB_METAL"&&<p className="runbookSourceSummary">DED selection: these are generic service-load and steady-conduction calculations on your STL. No DED deposition path, process thermal history or residual-stress prediction is being run.</p>}
  <div className="runbookActions">
   <button type="button" className="copilotPrimary" onClick={()=>void run()} disabled={!canRun}>{active?"Running approved analyses…":"Run All Applicable Analyses"}</button>
   {active&&<button type="button" className="copilotSmall" onClick={cancel}>Cancel study</button>}
  </div>
  {active&&<p role="status" className="runbookActive">{phase==="structural"?"1/2 · Calculating stress and displacement…":"2/2 · Calculating steady temperature…"}</p>}
  {phase==="complete"&&<div role="status" className="runbookComplete">
   All three result fields computed. <button type="button" className="copilotSmall" onClick={onOpenResults}>Inspect stress, displacement and temperature in 3D</button>
  </div>}
  {phase==="failed"&&<p role="alert" className="runbookBlocker">Study stopped: {error}. Previous completed steps remain labeled as partial results.</p>}
  {phase==="cancelled"&&<p role="status" className="runbookBlocker">Study cancelled; incomplete steps were not marked successful.</p>}
  <div className="runbookHistory"><h4>Study job history</h4>
   <p>Runs are stored in this browser for the STL fingerprint. Only numerical summaries and approvals survive reload; full contour arrays must be recomputed.</p>
   {!history.length?<p>No study records for this part.</p>:<ol>{history.slice(0,5).map(item=><li key={item.id}>
    <b>{item.status.toUpperCase()}</b> · {item.createdAt.slice(0,19).replace("T"," ")} · {item.steps.map(s=>s.kind).join(" → ")}
    <small>{item.steps.filter(s=>s.result).map(s=>s.result?.summary).join(" | ")}</small>
   </li>)}</ol>}
   {storageError&&<p role="alert" className="runbookBlocker">{storageError}</p>}
   {job&&<button type="button" className="copilotSmall" onClick={exportJob}>Export current study job record</button>}
  </div>
  <details className="runbookLimits"><summary>Engineering model limitations</summary>
   <p>Research models only: idealized isotropic linear elasticity; fixed and loaded extreme faces; simplified finite-volume conduction. No qualified service-life, fatigue, residual-stress, print distortion, DED toolpath or aerospace acceptance calculation.</p>
  </details>
 </section>;
}
