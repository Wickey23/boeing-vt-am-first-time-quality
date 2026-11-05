"use client";
import {ArrowRight,Check,Box as BoxIcon,FileText,ClipboardCheck} from "lucide-react";
export type AssessmentStage="part"|"context"|"assessment";
type Props={
 fileName:string;unitsConfirmed:boolean;hasGeometryRun:boolean;sourceCount:number;reviewedCount:number;
 activeStage:AssessmentStage;onStageChange:(stage:AssessmentStage)=>void;onReviewPart:()=>void;
};
/** One clear study stepper; no side-by-side header widgets that can crush the labels. */
export default function EngineeringAssessmentJourney({fileName,unitsConfirmed,hasGeometryRun,sourceCount,reviewedCount,activeStage,onStageChange,onReviewPart}:Props){
 const stages=[
  {id:"part" as const,name:"Part Geometry",hint:unitsConfirmed?"Units confirmed":"Inspect and confirm",complete:unitsConfirmed,Icon:BoxIcon},
  {id:"context" as const,name:"Engineering Context",hint:sourceCount?sourceCount+" source"+(sourceCount===1?"":"s"):"Assembly and requirements",complete:reviewedCount>0,Icon:FileText},
  {id:"assessment" as const,name:"Failure Assessment",hint:hasGeometryRun?"Geometry screened":"Evidence and report",complete:false,Icon:ClipboardCheck}
 ];
 const next=!unitsConfirmed?{text:"Confirm the STL units and measured dimensions.",label:"Review geometry",action:onReviewPart}:
  sourceCount===0?{text:"Describe the part's function or add an assembly document.",label:"Add context",action:()=>onStageChange("context")}:
  reviewedCount===0?{text:"Review the document excerpts and identify applicable requirements.",label:"Review sources",action:()=>onStageChange("context")}:
  !hasGeometryRun?{text:"Run the supported geometric screening before drawing conclusions.",label:"Run screening",action:()=>onStageChange("part")}:
  {text:"Review actual findings, limitations and evidence-based next actions.",label:"Review findings",action:()=>onStageChange("assessment")};
 return <section className="oaAssessmentJourney" aria-label="Three-stage engineering assessment" data-testid="assessment-journey">
  <div className="oaAssessmentHeading">
   <div className="oaAssessmentTitle"><small>CURRENT STUDY</small><strong>Pre-build engineering assessment</strong></div>
   <span title={fileName}>{fileName} <em>Research prototype</em></span>
  </div>
  <nav className="oaAssessmentStages" aria-label="Assessment stages">
   {stages.map(({id,name,hint,complete,Icon},i)=><button key={id} type="button"
    aria-current={activeStage===id?"step":undefined}
    aria-label={id==="part"?"Open part geometry view":id==="context"?"Open engineering context stage":"Open failure assessment and export stage"}
    className={"oaAssessmentStep"+(activeStage===id?" is-active":"")+(complete?" is-complete":"")} onClick={()=>onStageChange(id)}>
    <span className="oaAssessmentStepNumber" aria-hidden="true">{complete?<Check size={16}/>:i+1}</span>
    <span className="oaAssessmentStepText"><strong>{name}</strong><small>{hint}</small></span>
    <Icon size={16} className="oaAssessmentStepIcon" aria-hidden="true"/>
   </button>)}
  </nav>
  <div className="oaAssessmentNext"><div><strong>Next step</strong><span>{next.text}</span></div>
   <button type="button" onClick={next.action}>{next.label}<ArrowRight size={15}/></button>
  </div>
 </section>;
}
