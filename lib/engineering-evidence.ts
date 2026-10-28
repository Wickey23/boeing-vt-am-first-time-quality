/** Local evidence review for assembly-aware ORIENTAI studies.
 * Finding a keyword is NOT proof of the physical requirement or its applicability.
 * No document values are transferred to FEM inputs by this module.
 */
import type {ProjectSource} from "./copilot-context";

export type EvidenceCategory="assembly"|"fixture"|"load"|"material"|"tolerance"|"inspection";
export type EvidenceOrigin="extracted_text"|"engineer_note";
export type EvidenceCandidate={
 key:string;sourceId:string;sourceName:string;sourceRevision:string;locator:string;
 excerpt:string;category:EvidenceCategory;origin:EvidenceOrigin;hasUncertainty:boolean;
};
export type ReviewedEvidence=EvidenceCandidate&{
 reviewedAt:string;reviewerNote:string;
};
export const MAX_REVIEWED_EVIDENCE=30;
export function sourceRevision(source:ProjectSource):string{
 // Stable change detector, not a cryptographic or authenticity guarantee.
 const content=source.name+"\u0000"+source.extractedText+"\u0000"+source.engineerNotes;
 let h=2166136261;
 for(let i=0;i<content.length;i++){h=Math.imul(h^content.charCodeAt(i),16777619);}
 return (h>>>0).toString(16).padStart(8,"0");
}
const categories:[EvidenceCategory,RegExp][]=[
 ["load",/\b(load(?:ing)?|force|tension|compression|torque|bending|pressure|stress|strain|[f][xyz]\s*[=:]|newtons?|kilonewtons?)\b/i],
 ["fixture",/\b(fixed|clamp|mount(?:s|ing|ed)?|bolt(?:ed|ing)?|weld(?:ed|ing)?|attach(?:ed|es|ment)?|joint|boundary condition|fixture|support point|constraint)\b/i],
 ["material",/\b(material|alloy|titanium|aluminum|steel|inconel|ti[- ]?6al|young.s modulus|poisson|elastic modulus|yield strength|conductivity)\b/i],
 ["tolerance",/\b(tolerance|diameter|clearance|dimensional|surface finish|flatness|roughness|critical dimension|mm\b|microns?)\b/i],
 ["inspection",/\b(inspection|non[- ]destructive|ct scan|ultrasonic|x[- ]?ray|acceptance|defect|porosity|fatigue life)\b/i],
 ["assembly",/\b(assembly|fuselage|bulkhead|rib|frame|stringer|station|interfac(?:e|es)|adjacent|subassembly)\b/i]
];
const uncertain=/\b(unverified|unconfirmed|unknown|approx(?:imate(?:ly)?)?|estimated|assumed|pending|proposed|candidate|draft|not verified|not confirmed|tbd)\b/i;
function toCategory(value:string):EvidenceCategory|null{
 for(const [category,rule] of categories)if(rule.test(value))return category;
 return null;
}
function collect(source:ProjectSource,content:string,origin:EvidenceOrigin,revision:string){
 const entries:EvidenceCandidate[]=[];
 const lines=content.replace(/\r/g,"").split("\n");
 for(let i=0;i<lines.length&&entries.length<100;i++){
  let excerpt=lines[i].trim();
  if(excerpt.length<9)continue;
  const category=toCategory(excerpt);if(!category)continue;
  let locator="L"+(i+1);
  if(origin==="engineer_note")locator="Engineer note L"+(i+1);
  else{
   const p=excerpt.match(/^P(\d+):\s*/);
   const row=excerpt.match(/^Row\s+(\d+):\s*/i);
   if(p)locator="P"+p[1];
   else if(row)locator="Row "+row[1];
  }
  excerpt=excerpt.slice(0,500);
  const key=source.id+":"+origin+":"+locator+":"+revision;
  entries.push({key,sourceId:source.id,sourceName:source.name,sourceRevision:revision,
   locator,excerpt,category,origin,hasUncertainty:uncertain.test(excerpt)});
 }
 return entries;
}
export function suggestEngineeringEvidence(sources:ProjectSource[],limit=24):EvidenceCandidate[]{
 const candidates:EvidenceCandidate[]=[];
 for(const source of sources){
  const revision=sourceRevision(source);
  if(source.extractedText)candidates.push(...collect(source,source.extractedText,"extracted_text",revision));
  if(source.engineerNotes)candidates.push(...collect(source,source.engineerNotes,"engineer_note",revision));
 }
 return candidates.slice(0,Math.max(0,Math.min(60,limit)));
}
export function acceptEngineeringEvidence(candidate:EvidenceCandidate,reviewerNote:string,now?:string):ReviewedEvidence{
 const note=reviewerNote.trim();
 if(note.length<8)throw Error("Add a short engineer review note explaining applicability or uncertainty.");
 if(!candidate.sourceId||!candidate.sourceRevision||!candidate.excerpt)throw Error("Invalid source evidence.");
 return {...candidate,reviewerNote:note.slice(0,700),reviewedAt:now??new Date().toISOString()};
}
export function evidenceIsCurrent(item:ReviewedEvidence,sources:ProjectSource[]):boolean{
 const source=sources.find(s=>s.id===item.sourceId&&s.name===item.sourceName);
 return Boolean(source&&sourceRevision(source)===item.sourceRevision);
}
export function currentReviewedEvidence(evidence:ReviewedEvidence[],sources:ProjectSource[]):ReviewedEvidence[]{
 return evidence.filter(item=>evidenceIsCurrent(item,sources));
}
export function restoreReviewedEvidence(raw:unknown):ReviewedEvidence[]{
 if(!Array.isArray(raw))return [];
 const unique=new Set<string>();
 return raw.filter((v:unknown):v is ReviewedEvidence=>{
  if(!v||typeof v!=="object")return false;
  const r=v as Partial<ReviewedEvidence>;
  if(typeof r.key!=="string"||r.key.length>300||unique.has(r.key)||
   typeof r.sourceId!=="string"||typeof r.sourceName!=="string"||
   typeof r.sourceRevision!=="string"||typeof r.locator!=="string"||
   typeof r.excerpt!=="string"||typeof r.reviewerNote!=="string"||typeof r.reviewedAt!=="string"||
   r.excerpt.length>500||r.reviewerNote.length>700||
   !["extracted_text","engineer_note"].includes(r.origin??"")||
   !categories.some(([category])=>category===r.category))return false;
  unique.add(r.key);return true;
 }).slice(0,MAX_REVIEWED_EVIDENCE);
}
