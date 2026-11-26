import {DEFAULT_SETTINGS, type Analysis, type Settings} from './analysis-workspace';

/** Identity checks establish consistency, not correctness or physical validation. */
export async function sha256(bytes:ArrayBuffer):Promise<string>{
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
export function canonicalJSON(value:unknown):string{
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonicalJSON(v)).join(',')+'}';
 throw Error('Study inputs must contain finite, serializable values');
}
export function assertAnalysisIdentity(result:Analysis,settings:Settings,partHash:string,byteSize:number):void{
 if(!result||!result.runId?.trim()||!result.source||result.source.fileHashSha256?.toLowerCase()!==partHash.toLowerCase()||result.source.byteSize!==byteSize)
  throw Error('Saved analysis does not match the current STL bytes. Run the assessment again.');
 if(Object.keys(DEFAULT_SETTINGS).some(k=>result.configuration?.[k as keyof Settings]!==settings[k as keyof Settings]))
  throw Error('Saved results use a different manufacturing configuration. Run the assessment again.');
 if(!Array.isArray(result.candidates)||new Set(result.candidates.map(c=>c?.id)).size!==result.candidates.length||result.candidates.some(c=>!c?.id||!Number.isFinite(c.score)||![c.rotation?.x,c.rotation?.y,c.rotation?.z].every(Number.isFinite)))
  throw Error('Saved analysis contains incompatible orientation candidates.');
 for(const attached of [result.thermal,result.structural,...Object.values(result.structuralCases??{}),...Object.values(result.meshSensitivity??{})]){
  if(attached&&(attached.runId!==result.runId||!result.candidates.some(c=>c.id===attached.candidateId)))
   throw Error('Saved study contains a result from a different run or orientation. Run the assessment again.');
 }
}
export type StudyManifest={schema:1;scope:'RESEARCH_SCREENING_ONLY';partSha256:string;byteSize:number;inputSha256:string;runId:string|null;method:string|null;selectedCandidateId:string|null;selectedRotation:{x:number;y:number;z:number}|null;unitsConfirmed:boolean;process:string;resultState:'not-run'|'calculated-unvalidated';physicalValidation:'not-established'};
export async function createStudyManifest(input:{partHash:string;byteSize:number;settings:Settings;result:Analysis|null;selected:string|null;journey?:{process:string;confirmedFileName:string|null;confirmedUnitScale:number|null};fileName:string;servicePlan?:unknown}):Promise<StudyManifest>{
 const {partHash,byteSize,settings,result,selected,journey,fileName,servicePlan}=input;
 if(result)assertAnalysisIdentity(result,settings,partHash,byteSize);
 const candidate=result?.candidates.find(c=>c.id===selected);
 if(selected&&!candidate)throw Error('Selected orientation is not part of the saved analysis.');
 const process=journey?.process??'PBF_LB_METAL';
 if(result&&process!=='PBF_LB_METAL')throw Error('LPBF orientation results cannot be exported as a DED study.');
 const unitsConfirmed=journey?.confirmedFileName===fileName&&journey?.confirmedUnitScale===settings.unitScale;
 const identity={partHash:partHash.toLowerCase(),byteSize,settings,process,unitsConfirmed,selectedRotation:candidate?.rotation??null,servicePlan:servicePlan??null};
 return {schema:1,scope:'RESEARCH_SCREENING_ONLY',partSha256:partHash.toLowerCase(),byteSize,inputSha256:await sha256(new TextEncoder().encode(canonicalJSON(identity)).buffer),runId:result?.runId??null,method:result?.algorithm??null,selectedCandidateId:candidate?.id??null,selectedRotation:candidate?.rotation??null,unitsConfirmed,process,resultState:result?'calculated-unvalidated':'not-run',physicalValidation:'not-established'};
}
