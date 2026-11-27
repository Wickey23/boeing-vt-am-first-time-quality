import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_SETTINGS,requestFor,type Analysis} from '../lib/analysis-workspace';
import {analyzeOrientations} from '../lib/orientation-engine';
import {sha256} from '../lib/study-identity';
import {prepareEngineeringReport,reportPDF} from '../lib/engineering-report';
import {prepareAssessmentReport} from '../lib/assessment-report-evidence';
import {createCopilotReviewPDF,type CopilotPdfInputs} from '../lib/copilot-review-pdf';
import {blankKnowledge} from '../lib/copilot-context';
import {requirementRegister} from '../lib/requirement-register';
import {createServicePlan,syncServicePlan,attachServiceResult,serviceInputKey} from '../lib/service-plan';
import {solvePartStructural} from '../lib/voxel-structural';
import {exportPortableProject} from '../lib/project-transfer';

const bytes=Uint8Array.from(readFileSync('public/verification/cube-10mm.stl')).buffer;
const settings={...DEFAULT_SETTINGS,searchSamples:0};
async function fixture(){
 const file=new File([bytes],'cube.stl'),digest=await sha256(bytes);
 const run:Analysis={...analyzeOrientations(bytes,requestFor(settings)),runId:'report-run',generatedAt:'2026-11-26T00:00:00Z',algorithm:'test',configuration:settings,source:{fileName:file.name,fileHashSha256:digest,byteSize:file.size}};
 const input:CopilotPdfInputs={projectName:'Review',partName:file.name,partSha256:digest,modelFile:file,unitScale:1,process:'PBF_LB_METAL',unitsConfirmed:true,createdAt:run.generatedAt,knowledge:blankKnowledge(digest),reviewedEvidence:[],readiness:{status:'needs-inputs',nextAction:{step:'requirements',title:'Review requirements',reason:'Test fixture'},gates:[],counts:{ready:0,review:0,unavailable:0},caveats:[]}};
 return {file,run,input};
}
test('report JSON and portable project use the same input identity',async()=>{
 const {file,run}=await fixture();const selected=run.candidates[0].id;
 const report=await prepareEngineeringReport(run,selected,file);
 const project=JSON.parse(await exportPortableProject('Review',file,settings,run,selected,createServicePlan()));
 // The report must include the same service plan to describe the same complete inputs.
 const withPlan=await prepareEngineeringReport({...run,servicePlan:createServicePlan()},selected,file);
 assert.equal(withPlan.evidenceManifest.inputSha256,project.evidenceManifest.inputSha256);
 assert.equal(report.evidenceManifest.sourceVerification,'original-bytes-verified');
 assert.equal(report.evidenceManifest.physicalValidation,'not-established');
});
test('geometry exports reject changed bytes, settings and unknown selection even with no figure',async()=>{
 const {file,run}=await fixture();
 await assert.rejects(prepareEngineeringReport(run,null,new File(['wrong'],'cube.stl')),/STL bytes/);
 await assert.rejects(reportPDF(run,null,new File(['wrong'],'cube.stl')),/STL bytes/);
 await assert.rejects(prepareEngineeringReport(run,null,file,{settings:{...settings,unitScale:25.4}}),/configuration/);
 await assert.rejects(prepareEngineeringReport(run,'missing',file),/orientation/);
 await assert.rejects(prepareEngineeringReport(run,null),/Original STL/);
});
test('assessment export rejects cross-part context, unconfirmed units, changed source bytes and stale evidence',async()=>{
 const {input}=await fixture();
 await assert.rejects(prepareAssessmentReport({...input,unitsConfirmed:false}),/Confirm STL/);
 await assert.rejects(prepareAssessmentReport({...input,knowledge:blankKnowledge('b'.repeat(64))}),/different part/);
 await assert.rejects(createCopilotReviewPDF({...input,modelFile:new File(['wrong'],'cube.stl')}),/checksum mismatch/);
 await assert.rejects(prepareAssessmentReport({...input,reviewedEvidence:[{sourceId:'missing'} as never]}),/source changed/);
 await assert.rejects(prepareAssessmentReport({...input,approvedBindings:[{serviceCaseId:'missing'} as never]}),/binding is stale/);
});
test('assessment content identity is stable across export times but changes with requirements',async()=>{
 const {input}=await fixture();input.knowledge.reviewedRequirements='Surface finish must be inspected.';
 const first=await prepareAssessmentReport(input);
 const later=await prepareAssessmentReport({...input,createdAt:'2026-12-01T00:00:00Z'});
 assert.equal(first.manifest.contentSha256,later.manifest.contentSha256);
 assert.equal(first.requirements[0].status,'unassessed');
 input.knowledge.reviewedRequirements='A revised requirement.';
 assert.notEqual((await prepareAssessmentReport(input)).manifest.contentSha256,first.manifest.contentSha256);
});
test('async export freezes context before reading bytes',async()=>{
 const {input}=await fixture();input.knowledge.reviewedRequirements='Original requirement';
 const pending=prepareAssessmentReport(input);
 input.knowledge.reviewedRequirements='Edited while exporting';
 const report=await pending;
 assert.equal(report.input.knowledge.reviewedRequirements,'Original requirement');
 assert.equal(report.requirements[0].requirement,'Original requirement');
});
test('requirements compare actual matching solver output, not stored assessment labels',async()=>{
 const {run}=await fixture();const plan=createServicePlan();plan.cases[0].input.displacementLimitMm=.1;
 let r=syncServicePlan(run,plan);const c=plan.cases[0],candidate=r.candidates[0];
 const field=solvePartStructural(bytes,candidate.rotation,1,c.input);
 r=attachServiceResult(r,r.runId,candidate.id,c.id,serviceInputKey(c.input),field);
 assert.equal(requirementRegister(r)[0].status,'within-model-limit');
 const saved=r.structuralCases![c.id];
 const altered={...r,structuralCases:{[c.id]:{...saved,field:{...field,solver:{...field.solver,maxDisplacementMm:2}}}}};
 assert.equal(requirementRegister(altered)[0].status,'exceeds-model-limit');
 assert.equal(requirementRegister(altered)[0].calculatedMm,2);
 const stale={...r,servicePlan:{...plan,cases:[{...c,input:{...c.input,forceZN:200}}]}};
 assert.equal(requirementRegister(stale)[0].status,'stale');
 assert.equal(requirementRegister(stale)[0].calculatedMm,null);
 assert.equal(requirementRegister(null,undefined,plan)[0].status,'not-run');
 assert.equal(requirementRegister({...r,servicePlan:createServicePlan()})[0].status,'missing-limit');
});
test('assessment orientation metrics must match the current run',async()=>{
 const {input,run}=await fixture();const c=run.candidates[0];
 const selected={id:c.id,buildHeightMm:c.buildHeightMm,downFacingAreaMm2:c.downFacingAreaMm2,supportProxyMm3:c.supportProxyMm3,overhangFraction:c.overhangFraction,contactAreaMm2:c.contactAreaMm2,rotation:c.rotation};
 const valid={...input,analysis:run,settings,selectedOrientation:selected};
 assert.equal((await prepareAssessmentReport(valid)).manifest.analysisRunId,run.runId);
 await assert.rejects(prepareAssessmentReport({...valid,selectedOrientation:{...selected,buildHeightMm:999}}),/orientation/);
});
