import {DEFAULT_SERVICE_SETUP, END_FACES, validateServiceSetup, type ServiceSetup} from './service-load';
import type {Analysis} from './analysis-workspace';

export type ServiceCase = {id:string; name:string; input:ServiceSetup};
export type ServicePlan = {schema:1; activeCaseId:string; cases:ServiceCase[]};
export const MAX_SERVICE_CASES=8;
export function createServicePlan(input:ServiceSetup=DEFAULT_SERVICE_SETUP):ServicePlan {
 return {schema:1,activeCaseId:'service-1',cases:[{id:'service-1',name:'Service case 1',input:{...input}}]};
}
export function activeServiceCase(plan:ServicePlan){return plan.cases.find(c=>c.id===plan.activeCaseId)!;}
/** Stable key excludes labels, but includes every physical input and requirement. */
export function serviceInputKey(input:ServiceSetup){return JSON.stringify({
 coordinateFrame:input.coordinateFrame,fixedFace:input.fixedFace??'z-min',
 youngModulusMPa:input.youngModulusMPa,poissonRatio:input.poissonRatio,
 forceXN:input.forceXN,forceYN:input.forceYN??0,forceZN:input.forceZN,
 resolution:input.resolution,displacementLimitMm:input.displacementLimitMm??null,
});}
/** Drafts may be physically invalid while editing; they must still be safely restorable. */
export function validateServicePlan(value:unknown):asserts value is ServicePlan {
 const p=value as ServicePlan;
 if(!p||p.schema!==1||!Array.isArray(p.cases)||!p.cases.length||p.cases.length>MAX_SERVICE_CASES)throw Error('Invalid service-case plan.');
 const ids=new Set<string>();
 for(const c of p.cases){
  if(!c||typeof c.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(c.id)||ids.has(c.id)||typeof c.name!=='string'||c.name.length>80)throw Error('Invalid or duplicate service case.');
  ids.add(c.id);const i=c.input;
  if(!i||i.coordinateFrame!=='part'||!END_FACES.includes(i.fixedFace??'z-min')||![i.youngModulusMPa,i.poissonRatio,i.forceXN,i.forceYN??0,i.forceZN,i.resolution].every(Number.isFinite)||(i.displacementLimitMm!==undefined&&!Number.isFinite(i.displacementLimitMm)))throw Error('Invalid service-case input schema.');
 }
 if(!ids.has(p.activeCaseId))throw Error('Active service case is missing.');
}
export function restoreServicePlan(plan:unknown,run:Analysis|null):ServicePlan {
 if(plan!==undefined){validateServicePlan(plan);return plan;}
 if(run?.servicePlan){validateServicePlan(run.servicePlan);return run.servicePlan;}
 const input=run?.serviceSetup??run?.structural?.field.input;
 if(input?.coordinateFrame==='part'){validateServiceSetup(input);return createServicePlan(input);}
 return createServicePlan();
}
export function syncServicePlan(run:Analysis,plan:ServicePlan):Analysis {
 const cases:NonNullable<Analysis['structuralCases']>={};
 for(const c of plan.cases){const saved=run.structuralCases?.[c.id];if(saved?.runId===run.runId&&saved.inputKey===serviceInputKey(c.input))cases[c.id]=saved;}
 // Migrate an older original-part result only when its exact inputs match.
 if(!run.servicePlan&&run.structural?.field.input.coordinateFrame==='part'){
  const first=plan.cases[0];if(serviceInputKey(run.structural.field.input)===serviceInputKey(first.input))cases[first.id]={...run.structural,inputKey:serviceInputKey(first.input)};
 }
 const active=activeServiceCase(plan);
 const sameInput=run.serviceSetup&&serviceInputKey(run.serviceSetup)===serviceInputKey(active.input);
 return {...run,servicePlan:plan,serviceSetup:active.input,structuralCases:cases,structural:cases[active.id],meshSensitivity:{...run.meshSensitivity,structural:sameInput?run.meshSensitivity?.structural:undefined}};
}
export function attachServiceResult(run:Analysis,runId:string,candidateId:string,caseId:string,inputKey:string,field:NonNullable<Analysis['structural']>['field']):Analysis {
 const c=run.servicePlan?.cases.find(c=>c.id===caseId);
 if(run.runId!==runId||!c||serviceInputKey(c.input)!==inputKey||serviceInputKey(field.input)!==inputKey||!run.candidates.some(x=>x.id===candidateId))return run;
 const next={...run,structuralCases:{...run.structuralCases,[caseId]:{runId,candidateId,inputKey,field}}};
 return syncServicePlan(next,run.servicePlan!);
}
export function serviceCaseSummary(run:Analysis){
 return (run.servicePlan?.cases??[]).map(c=>{
  const result=run.structuralCases?.[c.id];const current=result?.runId===run.runId&&result.inputKey===serviceInputKey(c.input);
  return {id:c.id,name:c.name,input:c.input,status:current?(result.field.assessment?.status??'not-evaluated'):'not-run',
   maxDisplacementMm:current?result.field.solver.maxDisplacementMm:null,maxVonMisesMPa:current?result.field.solver.maxVonMisesMPa:null,
   strength:'not-evaluated',fatigue:'not-evaluated',manufacturingAcceptance:'not-evaluated'};
 });
}
