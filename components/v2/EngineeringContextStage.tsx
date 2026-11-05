"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {ArrowRight,BookOpen,CheckCircle2,FileText,FileUp,Info,ShieldCheck,Trash2} from "lucide-react";
import type {ProjectKnowledge,ProjectSource} from "@/lib/copilot-context";
import {
 suggestEngineeringEvidence,type ReviewedEvidence,type EvidenceCandidate
} from "@/lib/engineering-evidence";

type Props={
 knowledge:ProjectKnowledge|null;sources:ProjectSource[];reviewed:ReviewedEvidence[];
 unitsConfirmed:boolean;busy:boolean;notice:string;error:string;
 onAddDocuments:(files:FileList|File[]|null)=>Promise<void>;
 onFieldChange:(field:"componentName"|"assemblyContext"|"attachmentNotes"|"reviewedRequirements",value:string)=>void;
 onSourceNotes:(id:string,notes:string)=>void;onRemoveSource:(id:string)=>void;
 onReviewEvidence:(candidate:EvidenceCandidate,note:string)=>boolean;
 onContinue:()=>void;
};
const questions=[
 ["componentName","What is the part and what is its function?"],
 ["assemblyContext","Where does it fit in the surrounding assembly?"],
 ["attachmentNotes","Which interfaces carry loads or restrain movement?"],
 ["reviewedRequirements","What service, material and acceptance requirements apply?"]
] as const;

