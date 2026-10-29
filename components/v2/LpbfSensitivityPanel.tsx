"use client";
import {useEffect,useRef,useState} from "react";
import {useAnalysis} from "../AnalysisProvider";
import type {MovingInputs} from "@/lib/lpbf-moving-source";
import type {LpbfResult} from "@/lib/lpbf-transient";
import type {ScanPlan} from "@/lib/lpbf-scan-plan";
import type {SensitivityMetric,SensitivityStudy} from "@/lib/lpbf-sensitivity";

type SensitivityMessage=
 |{type:"progress";partHash:string;stage:"time-step"|"spatial";done:number;total:number}
 |{type:"result";partHash:string;result:SensitivityStudy}
 |{type:"error";error:string};
function Metric({value,unit}:{value:number;unit:string}){
 return <span>{Number.isFinite(value)?value.toPrecision(4):"Unavailable"} {unit}</span>;
}
function Case({title,metric}:{title:string;metric:SensitivityMetric}){
 return <div className="oaSensitivityCase">
  <h4>{title}</h4>
  <p>{metric.summary}</p>
  <dl>
   <div><dt>Baseline / candidate voxels per axis</dt><dd>{metric.baselineResolution} / {metric.candidateResolution}</dd></div>
   <div><dt>Maximum step scaling</dt><dd>{metric.baselineStepScale} / {metric.candidateStepScale}</dd></div>
   <div><dt>Computed solver steps</dt><dd>{metric.baselineTimeSteps} / {metric.candidateTimeSteps}</dd></div>
   <div><dt>Absolute peak temperature change</dt><dd><Metric value={metric.peakDifferenceC} unit="°C"/></dd></div>
   <div><dt>Final mean temperature change</dt><dd><Metric value={metric.finalMeanDifferenceC} unit="°C"/></dd></div>
   <div><dt>Final surface temperature RMS change</dt><dd><Metric value={metric.surfaceRmsDifferenceC} unit="°C"/></dd></div>
   <div><dt>Absorbed energy difference</dt><dd><Metric value={metric.absorbedEnergyDifferenceJ} unit="J"/></dd></div>
  </dl>
 </div>;
}
export default function LpbfSensitivityPanel({baseline,inputs,scanPlan,partHash}:{
 baseline:LpbfResult;inputs:MovingInputs;scanPlan?:ScanPlan;partHash:string;
}){
 const a=useAnalysis();
 const [status,setStatus]=useState<"idle"|"running"|"complete"|"error"|"cancelled">("idle");
 const [error,setError]=useState(""),[progress,setProgress]=useState(0),[stage,setStage]=useState("time-step");
 const [study,setStudy]=useState<SensitivityStudy|null>(null);
 const worker=useRef<Worker|null>(null),token=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const stop=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;worker.current?.terminate();worker.current=null;};
 useEffect(()=>()=>{token.current++;stop()},[]);
 const cancel=()=>{token.current++;stop();setStatus("cancelled");setError("Numerical sensitivity study cancelled; no comparison published.");};
 const run=async()=>{
  if(!a.file||status==="running")return;
  const current=++token.current;stop();setError("");setStudy(null);setProgress(0);setStage("time-step");setStatus("running");
  try{
   const file=await a.file.arrayBuffer();if(current!==token.current)return;
   const w=new Worker(new URL("../../workers/lpbf-sensitivity.worker.ts",import.meta.url));
   worker.current=w;
   timer.current=setTimeout(()=>{if(current!==token.current)return;stop();setStatus("error");setError("Sensitivity worker exceeded 120 seconds; no complete comparison published.");},120000);
   w.onmessage=(event:MessageEvent<SensitivityMessage>)=>{
    if(current!==token.current)return;const msg=event.data;
    if(msg.type==="progress"){
     if(msg.partHash!==partHash){cancel();return;}
     setStage(msg.stage);setProgress(Math.round(100*msg.done/msg.total));return;
    }
    stop();
    if(msg.type==="error"){setStatus("error");setError(msg.error);return;}
    if(msg.partHash!==partHash){setStatus("error");setError("Part identity mismatch; result discarded.");return;}
    setStudy(msg.result);setStatus("complete");
   };
   w.onerror=()=>{if(current===token.current){stop();setStatus("error");setError("Sensitivity worker failed. No report published.");}};
   w.postMessage({file,partHash,unitScale:a.settings.unitScale,inputs,baseline,scanPlan},[file]);
  }catch(err){if(current===token.current){stop();setStatus("error");setError(err instanceof Error?err.message:"Could not start sensitivity checks.");}}
 };
 const exportReport=()=>{
  if(!study)return;
  const payload={
   schema:"orientai.lpbf-numerical-sensitivity.v1",timestamp:new Date().toISOString(),
   part:{sha256:partHash,fileName:a.file?.name??"",unitsToMm:a.settings.unitScale},
   inputApproval:"engineer-approved baseline, followed by explicit sensitivity request",
   engine:study.engine,inputs,scanPlanSha256:scanPlan?.sha256??null,study
  };
  const uri=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=uri;link.download="orientai-lpbf-sensitivity-"+partHash.slice(0,12)+".json";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(uri),2000);
 };
 return <section className="oaSensitivityPanel" aria-label="LPBF numerical sensitivity review">
  <h3>Numerical sensitivity review</h3>
  <p className="oaSubtle">Run the same approved idealized thermal model at half the original maximum time step. {scanPlan?
   "Spatial refinement is disabled for imported paths because their indices reference specific virtual voxel slabs.":
   "A second comparison tries a finer voxel grid; its laser discretization and layer grouping also change, so this is not a controlled mesh-convergence proof."}
  </p>
  <p className="oaSubtle">This extra computation is local and optional. No benchmark measurements are used. Small differences do not establish predictive accuracy, defect probability, or a first-time-quality guarantee.</p>
  <div className="oaRunActions">
   <button type="button" className="oaRunButton" disabled={status==="running"} onClick={()=>void run()}>Run numerical sensitivity checks</button>
   {status==="running"&&<button type="button" className="oaSecondaryRun" onClick={cancel}>Cancel sensitivity run</button>}
  </div>
  {status==="running"&&<><progress aria-label="Sensitivity progress" className="oaRunProgress" max={100} value={progress}/><p role="status" className="oaSubtle">Calculating {stage==="spatial"?"finer spatial grid":"smaller time step"} · {progress}%</p></>}
  {error&&<p role="alert" className="oaStudyError">{error}</p>}
  {study&&<div role="region" className="oaSensitivityOutput" aria-label="Calculated numerical sensitivity results">
   <Case title="Time-step sensitivity" metric={study.temporal}/>
   {study.spatial?<Case title="Spatial grid sensitivity" metric={study.spatial}/>:<p className="oaSubtle">Spatial comparison not reported: {study.spatialSkippedReason}</p>}
   <details className="oaUnavailable"><summary>Interpretation and validation limits</summary>
    {study.interpretation.map((v,i)=><p key={i}>{v}</p>)}
   </details>
   <button type="button" className="oaSecondaryRun" onClick={exportReport}>Export sensitivity JSON report</button>
  </div>}
 </section>;
}
