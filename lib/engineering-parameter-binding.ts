/** Source-backed numeric candidates for original-part service studies.
 * Reading a value is not approval; directions, fixtures and material applicability
 * remain human responsibilities. This does NOT read actual CAD attachment faces.
 */
import type {ReviewedEvidence} from "./engineering-evidence";
import {evidenceIsCurrent} from "./engineering-evidence";
import type {ProjectSource} from "./copilot-context";
import type {ServiceCase} from "./service-plan";
import type {ServiceSetup} from "./service-load";
export type ParameterTarget="forceXN"|"forceYN"|"forceZN"|"youngModulusMPa"|"poissonRatio";
export type ParameterCandidate={
 key:string;evidenceKey:string;sourceId:string;sourceName:string;sourceRevision:string;locator:string;
 excerpt:string;targetKind:"force"|"elastic"|"ratio";
 rawNumber:number;rawUnit:string;normalizedMagnitude:number;normalizedUnit:string;
 suggestedTarget:ParameterTarget|null;uncertain:boolean;rawQuantity:string;
};
export type ApprovedParameterBinding={
 id:string;serviceCaseId:string;evidenceKey:string;sourceId:string;sourceName:string;
 sourceRevision:string;locator:string;target:ParameterTarget;value:number;
 normalizedUnit:string;rawQuantity:string;reviewNote:string;approvedAt:string;
 independentlyVerified:boolean;
};
const num="[+-]?(?:\\d+(?:,\\d{3})*(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?";
const uncertain=/\b(unverified|unconfirmed|unknown|assumed|approx(?:imately)?|estimat(?:ed|e)|pending|propos(?:ed|al)|candidate|draft|not verified|not confirmed|tbd)\b/i;
const forceContext=/\b(force|load|loading|axial|tension|compression|shear|Fx\b|Fy\b|Fz\b)\b/i;
const isForce=(v:number)=>Number.isFinite(v)&&Math.abs(v)<=1e8;
export function proposeNumericalParameters(evidence:ReviewedEvidence[],sources:ProjectSource[],limit=35):ParameterCandidate[]{
 const out:ParameterCandidate[]=[];
 for(const item of evidence){
  if(!evidenceIsCurrent(item,sources))continue;
  const line=item.excerpt,flag=item.hasUncertainty||uncertain.test(line);
  if(item.category==="load"&&forceContext.test(line)&&!/\b(torque|moment)\b/i.test(line)){
   const regex=new RegExp("("+num+")\\s*(kN|N)\\b","gi");
   for(const match of line.matchAll(regex)){
    const v=Number(match[1].replace(/,/g,""));
    const magnitude=v*(match[2].toLowerCase()==="kn"?1000:1);
    if(!isForce(magnitude))continue;
    const before=line.slice(0,match.index??0);
    const axis=before.match(/(?:\bF([XYZ])\s*[:=]\s*|\bforce\s*([XYZ])\s*[:=]?\s*)$/i);
    const target=axis?("force"+(axis[1]??axis[2]).toUpperCase()+"N") as ParameterTarget:null;
    out.push({key:item.key+":force:"+(match.index??0),evidenceKey:item.key,sourceId:item.sourceId,sourceName:item.sourceName,
     sourceRevision:item.sourceRevision,locator:item.locator,excerpt:line,targetKind:"force",
     rawNumber:v,rawUnit:match[2],normalizedMagnitude:magnitude,normalizedUnit:"N",
     suggestedTarget:target,uncertain:flag,rawQuantity:match[0]});
   }
  }
  if(item.category==="material"){
   const elastic=new RegExp("(?:young[’']?s\\s+modulus|elastic\\s+modulus|\\bE\\s*=)\\s*[:=]?\\s*("+num+")\\s*(GPa|MPa)\\b","i").exec(line);
   if(elastic){
    const raw=Number(elastic[1].replace(/,/g,""));
    const value=raw*(elastic[2].toLowerCase()==="gpa"?1000:1);
    if(Number.isFinite(value)&&value>0&&value<=1e7)
     out.push({key:item.key+":elastic",evidenceKey:item.key,sourceId:item.sourceId,sourceName:item.sourceName,
      sourceRevision:item.sourceRevision,locator:item.locator,excerpt:line,targetKind:"elastic",
      rawNumber:raw,rawUnit:elastic[2],normalizedMagnitude:value,normalizedUnit:"MPa",
      suggestedTarget:"youngModulusMPa",uncertain:flag,rawQuantity:elastic[0]});
   }
   const ratio=new RegExp("(?:poisson(?:'s)?\\s+(?:ratio|coefficient)|\\bnu\\s*=)\\s*[:=]?\\s*("+num+")\\b","i").exec(line);
   if(ratio){
    const value=Number(ratio[1].replace(/,/g,""));
    if(Number.isFinite(value)&&value>-1&&value<.49)
     out.push({key:item.key+":poisson",evidenceKey:item.key,sourceId:item.sourceId,sourceName:item.sourceName,
      sourceRevision:item.sourceRevision,locator:item.locator,excerpt:line,targetKind:"ratio",
      rawNumber:value,rawUnit:"ratio",normalizedMagnitude:value,normalizedUnit:"dimensionless",
      suggestedTarget:"poissonRatio",uncertain:flag,rawQuantity:ratio[0]});
   }
  }
 }
 return out.slice(0,Math.max(0,Math.min(limit,60)));
}
const targets:ParameterTarget[]=["forceXN","forceYN","forceZN","youngModulusMPa","poissonRatio"];
export function approveParameterBinding(input:{
 candidate:ParameterCandidate;target:ParameterTarget;direction?:1|-1;
 serviceCase:ServiceCase;reviewedEvidence:ReviewedEvidence[];sources:ProjectSource[];
 rationale:string;independentlyVerified:boolean;at?:string;
}):{binding:ApprovedParameterBinding;setup:ServiceSetup}{
 const {candidate,target,serviceCase,reviewedEvidence,sources}=input;
 const source=reviewedEvidence.find(x=>x.key===candidate.evidenceKey);
 if(!source||!evidenceIsCurrent(source,sources)||source.sourceId!==candidate.sourceId||
  source.sourceRevision!==candidate.sourceRevision||!proposeNumericalParameters([source],sources).some(x=>x.key===candidate.key&&x.normalizedMagnitude===candidate.normalizedMagnitude))
  throw Error("The reviewed source changed or the numerical candidate is not current.");
 if(!targets.includes(target))throw Error("Unsupported numerical parameter.");
 if(candidate.targetKind==="force"&&!["forceXN","forceYN","forceZN"].includes(target)||
  candidate.targetKind==="elastic"&&target!=="youngModulusMPa"||
  candidate.targetKind==="ratio"&&target!=="poissonRatio")throw Error("Parameter target does not match extracted units.");
 const reason=input.rationale.trim();
 if(reason.length<15)throw Error("Explain the actual load direction, applicability and independent verification in at least 15 characters.");
 if(!input.independentlyVerified)throw Error("Engineer confirmation of the magnitude, units, direction and applicability is required.");
 const value=candidate.targetKind==="force"?
   Math.abs(candidate.normalizedMagnitude)*(input.direction===-1?-1:input.direction===1?1:NaN):
   candidate.normalizedMagnitude;
 if(!Number.isFinite(value)||candidate.targetKind==="force"&&!isForce(value)||
  target==="youngModulusMPa"&&(value<=0||value>1e7)||
  target==="poissonRatio"&&(value<=-1||value>=.49))
  throw Error("Invalid numerical magnitude or missing signed force direction.");
 const setup:ServiceSetup={...serviceCase.input,[target]:value};
 const binding:ApprovedParameterBinding={
  id:candidate.key+":"+serviceCase.id+":"+target,evidenceKey:candidate.evidenceKey,sourceId:candidate.sourceId,
  sourceName:candidate.sourceName,sourceRevision:candidate.sourceRevision,locator:candidate.locator,
  serviceCaseId:serviceCase.id,target,value,normalizedUnit:candidate.normalizedUnit,
  rawQuantity:candidate.rawQuantity,reviewNote:reason.slice(0,700),
  approvedAt:input.at??new Date().toISOString(),independentlyVerified:true
 };
 return {binding,setup};
}
export function activeParameterBindings(bindings:ApprovedParameterBinding[],sources:ProjectSource[],reviewed:ReviewedEvidence[],serviceCase:ServiceCase){
 return bindings.filter(binding=>{
  const evidence=reviewed.find(x=>x.key===binding.evidenceKey);
  const source=sources.find(x=>x.id===binding.sourceId&&x.name===binding.sourceName);
  return !!evidence&&!!source&&evidenceIsCurrent(evidence,sources)&&
   binding.sourceRevision===evidence.sourceRevision&&binding.serviceCaseId===serviceCase.id&&
   Object.is(serviceCase.input[binding.target],binding.value)&&binding.independentlyVerified;
 });
}
export function restoreParameterBindings(raw:unknown):ApprovedParameterBinding[]{
 if(!Array.isArray(raw))return [];
 const ids=new Set<string>();
 return raw.filter((v:unknown):v is ApprovedParameterBinding=>{
  if(!v||typeof v!=="object")return false;
  const o=v as Partial<ApprovedParameterBinding>;
  if(typeof o.id!=="string"||o.id.length>500||ids.has(o.id)||typeof o.evidenceKey!=="string"||
   typeof o.sourceId!=="string"||typeof o.sourceName!=="string"||typeof o.sourceRevision!=="string"||
   typeof o.locator!=="string"||!targets.includes(o.target as ParameterTarget)||
   !Number.isFinite(o.value)||typeof o.rawQuantity!=="string"||
   typeof o.reviewNote!=="string"||o.reviewNote.length<15||
   typeof o.serviceCaseId!=="string"||typeof o.approvedAt!=="string"||o.independentlyVerified!==true||
   !["N","MPa","dimensionless"].includes(o.normalizedUnit??""))return false;
  ids.add(o.id);return true;
 }).slice(0,40);
}
