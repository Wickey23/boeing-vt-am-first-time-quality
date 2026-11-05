"use client";
import Link from "next/link";
import {ArrowRight,BarChart3,CheckCircle2,FileDown,Info,Play,ShieldAlert} from "lucide-react";
import type {FailureCoverage} from "@/lib/failure-coverage";
type Finding={code:string;message:string;basis:string;level:"blocker"|"review"};
type Props={
 fileName:string;unitsConfirmed:boolean;hasGeometryRun:boolean;
 coverage:FailureCoverage[];findings:Finding[];
 canRun:boolean;busy:boolean;onRunGeometry:()=>void;onOpenGeometry:()=>void;onOpenContext:()=>void;
 selectedOrientation?:{id:string;buildHeightMm:number;supportProxyMm3:number};
};
const label=(state:FailureCoverage["state"])=>state==="screened"?"Screened":state==="calculated"?"Calculated":"Not assessed";
export default function EngineeringAssessmentResults(props:Props){
 const screened=props.coverage.filter(x=>x.state==="screened").length;
 const calculated=props.coverage.filter(x=>x.state==="calculated").length;
 const missing=props.coverage.filter(x=>x.state==="not-assessed").length;
 const manufacturing=props.coverage.filter(x=>x.category==="geometry"||x.category==="manufacturability"||x.category==="print-process");
 const service=props.coverage.filter(x=>x.category==="service");
 const group=(items:FailureCoverage[],name:string,explanation:string)=><section className="oaProCard oaRiskGroup">
  <div className="oaProCardHeading"><div><ShieldAlert size={18}/><strong>{name}</strong></div><span>{items.filter(x=>x.state!=="not-assessed").length} of {items.length} assessed</span></div>
  <p className="oaQuietCopy">{explanation}</p>
  <div className="oaRiskRows">{items.map(item=><details className="oaRiskRow" key={item.id}>
   <summary><span>{item.name}</span><span className={"oaRiskStatus oaRiskStatus-"+item.state}>{label(item.state)}</span></summary>
   <div><p><strong>Method:</strong> {item.method}</p><p><strong>Limitations:</strong> {item.limitations}</p><p><strong>Needed:</strong> {item.nextInput}</p></div>
  </details>)}</div>
 </section>;
 return <section className="oaStageWorkspace oaAssessmentResults" aria-label="Failure assessment workspace">
  <div className="oaStageIntro">
   <span className="oaStageEyebrow">STAGE 03 / FAILURE ASSESSMENT</span>
   <h1>Review the engineering evidence</h1>
   <p>See which risks have supporting calculations, which geometry flags require investigation, and which print or service failures cannot yet be assessed.</p>
  </div>
  <div className="oaAssessmentMetrics">
   <div><BarChart3 size={19}/><span><strong>{screened}</strong><small>Geometry / process screens</small></span></div>
   <div><CheckCircle2 size={19}/><span><strong>{calculated}</strong><small>Research calculations</small></span></div>
   <div><Info size={19}/><span><strong>{missing}</strong><small>Unassessed mechanisms</small></span></div>
  </div>
  <article className="oaProCard oaAssessmentActions">
   <div><strong>Recommended action</strong>
    <p>{!props.unitsConfirmed?"Confirm source dimensions and units before running geometry screening.":
     !props.hasGeometryRun?"Run geometric LPBF orientation screening. Process-physics failure predictions still require separate validated evidence.":
     props.findings.length?"Review the identified geometry concerns and source assumptions, then confirm assembly context and applicable service inputs.":
     "No additional concerns were flagged by the completed geometry screen. Continue with service requirements, validated material and process evidence."}</p>
   </div>
   {!props.unitsConfirmed?<button type="button" onClick={props.onOpenGeometry}>Review geometry <ArrowRight size={15}/></button>:
    !props.hasGeometryRun?<button type="button" disabled={!props.canRun||props.busy} onClick={props.onRunGeometry}><Play size={15}/>{props.busy?"Screening…":"Run geometry screen"}</button>:
    <button type="button" onClick={props.onOpenContext}>Review engineering context <ArrowRight size={15}/></button>}
  </article>
  {props.selectedOrientation&&<div className="oaAssessmentOrientation">
   <span>Selected orientation <strong>{props.selectedOrientation.id}</strong></span>
   <span>Build height <strong>{props.selectedOrientation.buildHeightMm.toFixed(1)} mm</strong></span>
   <span>Support proxy <strong>{props.selectedOrientation.supportProxyMm3.toFixed(1)} mm³</strong></span>
   <small>Geometry-only orientation estimates, not sliced supports or machine qualification.</small>
  </div>}
  <section className="oaProCard oaActualFindings">
   <div className="oaProCardHeading"><div><ShieldAlert size={19}/><strong>Observed geometric concerns</strong></div><span>{props.findings.length} findings</span></div>
   {props.findings.length?props.findings.map((f,i)=><div className="oaActualFinding" key={f.code+i}><span className={"oaFindingPriority "+(f.level==="blocker"?"is-blocker":"")}>{f.level==="blocker"?"Blocker":"Review"}</span><div><strong>{f.code}</strong><p>{f.message}</p><small>{f.basis}</small></div></div>):
    <p className="oaQuietCopy">{props.hasGeometryRun?"No geometric concerns were raised by the available rules. This does not establish defect-free manufacturing.":"Geometry inspection and orientation screening must finish before these results can be summarized."}</p>}
  </section>
  <div className="oaRiskGrid">
   {group(manufacturing,"Manufacturing screening","Geometric support and mesh screens are distinct from calibrated defect or deposition-process predictions.")}
   {group(service,"In-service behavior","Service stress and heat conduction require approved loads, fixtures, properties and boundary conditions.")}
  </div>
  <div className="oaAssessmentReport oaProCard">
   <div><span className="oaStageEyebrow">ENGINEERING DELIVERABLE</span><h2>Evidence-backed assessment report</h2>
    <p>Includes available results, reference provenance, assumptions, missing analysis and recommended next checks. No flight or manufacturing qualification is asserted.</p>
   </div>
   <Link href="/copilot/advanced?stage=results"><FileDown size={17}/> Review & export PDF <ArrowRight size={15}/></Link>
  </div>
  <p className="oaStageFootnote">Research prototype. An unassessed mechanism is not a low-risk mechanism; a screened geometry condition is not a validated print-failure prediction.</p>
 </section>;
}
