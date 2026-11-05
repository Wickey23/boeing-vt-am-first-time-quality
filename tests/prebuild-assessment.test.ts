import {test} from "node:test";
import assert from "node:assert/strict";
import {evaluatePrebuild,PREBUILD_ENGINE_VERSION,type PrebuildInputs} from "../lib/prebuild-assessment";
import {manufacturingProcessFlow} from "../lib/manufacturing-process-flow";
import {failureCoverage} from "../lib/failure-coverage";
import {assessLpbfProcessWindow,emptyProcessQualityInput} from "../lib/lpbf-process-quality";
const candidate={
 id:"O1",feasible:true,fitsEnvelope:true,buildHeightMm:20,
 downFacingAreaMm2:5,supportProxyMm3:20,overhangFraction:.03,
 contactAreaMm2:100,dimensions:{x:30,y:40,z:20},score:.5,rank:1
};
const base:PrebuildInputs={
 fileName:null,unitsConfirmed:false,process:"PBF_LB_METAL",
 mesh:null,selected:null,allCandidates:[],componentName:"",assemblyContext:"",
 attachmentNotes:"",requirements:"",documentCount:0,reviewedEvidenceCount:0,
 hasStructuralStudy:false,hasSteadyThermalStudy:false,
 coverage:failureCoverage({hasMeshAudit:false,hasOrientationRun:false,hasStructuralStudy:false,hasSteadyThermalStudy:false,process:"PBF_LB_METAL"})
};
const mesh={triangles:100,openEdges:0,nonManifoldEdges:0,disconnectedShells:1,smallestEdgeMm:1,findings:[]};
test("new project never has an apparent green-light release status",()=>{
 const x=evaluatePrebuild(base);
 assert.equal(x.version,PREBUILD_ENGINE_VERSION);
 assert.equal(x.scope,"RESEARCH_SCREENING_ONLY");
 assert.equal(x.disposition,"information-incomplete");
 assert(x.findings.some(f=>f.id==="INPUT_STL"&&f.status==="unassessed"));
 assert(x.findings.every(f=>f.evidence.every(e=>e.detail.length>0)));
});
test("mesh connectivity warning and hole are observed geometry, not a print defect probability",()=>{
 const x=evaluatePrebuild({...base,fileName:"lug.stl",unitsConfirmed:true,mesh:{
  ...mesh,openEdges:3,nonManifoldEdges:2,disconnectedShells:2,smallestEdgeMm:.03}});
 assert.equal(x.disposition,"geometry-blocked");
 assert.equal(x.findings.find(f=>f.id==="MESH_TOPOLOGY")?.status,"observed");
 assert.equal(x.findings.find(f=>f.id==="DISCONNECTED_SHELLS")?.priority,"high");
 assert.match(x.findings.find(f=>f.id==="FINE_TRIANGLES")?.potentialFailure??"",/not measured wall thickness/i);
 assert(x.actions.some(a=>a.stage==="geometry"));
});
test("LPBF orientation screen produces support warnings without pretending to simulate porosity",()=>{
 const c={...candidate,downFacingAreaMm2:300,overhangFraction:.6,supportProxyMm3:600,contactAreaMm2:0};
 const x=evaluatePrebuild({...base,fileName:"bracket.stl",unitsConfirmed:true,mesh,selected:c,
  allCandidates:[c,{...candidate,id:"O2",supportProxyMm3:30}]});
 assert.equal(x.findings.find(f=>f.id==="OVERHANG_SUPPORT")?.status,"screened");
 assert.equal(x.findings.find(f=>f.id==="BED_CONTACT")?.location,"build-plate-interface");
 assert(x.findings.some(f=>f.id==="SUPPORT_TRADEOFF"));
 const pore=x.findings.find(f=>f.id==="UNASSESSED_lack-of-fusion");
 assert.equal(pore?.status,"unassessed");
 assert.match(pore?.observation??"",/not evaluated/i);
 assert(!x.findings.some(f=>f.id==="UNASSESSED_lack-of-fusion"&&f.status==="screened"));
});
test("outside reviewed process range can block review but cannot identify the physical defect",()=>{
 const i=emptyProcessQualityInput();
 i.machine="M-1";i.material="Ti-6Al-4V lot R";i.parameterSet="P1";i.reference="PS 123 rev A";
 i.referenceReviewed=true;i.values.powerW=500;i.windows.powerW={min:100,max:300};
 const w=assessLpbfProcessWindow(i);
 const x=evaluatePrebuild({...base,fileName:"lug.stl",unitsConfirmed:true,mesh,selected:candidate,
  allCandidates:[candidate],processWindow:w});
 assert.equal(w.decision,"outside-declared-range");
 const f=x.findings.find(f=>f.id==="PROCESS_BOUNDARY_VIOLATION");
 assert.equal(f?.priority,"critical");
 assert.equal(f?.status,"screened");
 assert.match(f?.potentialFailure??"",/does not identify a specific physical defect/i);
});
test("inside complete reviewer-entered individual ranges never become build approval",()=>{
 const i=emptyProcessQualityInput();
 i.machine="M1";i.material="Alloy-X";i.parameterSet="P1";i.reference="REV B";i.referenceReviewed=true;
 for(const name of ["powerW","speedMmS","hatchMm","layerMm"] as const){
  i.values[name]=1;
  i.windows[name]={min:.5,max:2};
 }
 const w=assessLpbfProcessWindow(i);
 assert.equal(w.decision,"inside-declared-ranges");
 const x=evaluatePrebuild({...base,fileName:"test.stl",unitsConfirmed:true,mesh,selected:candidate,
  allCandidates:[candidate],processWindow:w});
 assert.equal(x.findings.find(f=>f.id==="PARAMETERS_WITHIN_DECLARED_BOUNDS")?.priority,"information");
 assert.equal(x.disposition,"information-incomplete");
 assert(x.uncertainties.some(t=>/process.*validated/i.test(t)));
});
test("source-reviewed application and research solver results are still not release approval",()=>{
 const x=evaluatePrebuild({...base,fileName:"test.stl",unitsConfirmed:true,mesh,selected:candidate,
  allCandidates:[candidate],componentName:"Mounting lug",assemblyContext:"Actuator mount",
  attachmentNotes:"Two bolts",requirements:"Reviewed load specifications",
  documentCount:2,reviewedEvidenceCount:2,hasStructuralStudy:true,hasSteadyThermalStudy:true});
 assert.equal(x.completed.requirements,true);
 assert.equal(x.completed.service,true);
 assert.equal(x.findings.some(f=>f.id==="APPLICATION_UNDEFINED"),false);
 assert.equal(x.findings.some(f=>f.id==="STRUCTURAL_NOT_CALCULATED"),false);
 assert.equal(x.scope,"RESEARCH_SCREENING_ONLY");
 assert(x.findings.some(f=>f.id==="UNASSESSED_in-service-fatigue"));
});
test("DED uploaded-STL process is explicitly unsupported rather than applying LPBF heuristics",()=>{
 const x=evaluatePrebuild({...base,fileName:"part.stl",unitsConfirmed:true,mesh,process:"DED_LB_POWDER",
  selected:candidate,allCandidates:[candidate]});
 assert(x.findings.some(f=>f.id==="DED_PATH_UNAVAILABLE"));
 assert(!x.findings.some(f=>f.id==="OVERHANG_SUPPORT"));
});
test("manufacturing flow preserves external manufacturing, inspection and feedback stages",()=>{
 const empty=manufacturingProcessFlow({hasPart:false,unitsConfirmed:false,hasGeometryRun:false,
  hasAssemblyContext:false,hasReviewedEvidence:false,hasRiskAssessment:false,hasBlockers:false});
 assert.equal(empty.length,8);assert.equal(empty[0].status,"needs-input");
 for(const phase of ["manufacture","inspect","feedback"])
  assert.equal(empty.find(f=>f.id===phase)?.status,"external");
 const used=manufacturingProcessFlow({hasPart:true,unitsConfirmed:true,hasGeometryRun:true,
  hasAssemblyContext:true,hasReviewedEvidence:true,hasRiskAssessment:true,hasBlockers:false});
 assert.equal(used.find(f=>f.id==="geometry")?.status,"completed");
 assert.equal(used.find(f=>f.id==="assessment")?.status,"completed");
 assert.equal(used.find(f=>f.id==="review")?.status,"in-progress");
 assert.equal(used.find(f=>f.id==="manufacture")?.status,"external");
});
