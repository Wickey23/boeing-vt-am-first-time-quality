"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {AlertTriangle,Download,ShieldCheck} from "lucide-react";
import {
 PROCESS_PARAMETERS,assessLpbfProcessWindow,emptyProcessQualityInput,
 type ProcessParameter,type ProcessQualityInput,type ProcessWindowAssessment
} from "@/lib/lpbf-process-quality";

export type QualitySnapshot={partHash:string;unitScale:number;
 input:ProcessQualityInput;assessment:ProcessWindowAssessment};
const parsePositiveOptional=(value:string)=>value.trim()===""?null:Number(value);
const visible=(value:number|null)=>value===null?"":String(value);
export default function ProcessQualityReview({partHash,unitScale,confirmed,onSummary}:{
 partHash:string|null;unitScale:number;confirmed:boolean;
 onSummary?:(snapshot:QualitySnapshot|null)=>void
}){
 const [input,setInput]=useState<ProcessQualityInput>(emptyProcessQualityInput);
 const [expanded,setExpanded]=useState(false);
 const assessment=useMemo(()=>assessLpbfProcessWindow(input),[input]);
 const summaryRef=useRef(onSummary);summaryRef.current=onSummary;
 useEffect(()=>{
  // A new STL or a different physical unit scale requires a new process review.
  setInput(emptyProcessQualityInput());setExpanded(false);
  summaryRef.current?.(null);
 },[partHash,unitScale]);
 useEffect(()=>{
  summaryRef.current?.(partHash&&confirmed?
   {partHash,unitScale,input,assessment}:null);
 },[partHash,confirmed,unitScale,input,assessment]);
 const updateText=(field:"machine"|"material"|"parameterSet"|"reference",value:string)=>
  setInput(prev=>({...prev,[field]:value,referenceReviewed:false}));
 const updateNumeric=(field:ProcessParameter,slot:"value"|"min"|"max",value:string)=>{
  const number=parsePositiveOptional(value);
  setInput(prev=>({...prev,referenceReviewed:false,
   values:slot==="value"?{...prev.values,[field]:number}:prev.values,
   windows:slot==="value"?prev.windows:{...prev.windows,
    [field]:{...prev.windows[field],[slot]:number}}
  }));
 };
 const outside=assessment.findings.filter(f=>f.severity==="blocker");
 const outstanding=assessment.findings.filter(f=>f.severity==="unassessed");
 const exportEvidence=()=>{
  if(!partHash||!confirmed)return;
  const json={schema:"orientai.lpbf-process-review.v1",partSha256:partHash,unitScaleToMm:unitScale,
   input,assessment,createdAt:new Date().toISOString(),
   note:"Engineer-entered parameters and source; not qualified and not a validated defect prediction."};
  const url=URL.createObjectURL(new Blob([JSON.stringify(json,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download="orientai-process-review-"+partHash.slice(0,12)+".json";
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 const status=!confirmed?"Confirm STL units to review the build":
  assessment.decision==="invalid-configuration"?"Invalid inputs · correct before evaluation":
  assessment.decision==="outside-declared-range"?"Outside entered process limits":
  assessment.decision==="inside-declared-ranges"?"Within entered parameter bounds · quality unverified":
  "Manufacturing evidence missing";
 return <section className="oaProcessQuality" aria-label="Deterministic LPBF process quality review">
  <header className="oaProcessQualityHeading">
   <div><ShieldCheck size={18}/><strong>Process quality preflight</strong></div>
   <small>{status}</small>
  </header>
  <p className="oaSubtle">Compare your actual planned LPBF settings with your own documented machine/material process window. No generic alloy preset or guessed failure probability is used. These checks do not establish density, fatigue strength or print success.</p>
  <div className="oaProcessQualityCounts" role="status">
   <div><strong>{assessment.outsideCount}</strong><small>Outside supplied ranges</small></div>
   <div><strong>{assessment.checksCompleted}/4</strong><small>Parameters compared</small></div>
   <div><strong>{outstanding.length}</strong><small>Evidence gaps</small></div>
  </div>
  <details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)} className="oaProcessQualityInputs">
   <summary>Enter machine, material and approved process limits</summary>
   <p className="oaSubtle">Never treat an example parameter set as machine-qualified. Use a source specific to this machine, alloy condition and scan strategy.</p>
   <div className="oaProcessQualityFields">
    <label>Machine / build system<input aria-label="Process machine" value={input.machine} onChange={e=>updateText("machine",e.target.value)} placeholder="Actual model / serial or approved ID"/></label>
    <label>Alloy and condition<input aria-label="Process material" value={input.material} onChange={e=>updateText("material",e.target.value)} placeholder="Material specification and condition"/></label>
    <label>Parameter-set identifier<input aria-label="Process parameter set" value={input.parameterSet} onChange={e=>updateText("parameterSet",e.target.value)} placeholder="Approved configuration revision"/></label>
    <label>Process-window source / revision<input aria-label="Process source reference" value={input.reference} onChange={e=>updateText("reference",e.target.value)} placeholder="Document ID and revision"/></label>
   </div>
   <div className="oaProcessQualityTableWrap">
    <table className="oaProcessQualityTable">
     <thead><tr><th scope="col">Parameter</th><th scope="col">Planned value</th><th scope="col">Source minimum</th><th scope="col">Source maximum</th></tr></thead>
     <tbody>{PROCESS_PARAMETERS.map(spec=><tr key={spec.id}>
      <th scope="row">{spec.label} <small>({spec.unit})</small></th>
      <td><input type="number" aria-label={"Planned "+spec.label} min="0" step="any" value={visible(input.values[spec.id])}
       onChange={e=>updateNumeric(spec.id,"value",e.target.value)}/></td>
      <td><input type="number" aria-label={spec.label+" source minimum"} min="0" step="any" value={visible(input.windows[spec.id].min)}
       onChange={e=>updateNumeric(spec.id,"min",e.target.value)}/></td>
      <td><input type="number" aria-label={spec.label+" source maximum"} min="0" step="any" value={visible(input.windows[spec.id].max)}
       onChange={e=>updateNumeric(spec.id,"max",e.target.value)}/></td>
     </tr>)}</tbody>
    </table>
   </div>
   <label className="oaProcessQualityApproval"><input type="checkbox" aria-label="Review process source applicability"
    checked={input.referenceReviewed}
    disabled={!input.machine.trim()||!input.material.trim()||!input.parameterSet.trim()||!input.reference.trim()}
    onChange={e=>setInput(old=>({...old,referenceReviewed:e.target.checked}))}/>
    I checked the cited document and these limits apply to this exact machine, alloy/condition, and parameter set. This confirms my input review, not ORIENTAI validation.</label>
  </details>
  {assessment.indicators.volumeEnergyJMm3!==null&&<div className="oaProcessQualityIndicators">
   <span>Calculated energy-density proxy: <b>{Number(assessment.indicators.volumeEnergyJMm3.toPrecision(5))} J/mm³</b></span>
   <small>Power / (speed × hatch × layer). Diagnostic only. Cannot classify lack-of-fusion or keyholing without validated process and melt-pool evidence.</small>
  </div>}
  {outside.map(f=><article className="oaPreflightIssue" key={f.code}>
   <div className="oaPreflightIssueHead"><AlertTriangle size={16}/><strong>{f.title}</strong><span>Configuration blocker</span></div>
   <p>{f.observation}</p><small><b>Basis:</b> {f.basis}</small><small><b>Action:</b> {f.action}</small>
  </article>)}
  {assessment.decision==="inside-declared-ranges"&&<p className="oaSubtle"><ShieldCheck size={14} style={{verticalAlign:"middle"}}/> All four numerical values are inside the engineer-reviewed individual bounds. This is not process qualification or a prediction of good print quality.</p>}
  <details className="oaPreflightUnassessed">
   <summary>Missing evidence and limitations ({outstanding.length})</summary>
   {assessment.findings.filter(f=>f.severity!=="blocker").map(f=>
    <p key={f.code}><b>{f.title}.</b> {f.observation} {f.action}</p>)}
  </details>
  <div className="oaRunActions"><button type="button" className="oaSecondaryRun" disabled={!confirmed||!partHash} onClick={exportEvidence}>
   <Download size={14}/> Export process quality evidence JSON
  </button></div>
 </section>;
}
