/** Browser-side project references for the ORIENTAI engineering copilot.
 * Source text is only extracted for plain-text formats. Unsupported PDFs and Word files
 * are metadata until the engineer supplies an excerpt or authorizes external processing.
 */
import {extractLocalDocument} from "./document-extraction";
import {restoreReviewedEvidence,type ReviewedEvidence} from "./engineering-evidence";
import {restoreParameterBindings,type ApprovedParameterBinding} from "./engineering-parameter-binding";
export type SourceKind="text"|"pdf"|"document";
export type ProjectSource={
 id:string;name:string;kind:SourceKind;size:number;
 extractedText:string;engineerNotes:string;
 extraction:"local_text"|"local_document"|"engineer_excerpt"|"not_extracted";
 addedAt:string;
};
export type CopilotMessage={
 id:string;role:"user"|"assistant";text:string;createdAt:string;
 sourceIds:string[];origin:"user"|"local_guide"|"model";
};
export type ProjectKnowledge={
 schema:1;partKey:string;componentName:string;assemblyContext:string;
 attachmentNotes:string;reviewedRequirements:string;
 sources:ProjectSource[];messages:CopilotMessage[];reviewedEvidence:ReviewedEvidence[];parameterBindings:ApprovedParameterBinding[];
};
export const MAX_SOURCES=12, MAX_SOURCE_BYTES=3*1024*1024,MAX_SOURCE_CHARS=30000;
const localExtensions=new Set(["txt","md","csv","json","log"]);
export function blankKnowledge(partKey:string):ProjectKnowledge{
 return {schema:1,partKey,componentName:"",assemblyContext:"",attachmentNotes:"",reviewedRequirements:"",sources:[],messages:[],reviewedEvidence:[],parameterBindings:[]};
}
export function extension(name:string){return name.toLowerCase().split(".").pop()??"";}
export function validateSource(file:{name:string;size:number}){
 const ext=extension(file.name);
 if(!["txt","md","csv","json","log","pdf","doc","docx","xlsx","xls"].includes(ext))
  throw Error("Use PDF, DOCX, XLSX, TXT, MD, CSV or JSON references.");
 if(file.size<=0||file.size>MAX_SOURCE_BYTES)
  throw Error("Each reference file must be nonempty and 3 MB or smaller.");
 if(file.name.length>160||/[/\\]/.test(file.name))throw Error("Invalid document filename.");
 return ext;
}
export async function addProjectSource(sources:ProjectSource[],file:File):Promise<ProjectSource[]>{
 if(sources.length>=MAX_SOURCES)throw Error("This project supports up to 12 reference documents.");
 const ext=validateSource(file);
 if(sources.some(x=>x.name===file.name&&x.size===file.size))
  throw Error("This file is already in the project. Remove it before replacing.");
 const isText=localExtensions.has(ext);
 const isOffice=ext==="docx"||ext==="xlsx";
 const text=(isText?(await file.text()).replace(/\u0000/g,""):isOffice?await extractLocalDocument(file):"").slice(0,MAX_SOURCE_CHARS);
 const id="D"+String(1+Math.max(0,...sources.map(s=>Number(s.id.replace(/^D/,""))||0)));
 const created:ProjectSource={
   id,name:file.name,kind:ext==="pdf"?"pdf":isText?"text":"document",
   size:file.size,extractedText:text,engineerNotes:"",
   extraction:isText?"local_text":isOffice?"local_document":"not_extracted",addedAt:new Date().toISOString()
 };
 return [...sources,created];
}
export function updateSourceNotes(sources:ProjectSource[],id:string,notes:string):ProjectSource[]{
 return sources.map(s=>s.id===id?{...s,engineerNotes:notes.slice(0,MAX_SOURCE_CHARS),
   extraction:s.extractedText?(s.kind==="document"?"local_document":"local_text"):notes.trim()?"engineer_excerpt":"not_extracted"}:s);
}
const words=(text:string)=>new Set((text.toLowerCase().match(/[a-z0-9]{4,}/g)??[]).filter(w=>!["this","that","with","from","about","have","there","which","would","your","will","part","file","what","where","when"].includes(w)));
export type EvidenceHit={sourceId:string;fileName:string;line:string;excerpt:string;origin:"source_text"|"engineer_excerpt";score:number};
export function findEvidence(sources:ProjectSource[],question:string,limit=5):EvidenceHit[]{
 const terms=words(question);
 const hits:EvidenceHit[]=[];
 for(const s of sources){
  const chunks=[
   ...(s.extractedText?chunkLines(s.extractedText,4,"source_text"):[]),
   ...(s.engineerNotes?chunkLines(s.engineerNotes,4,"engineer_excerpt"):[])
  ];
  for(const c of chunks){
   const ct=words(c.excerpt);
   const overlap=[...terms].filter(w=>ct.has(w)).length;
   const score=overlap*5+(terms.size===0?1:0);
   if(overlap>0||terms.size===0)hits.push({sourceId:s.id,fileName:s.name,line:c.line,excerpt:c.excerpt,origin:c.origin,score});
  }
 }
 return hits.sort((a,b)=>b.score-a.score||a.sourceId.localeCompare(b.sourceId)).slice(0,limit);
}
function chunkLines(text:string,width:number,origin:"source_text"|"engineer_excerpt"){
 const lines=text.split(/\r?\n/);
 const result:{line:string;excerpt:string;origin:"source_text"|"engineer_excerpt"}[]=[];
 for(let i=0;i<lines.length;i+=width){
  const excerpt=lines.slice(i,i+width).join(" ").trim().slice(0,900);
  if(excerpt)result.push({line:"L"+(i+1)+"–"+Math.min(i+width,lines.length),excerpt,origin});
 }
 return result;
}
export function nextEngineeringQuestion(state:ProjectKnowledge,opts:{
 partName:string|null;confirmed:boolean;hasOrientation:boolean;loadsReviewed:boolean;process:string;
}):string{
 if(!opts.partName)return "Upload the target part STL first, or open an explicit DED teaching example. Then attach any available assembly documents.";
 if(!opts.confirmed)return "Please confirm the STL units and geometry before interpreting dimensions or running analyses.";
 if(!state.componentName.trim())return "What does this part do in the larger assembly? Identify its role or part number; I will not infer one from the STL filename.";
 if(!state.assemblyContext.trim())return "Which larger assembly does it belong to, and which surrounding components connect to it? You can attach references or describe the interfaces.";
 if(!state.attachmentNotes.trim())return "Which locations are actually fixed or joined, and where are service forces applied? We need verified boundary conditions before structural results are meaningful.";
 if(!state.reviewedRequirements.trim()||!opts.loadsReviewed)return "Which load magnitudes, directions, critical tolerances and material allowables have been confirmed by an engineer? Enter the verified load case in Requirements.";
 if(opts.process!=="PBF_LB_METAL")return "The uploaded STL is set to DED. Arbitrary-part DED pathing and physical simulation are unavailable; use the separate teaching model or choose LPBF for supported screening.";
 if(!opts.hasOrientation&&opts.process==="PBF_LB_METAL")return "The project is ready for LPBF geometric orientation screening. Would you like to run the supported local orientation solver?";
 return "The current supported analyses are ready to review. Do you want to compare orientations, run the reviewed service-load model, or prepare an engineering evidence report?";
}
export function localCopilotReply(state:ProjectKnowledge,question:string,opts:{
 partName:string|null;confirmed:boolean;hasOrientation:boolean;loadsReviewed:boolean;process:string;
}):{text:string;sourceIds:string[]}{
 const matches=findEvidence(state.sources,question,3);
 const sources=matches.length?("\n\nRelevant excerpts (not independently verified):\n"+matches.map(h=>"["+h.sourceId+" "+h.line+"] "+h.excerpt).join("\n")):"";
 const next=nextEngineeringQuestion(state,opts);
 const text=question.trim().length?
  "I can organize the references and show supported engineering calculations. I will not infer loads, connections, properties, or quality from a filename. "+(sources?"I found the following possible evidence. Confirm applicability before using it.":"No matching extracted passage was found. PDFs or scanned drawings need an engineer-supplied excerpt or explicitly authorized processing; DOCX and XLSX text can be extracted locally.")+sources+"\n\nNext question: "+next:
  next;
 return {text,sourceIds:matches.map(h=>h.sourceId)};
}
export function restoreKnowledge(value:unknown,partKey:string):ProjectKnowledge{
 const fallback=blankKnowledge(partKey);
 if(!value||typeof value!=="object")return fallback;
 const v=value as Partial<ProjectKnowledge>;
 if(v.schema!==1||v.partKey!==partKey||!Array.isArray(v.sources)||!Array.isArray(v.messages))return fallback;
 return {...fallback,componentName:typeof v.componentName==="string"?v.componentName.slice(0,160):"",
  assemblyContext:typeof v.assemblyContext==="string"?v.assemblyContext.slice(0,4000):"",
  attachmentNotes:typeof v.attachmentNotes==="string"?v.attachmentNotes.slice(0,4000):"",
  reviewedRequirements:typeof v.reviewedRequirements==="string"?v.reviewedRequirements.slice(0,4000):"",
  sources:v.sources.filter(s=>s&&typeof s.id==="string"&&typeof s.name==="string"&&typeof s.extractedText==="string"&&typeof s.engineerNotes==="string"&&["text","pdf","document"].includes(s.kind)).slice(0,MAX_SOURCES).map(s=>({
   ...s,extractedText:s.extractedText.slice(0,MAX_SOURCE_CHARS),
   engineerNotes:s.engineerNotes.slice(0,MAX_SOURCE_CHARS)
  })),
  reviewedEvidence:restoreReviewedEvidence(v.reviewedEvidence),
  parameterBindings:restoreParameterBindings(v.parameterBindings),
  messages:v.messages.filter(m=>m&&typeof m.text==="string"&&(m.role==="assistant"||m.role==="user")).slice(-45).map(m=>({...m,text:m.text.slice(0,5000),sourceIds:Array.isArray(m.sourceIds)?m.sourceIds.filter(x=>typeof x==="string"):[]}))
 };
}
export function createMessage(role:CopilotMessage["role"],text:string,origin:CopilotMessage["origin"],sourceIds:string[]=[]):CopilotMessage{
 return {id:globalThis.crypto?.randomUUID?.()??("m"+Date.now()),role,text:text.slice(0,5000),createdAt:new Date().toISOString(),origin,sourceIds};
}
