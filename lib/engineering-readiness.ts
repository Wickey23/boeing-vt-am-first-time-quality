/** Explainable engineering workflow assessment, not an engineering pass/fail certificate.
 * A completed numerical worker proves only that a calculation ran. It does not
 * demonstrate allowable stress, material qualification or first-time build quality.
 */
import type {ProcessKind} from "./engineering-journey";
export type GateStatus="ready"|"needs-review"|"not-available";
export type ReadinessGate={
 id:"geometry"|"assembly"|"requirements"|"evidence"|"service"|"manufacturing";
 title:string;status:GateStatus;detail:string;next:"part"|"documents"|"requirements"|"run"|"results";
};
export type ReadinessContext={
 fileName:string|null;unitsConfirmed:boolean;process:ProcessKind;
 componentName:string;assemblyContext:string;attachmentNotes:string;requirements:string;
 documentCount:number;reviewedEvidenceCount:number;
 hasNumericalServiceStudy:boolean;hasSteadyThermalStudy:boolean;
 hasLpbfGeometryCandidates:boolean;
};
export type EngineeringReadiness={
 status:"research-ready"|"needs-inputs";gates:ReadinessGate[];
 nextAction:{step:ReadinessGate["next"];title:string;reason:string};
 counts:{ready:number;review:number;unavailable:number};
 caveats:string[];
};
export function assessEngineeringReadiness(c:ReadinessContext):EngineeringReadiness{
 const gates:ReadinessGate[]=[];
 const add=(gate:ReadinessGate)=>gates.push(gate);
 add({id:"geometry",title:"Part and dimensional identity",
  status:c.fileName&&c.unitsConfirmed?"ready":"needs-review",next:"part",
  detail:!c.fileName?"Upload the actual target STL.":!c.unitsConfirmed?
  "Confirm the STL units and observed dimensions.":"STL is present and its scale has been confirmed by the engineer; mesh quality still requires review."});
 const assembly=Boolean(c.componentName.trim()&&c.assemblyContext.trim());
 add({id:"assembly",title:"Assembly role and interfaces",next:"requirements",
  status:assembly?"ready":"needs-review",detail:assembly?
  "Part identity and surrounding assembly are documented as engineer-provided context.":
  "Identify the component's function and its relationships to the surrounding assembly."});
 const requirements=Boolean(c.attachmentNotes.trim()&&c.requirements.trim());
 add({id:"requirements",title:"Loads, fixtures and engineering requirements",next:"requirements",
  status:requirements?"ready":"needs-review",detail:requirements?
  "Requirements and interface locations are recorded; only separately approved numerical inputs may enter solvers.":
  "Record the actual fixture/load interfaces and design requirements before interpreting service calculations."});
 add({id:"evidence",title:"Document provenance",next:"documents",
  status:c.reviewedEvidenceCount>0?"ready":"needs-review",
  detail:c.reviewedEvidenceCount>0?
   c.reviewedEvidenceCount+" source excerpt(s) reviewed and linked. Review does not establish their numerical validity.":
   c.documentCount>0?"Documents exist, but no source passage has been reviewed for this part.":
   "No supporting assembly documents attached. Engineer-provided context remains uncorroborated."});
 add({id:"service",title:"Service stress, displacement and steady temperature",next:"run",
  status:c.hasNumericalServiceStudy&&c.hasSteadyThermalStudy?"ready":"needs-review",
  detail:c.hasNumericalServiceStudy&&c.hasSteadyThermalStudy?
   "Numerical workers returned service stress, displacement and steady temperature fields. These are research approximations, not verification against allowables.":
   "At least one of the supported numerical service studies has not completed for the current STL/settings."});
 add({id:"manufacturing",title:"Process-specific manufacturing evidence",
  status:c.process==="PBF_LB_METAL"&&c.hasLpbfGeometryCandidates?"needs-review":"not-available",
  next:c.process==="PBF_LB_METAL"?"run":"results",
  detail:c.process==="PBF_LB_METAL"?
   c.hasLpbfGeometryCandidates?
    "LPBF geometric orientation candidates exist. Support, thermal distortion, print failure and qualification are not validated.":
    "Run LPBF orientation screening for geometric comparisons. A manufacturing-quality prediction remains unavailable.":
   "DED arbitrary-STL deposition pathing, deposition thermal history and distortion prediction are not available. Service-load calculations do not establish DED printability."});
 const counts={ready:gates.filter(g=>g.status==="ready").length,
  review:gates.filter(g=>g.status==="needs-review").length,
  unavailable:gates.filter(g=>g.status==="not-available").length};
 const priority=gates.find(g=>g.id==="geometry"&&g.status!=="ready")||
  gates.find(g=>g.id==="assembly"&&g.status!=="ready")||
  gates.find(g=>g.id==="requirements"&&g.status!=="ready")||
  gates.find(g=>g.id==="evidence"&&g.status!=="ready")||
  gates.find(g=>g.id==="service"&&g.status!=="ready")||
  gates.find(g=>g.id==="manufacturing"&&g.status!=="ready")!;
 return {status:counts.ready>=5?"research-ready":"needs-inputs",gates,counts,
  nextAction:{step:priority.next,title:priority.title,reason:priority.detail},
  caveats:["No engineering or manufacturing acceptance is asserted by this summary.",
   "Isotropic service-load response cannot identify the strongest build orientation without validated orientation-dependent properties.",
   "Thermal conduction is not metal-AM thermal-history or distortion modeling.",
   "Unknown critical constraints remain unknown; do not substitute a weighted score for hard-limit verification."]};
}
