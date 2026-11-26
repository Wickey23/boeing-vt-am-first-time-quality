import type {Analysis} from './analysis-workspace';
import type {ProjectKnowledge} from './copilot-context';
import {serviceInputKey,type ServicePlan} from './service-plan';
import {displacementAssessment} from './service-load';

export type RequirementEvidence={
 id:string;requirement:string;origin:'engineer-entered';
 status:'unassessed'|'missing-limit'|'invalid-limit'|'not-run'|'stale'|'invalid-result'|'within-model-limit'|'exceeds-model-limit';
 limitMm:number|null;calculatedMm:number|null;runId:string|null;candidateId:string|null;
 evidence:string;nextAction:string;
};

/** A requirement statement or a completed calculation is not a verified acceptance. */
export function requirementRegister(run:Analysis|null,knowledge?:Pick<ProjectKnowledge,'reviewedRequirements'>,plan?:ServicePlan):RequirementEvidence[]{
 const rows:RequirementEvidence[]=[];
 if(knowledge?.reviewedRequirements.trim())rows.push({
  id:'context-requirements',requirement:knowledge.reviewedRequirements.trim(),origin:'engineer-entered',
  status:'unassessed',limitMm:null,calculatedMm:null,runId:null,candidateId:null,
  evidence:'Recorded engineering context; no automatic requirement-to-solver mapping.',
  nextAction:'Define each acceptance criterion and link an independently reviewed calculation or inspection.'
 });
 for(const c of (plan??run?.servicePlan)?.cases??[]){
  const saved=run?.structuralCases?.[c.id];
  const limit=c.input.displacementLimitMm;
  const current=!!saved&&saved.runId===run!.runId&&saved.inputKey===serviceInputKey(c.input)&&
   serviceInputKey(saved.field.input)===serviceInputKey(c.input)&&run!.candidates.some(x=>x.id===saved.candidateId);
  const value=current?saved.field.solver.maxDisplacementMm:null;
  const numeric=value!==null&&Number.isFinite(value)&&value>=0;
  let status:RequirementEvidence['status'];
  if(limit===undefined)status='missing-limit';
  else if(!Number.isFinite(limit)||limit<=0)status='invalid-limit';
  else if(!saved)status='not-run';
  else if(!current)status='stale';
  else if(!numeric)status='invalid-result';
  else status=displacementAssessment(value!,limit).status as 'within-model-limit'|'exceeds-model-limit';
  const evaluated=status==='within-model-limit'||status==='exceeds-model-limit';
  rows.push({id:'displacement:'+c.id,requirement:c.name+' — maximum service displacement',origin:'engineer-entered',status,
   limitMm:limit!==undefined&&Number.isFinite(limit)?limit:null,calculatedMm:numeric?value:null,
   runId:current?run!.runId:null,candidateId:current?saved.candidateId:null,
   evidence:current?'Current original-part service calculation. Comparison to a research model only; no physical validation.':'No current matching service calculation.',
   nextAction:status==='missing-limit'||status==='invalid-limit'?'Enter a documented positive displacement limit in millimeters.':
    evaluated?'Independently verify loads, material, convergence and measured response before engineering acceptance.':'Run the service case using its current inputs, then review the model limitations.'
  });
 }
 return rows;
}
