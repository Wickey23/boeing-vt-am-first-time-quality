"use client";
import {ArrowRight,Check,ChevronRight,FileText,Box as BoxIcon,ClipboardCheck} from "lucide-react";
export type AssessmentStage="part"|"context"|"assessment";
type Props={
 fileName:string;unitsConfirmed:boolean;hasGeometryRun:boolean;sourceCount:number;reviewedCount:number;
 activeStage:AssessmentStage;onStageChange:(stage:AssessmentStage)=>void;onReviewPart:()=>void;
};
/** The guided workflow is a single workspace; advanced tools are optional, not a separate navigation requirement. */
export default function EngineeringAssessmentJourney({
 fileName,unitsConfirmed,hasGeometryRun,sourceCount,reviewedCount,activeStage,onStageChange,onReviewPart
}:Props){
 const stages=[
  {id:"part" as const,name:"Part geometry",hint:unitsConfirmed?"Units confirmed":"Dimensions and mesh",complete:unitsConfirmed,icon:BoxIcon},
  {id:"context" as const,name:"Engineering context",hint:sourceCount?sourceCount+" reference"+(sourceCount===1?"":"s"):"Assembly and requirements",complete:reviewedCount>0,icon:FileText},
  {id:"assessment" as const,name:"Failure assessment",hint:hasGeometryRun?"Geometry screening available":"Risks, evidence and report",complete:false,icon:ClipboardCheck}
 ];
 const next=!unitsConfirmed?{text:"Confirm dimensions and STL units before engineering analysis.",label:"Review geometry",action:onReviewPart}:
  sourceCount===0?{text:"Add assembly documents or describe what the part must do.",label:"Add context",action:()=>onStageChange("context")}:
  reviewedCount===0?{text:"Review document passages before assigning engineering requirements.",label:"Review context",action:()=>onStageChange("context")}:
  !hasGeometryRun?{text:"Run the supported geometric screening for this part.",label:"Analyze geometry",action:()=>onStageChange("part")}:
  {text:"Review available findings, unassessed risks and next actions.",label:"Review assessment",action:()=>onStageChange("assessment")};
 return <header role="region" className="oaAssessmentJourney" aria-label="Three-stage engineering assessment" data-testid="assessment-journey">
  <div className="oaAssessmentHeading">
   <div><small>ENGINEERING WORKSPACE</small><strong>Pre-build assessment</strong></div>
   <span title={fileName}>{fileName} · Research only</span>
  </div>
  <nav className="oaAssessmentStages" aria-label="Assessment stages">{stages.map((step,i)=>
   <button key={step.id} type="button" className={"oaAssessmentStep"+(activeStage===step.id?" is-active":"")+(step.complete?" is-complete":"")} aria-current={activeStage===step.id?"step":undefined}
    aria-label={step.id==="part"?"Open part geometry view":step.id==="context"?"Open engineering context stage":"Open failure assessment and export stage"}
    onClick={()=>onStageChange(step.id)}>
    <span className="oaAssessmentStepNumber" aria-hidden="true">{step.complete?<Check size={16}/>:i+1}</span>
    <span className="oaAssessmentStepText"><strong>{step.name}</strong><small>{step.hint}</small></span>
    {activeStage===step.id&&<ChevronRight className="oaAssessmentStepArrow" size={15} aria-hidden="true"/>}
   </button>
  )}</nav>
  <div className="oaAssessmentNext">
   <span><strong>Recommended next step</strong>{next.text}</span>
   <button type="button" onClick={next.action}>{next.label}<ArrowRight size={14}/></button>
  </div>
 </header>;
}
