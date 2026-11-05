/**
 * ORIENTAI pre-build engineering assessment — deterministic, auditable rule engine.
 *
 * A flag is NOT a failure probability or an observation of a manufactured defect.
 * Rules use only measured geometry, explicit process limits and engineer-supplied context.
 * Unknowns remain unknown. Nothing here approves a build or replaces a qualified model.
 */
import type {MeshAudit} from "./stl-mesh-audit";
import type {ScreenCandidate} from "./part-screening";
import type {ProcessWindowAssessment} from "./lpbf-process-quality";
import type {ProcessKind} from "./engineering-journey";
import type {FailureCoverage} from "./failure-coverage";

export const PREBUILD_ENGINE_VERSION="orientai.prebuild.rules.v1" as const;
export type RiskDomain="manufacturing"|"service"|"geometry"|"verification";
export type RiskStatus="observed"|"screened"|"unassessed";
export type RiskPriority="critical"|"high"|"medium"|"information";
export type AssessmentDisposition="geometry-blocked"|"review-required"|"information-incomplete";
export type PrebuildEvidence={kind:"mesh"|"orientation"|"process-window"|"document"|"engineering-entry"|"model-coverage";
 detail:string;sourceId?:string};
export type PrebuildFinding={
 id:string;domain:RiskDomain;status:RiskStatus;priority:RiskPriority;
 title:string;observation:string;potentialFailure:string;basis:string;
 recommendedAction:string;requiredEvidence:string;
 evidence:PrebuildEvidence[];
 location:"mesh-wide"|"down-facing-surfaces"|"build-plate-interface"|"assembly-interfaces"|"process-setup"|"unknown";
};
export type PrebuildAction={
 id:string;title:string;why:string;stage:"geometry"|"context"|"assessment"|"external";priority:RiskPriority;linkedFindings:string[];
};
export type PrebuildInputs={
 fileName:string|null;unitsConfirmed:boolean;process:ProcessKind;
 mesh:MeshAudit|null;
 selected:ScreenCandidate|null;allCandidates:ScreenCandidate[];
 componentName:string;assemblyContext:string;attachmentNotes:string;
 requirements:string;documentCount:number;reviewedEvidenceCount:number;
 processWindow?:ProcessWindowAssessment|null;
 hasStructuralStudy:boolean;hasSteadyThermalStudy:boolean;
 coverage:FailureCoverage[];
};
export type PrebuildAssessment={
 version:typeof PREBUILD_ENGINE_VERSION;partName:string|null;
 scope:"RESEARCH_SCREENING_ONLY";disposition:AssessmentDisposition;
 dispositionReason:string;
 findings:PrebuildFinding[];actions:PrebuildAction[];
 completed:{mesh:boolean;orientation:boolean;processWindow:boolean;service:boolean;requirements:boolean};
 counts:{critical:number;high:number;medium:number;information:number;screened:number;unassessed:number};
 uncertainties:string[];
};
const make=(f:PrebuildFinding)=>f;
const exists=(s:string)=>Boolean(s.trim().length);
const evidence=(kind:PrebuildEvidence["kind"],detail:string,sourceId?:string):PrebuildEvidence=>({kind,detail,sourceId});
const flag=(data:PrebuildFinding)=>data;
export function evaluatePrebuild(input:PrebuildInputs):PrebuildAssessment{
 const findings:PrebuildFinding[]=[];
 const add=(f:PrebuildFinding)=>findings.push(flag(f));
 const geometryReady=!!input.fileName&&input.unitsConfirmed;
 if(!input.fileName)add(make({
  id:"INPUT_STL",domain:"verification",status:"unassessed",priority:"information",
  title:"No target part model",observation:"No STL has been uploaded.",
  potentialFailure:"Geometric manufacturability cannot be evaluated.",
  basis:"No source geometry",recommendedAction:"Upload the actual part STL and verify its dimensions.",
  requiredEvidence:"Actual STL; source drawing and unit confirmation",
  evidence:[],location:"unknown"
 }));
 else if(!input.unitsConfirmed)add(make({
  id:"INPUT_UNITS",domain:"geometry",status:"unassessed",priority:"high",
  title:"Dimensions not confirmed",observation:"STL contains no trustworthy unit metadata.",
  potentialFailure:"An incorrect unit scale can invalidate fit, support and physical analyses.",
  basis:"STL format does not encode engineering units",
  recommendedAction:"Compare bounding dimensions against the controlled engineering drawing.",
  requiredEvidence:"Drawing revision and engineer-confirmed STL units",
  evidence:[evidence("engineering-entry","Unit confirmation has not been recorded.")],location:"mesh-wide"
 }));
 if(input.mesh){
  const m=input.mesh;
  if(m.openEdges>0||m.nonManifoldEdges>0)add(make({
   id:"MESH_TOPOLOGY",domain:"geometry",status:"observed",priority:"critical",
   title:"Mesh topology requires repair",
   observation:m.openEdges+" boundary edges; "+m.nonManifoldEdges+" inconsistent manifold edges.",
   potentialFailure:"The imported geometry may not support a valid solid meshing or reliable downstream calculation.",
   basis:"STL triangle-edge topology audit",
   recommendedAction:"Repair and re-export the solid STL, then rerun the mesh audit.",
   requiredEvidence:"Closed, consistently oriented STL plus independent source-CAD verification",
   evidence:[evidence("mesh","openEdges="+m.openEdges+"; nonManifoldEdges="+m.nonManifoldEdges)],
   location:"mesh-wide"
  }));
  if(m.disconnectedShells>1)add(make({
   id:"DISCONNECTED_SHELLS",domain:"geometry",status:"observed",priority:"high",
   title:"Multiple disconnected STL shells",
   observation:m.disconnectedShells+" distinct shells detected.",
   potentialFailure:"Independent islands may be intended separate bodies or an unintended missing physical connection.",
   basis:"Quantized STL vertex-connectivity audit",
   recommendedAction:"Inspect the shells against the source CAD and confirm intended assembly and load-transfer continuity.",
   requiredEvidence:"Source-CAD assembly relationships and connection/join definition",
   evidence:[evidence("mesh","disconnectedShells="+m.disconnectedShells)],
   location:"mesh-wide"
  }));
  if(m.smallestEdgeMm>0&&m.smallestEdgeMm<0.2)add(make({
   id:"FINE_TRIANGLES",domain:"geometry",status:"observed",priority:"medium",
   title:"Small tessellation edges",
   observation:"Minimum STL triangle edge is "+m.smallestEdgeMm.toFixed(4)+" mm.",
   potentialFailure:"Poorly resolved geometry or coarse analysis grids may omit small details; this is not measured wall thickness.",
   basis:"STL triangle-edge length",
   recommendedAction:"Compare the tessellated geometry with nominal CAD feature dimensions and the simulation voxel size.",
   requiredEvidence:"Source dimensions, meshing sensitivity and confirmed minimum wall/feature specifications",
   evidence:[evidence("mesh","smallestEdgeMm="+m.smallestEdgeMm)],
   location:"mesh-wide"
  }));
 }
 if(input.process==="PBF_LB_METAL"&&geometryReady){
  const c=input.selected;
  if(!c)add(make({
   id:"ORIENTATION_MISSING",domain:"manufacturing",status:"unassessed",priority:"information",
   title:"Build orientation not evaluated",observation:"No current part-specific LPBF orientation sweep.",
   potentialFailure:"Build height, down-facing area and support demand are not evaluated.",
   basis:"No geometry worker output",recommendedAction:"Run the current geometry screening and select a candidate.",
   requiredEvidence:"Current orientation analysis tied to uploaded STL and unit scale",evidence:[],location:"unknown"
  }));
  else{
   if(!c.fitsEnvelope)add(make({
    id:"BUILD_ENVELOPE",domain:"manufacturing",status:"screened",priority:"critical",
    title:"Selected orientation exceeds machine envelope",
    observation:"Candidate "+c.id+" rotated bounding box does not fit the entered build dimensions.",
    potentialFailure:"Part cannot be produced in this orientation on the configured envelope.",
    basis:"Candidate rotated bounding box vs engineer-entered machine limits",
    recommendedAction:"Choose a feasible orientation or verify the actual machine envelope.",
    requiredEvidence:"Machine build volume, fixture offsets and qualified candidate selection",
    evidence:[evidence("orientation","fitsEnvelope=false; candidate="+c.id)],location:"mesh-wide"
   }));
   if(c.fitsEnvelope&&!c.feasible)add(make({
    id:"CONFIGURED_SUPPORT_LIMIT",domain:"manufacturing",status:"screened",priority:"high",
    title:"Configured support proxy limit exceeded",
    observation:"Candidate "+c.id+" is infeasible under the current geometric screen.",
    potentialFailure:"Support burden may exceed the configured planning preference; a machine-ready support plan was not generated.",
    basis:"Existing deterministic LPBF candidate feasibility check",
    recommendedAction:"Review constraint weights and support-accessibility assumptions; inspect an actual slicer support plan.",
    requiredEvidence:"Qualified slicer result and approved support strategy",
    evidence:[evidence("orientation","Candidate "+c.id+" marked infeasible")],location:"down-facing-surfaces"
   }));
   if(c.overhangFraction>0.25&&c.downFacingAreaMm2>0)add(make({
    id:"OVERHANG_SUPPORT",domain:"manufacturing",status:"screened",priority:"high",
    title:"Elevated down-facing surface fraction",
    observation:(100*c.overhangFraction).toFixed(1)+"% of the evaluated area is down-facing; "+c.downFacingAreaMm2.toFixed(1)+" mm².",
    potentialFailure:"Local unsupported regions could require supports; thermal or mechanical build failure has not been calculated.",
    basis:"Triangle-normal orientation proxy using current overhang screen (25% review trigger)",
    recommendedAction:"Inspect highlighted down-facing faces, verify real support accessibility and compare alternative orientations.",
    requiredEvidence:"Actual support toolpaths, overhang angle specification and reviewed build orientation",
    evidence:[evidence("orientation","candidate="+c.id+"; fraction="+c.overhangFraction)],location:"down-facing-surfaces"
   }));
   if(c.contactAreaMm2<=0)add(make({
    id:"BED_CONTACT",domain:"manufacturing",status:"screened",priority:"medium",
    title:"No near-plate contact in geometric heuristic",
    observation:"The current candidate has 0 mm² near-bed downward triangle area.",
    potentialFailure:"The build may require an independently designed foundation, fixture or support structures.",
    basis:"Build-plate contact triangle heuristic, not adhesion measurement",
    recommendedAction:"Review part seating, support anchoring and build-plate connection in a qualified slicer.",
    requiredEvidence:"Verified support/foundation design and machine build preparation",
    evidence:[evidence("orientation","candidate="+c.id+"; contactAreaMm2=0")],location:"build-plate-interface"
   }));
   const alternatives=input.allCandidates.filter(x=>x.feasible);
   const minSupport=Math.min(...alternatives.map(x=>x.supportProxyMm3));
   if(Number.isFinite(minSupport)&&alternatives.length>1&&
      c.supportProxyMm3>Math.max(1,minSupport)*2&&c.supportProxyMm3>100)
    add(make({
     id:"SUPPORT_TRADEOFF",domain:"manufacturing",status:"screened",priority:"medium",
     title:"Alternative orientation may reduce support demand",
     observation:"Selected support proxy "+c.supportProxyMm3.toFixed(1)+" mm³ vs feasible minimum "+minSupport.toFixed(1)+" mm³.",
     potentialFailure:"Excessive planned supports could increase material use, removal effort and risk to functional surfaces.",
     basis:"Comparison of screened geometric support-volume proxies, not a toolpath study",
     recommendedAction:"Compare top orientations for support removal, build height, surface needs and service-load direction.",
     requiredEvidence:"Actual support mass, machine settings, and critical-face constraints",
     evidence:[evidence("orientation","supportProxyMm3="+c.supportProxyMm3+"; minFeasible="+minSupport)],location:"down-facing-surfaces"
    }));
  }
 }
 if(input.process!=="PBF_LB_METAL")add(make({
  id:"DED_PATH_UNAVAILABLE",domain:"manufacturing",status:"unassessed",priority:"information",
  title:"Uploaded-part DED path analysis unavailable",
  observation:"Current arbitrary-part geometry optimization supports LPBF, not DED deposition pathing.",
  potentialFailure:"DED build continuity, distortion and deposition stability remain unassessed.",
  basis:"Current implementation scope",recommendedAction:"Use an approved DED reference study or obtain DED path/process inputs.",
  requiredEvidence:"DED process plan, deposit geometry, and qualified path conditions",
  evidence:[evidence("model-coverage","DED pathing not connected")],location:"process-setup"
 }));
 const window=input.processWindow;
 if(input.process==="PBF_LB_METAL"){
  if(!window||window.decision==="insufficient-evidence")add(make({
   id:"PROCESS_WINDOW_MISSING",domain:"manufacturing",status:"unassessed",priority:"information",
   title:"Qualified process-window evidence incomplete",
   observation:"Actual machine, alloy, parameter set or a fully bounded, engineer-reviewed process window is missing.",
   potentialFailure:"Lack of fusion, keyholing and unstable processing cannot be classified from geometry or volumetric energy density.",
   basis:"No complete, reviewed joint process setting supplied",
   recommendedAction:"Enter the machine/material/parameter identity and controlled source limits. Verify their applicability.",
   requiredEvidence:"Qualified machine-specific build parameters and supporting validation/inspection results",
   evidence:[evidence("model-coverage","No qualified defect predictor exists")],location:"process-setup"
  }));
  if(window?.decision==="outside-declared-range"||window?.decision==="invalid-configuration"){
   add(make({
    id:"PROCESS_BOUNDARY_VIOLATION",domain:"manufacturing",status:"screened",priority:"critical",
    title:window.decision==="invalid-configuration"?"Process input or interval invalid":"Parameter outside declared process range",
    observation:window.findings.filter(x=>x.severity==="blocker").map(x=>x.observation).slice(0,4).join(" | ")||"Entered process constraints cannot be satisfied.",
    potentialFailure:"The current planned parameters are outside the supplied engineering bounds; this does not identify a specific physical defect.",
    basis:"Engineer-entered source limits compared to planned settings",
    recommendedAction:"Hold process acceptance. Verify the source revision, resolve out-of-range inputs and recheck the whole combination.",
    requiredEvidence:"Engineer-reviewed actual process window and verified settings",
    evidence:[evidence("process-window","decision="+window.decision+"; outsideCount="+window.outsideCount)],location:"process-setup"
   });
  }
  if(window?.decision==="inside-declared-ranges")add(make({
   id:"PARAMETERS_WITHIN_DECLARED_BOUNDS",domain:"manufacturing",status:"screened",priority:"information",
   title:"Planned settings within individually reviewed bounds",
   observation:"Four planned parameters lie within source-entered individual min/max intervals.",
   potentialFailure:"Combined parameter interactions and resulting density/quality still have not been validated by ORIENTAI.",
   basis:"Engineer-reviewed single-variable parameter intervals; no joint process qualification",
   recommendedAction:"Validate the full parameter combination, scan pattern, layer thickness and actual inspection outcomes.",
   requiredEvidence:"Qualified combined processing windows and measured build quality",
   evidence:[evidence("process-window","inside-declared-ranges; checksCompleted="+window.checksCompleted)],location:"process-setup"
  }));
 }
 if(!exists(input.componentName)||!exists(input.assemblyContext))add(make({
  id:"APPLICATION_UNDEFINED",domain:"service",status:"unassessed",priority:"information",
  title:"Intended service function or assembly not established",
  observation:"The component's function and connected assembly are not both documented.",
  potentialFailure:"Part strength, required stiffness, mass optimisation and service-load paths cannot be evaluated from STL geometry alone.",
  basis:"Engineering-context completeness review",
  recommendedAction:"Document the part function, surrounding assembly, critical interfaces, and acceptable behavior.",
  requiredEvidence:"Assembly drawing, connection locations and design requirements",
  evidence:[evidence("engineering-entry","Incomplete componentName / assemblyContext")],location:"assembly-interfaces"
 }));
 if(!exists(input.attachmentNotes)||!exists(input.requirements))add(make({
  id:"SERVICE_REQUIREMENTS_UNVERIFIED",domain:"service",status:"unassessed",priority:"high",
  title:"Load cases, interfaces or acceptance criteria missing",
  observation:"Service load/attachment description and numerical acceptance requirements are incomplete.",
  potentialFailure:"Static yield, stiffness, buckling and fatigue risks cannot be substantiated.",
  basis:"Engineer-entered requirements are insufficient",
  recommendedAction:"Confirm real load magnitudes and directions, fixtures, material condition, temperature and design allowables.",
  requiredEvidence:"Reviewed load and fixture drawings; allowable stress/deflection; material specification",
  evidence:[evidence("engineering-entry","Missing verified loads and/or requirements")],location:"assembly-interfaces"
 }));
 if(input.documentCount===0||input.reviewedEvidenceCount===0)add(make({
  id:"SOURCE_TRACEABILITY_MISSING",domain:"verification",status:"unassessed",priority:"information",
  title:"Assembly evidence not independently reviewed",
  observation:input.documentCount===0?"No assembly/engineering references attached.":"References exist but no applicable source passages were reviewed.",
  potentialFailure:"Incorrect assumptions about loads, material or function may reach downstream analysis.",
  basis:"Part-scoped source/evidence review state",
  recommendedAction:"Attach drawings/specifications and mark source excerpts as applicable with rationale.",
  requiredEvidence:"Source ID/revision, page or drawing locator, engineer review note",
  evidence:[evidence("document","documents="+input.documentCount+"; reviewed="+input.reviewedEvidenceCount)],
  location:"assembly-interfaces"
 }));
 if(!input.hasStructuralStudy)add(make({
  id:"STRUCTURAL_NOT_CALCULATED",domain:"service",status:"unassessed",priority:"information",
  title:"In-service structural response not calculated",
  observation:"No current part-specific, reviewed idealized stress/displacement study.",
  potentialFailure:"Under service loads the component may exceed strength or stiffness limits; no assessment is available.",
  basis:"No linked current structural research result",
  recommendedAction:"After approving loads/fixtures, run structural research analysis and compare against independently verified allowables.",
  requiredEvidence:"Verified force and constraint locations, material allowables, FEM convergence and service factors",
  evidence:[evidence("model-coverage","structural calculation missing")],location:"assembly-interfaces"
 }));
 if(!input.hasSteadyThermalStudy)add(make({
  id:"SERVICE_THERMAL_NOT_CALCULATED",domain:"service",status:"unassessed",priority:"information",
  title:"Service temperature response not calculated",
  observation:"No current part-specific steady conduction study.",
  potentialFailure:"Temperature exposure can change properties or induce dimensional response that has not been evaluated.",
  basis:"No linked current thermal research result",
  recommendedAction:"Confirm service thermal boundary conditions and material conductivity before a research solve.",
  requiredEvidence:"Heat loads, boundary conditions, temperature limits, material properties",
  evidence:[evidence("model-coverage","steady service thermal calculation missing")],location:"assembly-interfaces"
 }));
 const uncovered=input.coverage.filter(x=>x.state==="not-assessed"&&x.category==="print-process");
 const riskAliases:Record<string,string>={
  "lack-of-fusion":"Insufficient consolidation, missing fusion",
  "keyhole-porosity":"Keyhole pore formation",
  "distortion-residual-stress":"Thermal distortion or residual-stress concerns",
  "hot-cracking":"Cracking or delamination",
  "recoater-collision":"Recoater interference",
  "print-thermal-history":"Time-resolved build thermal behavior",
  "surface-dimensions":"Surface/dimensional nonconformance",
  "in-service-fatigue":"In-service fatigue / as-built anisotropy"
 };
 for(const mode of uncovered){
  // Consolidated status per mechanism, not an inferred part-specific high-risk score.
  add(make({
   id:"UNASSESSED_"+mode.id,domain:mode.id==="in-service-fatigue"?"service":"manufacturing",
   status:"unassessed",priority:"information",
   title:riskAliases[mode.id]??mode.name,observation:"Not evaluated for this part in this study.",
   potentialFailure:mode.name+" remains possible but no probability or localised defect is known.",
   basis:mode.limitations,
   recommendedAction:"Do not infer absence. "+mode.nextInput,
   requiredEvidence:mode.nextInput,
   evidence:[evidence("model-coverage","failureCoverage:"+mode.id+" state=not-assessed")],
   location:"unknown"
  }));
 }
 const priorities:Record<RiskPriority,number>={critical:0,high:1,medium:2,information:3};
 findings.sort((a,b)=>priorities[a.priority]-priorities[b.priority]||
  (a.status==="unassessed"?1:0)-(b.status==="unassessed"?1:0)||a.id.localeCompare(b.id));
 const actionable=findings.filter(x=>!x.id.startsWith("UNASSESSED_"));
 const actions:PrebuildAction[]=actionable.slice(0,9).map(f=>({
  id:"ACTION_"+f.id,title:f.recommendedAction,why:f.observation,
  stage:f.domain==="geometry"?"geometry":
   f.id==="ORIENTATION_MISSING"||f.id==="BUILD_ENVELOPE"||f.id==="OVERHANG_SUPPORT"||
   f.id==="CONFIGURED_SUPPORT_LIMIT"||f.id==="SUPPORT_TRADEOFF"||f.id==="BED_CONTACT"?"geometry":
   ["APPLICATION_UNDEFINED","SERVICE_REQUIREMENTS_UNVERIFIED","SOURCE_TRACEABILITY_MISSING",
    "PROCESS_WINDOW_MISSING","PROCESS_BOUNDARY_VIOLATION"].includes(f.id)?"context":
    f.domain==="service"?"external":"assessment",
  priority:f.priority,linkedFindings:[f.id]
 }));
 const blocking=findings.some(f=>f.priority==="critical"&&f.status!=="unassessed");
 const review=findings.some(f=>["critical","high","medium"].includes(f.priority)&&f.status!=="unassessed");
 const disposition:AssessmentDisposition=blocking?"geometry-blocked":review?"review-required":"information-incomplete";
 const uncertainties=[
  "Research-only screening: no qualified manufacturing release or first-time-quality guarantee.",
  "STL topology does not prove minimum wall thickness, functional strength or absence of self-intersections.",
  "Even if process parameters are within individual bounds, the combined machine/scan/material process has not been validated.",
  "No calibrated melt-pool, porosity, cracking, distortion, recoater or as-built fatigue predictor is connected.",
  "Service stress and thermal results require verified boundary conditions and experimental or analytical validation."
 ];
 return {
  version:PREBUILD_ENGINE_VERSION,partName:input.fileName,scope:"RESEARCH_SCREENING_ONLY",
  disposition,dispositionReason:blocking?
    "At least one measured geometry or declared parameter-bound condition must be resolved before review.":
   review?"Geometry or entered process evidence raises concerns requiring engineering review.":
   "Essential engineering/process inputs remain unavailable. No release decision is justified.",
  findings,actions,
  completed:{mesh:!!input.mesh,orientation:!!input.selected,processWindow:!!window&&window.decision!=="insufficient-evidence",
   service:input.hasStructuralStudy&&input.hasSteadyThermalStudy,
   requirements:exists(input.componentName)&&exists(input.assemblyContext)&&
    exists(input.attachmentNotes)&&exists(input.requirements)&&input.reviewedEvidenceCount>0},
  counts:{critical:findings.filter(x=>x.priority==="critical").length,
   high:findings.filter(x=>x.priority==="high").length,medium:findings.filter(x=>x.priority==="medium").length,
   information:findings.filter(x=>x.priority==="information").length,
   screened:findings.filter(x=>x.status!=="unassessed").length,
   unassessed:findings.filter(x=>x.status==="unassessed").length},
  uncertainties
 };
}
