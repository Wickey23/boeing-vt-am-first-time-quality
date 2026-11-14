"use client";
import {CheckCircle2,ArrowRight,Info} from "lucide-react";
import "./guided-study-help.css";

type Stage="geometry"|"context"|"assessment";
type Props={
 stage:Stage;hasPart:boolean;unitsConfirmed:boolean;geometryScreened:boolean;
 hasContext:boolean;hasReferences:boolean;hasReviewedSources:boolean;
 onUpload:()=>void;onConfirmUnits:()=>void;onRunGeometry:()=>void;
 onStage:(stage:Stage)=>void;busy:boolean;
};
const copy={
 geometry:{heading:"Start with your part",why:"We need its actual shape and correct dimensions before checking whether it may be difficult to print."},
 context:{heading:"Explain how the part will be used",why:"An STL contains shape, not purpose, forces, requirements or qualified printing parameters. Add what you know; leave unknown values blank."},
 assessment:{heading:"Understand the findings",why:"These are engineering screening observations, not predictions of exact defect probabilities or proof that a build is safe."}
};
export default function GuidedStudyHelp(p:Props){
 const steps=[
  {label:"Upload STL",done:p.hasPart},
  {label:"Confirm size",done:p.unitsConfirmed},
  {label:"Screen geometry",done:p.geometryScreened},
  {label:"Add part context",done:p.hasContext},
  {label:"Review findings",done:false}
 ];
 const action=!p.hasPart?
  {label:"Choose an STL file",explanation:"Select a 3D part model (.stl, up to 20 MB).",run:p.onUpload}:
  !p.unitsConfirmed?
  {label:"Find units confirmation",explanation:"Check the shown width, height and depth against your drawing. STL has no built-in units.",run:p.onConfirmUnits}:
  !p.geometryScreened?
  {label:"Run geometry screening",explanation:"Check orientation, envelope and potential support-related geometry.",run:p.onRunGeometry}:
  p.stage==="geometry"?
  {label:"Continue to part context",explanation:"Tell ORIENTAI what this component does.",run:()=>p.onStage("context")}:
  p.stage==="context"?
  {label:"Review findings",explanation:"You can return and update your part information at any time.",run:()=>p.onStage("assessment")}:
  {label:"Review engineering actions",explanation:"Use the failure scenarios and action plan below; inspect unknown mechanisms separately.",run:()=>p.onStage("assessment")};
 const details=p.stage==="geometry"?
  ["Upload an STL. You do not need to write a prompt.","Confirm model size and original units.","Run geometry screening, then continue."]:
  p.stage==="context"?
  ["Describe the component's purpose and where it attaches.","Enter known loads, material and requirements. Do not guess.","Documents and detailed LPBF settings are optional; review their source before relying on them."]:
  ["Read the screened concerns and distinguish them from unassessed defects.","Open Action plan to see what needs correction or evidence.","Export a report when sufficient inputs exist; it does not authorize printing."];
 return <section className="psGuidedHelp" aria-label="Guided study instructions">
  <div className="psGuidedHelpTop"><span className="psGuidedEyebrow">GUIDED PART REVIEW</span>
   <span className="psGuidedCount">{steps.filter(s=>s.done).length} of 4 setup tasks complete</span></div>
  <div className="psGuidedProgress" aria-label="Study progress">
   {steps.slice(0,4).map((s,i)=><span key={s.label} className={s.done?"done":""} title={s.label} aria-label={s.label+": "+(s.done?"complete":"not yet complete")}/>)}
  </div>
  <h2>{copy[p.stage].heading}</h2><p>{copy[p.stage].why}</p>
  <div className="psGuidedInstructionList">
   {details.map((text,i)=><div key={i}><span aria-hidden="true">{i+1}</span><p>{text}</p></div>)}
  </div>
  <div className="psGuidedNext"><div><strong>Do this next: {action.label}</strong><small>{action.explanation}</small></div>
   <button type="button" disabled={p.busy} onClick={action.run}>{p.busy?"Running…":action.label}<ArrowRight size={15}/></button></div>
  <details className="psGuidedHelpDetails"><summary><Info size={14}/> What can ORIENTAI actually assess?</summary>
   <p>It can screen geometry, orientations and engineer-entered process limits. Lack of fusion, porosity, cracking and distortion probabilities require independently validated models and test data. A green geometric check does not imply a successful print.</p>
  </details>
 </section>;
}