export default function EngineeringContextStage(props:Props){
 const {knowledge,sources,reviewed}=props;
 const [dropActive,setDropActive]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const [reviewReason,setReviewReason]=useState("");
 const candidates=useMemo(()=>suggestEngineeringEvidence(sources,24),[sources]);
 const pending=candidates.filter(c=>!reviewed.some(r=>r.key===c.key));
 const candidate=pending.find(c=>c.key===selected);
 const next=questions.find(([field])=>!knowledge?.[field]?.trim());
 return <section className="oaStageWorkspace oaContextWorkspace" aria-label="Engineering context workspace">
  <div className="oaStageIntro">
   <span className="oaStageEyebrow">STAGE 02 / ENGINEERING CONTEXT</span>
   <h1>Understand the part in its assembly</h1>
   <p>Provide the intended function, interfaces, and engineering references. Extracted passages are possible evidence, not confirmed design requirements.</p>
  </div>
  {!props.unitsConfirmed&&<div className="oaStageCaution"><Info size={18}/> STL dimensions have not been confirmed. Review units before using any geometric measurement in a requirement.</div>}
  <div className="oaContextGrid">
   <article className="oaProCard oaDocumentCard">
    <div className="oaProCardHeading"><div><FileText size={19}/><strong>Engineering documents</strong></div><span>{sources.length} / 12 attached</span></div>
    <label className={"oaDocumentDrop"+(dropActive?" is-dragging":"")}
     onDragOver={e=>{e.preventDefault();setDropActive(true);}}
     onDragLeave={e=>{e.preventDefault();setDropActive(false);}}
     onDrop={e=>{e.preventDefault();setDropActive(false);void props.onAddDocuments(e.dataTransfer.files);}}>
     <FileUp size={21}/>
     <strong>{props.busy?"Reading references…":"Upload assembly or requirements"}</strong>
     <small>Choose files or drag here · PDF, DOCX, XLSX, TXT</small>
     <input type="file" aria-label="Upload assembly documents" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.json,.log" multiple
      disabled={props.busy} onChange={e=>{void props.onAddDocuments(e.target.files);e.currentTarget.value="";}}/>
    </label>
    {sources.length===0?<p className="oaQuietCopy">No documents yet. Begin with an approved assembly drawing, requirements sheet, or a short engineering description.</p>:
    <div className="oaDocumentList">{sources.map(source=><details className="oaDocumentItem" key={source.id}>
     <summary><span className="oaDocumentId">{source.id}</span><span className="oaDocumentName"><strong title={source.name}>{source.name}</strong><small>{source.extraction==="not_extracted"?"Content not extracted · add page-numbered excerpts":source.extraction==="engineer_excerpt"?"Engineer-supplied excerpt":"Text extracted locally · unverified"}</small></span><span aria-hidden="true">⌄</span></summary>
     <div className="oaDocumentDetails">
      {source.extractedText&&<details><summary>View extracted text</summary><pre>{source.extractedText.slice(0,2500)}</pre></details>}
      <label>Document excerpts and reviewer notes
       <textarea value={source.engineerNotes} rows={3} maxLength={30000}
        onChange={e=>props.onSourceNotes(source.id,e.target.value)}
        placeholder={source.extraction==="not_extracted"?"For a PDF, paste the relevant passage and page reference, e.g. 'p. 4: ...'":"Record additional source details, including page or drawing identifiers."}/>
      </label>
      <button type="button" className="oaTextButton" onClick={()=>props.onRemoveSource(source.id)}><Trash2 size={14}/> Remove reference</button>
     </div>
    </details>)}</div>}
    {props.notice&&<p className="oaStageNotice" role="status">{props.notice}</p>}
    {props.error&&<p className="oaStudyError" role="alert">{props.error}</p>}
    <small className="oaDocumentSafety">Local text/DOCX/XLSX extraction only. PDFs and scanned drawings require manually checked excerpts or approved processing. Do not upload controlled Boeing data to this public prototype.</small>
   </article>
   <article className="oaProCard oaContextFacts">
    <div className="oaProCardHeading"><div><BookOpen size={19}/><strong>Part purpose and interfaces</strong></div><span>Engineer-provided</span></div>
    <div className="oaContextFields">
     <label>Component name or function
      <input aria-label="Component function" value={knowledge?.componentName??""} maxLength={160}
       onChange={e=>props.onFieldChange("componentName",e.target.value)} placeholder="e.g. Structural mounting lug"/>
     </label>
     <label>Assembly and connected components
      <textarea aria-label="Assembly relationships" rows={2} value={knowledge?.assemblyContext??""}
       onChange={e=>props.onFieldChange("assemblyContext",e.target.value)} placeholder="Where the part is installed and what attaches to it"/>
     </label>
     <label>Loading and fixture interfaces
      <textarea aria-label="Loading and fixture interfaces" rows={2} value={knowledge?.attachmentNotes??""}
       onChange={e=>props.onFieldChange("attachmentNotes",e.target.value)} placeholder="Documented load directions, bolted locations, and constraints"/>
     </label>
     <label>Materials, service conditions and acceptance requirements
      <textarea aria-label="Engineering requirements notes" rows={2} value={knowledge?.reviewedRequirements??""}
       onChange={e=>props.onFieldChange("reviewedRequirements",e.target.value)} placeholder="Only document-supported requirements; note what is unknown"/>
     </label>
    </div>
    <p className="oaQuietCopy">These notes describe engineering context. They do not automatically set numerical loads or material allowables.</p>
   </article>
  </div>
  <article className="oaProCard oaEvidenceCard">
   <div className="oaProCardHeading"><div><ShieldCheck size={19}/><strong>Evidence from references</strong></div><span>{reviewed.length} reviewed · {pending.length} suggested</span></div>
   {reviewed.length>0&&<div className="oaReviewedList">{reviewed.slice(0,4).map(e=>
    <div key={e.key}><CheckCircle2 size={15}/><span><strong>{e.category}</strong> · [{e.sourceId} {e.locator}] {e.excerpt.slice(0,140)}{e.excerpt.length>140?"…":""}</span></div>)}</div>}
   {!pending.length?<p className="oaQuietCopy">{sources.length?"No further machine-suggested passages. You can inspect the complete source review in advanced mode.":"Add reference text to see source-addressable candidate passages."}</p>:
   <div className="oaEvidenceCandidates">{pending.slice(0,4).map(c=><div key={c.key} className="oaEvidenceItem">
    <div><span className="oaEvidenceTag">{c.category}</span><small>[{c.sourceId} {c.locator}] {c.sourceName}{c.hasUncertainty?" · uncertain wording":""}</small></div>
    <p>{c.excerpt}</p>
    <button type="button" className="oaTextButton" onClick={()=>{setSelected(c.key===selected?null:c.key);setReviewReason("");}}>{selected===c.key?"Cancel review":"Review relevance"}</button>
    {candidate?.key===c.key&&<div className="oaEvidenceReview"><label>Why is this passage applicable to this part?
      <textarea aria-label="Evidence review rationale" rows={2} value={reviewReason} onChange={e=>setReviewReason(e.target.value)} placeholder="State relevance and any uncertainty. This does not authorize numerical inputs."/>
     </label><button type="button" disabled={reviewReason.trim().length<8} onClick={()=>{if(props.onReviewEvidence(c,reviewReason)){setSelected(null);setReviewReason("");}}}>Confirm passage relevance</button></div>}
   </div>)}</div>}
   <Link className="oaInlineLink" href="/copilot/advanced?stage=requirements">Review approved source-to-solver mappings <ArrowRight size={14}/></Link>
  </article>
  <article className="oaProCard oaNextQuestion">
   <div><span className="oaStageEyebrow">ENGINEERING GUIDANCE</span><h2>{next?"Next question":"Continue to assessment"}</h2>
    <p>{next?next[1]:"The documented context can now be reviewed alongside the actual available screens. Any unsupported print defect mechanisms will remain unassessed."}</p>
   </div>
   <button type="button" onClick={props.onContinue}>Review failure assessment <ArrowRight size={16}/></button>
  </article>
 </section>;
}
