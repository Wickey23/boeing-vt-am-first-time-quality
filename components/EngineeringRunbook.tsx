"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {useAnalysis} from "./AnalysisProvider";
import {activeServiceCase,serviceInputKey} from "@/lib/service-plan";
import {buildEngineeringRunbook,type StudyKind} from "@/lib/engineering-runbook";
import type {StructuralField} from "@/lib/voxel-structural";
import type {ThermalField,ThermalInput} from "@/lib/voxel-thermal";
type Phase="idle"|"screening"|"structural"|"thermal"|"completed"|"failed"|"cancelled";
type HistoryItem={stage:string;detail:string};
const defaultThermal:ThermalInput={conductivityWmK:6.7,baseTemperatureC:20,topFluxWm2:1000,resolution:12};
export default function EngineeringRunbook({verified,loadsReviewed,requirementsDocumented}:{verified:boolean;loadsReviewed:boolean;requirementsDocumented:boolean}){
 const a=useAnalysis(),service=activeServiceCase(a.servicePlan);
 const [includeStructural,setIncludeStructural]=useState(false),[includeThermal,setIncludeThermal]=useState(false);
 const [thermal,setThermal]=useState<ThermalInput>(defaultThermal),[thermalReviewed,setThermalReviewed]=useState(false);
 const [phase,setPhase]=useState<Phase>("idle"),[log,setLog]=useState<HistoryItem[]>([]),[error,setError]=useState("");
 const generation=useRef(0),worker=useRef<Worker|null>(null),timeout=useRef<ReturnType<typeof setTimeout>|null>(null);
 const phaseRef=useRef<Phase>("idle");phaseRef.current=phase;
 const active=phase==="screening"||phase==="structural"||phase==="thermal";
 const inputFingerprint=serviceInputKey(service.input);
 const plan=useMemo(()=>buildEngineeringRunbook({
  filePresent:!!a.file,geometryConfirmed:verified,process:a.journey.process,runStructural:includeStructural,runThermal:includeThermal,
  loadsReviewed,requirementsDocumented,serviceInput:service.input,thermalInputReviewed:thermalReviewed,thermalInput:thermal
 }),[a.file,verified,a.journey.process,includeStructural,includeThermal,loadsReviewed,requirementsDocumented,inputFingerprint,thermalReviewed,thermal]);
 function release(){if(timeout.current)clearTimeout(timeout.current);timeout.current=null;worker.current?.terminate();worker.current=null;}
 function cancel(){generation.current++;release();if(phaseRef.current==="screening")a.cancel();setPhase("cancelled");setLog(x=>[...x,{stage:"Cancelled",detail:"Active worker stopped; previously saved results are unchanged."}]);}
 // A new part, changed fixture or machine assumptions invalidate a running study.
 useEffect(()=>()=>{generation.current++;release();},[a.file,a.settings,a.journey.process,inputFingerprint,a.selected]);
 const note=(stage:string,detail:string)=>setLog(x=>[...x,{stage,detail}]);
 const fail=(detail:string)=>{release();setError(detail);setPhase("failed");note("Stopped",detail);};
 const finish=()=>{release();setPhase("completed");note("Complete","Research calculations completed; review the model limitations and source evidence before using results.");};
 const runWorker=async(kind:Exclude<StudyKind,"geometry">,runId:string,candidateId:string,
   rotation:{x:number;y:number;z:number},unitScale:number,seq:number)=>{
  if(!a.file){fail("Source STL is missing.");return;}
  setPhase(kind==="service-structural"?"structural":"thermal");
  note(kind==="service-structural"?"Structural FEM":"Steady conduction","Running numerical worker against the selected geometry.");
  try{
   const buffer=await a.file.arrayBuffer();
   if(seq!==generation.current)return;
   const w=kind==="service-structural"?
     new Worker(new URL("../workers/structural.worker.ts",import.meta.url)):
     new Worker(new URL("../workers/thermal.worker.ts",import.meta.url));
   worker.current=w;
   timeout.current=setTimeout(()=>{if(seq===generation.current)fail("Numerical worker exceeded 120 seconds.");},120000);
   w.onmessage=(event:MessageEvent<{ok:boolean;field?:StructuralField|ThermalField;error?:string}>)=>{
    if(seq!==generation.current)return;
    release();
    const output=event.data;
    if(!output.ok||!output.field){fail(output.error||"Solver returned no valid field.");return;}
    if(kind==="service-structural"){
     a.attachStructural(runId,candidateId,output.field as StructuralField,service.id,serviceInputKey(service.input));
     note("Structural FEM complete","Simplified isotropic linear-elastic numerical field; no strength or fatigue approval.");
     if(includeThermal)void runWorker("steady-conduction",runId,candidateId,rotation,unitScale,seq);
     else finish();
    }else{
     a.attachThermal(runId,candidateId,output.field as ThermalField);
     note("Steady conduction complete","Solid steady-state field; not deposition thermal history.");
     finish();
    }
   };
   w.onerror=()=>{if(seq===generation.current)fail("Numerical worker crashed; output was withheld.");};
   const input=kind==="service-structural"?{...service.input}:thermal;
   w.postMessage({file:buffer,rotation,unitScale,input},[buffer]);
  }catch(e){if(seq===generation.current)fail(e instanceof Error?e.message:"Numerical worker could not start.");}
 };
 const begin=()=>{
  if(active||!plan.allowed)return;
  generation.current++;release();setLog([]);setError("");setPhase("screening");
  note("Orientation screening","Starting LPBF geometry screening with confirmed STL and machine settings.");
  a.retry();
 };
 useEffect(()=>{
  if(phase!=="screening")return;
  if(a.error&&!a.busy){fail("Orientation solver: "+a.error);return;}
  if(!a.result||!a.selected||a.busy)return;
  const candidate=a.result.candidates.find(c=>c.id===a.selected);
  if(!candidate){fail("No selected orientation was returned.");return;}
  note("Geometry complete",String(a.result.candidates.length)+" sampled orientations, selected "+candidate.id+".");
  const seq=generation.current;
  if(includeStructural)void runWorker("service-structural",a.result.runId,candidate.id,candidate.rotation,a.result.configuration.unitScale,seq);
  else if(includeThermal)void runWorker("steady-conduction",a.result.runId,candidate.id,candidate.rotation,a.result.configuration.unitScale,seq);
  else finish();
 // Next stage is launched only once when results become available.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[phase,a.result,a.selected,a.busy,a.error]);
 function editThermal<K extends keyof ThermalInput>(key:K,value:ThermalInput[K]){
  setThermal(prev=>({...prev,[key]:value}));setThermalReviewed(false);
 }
 return <section className="copilotRunbook" aria-label="Guided simulation plan">
  <h3>Guided simulation plan</h3>
  <p>Select supported analyses. The workflow checks prerequisites and executes real numerical workers after explicit approval. AI chat cannot change loads or trigger execution.</p>
  <label className="runbookChoice"><input type="checkbox" checked={includeStructural} disabled={active} onChange={e=>setIncludeStructural(e.target.checked)}/> Include idealized service-load FEM</label>
  <label className="runbookChoice"><input type="checkbox" checked={includeThermal} disabled={active} onChange={e=>setIncludeThermal(e.target.checked)}/> Include steady solid conduction (not printing thermal history)</label>
  {includeThermal&&<div className="runbookThermal">
   <p>Review the actual material and thermal inputs. Defaults are illustrative, not derived from the assembly documents.</p>
   <div className="runbookFields">{([
    ["conductivityWmK","Conductivity (W/m·K)"],["baseTemperatureC","Base temperature (°C)"],
    ["topFluxWm2","Upper-face flux (W/m²)"],["resolution","Voxel resolution (6–24)"]
   ] as const).map(([key,label])=><label key={key}>{label}<input type="number" step="any" disabled={active} value={thermal[key]} onChange={e=>editThermal(key,Number(e.target.value))}/></label>)}</div>
   <label className="runbookChoice"><input type="checkbox" checked={thermalReviewed} disabled={active} onChange={e=>setThermalReviewed(e.target.checked)}/> I reviewed the thermal values and accept their illustrative boundary conditions.</label>
  </div>}
  <ol className="runbookChecklist">{plan.steps.map((step,i)=><li key={step.kind}>
   <div><b>{i+1}. {step.name}</b><span className={"runbookFlag "+step.status}>{step.status==="ready"?"Ready":step.status==="not-supported"?"Unsupported":"Needs information"}</span></div>
   <p>{step.reason}</p><small>{step.scope}</small>
  </li>)}</ol>
  {includeStructural&&!loadsReviewed&&<p className="runbookBlocker">Confirm requirements, real forces, material and fixture assumptions in “Reviewed engineering facts” before scheduling FEM.</p>}
  <div className="runbookActions">
   <button className="copilotPrimary" disabled={!plan.allowed||active} onClick={begin}>{active?"Study running…":"Run approved study sequence"}</button>
   {active&&<button type="button" className="copilotSmall" onClick={cancel}>Cancel active study</button>}
  </div>
  {active&&<p role="status" className="runbookActive">Current step: {phase==="screening"?"Orientation screening "+Math.round(a.progress*100)+"%":phase==="structural"?"Service-load FEM":"Steady conduction"}</p>}
  {a.busy&&phase==="screening"&&<progress aria-label="Runbook geometry progress" value={a.progress} max={1}/>}
  {phase==="completed"&&<p role="status" className="runbookComplete">Study sequence complete. <Link href="/report">Review engineering results</Link>. No print qualification was established.</p>}
  {error&&<p role="alert" className="runbookBlocker">{error}</p>}
  {log.length>0&&<details open={active||phase==="failed"||phase==="completed"}><summary>Executed steps and evidence</summary><ol className="runbookLog">{log.map((entry,i)=><li key={i}><b>{entry.stage}</b><p>{entry.detail}</p></li>)}</ol></details>}
  <details className="runbookLimits"><summary>Model limitations</summary>{plan.limitations.map(item=><p key={item}>{item}</p>)}</details>
 </section>;
}
