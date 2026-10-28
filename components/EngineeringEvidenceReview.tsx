"use client";
import {useMemo,useState} from "react";
import {
 acceptEngineeringEvidence,currentReviewedEvidence,evidenceIsCurrent,suggestEngineeringEvidence,
 MAX_REVIEWED_EVIDENCE,type EvidenceCandidate,type ReviewedEvidence
} from "@/lib/engineering-evidence";
import type {ProjectSource} from "@/lib/copilot-context";

export default function EngineeringEvidenceReview({sources,reviewed,onAccept,onRemove}:{
 sources:ProjectSource[];reviewed:ReviewedEvidence[];
 onAccept:(item:ReviewedEvidence)=>void;onRemove:(key:string)=>void;
}){
 const [selected,setSelected]=useState<EvidenceCandidate|null>(null);
 const [note,setNote]=useState("");
 const [error,setError]=useState("");
 const [showAll,setShowAll]=useState(false);
 const candidates=useMemo(()=>suggestEngineeringEvidence(sources,60),[sources]);
 const current=useMemo(()=>currentReviewedEvidence(reviewed,sources),[reviewed,sources]);
 const remaining=candidates.filter(x=>!reviewed.some(a=>a.key===x.key));
 const pending=showAll?remaining:remaining.slice(0,6);
 const commit=()=>{
  if(!selected)return;
  try{
   const accepted=acceptEngineeringEvidence(selected,note);
   onAccept(accepted);setSelected(null);setNote("");setError("");
  }catch(e){setError(e instanceof Error?e.message:"Could not record engineer review.");}
 };
 return <div className="copilotEvidenceReview" data-testid="evidence-review">
  <div className="evidenceReviewHeading">
   <div><h3>Document-to-requirements review</h3><p>Candidate source passages, not interpreted engineering requirements. Confirm relevance and validity before using them.</p></div>
   <span className="evidenceCount">{current.length} reviewed · {remaining.length} suggested</span>
  </div>
  {reviewed.length>0&&<div className="evidenceReviewed" aria-label="Reviewed engineering evidence">
   <h4>Engineer-reviewed references</h4>
   {reviewed.map(item=>{
    const valid=evidenceIsCurrent(item,sources);
    return <div className={"evidenceItem "+(valid?"":"evidenceStale")} key={item.key}>
      <div className="evidenceItemTop"><strong>[{item.sourceId} {item.locator}] · {item.category}</strong><span>{valid?"Current source":"Stale or removed source"}</span></div>
      <p>{item.excerpt}</p>
      <small>Review: {item.reviewerNote} · {item.origin==="engineer_note"?"Engineer-entered note":"Locally extracted text"}</small>
      {!valid&&<p className="evidenceWarning">Source changed or was removed. This citation is excluded from new study snapshots; re-review the current passage.</p>}
      <button type="button" className="copilotSmall" onClick={()=>onRemove(item.key)}>Remove review</button>
    </div>;
   })}
  </div>}
  {!sources.length?<p className="evidenceEmpty">Attach a TXT, DOCX, XLSX or CSV reference to see suggested evidence. PDFs currently need an engineer-entered excerpt.</p>:
   !remaining.length?<p className="evidenceEmpty">No additional matching source passages. You can still enter other requirements manually after reviewing the source material.</p>:
   <div className="evidenceSuggested">
    <h4>Potentially relevant excerpts</h4>
    {pending.map(item=><div className="evidenceItem" key={item.key}>
      <div className="evidenceItemTop"><strong>[{item.sourceId} {item.locator}] · {item.category}</strong><span>{item.sourceName}</span></div>
      <p>{item.excerpt}</p>
      {item.hasUncertainty&&<p className="evidenceWarning">Contains uncertainty language. Do not treat this passage as a confirmed design load or acceptance criterion.</p>}
      {selected?.key===item.key?<div className="evidenceReviewForm">
       <label>Why does this passage apply to the selected STL?
        <textarea rows={3} aria-label={"Review rationale "+item.key} value={note} onChange={e=>setNote(e.target.value)}
         placeholder="e.g. Applies to frame F-04; magnitude remains unverified and is not approved as a solver input."/>
       </label>
       <p>Accepting links this text to the study. It does not set loads, fixtures or material properties, and it does not satisfy the separate numerical-input approval.</p>
       {error&&<p role="alert" className="evidenceWarning">{error}</p>}
       <div className="evidenceActions"><button type="button" disabled={reviewed.length>=MAX_REVIEWED_EVIDENCE} onClick={commit}>Record reviewed reference</button>
        <button type="button" className="copilotSmall" onClick={()=>{setSelected(null);setNote("");setError("");}}>Cancel</button></div>
      </div>:
       <button type="button" className="copilotSmall" onClick={()=>{setSelected(item);setNote("");setError("");}}>Review relevance</button>}
    </div>)}
    {remaining.length>6&&<button type="button" className="copilotSmall" onClick={()=>setShowAll(v=>!v)}>
     {showAll?"Show fewer":"Review all "+remaining.length+" suggested passages"}</button>}
   </div>}
 </div>;
}
