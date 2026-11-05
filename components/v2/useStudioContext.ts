"use client";
import {useEffect,useMemo,useState} from "react";
import {
 addProjectSource,blankKnowledge,restoreKnowledge,updateSourceNotes,
 type ProjectKnowledge,type ProjectSource
} from "@/lib/copilot-context";
import {
 acceptEngineeringEvidence,currentReviewedEvidence,suggestEngineeringEvidence,
 type EvidenceCandidate
} from "@/lib/engineering-evidence";
const PREFIX="orientai-engineering-context-v1-";
/** Shared with the existing advanced copilot: one part-hash-scoped, browser-local evidence store. */
export function useStudioContext(partKey:string|null){
 const [knowledge,setKnowledge]=useState<ProjectKnowledge|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  setKnowledge(null);setError("");
  if(!partKey)return;
  try{
   const old=localStorage.getItem(PREFIX+partKey);
   setKnowledge(old?restoreKnowledge(JSON.parse(old),partKey):blankKnowledge(partKey));
  }catch{setKnowledge(blankKnowledge(partKey));}
 },[partKey]);
 useEffect(()=>{
  if(!partKey||!knowledge||knowledge.partKey!==partKey)return;
  try{localStorage.setItem(PREFIX+partKey,JSON.stringify(knowledge));}
  catch{setError("Browser storage is full. Export the report before closing this page.");}
 },[knowledge,partKey]);
 const sources=knowledge?.sources??[];
 const reviewed=useMemo(()=>currentReviewedEvidence(knowledge?.reviewedEvidence??[],sources),[knowledge,sources]);
 const candidates=useMemo(()=>suggestEngineeringEvidence(sources,16),[sources]);
 const addDocuments=async(files:FileList|null)=>{
  if(!files?.length||!knowledge||busy)return;
  setBusy(true);setError("");
  try{
   let next=knowledge.sources;
   for(const file of Array.from(files))next=await addProjectSource(next,file);
   setKnowledge(k=>k?.partKey===partKey?{...k,sources:next}:k);
  }catch(e){setError(e instanceof Error?e.message:"Unable to read the reference.");}
  finally{setBusy(false);}
 };
 const setField=(field:"componentName"|"assemblyContext"|"attachmentNotes"|"reviewedRequirements",text:string)=>{
  setKnowledge(k=>k?{...k,[field]:text.slice(0,field==="componentName"?160:4000)}:k);
 };
 const setNotes=(id:string,text:string)=>{
  setKnowledge(k=>k?{...k,sources:updateSourceNotes(k.sources,id,text)}:k);
 };
 const review=(item:EvidenceCandidate,note:string)=>{
  try{
   const accepted=acceptEngineeringEvidence(item,note);
   setKnowledge(k=>k?{...k,reviewedEvidence:[...k.reviewedEvidence.filter(r=>r.key!==item.key),accepted]}:k);
   setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to review evidence.");}
 };
 const removeSource=(id:string)=>setKnowledge(k=>k?{...k,sources:k.sources.filter(s=>s.id!==id)}:k);
 return {knowledge,sources,reviewed,candidates,error,busy,addDocuments,setField,setNotes,review,removeSource};
}
