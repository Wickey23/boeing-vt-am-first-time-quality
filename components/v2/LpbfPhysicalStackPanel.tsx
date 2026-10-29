"use client";
import {useEffect,useRef,useState} from "react";
import type {PhysicalStackResult} from "@/lib/lpbf-physical-stack";
import type {MovingInputs} from "@/lib/lpbf-moving-source";
import type {PhysicalScanAudit} from "@/lib/lpbf-physical-schedule";
import {useAnalysis} from "../AnalysisProvider";
type Message=
 |{type:"progress";partSha256:string;done:number;total:number}
 |{type:"result";partSha256:string;sourceSha256:string;result:PhysicalStackResult}
 |{type:"error";error:string};
export default function LpbfPhysicalStackPanel({scan,audit,partHash,inputs}:{
 scan:File;audit:PhysicalScanAudit;partHash:string;inputs:MovingInputs;
}){
 const a=useAnalysis();
 const [approved,setApproved]=useState(false);
 const [status,setStatus]=useState<"idle"|"running"|"complete"|"error"|"cancelled">("idle");
 const [progress,setProgress]=useState(0),[error,setError]=useState("");
 const [result,setResult]=useState<PhysicalStackResult|null>(null);
 const ref=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),version=useRef(0);
 const stop=()=>{ref.current?.terminate();ref.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;};
 useEffect(()=>()=>{version.current++;stop()},[]);
 const run=async()=>{
  if(!a.file||!approved||status==="running")return;
  const id=++version.current;stop();setStatus("running");setError("");setProgress(0);setResult(null);
  try{
   const [part,bytes]=await Promise.all([a.file.arrayBuffer(),scan.arrayBuffer()]);
   if(id!==version.current)return;
   const worker=new Worker(new URL("../../workers/lpbf-physical-stack.worker.ts",import.meta.url));
   ref.current=worker;
   timer.current=setTimeout(()=>{if(id===version.current){stop();setStatus("error");setError("Research stack worker exceeded its 120-second cap.");}},120000);
   worker.onmessage=(event:MessageEvent<Message>)=>{
    if(id!==version.current)return;
    const msg=event.data;
    if(msg.type==="progress"){
     if(msg.partSha256!==partHash){stop();setStatus("error");setError("Part identity changed during stack study.");return;}
     setProgress(Math.round(100*msg.done/msg.total));return;
    }
    stop();
    if(msg.type==="error"){setStatus("error");setError(msg.error);return;}
    if(msg.partSha256!==partHash||msg.sourceSha256!==audit.sourceSha256||
       msg.result.engine!=="lpbf-physical-stack-1d-enthalpy-0.1"){
     setStatus("error");setError("Stack result did not match audited input identities.");return;
    }
    setResult(msg.result);setStatus("complete");
   };
   worker.onerror=()=>{if(id===version.current){stop();setStatus("error");setError("Physical stack research worker failed.");}};
   worker.postMessage({part,scan:bytes,partSha256:partHash,sourceSha256:audit.sourceSha256,
    unitScale:a.settings.unitScale,sourceName:scan.name,inputs},[part,bytes]);
  }catch(e){if(id===version.current){stop();setStatus("error");setError(e instanceof Error?e.message:"Could not start physical stack research.");}}
 };
 const cancel=()=>{version.current++;stop();setStatus("cancelled");setError("Run cancelled; no result published.");};
 const exportJson=()=>{
  if(!result)return;
  const record={schema:"orientai.lpbf-physical-stack-1d.v1",partSha256:partHash,
   auditedScanSha256:audit.sourceSha256,auditedSource:scan.name,
   unitScaleToMm:a.settings.unitScale,study:result,
   qualification:"UNVALIDATED_1D_RESEARCH_NOT_3D_MELT_POOL"};
  const blob=new Blob([JSON.stringify(record,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="orientai-physical-stack-"+partHash.slice(0,12)+".json";
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 };
 const records=result?.records??[];
 const ymax=Math.max(1,...records.map(p=>p.surfaceTemperatureC));
 const ymin=Math.min(0,...records.map(p=>p.surfaceTemperatureC));
 const tmax=records.at(-1)?.timeSeconds??1;
 const polyline=records.map(p=>{
  const x=20+520*p.timeSeconds/Math.max(1e-9,tmax);
  const y=195-175*(p.surfaceTemperatureC-ymin)/Math.max(1e-9,ymax-ymin);
  return x.toFixed(2)+","+y.toFixed(2);
 }).join(" ");
 return <section aria-label="Physical-layer one-dimensional thermal study" className="oaPhysicalStack">
  <h3>Physical-layer 1D thermal research</h3>
  <p className="oaSubtle">Optional through-height enthalpy column driven by the audited physical-layer power/timing. It activates full physical layers sequentially but averages all laser energy across each layer. It does not represent XY scan heating, melt-pool shape, powder physics, structural failure or calibrated print quality.</p>
  <label className="oaLpbfApproval"><input type="checkbox" aria-label="Approve physical stack research assumptions"
    checked={approved} disabled={status==="running"} onChange={e=>{setApproved(e.target.checked);setResult(null);setStatus("idle");}}/>
   I reviewed the independently audited source and accept the model's 1D, full-layer activation, uniform energy deposition and constant material property assumptions. This is not a validated 3D LPBF simulation.
  </label>
  <div className="oaRunActions">
   <button type="button" className="oaRunButton" disabled={!approved||status==="running"} onClick={()=>void run()}>Run 1D physical-layer research</button>
   {status==="running"&&<button type="button" className="oaSecondaryRun" onClick={cancel}>Cancel 1D study</button>}
  </div>
  {status==="running"&&<><progress max={100} value={progress} aria-label="Physical-layer research progress" className="oaRunProgress"/><p role="status" className="oaSubtle">Integrating physical layers: {progress}%</p></>}
  {error&&<p className="oaStudyError" role="alert">{error}</p>}
  {result&&<div aria-label="Physical-layer 1D results" role="region" className="oaPhysicalStackResults">
   <p className="oaLpbfWarning"><strong>Unvalidated 1D thermal column.</strong> No 3D melt-pool, local laser tracks, porosity, residual stress or first-time-quality prediction.</p>
   <div className="oaLpbfMetrics">
    <div><small>Simulated physical layers</small><strong>{result.geometry.physicalLayers}</strong></div>
    <div><small>Commanded laser energy</small><strong>{result.energy.commandedLaserJ.toPrecision(5)} J</strong></div>
    <div><small>Coupled laser energy</small><strong>{result.energy.absorbedJ.toPrecision(5)} J</strong></div>
    <div><small>Peak column temperature</small><strong>{result.temperature.peakC.toPrecision(5)} °C</strong></div>
    <div><small>Energy conservation residual</small><strong>{(result.energy.relativeImbalance*100).toPrecision(4)}%</strong></div>
    <div><small>Integration steps</small><strong>{result.time.integrationSteps}</strong></div>
   </div>
   <svg viewBox="0 0 560 220" role="img" aria-label="Research 1D layer-average top temperature versus commanded time" className="oaProbePlot">
    <rect width="560" height="220" rx="9" fill="#0c1928"/>
    <line x1="20" y1="195" x2="540" y2="195" stroke="#9eb8c6"/>
    <line x1="20" y1="20" x2="20" y2="195" stroke="#9eb8c6"/>
    <polyline points={polyline} stroke="#f0b66d" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
    <text x="24" y="14" fill="#c4d5dc" fontSize="11">Layer-average top T (°C)</text>
    <text x="425" y="211" fill="#c4d5dc" fontSize="11">0–{tmax.toFixed(4)} s</text>
   </svg>
   <details className="oaProbeLayerMap"><summary>Model limitations and research assumptions</summary>
    {result.limitations.map((x,i)=><p className="oaSubtle" key={i}>{x}</p>)}
   </details>
   <button className="oaSecondaryRun" type="button" onClick={exportJson}>Export 1D thermal research JSON</button>
  </div>}
 </section>;
}
