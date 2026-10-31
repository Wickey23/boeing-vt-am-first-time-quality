"use client";
import {useEffect,useRef,useState} from "react";
import {AlertTriangle,CheckCircle2,ShieldAlert,Eye,Download} from "lucide-react";
import type {Axis3,LpbfPreflight} from "@/lib/lpbf-risk-preflight";

type WorkerReply={type:"result";result:LpbfPreflight}|{type:"error";error:string};
export default function RiskPreflight({file,partHash,unitScale,confirmed,rotationDeg,
 envelopeMm,overhangThresholdDeg,onFocus,onSummary}:{
 file:File|null;partHash:string|null;unitScale:number;confirmed:boolean;
 rotationDeg:Axis3;envelopeMm:Axis3;overhangThresholdDeg:number;
 onFocus:(triangles:number[])=>void;onSummary?:(result:LpbfPreflight|null)=>void;
}){
 const [state,setState]=useState<{result:LpbfPreflight|null;error:string;status:"idle"|"running"|"done"|"failed"}>({
  result:null,error:"",status:"idle"});
 const job=useRef(0),worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const summary=useRef(onSummary);summary.current=onSummary;
 useEffect(()=>{
  const id=++job.current;
  worker.current?.terminate();worker.current=null;
  if(timer.current)clearTimeout(timer.current);
  onFocus([]);
  summary.current?.(null);
  setState({result:null,error:"",status:file&&confirmed&&partHash?"running":"idle"});
  if(!file||!partHash||!confirmed)return;
  let active=true;
  (async()=>{
   try{
    const bytes=await file.arrayBuffer();
    if(!active||id!==job.current)return;
    const w=new Worker(new URL("../../workers/lpbf-risk-preflight.worker.ts",import.meta.url));
    worker.current=w;
    timer.current=setTimeout(()=>{
     if(!active||id!==job.current)return;
     w.terminate();worker.current=null;
     setState({result:null,status:"failed",error:"Preflight timed out; simplify STL or reduce mesh size."});
     summary.current?.(null);
    },60000);
    w.onmessage=(e:MessageEvent<WorkerReply>)=>{
     if(!active||id!==job.current)return;
     if(timer.current)clearTimeout(timer.current);
     w.terminate();worker.current=null;
     const response=e.data;
     if(response.type==="error"){
      setState({result:null,status:"failed",error:response.error});
      summary.current?.(null);return;
     }
     if(response.result.sourceSha256!==partHash)return;
     setState({result:response.result,status:"done",error:""});
     summary.current?.(response.result);
    };
    w.onerror=()=>{
     if(!active||id!==job.current)return;
     if(timer.current)clearTimeout(timer.current);w.terminate();worker.current=null;
     setState({result:null,status:"failed",error:"Local STL preflight worker failed."});
     summary.current?.(null);
    };
    w.postMessage({source:bytes,sourceSha256:partHash,unitScaleToMm:unitScale,
     rotationDeg,envelopeMm,overhangThresholdDeg},[bytes]);
   }catch{
    if(active&&id===job.current)setState({result:null,status:"failed",error:"Unable to read STL for risk screening."});
   }
  })();
  return()=>{active=false;job.current++;worker.current?.terminate();worker.current=null;
   if(timer.current)clearTimeout(timer.current);};
 },[file,partHash,unitScale,confirmed,rotationDeg.x,rotationDeg.y,rotationDeg.z,
   envelopeMm.x,envelopeMm.y,envelopeMm.z,overhangThresholdDeg]);
 const result=state.result;
 const blockers=result?.findings.filter(f=>f.severity==="blocker")??[];
 const alerts=result?.findings.filter(f=>f.severity==="attention")??[];
 const unknowns=result?.findings.filter(f=>f.severity==="unassessed")??[];
 const exportReport=()=>{
  if(!result)return;
  const data={...result,exportedAt:new Date().toISOString(),
   caution:"STL-based geometric screening only. This is not a validated LPBF defect forecast, machine job or part qualification."};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="orientai-geometric-risk-"+result.sourceSha256.slice(0,12)+".json";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 return <section aria-label="Automatic LPBF failure-risk preflight" className="oaAutoPreflight">
  <header><span><ShieldAlert size={18}/> Automatic part risk preflight</span>
   <small>{!confirmed?"Awaiting confirmed STL units":state.status==="running"?"Inspecting triangles…":state.status==="done"?
    blockers.length+" blockers · "+alerts.length+" review items":"Research geometry screen"}</small></header>
  {!confirmed&&<p className="oaSubtle">Mesh topology is inspected automatically. Confirm the STL units and dimensions above to calculate location-specific down-facing regions and build-frame constraints. No external AI call is made.</p>}
  {state.status==="running"&&<p role="status" className="oaSubtle">Analyzing real STL triangle normals, topology, build envelope and potential support regions locally…</p>}
  {state.error&&<p role="alert" className="oaStudyError">{state.error}</p>}
  {result&&<>
   <div className="oaPreflightSummary" role="status">
    <div><strong>{blockers.length}</strong><small>Geometric blockers</small></div>
    <div><strong>{alerts.length}</strong><small>Needs engineering review</small></div>
    <div><strong>{unknowns.length}</strong><small>Still unassessed</small></div>
   </div>
   {blockers.length===0&&alerts.length===0&&<p className="oaSubtle"><CheckCircle2 size={14} style={{verticalAlign:"middle"}}/> No issues triggered these limited geometric screening rules. Printability and part quality remain unverified.</p>}
   {[...blockers,...alerts].map(f=><article className="oaPreflightIssue" key={f.code}>
    <div className="oaPreflightIssueHead"><AlertTriangle size={16} className={f.severity==="blocker"?"oaStepWarn":undefined}/>
     <strong>{f.title}</strong><span>{f.severity==="blocker"?"Geometry blocker":"Needs review"}</span></div>
    <p>{f.observation}</p>
    <small><b>Evidence:</b> {f.evidence}</small>
    <small><b>Next action:</b> {f.nextAction}</small>
    {!!f.triangleIds.length&&<button type="button" className="oaSecondaryRun" onClick={()=>onFocus(f.triangleIds)}>
      <Eye size={14}/> Highlight {f.triangleIds.length.toLocaleString()} relevant STL triangles in 3D</button>}
   </article>)}
   <details className="oaPreflightUnassessed">
    <summary>Not predicted — show missing manufacturing and model evidence ({unknowns.length})</summary>
    {unknowns.map(f=><p key={f.code}><b>{f.title}:</b> {f.observation} {f.nextAction}</p>)}
   </details>
   <div className="oaRunActions">
    <button className="oaSecondaryRun" type="button" onClick={()=>onFocus([])}>Clear 3D highlight</button>
    <button className="oaSecondaryRun" type="button" onClick={exportReport}><Download size={14}/> Export source-hashed evidence JSON</button>
   </div>
   <p className="oaSubtle">Current orientation: X {result.rotationDeg.x.toFixed(1)}°, Y {result.rotationDeg.y.toFixed(1)}°, Z {result.rotationDeg.z.toFixed(1)}°. Triangle-level geometric measurements only; no proof that surfaces require supports or that any physical defect will occur.</p>
  </>}
 </section>;
}
