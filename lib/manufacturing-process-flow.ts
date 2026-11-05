/** End-to-end manufacturing lifecycle showing the research tool's real role.
 * ORIENTAI does not pretend to run external printing/inspection equipment.
 */
export const MANUFACTURING_FLOW_VERSION="orientai.manufacturing.flow.v1";
export type ManufacturingPhase="design"|"geometry"|"context"|"assessment"|"review"|"manufacture"|"inspect"|"feedback";
export type FlowStatus="completed"|"in-progress"|"needs-input"|"external";
export type ManufacturingFlowStep={
 id:ManufacturingPhase;name:string;status:FlowStatus;
 owner:"design engineer"|"ORIENTAI"|"engineering reviewer"|"manufacturing"|"quality/test";
 purpose:string;input:string;output:string;action:string;
};
export type ManufacturingFlowInputs={
 hasPart:boolean;unitsConfirmed:boolean;hasGeometryRun:boolean;
 hasAssemblyContext:boolean;hasReviewedEvidence:boolean;
 hasRiskAssessment:boolean;hasBlockers:boolean;
 hasExternalTestResults?:boolean;
};
export function manufacturingProcessFlow(s:ManufacturingFlowInputs):ManufacturingFlowStep[]{
 const step=(item:ManufacturingFlowStep)=>item;
 return [
  step({id:"design",name:"Part design and specification",
   status:s.hasPart?"completed":"needs-input",owner:"design engineer",
   purpose:"Define geometry, design intent, critical features and source revisions.",
   input:"CAD model, drawings and application",output:"Reviewed design/STL package",
   action:s.hasPart?"Verify model revision and source drawing.":"Upload the intended STL and identify its source."}),
  step({id:"geometry",name:"Geometry and build-orientation screening",
   status:s.hasGeometryRun?"completed":s.hasPart?"in-progress":"needs-input",owner:"ORIENTAI",
   purpose:"Audit mesh, confirm scale, compare LPBF geometric orientation candidates.",
   input:"STL, units and machine envelope",output:"Topology flags and geometric build metrics",
   action:s.hasGeometryRun?"Review support and interface concerns.":s.unitsConfirmed?"Run LPBF geometry screening.":"Confirm the part units and dimensions."}),
  step({id:"context",name:"Engineering application and process context",
   status:s.hasAssemblyContext&&s.hasReviewedEvidence?"completed":
    s.hasPart?"in-progress":"needs-input",owner:"design engineer",
   purpose:"Establish function, fixtures, service loads, material/process limits and evidence.",
   input:"Assembly drawings, process sheet, acceptance requirements",output:"Traceable engineer-reviewed inputs and gaps",
   action:"Attach application documents, review source excerpts and verify numerical assumptions."}),
  step({id:"assessment",name:"Pre-build risk and trade-off assessment",
   status:s.hasRiskAssessment?"completed":s.hasPart?"in-progress":"needs-input",owner:"ORIENTAI",
   purpose:"Apply auditable rule checks and current supported research studies.",
   input:"Geometry, process ranges and approved application context",
   output:"Manufacturing/service scenarios, uncertainty labels and corrective actions",
   action:"Evaluate findings and export the evidence-based pre-build dossier."}),
  step({id:"review",name:"Authorized engineering decision",
   status:s.hasRiskAssessment?"in-progress":"needs-input",owner:"engineering reviewer",
   purpose:"Resolve geometry blockers and review unassessed mechanisms against qualification requirements.",
   input:"ORIENTAI report plus qualified external analyses and tests",
   output:"Documented engineering disposition, not automatically granted by the app",
   action:s.hasBlockers?"Resolve critical screens before proceeding.":"Confirm all requirements, sources and residual risks externally."}),
  step({id:"manufacture",name:"Build preparation and metal printing",
   status:"external",owner:"manufacturing",
   purpose:"Execute independently approved build preparation, printer setup and qualified process.",
   input:"Approved build file, manufacturing traveler and machine parameter set",
   output:"Manufactured component and machine/build records",
   action:"External manufacturer verifies setup and performs printing."}),
  step({id:"inspect",name:"Inspection and qualification testing",
   status:"external",owner:"quality/test",
   purpose:"Measure actual dimensions, defects and function under approved test conditions.",
   input:"Part, inspection plan, acceptance criteria and test loads",
   output:"Measured test/inspection evidence",
   action:"Record measured acceptance results with traceable part and build identity."}),
  step({id:"feedback",name:"Evidence feedback for future builds",
   status:s.hasExternalTestResults?"in-progress":"external",owner:"quality/test",
   purpose:"Compare risk flags with measured outcomes to validate or refine future rule/model development.",
   input:"Traceable build and inspection results",output:"Verification case and model-validation backlog",
   action:"Review predictive accuracy with real measurements before proposing model qualification."})
 ];
}
