"use client";
import {useState} from "react";
import Link from "next/link";
import {AlertTriangle,ArrowRight,CheckCircle2,ChevronDown,ClipboardList,FileText,GitBranch,Info,ShieldAlert,Table2} from "lucide-react";
import type {PrebuildAssessment,PrebuildFinding,PrebuildAction} from "@/lib/prebuild-assessment";
import type {ManufacturingFlowStep} from "@/lib/manufacturing-process-flow";
import type {FailureCoverage} from "@/lib/failure-coverage";
import type {FeedbackDraft,InspectionFeedback} from "@/lib/part-inspection-feedback";
import ProfessionalFeedbackPanel from "./ProfessionalFeedbackPanel";
type Tab="findings"|"actions"|"workflow"|"coverage";
const rank:Record<string,number>={critical:0,high:1,medium:2,information:3};
export default function ProfessionalAssessmentPanel({assessment,flow,coverage,hasPart,canExport,hasGeometry,exportBusy,feedback,feedbackError,onAddFeedback,onRemoveFeedback,onExport,onGeometryExport,onJsonExport,onNavigate,onInspectOverhangs}:{
 assessment:PrebuildAssessment;flow:ManufacturingFlowStep[];coverage:FailureCoverage[];
 hasPart:boolean;canExport:boolean;hasGeometry:boolean;exportBusy:boolean;
 feedback:InspectionFeedback[];feedbackError:string;
 onAddFeedback:(draft:FeedbackDraft)=>void;onRemoveFeedback:(id:string)=>void;
 onExport:()=>void;onGeometryExport:()=>void;onJsonExport:()=>void;
 onNavigate:(stage:"geometry"|"context"|"assessment")=>void;
 onInspectOverhangs:()=>void;
}){
 const [tab,setTab]=useState<Tab>("findings");
 const [domain,setDomain]=useState<"all"|"manufacturing"|"service">("all");
 const [showAll,setShowAll]=useState(false);
 const current=assessment.findings.filter(f=>domain==="all"||f.domain===domain||
  domain==="manufacturing"&&f.domain==="geometry");
 const filtered=showAll?current:current.slice(0,8);
 const keyUnknown=coverage.filter(f=>f.state==="not-assessed"&&
  ["lack-of-fusion","keyhole-porosity","hot-cracking","distortion-residual-stress"].includes(f.id));
 const stageActions=assessment.actions.filter(x=>x.stage!=="external");
 return <section className="psStage psDecisionStage" aria-label="Failure assessment stage">
  <div className="psSectionHead">
   <span>STAGE 03 / PRE-BUILD ENGINEERING DECISION</span>
   <h2>Engineering evidence and risks</h2>
   <p>Manufacturing concerns and in-service requirements are evaluated separately. Rules identify credible issues; none establishes defect likelihood or approves printing.</p>
  </div>
  <div className="psDecisionStatus" role="status">
   <div>
    <strong><ShieldAlert size={16}/> Research assessment · {assessment.disposition==="geometry-blocked"?"Resolve blocking findings":
     assessment.disposition==="review-required"?"Engineering review required":"Further engineering information required"}</strong>
    <p>{assessment.dispositionReason}</p>
   </div>
   <div className="psDecisionCounts">
    <span><b>{assessment.counts.screened}</b> screened flags</span>
    <span><b>{assessment.counts.unassessed}</b> unknown items</span>
   </div>
  </div>
  <div className="psDecisionQuickStart" aria-label="How to use the assessment" style={{display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:12,padding:"14px 18px",margin:"12px 0 18px",border:"1px solid #557183",borderRadius:10}}>
   <div style={{maxWidth:680}}>
    <strong style={{display:"block",marginBottom:6}}>What should I do with these results?</strong>
    <p style={{margin:0,fontSize:13,lineHeight:1.5}}>Start with the highest-priority findings, check the suggested corrections, then export the engineering evidence. Anything marked “not assessed” remains unknown.</p>
   </div>
   <button type="button" className="psPrimary" onClick={()=>setTab("actions")}><ClipboardList size={15}/> Show next actions <ArrowRight size={14}/></button>
  </div>
  <details className="psPanel psReportCard psDecisionExport" style={{padding:"14px 18px",marginBottom:14}}>
   <summary style={{cursor:"pointer",fontWeight:700}}>Download engineering report and evidence <ChevronDown size={14} style={{verticalAlign:"middle"}}/></summary>
   <p style={{fontSize:13}}>Export the current screening findings, inputs, and explicit limitations. This report does not approve a build.</p>
   <div className="psReportButtons">
    <button type="button" className="psPrimary" onClick={onExport} disabled={!canExport||exportBusy}>
     <FileText size={14}/> Export assessment PDF</button>
    <div className="psSecondaryExports">
     <button type="button" className="psSecondary" onClick={onGeometryExport} disabled={!hasGeometry||exportBusy}>Geometry analysis PDF</button>
     <button type="button" className="psSecondary" onClick={onJsonExport} disabled={!hasGeometry}>Analysis JSON</button>
    </div>
   </div>
  </details>
  <nav className="psDecisionTabs" aria-label="Assessment views">
   {([
    ["findings","Failure scenarios",ShieldAlert],
    ["actions","Action plan",ClipboardList],
    ["workflow","Process flow",GitBranch],
    ["coverage","Assessment coverage",Table2]
   ] as const).map(([name,label,Icon])=><button key={name} type="button"
    aria-current={tab===name?"page":undefined} aria-pressed={tab===name} className={tab===name?"psSelected":""}
    onClick={()=>setTab(name)}><Icon size={15}/>{label}</button>)}
  </nav>
  {tab==="findings"&&<div className="psDecisionView">
   <div className="psDecisionSectionBar">
    <div><strong>Potential failure scenarios</strong><small>Rules + available geometry evidence, not trained predictions</small></div>
    <div className="psDecisionFilters" role="group" aria-label="Failure domain filter">
     {(["all","manufacturing","service"] as const).map(d=><button key={d}
      type="button" aria-pressed={domain===d} onClick={()=>{setDomain(d);setShowAll(false);}}>
      {d==="all"?"All":d==="manufacturing"?"Printing":"Service"}</button>)}
    </div>
   </div>
   {!hasPart&&<p className="psNotice">Upload an STL to start a part-specific assessment.</p>}
   <div className="psDecisionFindings">{filtered.map(f=><FindingRow key={f.id} finding={f} onInspectOverhangs={onInspectOverhangs}/>)}</div>
   {current.length===0&&<p className="psCaveat">No screening rows in this view. This does not establish low risk.</p>}
   {current.length>8&&<button type="button" className="psTextButton" onClick={()=>setShowAll(v=>!v)}>
    {showAll?"Show fewer":"Show all "+current.length+" failure scenarios"}<ChevronDown size={14}/></button>}
   <div className="psUnassessedStrip"><Info size={15}/><div>
    <strong>Physical defect prediction remains unvalidated</strong>
    <p>{keyUnknown.map(f=>f.name).join(" · ")} — not assessed. Successful geometry screening cannot imply these defects are absent.</p>
   </div></div>
  </div>}
  {tab==="actions"&&<div className="psDecisionView">
   <div className="psDecisionSectionBar"><div><strong>Prioritized engineering actions</strong>
    <small>Triggered by the current source data; not automatic authorization</small></div></div>
   {stageActions.length===0?<p className="psCaveat">Add the geometry and context needed to generate actions.</p>:
    <ol className="psDecisionActions">{stageActions.map(a=><li key={a.id}>
     <span className={"psPriority psPriority-"+a.priority}>{a.priority}</span>
     <div><strong>{a.title}</strong><p>{a.why}</p></div>
     <button type="button" onClick={()=>onNavigate(a.stage==="geometry"?"geometry":a.stage==="context"?"context":"assessment")}>
      Open step <ArrowRight size={13}/></button>
    </li>)}</ol>}
   <Link className="psSecondary psAdvancedStudyLink" href="/copilot/advanced">
    Open reviewed structural / thermal research tools <ArrowRight size={14}/>
   </Link>
   <p className="psCaveat">Numerical studies require verified loads, fixtures and material properties; service response does not predict LPBF residual stress or fatigue.</p>
  </div>}
  {tab==="workflow"&&<div className="psDecisionView">
   <div className="psDecisionSectionBar"><div><strong>Manufacturing process flow</strong>
    <small>ORIENTAI participates in pre-build review, not printer operation or qualification</small></div></div>
   <ol className="psManufacturingFlow">{flow.map((s,i)=><li key={s.id}>
    <span className="psFlowNumber">{i+1}</span>
    <div><div className="psFlowTitle"><strong>{s.name}</strong>
     <small>{s.status==="completed"?<CheckCircle2 size={13}/>:s.status==="external"?<Info size={13}/>:<AlertTriangle size={13}/>}
      {s.status.replace("-"," ")} · {s.owner}</small></div>
     <p>{s.purpose}</p>
     <details><summary>Inputs, outputs and next action <ChevronDown size={12}/></summary>
      <p><b>Input:</b> {s.input}</p><p><b>Output:</b> {s.output}</p><p><b>Next:</b> {s.action}</p>
     </details>
    </div>
   </li>)}</ol>
   <ProfessionalFeedbackPanel findings={assessment.findings.map(f=>({id:f.id,title:f.title}))}
    records={feedback} error={feedbackError} onAdd={onAddFeedback} onRemove={onRemoveFeedback}/>
  </div>}
  {tab==="coverage"&&<div className="psDecisionView">
   <div className="psDecisionSectionBar"><div><strong>Supported vs unassessed methods</strong>
    <small>Method coverage is not part qualification or a failure-probability score</small></div></div>
   <div className="psRiskColumns">
    {(["Manufacturing risks","In-service behavior"] as const).map(group=><article className="psPanel" key={group}>
     <div className="psPanelHeading"><strong>{group}</strong></div>
     {coverage.filter(f=>group==="Manufacturing risks"?f.category!=="service":f.category==="service").map(f=><details key={f.id} className="psRiskItem">
      <summary><span>{f.name}</span><small className={f.state!=="not-assessed"?"psCalculated":""}>{f.state==="not-assessed"?"Not assessed":f.state==="screened"?"Screened":"Calculated"}</small></summary>
      <p><b>Method:</b> {f.method}</p><p><b>Limit:</b> {f.limitations}</p><p><b>Required:</b> {f.nextInput}</p>
     </details>)}
    </article>)}
   </div>
  </div>}
  <p className="psCaveat">Research prototype. An unassessed mechanism is unknown, not low risk. A reviewer must independently approve any manufacturing or service design decision.</p>
 </section>;
}
function FindingRow({finding:f,onInspectOverhangs}:{finding:PrebuildFinding;onInspectOverhangs:()=>void}){
 return <details className="psDecisionFinding">
  <summary><span className={"psPriority psPriority-"+f.priority}>{f.priority}</span>
   <span className="psDecisionFindingTitle"><strong>{f.title}</strong><small>{f.observation}</small></span>
   <small className="psFindingState">{f.status==="unassessed"?"Not assessed":f.status==="observed"?"Mesh observed":"Rule screened"}</small>
   <ChevronDown size={14}/>
  </summary>
  <div className="psFindingDetails">
   <p><b>Possible consequence:</b> {f.potentialFailure}</p>
   <p><b>Evidence:</b> {f.basis}</p>
   {f.evidence.map((v,i)=><p key={i} className="psCaveat">{v.kind}: {v.detail}</p>)}
   <p><b>Recommended action:</b> {f.recommendedAction}</p>
   <p><b>Needed to verify:</b> {f.requiredEvidence}</p>
   {f.location!=="unknown"&&<small>Region of interest: {f.location.replace(/-/g," ")}. No localized physical defect predicted.</small>}
   {f.location==="down-facing-surfaces"&&f.status==="screened"&&
    <button type="button" className="psTextButton" onClick={onInspectOverhangs}>
     Show down-facing surfaces on actual STL <ArrowRight size={13}/>
    </button>}
  </div>
 </details>;
}
