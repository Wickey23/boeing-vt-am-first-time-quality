"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {FileCheck2,FileUp} from "lucide-react";
import {addProjectSource,blankKnowledge,restoreKnowledge,type ProjectKnowledge} from "@/lib/copilot-context";
import {currentReviewedEvidence} from "@/lib/engineering-evidence";

const STORAGE_PREFIX="orientai-engineering-context-v1-";
type Props={
 partHash:string|null;
 fileName:string;
 unitsConfirmed:boolean;
 hasGeometryRun:boolean;
 onViewPart:()=>void;
 onReviewPart:()=>void;
};
/** Guided entry into the existing part-scoped document, evidence and report pipeline.
 * Metadata and extracted text remain browser-local; a PDF is NOT automatically read.
 */
export default function EngineeringAssessmentJourney({partHash,fileName,unitsConfirmed,hasGeometryRun,onViewPart,onReviewPart}:Props){
 const [knowledge,setKnowledge]=useState<ProjectKnowledge|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const activeHash=useRef(partHash);
 activeHash.current=partHash;
 useEffect(()=>{
  setKnowledge(null);setError("");setNotice("");
  if(!partHash)return;
  try{
   const saved=localStorage.getItem(STORAGE_PREFIX+partHash);
   setKnowledge(saved?restoreKnowledge(JSON.parse(saved),partHash):blankKnowledge(partHash));
  }catch{setKnowledge(blankKnowledge(partHash));}
 },[partHash]);
 const sources=knowledge?.sources??[];
 const reviewed=knowledge?currentReviewedEvidence(knowledge.reviewedEvidence,sources).length:0;
 const next=!unitsConfirmed?"Confirm the STL dimensions and units.":
  sources.length===0?"Add a document describing where the part is used and what it must withstand.":
  reviewed===0?"Review source excerpts and confirm which requirements actually apply.":
  "Confirm loads and boundary conditions, run available analyses, then generate the evidence report.";
 const attach=async(files:FileList|null)=>{
  if(!files?.length||!partHash||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const saved=localStorage.getItem(STORAGE_PREFIX+partHash);
   let working=saved?restoreKnowledge(JSON.parse(saved),partHash):blankKnowledge(partHash);
   for(const file of Array.from(files)){
    const updated=await addProjectSource(working.sources,file);
    working={...working,sources:updated};
   }
   if(activeHash.current!==partHash)return;
   localStorage.setItem(STORAGE_PREFIX+partHash,JSON.stringify(working));
   setKnowledge(working);
   const pdfCount=working.sources.filter(s=>s.extraction==="not_extracted").length;
   setNotice(pdfCount?
    "References saved locally. PDF/legacy documents are registered, not interpreted. Add relevant page-numbered excerpts in Engineering context.":
    "Reference text extracted locally. Review passages and confirm applicability before using them as engineering requirements.");
  }catch(e){
   setError(e instanceof Error?e.message:"Could not add the engineering reference.");
  }finally{setBusy(false);}
 };
 return <section className="oaAssessmentJourney" aria-label="Three-stage engineering assessment" data-testid="assessment-journey">
  <div className="oaAssessmentHeading"><strong>Engineering assessment</strong><small>Research prototype · engineer review required</small></div>
  <nav className="oaAssessmentStages" aria-label="Assessment stages">
   <button type="button" className="oaAssessmentStep" onClick={onViewPart} aria-label="Open part geometry view">
    <span className="oaAssessmentStepNumber">01</span><span className="oaAssessmentStepText"><strong>Part geometry</strong><small>{unitsConfirmed?"Units confirmed":"Confirm dimensions"}</small></span>
   </button>
   <Link className="oaAssessmentStep" href="/copilot/advanced?stage=documents" aria-label="Open engineering context stage">
    <span className="oaAssessmentStepNumber">02</span><span className="oaAssessmentStepText"><strong>Engineering context</strong><small>{sources.length?sources.length+" document(s) · "+reviewed+" reviewed":"Assembly and loads"}</small></span>
   </Link>
   <Link className="oaAssessmentStep" href="/copilot/advanced?stage=results" aria-label="Open failure assessment and export stage">
    <span className="oaAssessmentStepNumber">03</span><span className="oaAssessmentStepText"><strong>Failure assessment</strong><small>{hasGeometryRun?"Geometry screening ready":"Analyze and export"}</small></span>
   </Link>
  </nav>
  <div className="oaAssessmentNext">
   <FileCheck2 size={16} aria-hidden="true"/>
   <span><strong>Next:</strong> {next}</span>
   {!unitsConfirmed?<button type="button" onClick={onReviewPart}>Review dimensions</button>:sources.length>0?<Link href={reviewed===0?"/copilot/advanced?stage=documents":"/copilot/advanced?stage=requirements"}>{reviewed===0?"Review evidence":"Confirm requirements"}</Link>:null}
   <label className="oaAssessmentUploadButton"><FileUp size={15}/>{busy?"Reading…":"Add documents"}<input type="file" aria-label="Upload assembly documents" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.json,.log" disabled={!partHash||busy} onChange={e=>{void attach(e.target.files);e.currentTarget.value="";}}/></label>
  </div>
  {sources.length>0&&<div className="oaAssessmentSources">{sources.slice(0,3).map(source=><span key={source.id} title={source.name}>{source.id} · {source.name} · {source.extraction==="not_extracted"?"Needs excerpt":"Text available"}</span>)}{sources.length>3&&<small>+{sources.length-3} more</small>}<Link href="/copilot/advanced?stage=documents">Review sources & requirements</Link></div>}
  {notice&&<p className="oaAssessmentNotice" role="status">{notice}</p>}
  {error&&<p className="oaStudyError" role="alert">{error}</p>}
  <details className="oaAssessmentLimitations"><summary>Document and engineering limitations</summary><p>Documents stay in this browser; they are not transmitted to an external AI automatically. Local extraction covers supported text and Office formats, not PDF content or scanned drawings. Any interpreted load, fixture, material or acceptance criterion requires engineer confirmation before numerical analysis.</p></details>
 </section>;
}
