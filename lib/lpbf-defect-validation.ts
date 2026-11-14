/**
 * Held-out LPBF defect prediction validation. This NEVER trains a model or
 * manufactures probabilities: it scores predictions against inspected parts.
 *
 * Split groups must be assigned before model tuning (e.g., build IDs), and
 * only genuinely held-out observations belong in this evaluation.
 */
export const DEFECT_VALIDATION_VERSION="orientai.lpbf.defect.validation.v1" as const;
export type DefectKind="lack-of-fusion"|"distortion";
export type ValidationCase={
 id:string;buildId:string;actualDefect:boolean;
 predictedProbability:number|null; // null = model abstains
};
export type DefectValidationInput={
 defect:DefectKind;material:string;machine:string;processRevision:string;
 inspectedOutcomeDefinition:string;sourceReference:string;
 split:"held-out-builds";decisionThreshold:number;cases:ValidationCase[];
};
export type ValidationSummary={
 version:typeof DEFECT_VALIDATION_VERSION;status:"VALIDATION_ONLY_NOT_QUALIFIED";
 scope:{defect:DefectKind;material:string;machine:string;processRevision:string;outcome:string;source:string};
 sampleSize:number;distinctBuilds:number;abstained:number;coverage:number;
 confusion:{tp:number;fp:number;tn:number;fn:number};
 precision:number|null;recall:number|null;specificity:number|null;balancedAccuracy:number|null;
 brierScore:number|null;observedPrevalence:number;
 warnings:string[];
};
const ratio=(n:number,d:number)=>d>0?n/d:null;
export function evaluateHeldOutDefects(input:DefectValidationInput):ValidationSummary{
 if(input.split!=="held-out-builds")throw Error("Only prespecified held-out-build evaluation is supported.");
 const {material,machine,processRevision,inspectedOutcomeDefinition,sourceReference}=input;
 if([material,machine,processRevision,inspectedOutcomeDefinition,sourceReference].some(s=>!s||!s.trim()))
  throw Error("Material, machine, revision, outcome definition and evidence source are required.");
 if(!Number.isFinite(input.decisionThreshold)||input.decisionThreshold<=0||input.decisionThreshold>=1)
  throw Error("Decision threshold must be strictly between zero and one.");
 if(!Array.isArray(input.cases)||input.cases.length===0||input.cases.length>50000)
  throw Error("Provide 1–50,000 inspected held-out cases.");
 let tp=0,fp=0,tn=0,fn=0,abstained=0,brier=0,positive=0;
 const ids=new Set<string>(),builds=new Set<string>();
 for(const c of input.cases){
  if(!c.id||!c.buildId||ids.has(c.id)||typeof c.actualDefect!=="boolean")
   throw Error("Each inspected case needs a unique ID, build ID and binary observed outcome.");
  ids.add(c.id);builds.add(c.buildId);if(c.actualDefect)positive++;
  const p=c.predictedProbability;
  if(p===null){abstained++;continue;}
  if(!Number.isFinite(p)||p<0||p>1)throw Error("Prediction must be in [0,1] or null for abstention.");
  brier+=(p-Number(c.actualDefect))**2;
  const predicted=p>=input.decisionThreshold;
  if(predicted&&c.actualDefect)tp++;
  else if(predicted)fp++;
  else if(c.actualDefect)fn++;
  else tn++;
 }
 const covered=input.cases.length-abstained;
 const recall=ratio(tp,tp+fn),specificity=ratio(tn,tn+fp);
 const warnings=[
  "This is an evaluation of supplied held-out labels and predictions, not evidence that the split, inspections, or model are independently trustworthy.",
  "Results apply only to the named machine, alloy, process revision and outcome definition; no aerospace qualification or general first-time-quality claim."
 ];
 if(builds.size<5)warnings.push("Fewer than five independent build IDs: evidence is insufficient for reliable between-build generalization.");
 if(!covered)warnings.push("All predictions abstained; predictive performance is not estimable.");
 if(positive===0||positive===input.cases.length)warnings.push("Only one observed outcome class is present; discrimination estimates are incomplete.");
 if(abstained)warnings.push("Reported confusion metrics exclude abstentions; inspect coverage alongside model performance.");
 return {version:DEFECT_VALIDATION_VERSION,status:"VALIDATION_ONLY_NOT_QUALIFIED",
  scope:{defect:input.defect,material,machine,processRevision,outcome:inspectedOutcomeDefinition,source:sourceReference},
  sampleSize:input.cases.length,distinctBuilds:builds.size,abstained,
  coverage:covered/input.cases.length,confusion:{tp,fp,tn,fn},
  precision:ratio(tp,tp+fp),recall,specificity,
  balancedAccuracy:recall===null||specificity===null?null:(recall+specificity)/2,
  brierScore:ratio(brier,covered),observedPrevalence:positive/input.cases.length,warnings};
}
