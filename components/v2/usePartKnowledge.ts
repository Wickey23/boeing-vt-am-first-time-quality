"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {
 addProjectSource,blankKnowledge,restoreKnowledge,updateSourceNotes,
 type ProjectKnowledge,type ProjectSource
} from "@/lib/copilot-context";
import {
 acceptEngineeringEvidence,currentReviewedEvidence,evidenceIsCurrent,
 MAX_REVIEWED_EVIDENCE,type EvidenceCandidate
} from "@/lib/engineering-evidence";

const STORAGE_PREFIX="orientai-engineering-context-v1-";

/** One part-scoped, browser-local source of truth shared with the existing advanced copilot.
 * Text/reference records only: original PDFs and STL bytes are not copied into localStorage.
 */
export function usePartKnowledge(partHash:string|null){
 const [knowledge,setKnowledge]=useState<ProjectKnowledge|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const activeHash=useRef(partHash);
 activeHash.current=partHash;
 useEffect(()=>{
  setNotice("");setError("");setKnowledge(null);
  if(!partHash)return;
  try{
   const saved=localStorage.getItem(STORAGE_PREFIX+partHash);
   setKnowledge(saved?restoreKnowledge(JSON.parse(saved),partHash):blankKnowledge(partHash));
  }catch{setKnowledge(blankKnowledge(partHash));}
 },[partHash]);
 useEffect(()=>{
  if(!partHash||!knowledge||knowledge.partKey!==partHash)return;
  try{
   localStorage.setItem(STORAGE_PREFIX+partHash,JSON.stringify({
    ...knowledge,sources:knowledge.sources.map(s=>({...s,extractedText:s.extractedText.slice(0,30000)}))
   }));
  }catch{setError("Browser storage is full. Export your project context and remove unused references.");}
 },[partHash,knowledge]);
 const sources=knowledge?.sources??[];
 const reviewed=useMemo(()=>currentReviewedEvidence(knowledge?.reviewedEvidence??[],sources),[knowledge?.reviewedEvidence,sources]);
 const addDocuments=async(files:FileList|File[]|null)=>{
  if(!files||!partHash||busy)return;
  const selected=Array.from(files);
  if(!selected.length)return;
  setBusy(true);setError("");setNotice("");
  try{
   const stored=localStorage.getItem(STORAGE_PREFIX+partHash);
   let next=stored?restoreKnowledge(JSON.parse(stored),partHash):blankKnowledge(partHash);
   for(const file of selected)next={...next,sources:await addProjectSource(next.sources,file)};
   if(activeHash.current!==partHash)return;
   localStorage.setItem(STORAGE_PREFIX+partHash,JSON.stringify(next));
   setKnowledge(next);
   setNotice(next.sources.some(s=>s.extraction==="not_extracted")?
    "References saved locally. PDFs and legacy documents have not been read: enter page-numbered excerpts for review.":
    "Supported document text was extracted locally. Review each relevant requirement before using it.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to add documents.");}
  finally{setBusy(false);}
 };
 const updateField=(field:"componentName"|"assemblyContext"|"attachmentNotes"|"reviewedRequirements",value:string)=>{
  setKnowledge(k=>k?{...k,[field]:value.slice(0,field==="componentName"?160:4000)}:k);
 };
 const updateNotes=(sourceId:string,notes:string)=>{
  setKnowledge(k=>k?{...k,sources:updateSourceNotes(k.sources,sourceId,notes)}:k);
 };
 const removeSource=(sourceId:string)=>{
  setKnowledge(k=>k?{...k,sources:k.sources.filter(s=>s.id!==sourceId)}:k);
 };
 const reviewEvidence=(candidate:EvidenceCandidate,reason:string)=>{
  if(!knowledge||!evidenceIsCurrent({...candidate,reviewedAt:"",reviewerNote:""},knowledge.sources))return false;
  try{
   const reviewedItem=acceptEngineeringEvidence(candidate,reason);
   setKnowledge(k=>{
    if(!k||k.reviewedEvidence.length>=MAX_REVIEWED_EVIDENCE||
     k.reviewedEvidence.some(e=>e.key===candidate.key))return k;
    return {...k,reviewedEvidence:[...k.reviewedEvidence,reviewedItem]};
   });
   setNotice("Passage marked reviewed for relevance only. Numerical loads and solver inputs still need separate approval.");
   setError("");
   return true;
  }catch(e){setError(e instanceof Error?e.message:"Unable to review the passage.");return false;}
 };
 const removeReview=(key:string)=>setKnowledge(k=>k?{...k,reviewedEvidence:k.reviewedEvidence.filter(e=>e.key!==key)}:k);
 return {knowledge,sources,reviewed,busy,notice,error,addDocuments,updateField,updateNotes,removeSource,reviewEvidence,removeReview};
}
