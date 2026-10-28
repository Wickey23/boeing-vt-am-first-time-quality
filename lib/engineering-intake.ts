/** Deterministic engineering intake. It records the engineer's words as unverified
 * context; it never fabricates forces, boundary conditions, material data or FEA.
 * The local guide is not a language model.
 */
import type {ProjectKnowledge} from "./copilot-context";
export type IntakeField="componentName"|"assemblyContext"|"attachmentNotes"|"reviewedRequirements";
export type IntakeStage="part"|"units"|"component"|"assembly"|"interfaces"|"requirements"|"review"|"unsupported"|"ready";
export type IntakeStep={stage:IntakeStage;title:string;question:string;field?:IntakeField;hint:string};
export function getIntakeStep(state:ProjectKnowledge,opts:{
 partName:string|null;confirmed:boolean;loadsReviewed:boolean;process:string;
}):IntakeStep{
 if(!opts.partName)return {stage:"part",title:"Start with the actual part",question:"Which component are we analyzing?",hint:"Upload the STL using the part panel. The filename does not establish the part's function."};
 if(!opts.confirmed)return {stage:"units",title:"Confirm geometry",question:"Are the units and displayed dimensions correct?",hint:"Choose millimeters, inches or meters and confirm against the source CAD design."};
 if(!state.componentName.trim())return {stage:"component",title:"Identify the component",question:"What is this part, and what is its purpose?",field:"componentName",hint:"Use the part's known role or drawing identifier. Don't infer it from appearance."};
 if(!state.assemblyContext.trim())return {stage:"assembly",title:"Understand the surrounding assembly",question:"Which assembly does it belong to, and what connects to it?",field:"assemblyContext",hint:"Identify adjacent parts or documents, including source IDs where available."};
 if(!state.attachmentNotes.trim())return {stage:"interfaces",title:"Locate the interfaces",question:"Where is it fixed, joined or loaded in service?",field:"attachmentNotes",hint:"Describe documented fixture and force locations. Exact mesh-face selection is not yet supported."};
 if(!state.reviewedRequirements.trim())return {stage:"requirements",title:"Document requirements",question:"Which loads, tolerances and material requirements apply?",field:"reviewedRequirements",hint:"Provide only documented or explicitly assumed inputs; engineering review is required before FEA."};
 if(!opts.loadsReviewed)return {stage:"review",title:"Approve numerical assumptions",question:"Have you reviewed the numerical force, fixture and material inputs?",hint:"Open the load editor under Engineering facts, check the values, then explicitly confirm the review. No automatic approval."};
 if(opts.process!=="PBF_LB_METAL")return {stage:"ready",title:"Service analysis is available",question:"Ready to compute service stress, displacement and steady temperature on this STL.",hint:"Generic service and conduction solvers work with DED-selected parts too. DED deposition, residual stress and printing distortion are not simulated."};
 return {stage:"ready",title:"Run a coordinated service study",question:"Ready to compute service stress, displacement and steady temperature on this STL.",hint:"Confirm the numerical boundary conditions and run both supported solvers together. LPBF orientation screening is an optional separate study."};
}
export function applyIntakeAnswer(state:ProjectKnowledge,step:IntakeStep,answer:string):ProjectKnowledge{
 if(!step.field)throw Error("This action needs an explicit workflow control, not a free-text answer.");
 const text=answer.trim();
 if(!text)throw Error("Enter a description before saving.");
 return {...state,[step.field]:text.slice(0,step.field==="componentName"?160:4000)};
}
export function intakeProgress(state:ProjectKnowledge,opts:{
 partName:string|null;confirmed:boolean;loadsReviewed:boolean;process:string;hasOrientation?:boolean;
}){
 const labels=[
  {key:"geometry",label:"Part",done:!!opts.partName&&opts.confirmed},
  {key:"identity",label:"Assembly",done:!!state.componentName.trim()&&!!state.assemblyContext.trim()},
  {key:"requirements",label:"Requirements",done:!!state.attachmentNotes.trim()&&!!state.reviewedRequirements.trim()&&opts.loadsReviewed},
  {key:"analysis",label:"Analysis",done:opts.hasOrientation===true}
 ];
 return labels;
}
