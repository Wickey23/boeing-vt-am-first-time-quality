/** Deterministic, explicitly non-qualified failure-mode explanation for the study chat.
 * This is not an LLM, not a trained defect predictor, and does not assign probabilities.
 */
import type {FailureCoverage} from "./failure-coverage";
import type {PrebuildAssessment} from "./prebuild-assessment";
export type PartScreenFinding={code:string;message:string;basis?:string};
export function explainPartFailureModes(input:{
 partName:string;unitsConfirmed:boolean;hasOrientation:boolean;
 meshFindings:PartScreenFinding[];orientationFindings:PartScreenFinding[];
 coverage:FailureCoverage[];assemblyKnown:boolean;requirementsKnown:boolean;
 documentCount:number;reviewedCount:number;prebuild?:PrebuildAssessment;
}):string{
 const out:string[]=[
  "PART-SPECIFIC PRE-BUILD RISK REVIEW - geometry and evidence rules only.",
  "This is a deterministic interpretation of measured STL geometry and available engineering context, NOT a trained model's defect prediction."
 ];
 if(!input.unitsConfirmed)out.push("Geometry scale is unconfirmed; verify units before interpreting dimensional limits.");
 const findings=[
  ...input.meshFindings.map(f=>({...f,source:"STL mesh-topology audit"})),
  ...(input.hasOrientation?input.orientationFindings.map(f=>({...f,source:f.basis||"LPBF geometric orientation screen"})):[])
 ];
 if(findings.length){
  out.push("IDENTIFIED SCREENING FLAGS:");
  for(const f of findings.slice(0,7))
   out.push("- "+f.code+": "+f.message+" [Basis: "+f.source+"]");
 }else out.push("No current part-specific flags are available from the completed screens. This does not mean the part is safe to print.");
 if(input.prebuild){
  out.push("INTEGRATED RULE ASSESSMENT: "+input.prebuild.disposition.replace(/-/g," ")+" - "+input.prebuild.dispositionReason);
  const candidateActions=input.prebuild.actions.filter(x=>x.priority!=="information").slice(0,5);
  if(candidateActions.length){
   out.push("CORRECTIVE ACTIONS:");
   for(const action of candidateActions)out.push("- ["+action.priority+"] "+action.title+" (Evidence: "+action.why+")");
  }
  out.push("OPEN INFORMATION ITEMS: "+input.prebuild.counts.unassessed+
   " missing or unassessed checks, including service and print-process mechanisms.");
 }
 if(!input.hasOrientation)out.push("Run the geometric orientation screen to assess down-facing area, build height, support proxy and plate contact.");
 const unassessed=input.coverage.filter(c=>c.state==="not-assessed"&&c.category==="print-process");
 if(unassessed.length)out.push("NOT PREDICTED: "+unassessed.map(c=>c.name).join("; ")+". These mechanisms remain unknown, not low risk.");
 const missing:string[]=[];
 if(!input.assemblyKnown)missing.push("the part's role in the assembly and which interfaces transfer forces");
 if(!input.requirementsKnown)missing.push("loads, fixtures, material allowables, process setup and acceptance criteria");
 if(input.documentCount===0)missing.push("assembly or manufacturing references");
 else if(input.reviewedCount===0)missing.push("engineer-confirmed relevant passages in the attached references");
 if(missing.length)out.push("NEXT EVIDENCE NEEDED: "+missing.join("; ")+".");
 out.push("For quantitative defect likelihood or manufacturing approval, a qualified material/process model plus measurement and inspection evidence is still required.");
 return out.join("\n\n");
}
