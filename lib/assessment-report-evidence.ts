import type {CopilotPdfInputs} from './copilot-review-pdf';
import {canonicalJSON,sha256,assertAnalysisIdentity} from './study-identity';
import {evidenceIsCurrent} from './engineering-evidence';
import {activeParameterBindings} from './engineering-parameter-binding';
import {requirementRegister} from './requirement-register';

/** Freeze and verify the actual report inputs before asynchronous PDF work. */
export async function prepareAssessmentReport(source:CopilotPdfInputs){
 const {modelFile,...data}=source;
 const input:CopilotPdfInputs={...structuredClone(data),modelFile};
 if(!input.unitsConfirmed)throw Error('Confirm STL units and dimensions before exporting the assessment.');
 if(!Number.isFinite(input.unitScale)||input.unitScale<=0)throw Error('Report requires a positive STL unit scale.');
 if(!/^[a-f0-9]{64}$/i.test(input.partSha256)||input.knowledge.partKey.toLowerCase()!==input.partSha256.toLowerCase())
  throw Error('Engineering context belongs to a different part. Reopen context for the current STL.');
 if(!modelFile)throw Error('The original STL is required to verify this assessment export.');
 const bytes=await modelFile.arrayBuffer();
 const digest=await sha256(bytes);
 if(digest!==input.partSha256.toLowerCase())throw Error('Report geometry checksum mismatch. Run the assessment on the current STL.');
 if(input.reviewedEvidence.some(e=>!evidenceIsCurrent(e,input.knowledge.sources)))
  throw Error('A reviewed source changed. Review the current reference before exporting.');
 for(const binding of input.approvedBindings??[]){
  const c=input.servicePlan?.cases.find(c=>c.id===binding.serviceCaseId);
  if(!c||activeParameterBindings([binding],input.knowledge.sources,input.reviewedEvidence,c).length!==1)
   throw Error('A source-to-input binding is stale. Review the current service inputs before exporting.');
 }
 if(input.analysis){
  assertAnalysisIdentity(input.analysis,input.settings??input.analysis.configuration,digest,bytes.byteLength);
  if(input.process!=='PBF_LB_METAL'||input.analysis.configuration.unitScale!==input.unitScale)
   throw Error('Report process or units differ from the orientation analysis.');
 }
 if(input.selectedOrientation){
  const c=input.analysis?.candidates.find(c=>c.id===input.selectedOrientation!.id);
  if(!c||Object.entries(input.selectedOrientation).some(([key,value])=>canonicalJSON(value)!==canonicalJSON(c[key as keyof typeof c])))
   throw Error('Selected report orientation does not match the current analysis.');
 }
 if(input.study&&input.study.partSha256!==digest)throw Error('Service study belongs to a different part.');
 const requirements=requirementRegister(input.analysis??null,input.knowledge,input.servicePlan);
 // Exclude export time so an unchanged dossier has a stable content identity.
 const createdAt=input.createdAt;
 const contentSha256=await sha256(new TextEncoder().encode(canonicalJSON({...input,modelFile:undefined,createdAt:undefined,requirements})).buffer);
 return {input,bytes,requirements,manifest:{schema:1 as const,kind:'ORIENTAI_ASSESSMENT_EVIDENCE',
  partSha256:digest,byteSize:bytes.byteLength,contentSha256,unitsConfirmed:true,unitScale:input.unitScale,
  process:input.process,analysisRunId:input.analysis?.runId??null,
  selectedCandidateId:input.selectedOrientation?.id??null,sourceVerification:'original-bytes-verified',
  physicalValidation:'not-established',exportedAt:createdAt}};
}

export async function downloadAssessmentEvidence(source:CopilotPdfInputs){
 const prepared=await prepareAssessmentReport(source);
 const {modelFile,...inputs}=prepared.input;
 const report={manifest:prepared.manifest,requirements:prepared.requirements,inputs};
 const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='orientai-assessment-'+prepared.manifest.partSha256.slice(0,8)+'.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
