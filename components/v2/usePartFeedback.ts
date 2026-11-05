"use client";
import {useEffect,useState} from "react";
import {
 blankFeedbackDraft,recordInspectionFeedback,restoreInspectionFeedback,
 type InspectionFeedback,type FeedbackDraft
} from "@/lib/part-inspection-feedback";
const prefix="orientai.feedback.v1:";
export function usePartFeedback(partHash:string|null){
 const [loadedPart,setLoadedPart]=useState<string|null>(null);
 const [records,setRecords]=useState<InspectionFeedback[]>([]);
 const [error,setError]=useState("");
 useEffect(()=>{
  setLoadedPart(null);setError("");setRecords([]);
  if(!partHash)return;
  try{
   const raw=localStorage.getItem(prefix+partHash);
   setRecords(restoreInspectionFeedback(raw?JSON.parse(raw):[],partHash));
  }catch{setRecords([]);}
  setLoadedPart(partHash);
 },[partHash]);
 useEffect(()=>{
  if(!partHash||loadedPart!==partHash)return;
  try{localStorage.setItem(prefix+partHash,JSON.stringify(records));}
  catch{setError("Browser storage unavailable; export the assessment before leaving.");}
 },[partHash,loadedPart,records]);
 const add=(draft:FeedbackDraft)=>{
  if(!partHash||loadedPart!==partHash){setError("Wait until the current part identity is available.");return;}
  try{const next=recordInspectionFeedback(partHash,draft,records);
   setRecords(v=>[...v,next]);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Invalid test observation.");}
 };
 const remove=(id:string)=>setRecords(v=>v.filter(x=>x.id!==id));
 return {records:loadedPart===partHash?records:[],error,add,remove,blank:blankFeedbackDraft};
}
