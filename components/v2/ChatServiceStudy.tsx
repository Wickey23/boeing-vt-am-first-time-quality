"use client";
import {useEffect,useMemo,useState} from "react";
import {useAnalysis} from "@/components/AnalysisProvider";
import UnifiedServiceStudy,{type ServiceStudyResults} from "@/components/UnifiedServiceStudy";
import {activeServiceCase} from "@/lib/service-plan";
import {currentReviewedEvidence} from "@/lib/engineering-evidence";
import {activeParameterBindings} from "@/lib/engineering-parameter-binding";
import {restoreKnowledge,type ProjectKnowledge} from "@/lib/copilot-context";

/** Reuses the audited two-worker service-study orchestrator and its human approval.
 * No remote model and no print-process thermomechanics are run here. */
export default function ChatServiceStudy({partHash,verified,onResults,onOpenResults}:{
 partHash:string|null;verified:boolean;
 onResults:(result:ServiceStudyResults|null)=>void;
 onOpenResults:()=>void;
}){
 const a=useAnalysis();
 const [context,setContext]=useState<{hash:string;data:ProjectKnowledge}|null>(null);
 useEffect(()=>{
  if(!partHash||partHash==="no-part"){setContext(null);return;}
  try{
   const raw=localStorage.getItem("orientai-engineering-context-v1-"+partHash);
   setContext({hash:partHash,data:restoreKnowledge(raw?JSON.parse(raw):null,partHash)});
  }catch{setContext({hash:partHash,data:restoreKnowledge(null,partHash)});}
 },[partHash]);
 const knowledge=context?.hash===partHash?context.data:null;
 const sources=useMemo(()=>knowledge?.sources??[],[knowledge]);
 const reviewed=useMemo(()=>currentReviewedEvidence(knowledge?.reviewedEvidence??[],sources),[knowledge,sources]);
 const service=activeServiceCase(a.servicePlan);
 const bindings=useMemo(()=>activeParameterBindings(knowledge?.parameterBindings??[],sources,reviewed,service),
   [knowledge,sources,reviewed,service]);
 const sourceIds=useMemo(()=>[...new Set(reviewed.map(x=>x.sourceId))],[reviewed]);
 return <section className="oaServiceWorkspace" aria-label="Engineer-approved numerical studies">
  <p className="oaSubtle">
   These are actual calculations on the uploaded part under engineer-selected idealized service-load and steady-conduction conditions. They are not a simulated LPBF/DED print, a defect probability, or an engineering certification.
  </p>
  <div className="oaSourceStatus">
   {reviewed.length>0?
    <span>{reviewed.length} reviewed source passage(s) available. {bindings.length} currently approved parameter mapping(s). Review all assumptions below.</span>:
    <span>No source passages have been reviewed for this part. Numerical inputs must be independently verified; illustrative defaults are not design requirements.</span>}
  </div>
  {partHash&&partHash!=="no-part"&&
   <UnifiedServiceStudy key={partHash} partSha256={partHash} verified={verified}
    reviewedEvidence={reviewed} sourceIds={sourceIds} parameterBindings={bindings}
    onResults={onResults} onOpenResults={onOpenResults}/>}
 </section>;
}
