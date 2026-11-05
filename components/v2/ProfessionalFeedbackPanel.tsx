"use client";
import {useState} from "react";
import {ClipboardCheck,Plus,Trash2} from "lucide-react";
import {
 blankFeedbackDraft,feedbackOverview,type FeedbackDraft,type InspectionFeedback
} from "@/lib/part-inspection-feedback";
export default function ProfessionalFeedbackPanel({findings,records,error,onAdd,onRemove}:{
 findings:{id:string;title:string}[];records:InspectionFeedback[];error:string;
 onAdd:(draft:FeedbackDraft)=>void;onRemove:(id:string)=>void;
}){
 const [draft,setDraft]=useState<FeedbackDraft>(blankFeedbackDraft);
 const [expanded,setExpanded]=useState(false);
 const overview=feedbackOverview(records,findings.map(x=>x.id));
 const patch=(next:Partial<FeedbackDraft>)=>setDraft(old=>({...old,...next}));
 const submit=()=>{
  if(!draft.userReviewedSource)return;
  onAdd(draft);
  // The parent validates and displays any errors. Keep the draft for correction.
 };
 return <section className="psPanel psFeedbackPanel" aria-label="Post-build inspection feedback">
  <div className="psPanelHeading"><strong><ClipboardCheck size={16}/> Post-build evidence and comparison</strong>
   <span>{records.length} reviewed source entries · not model training</span></div>
  <p className="psCaveat">This optional stage records actual print, inspection or service-test observations against the initial screening. It does not connect to a printer, validate uploaded reports automatically, or train a prediction model.</p>
  {records.length>0&&<div className="psFeedbackCounts">
   <span>{overview.linked} linked to rules</span><span>{overview.observed} issue observed</span>
   <span>{overview.notObserved} not observed</span><span>{overview.inconclusive} inconclusive</span>
  </div>}
  {records.map(f=><article className="psFeedbackItem" key={f.id}>
   <div><strong>{f.buildId} · {f.outcome.replace("-"," ")}</strong>
    <small>Source: {f.sourceReference} · {f.testMethod} · Reviewer: {f.reviewedBy}</small>
    <p>{f.observation}</p>
    {f.findingId&&<small>Linked pre-build rule: {f.findingId}</small>}</div>
   <button type="button" aria-label={"Remove feedback "+f.id} title="Remove local entry"
    onClick={()=>onRemove(f.id)}><Trash2 size={14}/></button>
  </article>)}
  <details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}>
   <summary><Plus size={14}/> Record an independently reviewed inspection or test result</summary>
   <div className="psFeedbackForm">
    <label>Build / specimen ID<input value={draft.buildId} onChange={e=>patch({buildId:e.target.value})} placeholder="Actual build or specimen trace ID"/></label>
    <label>Report / source revision<input value={draft.sourceReference} onChange={e=>patch({sourceReference:e.target.value})} placeholder="Inspection report document ID + revision"/></label>
    <label>Test or inspection method<input value={draft.testMethod} onChange={e=>patch({testMethod:e.target.value})} placeholder="CT scan, measured dimensions, tensile test…"/></label>
    <label>Finding addressed<select value={draft.findingId??""} onChange={e=>patch({findingId:e.target.value||null})}>
     <option value="">No particular pre-build flag</option>
     {findings.slice(0,40).map(f=><option value={f.id} key={f.id}>{f.id}: {f.title}</option>)}
    </select></label>
    <label>Reported outcome<select value={draft.outcome} onChange={e=>patch({outcome:e.target.value as FeedbackDraft["outcome"]})}>
     <option value="observed">Issue observed in test</option>
     <option value="not-observed">Not observed under this test</option>
     <option value="inconclusive">Inconclusive or unknown</option>
    </select></label>
    <label>Engineer / reviewer<input value={draft.reviewedBy} onChange={e=>patch({reviewedBy:e.target.value})} placeholder="Reviewer identity or internal ID"/></label>
    <label className="psFeedbackObservation">Observed result and test conditions<textarea rows={2}
     value={draft.observation} onChange={e=>patch({observation:e.target.value})}
     placeholder="Actual measured observation, applicable test conditions and remaining uncertainty"/></label>
    <label className="psFeedbackReview"><input type="checkbox"
     checked={draft.userReviewedSource} onChange={e=>patch({userReviewedSource:e.target.checked})}/>
     I reviewed the cited source and confirm this is a user-entered observation, not a simulated prediction.</label>
    <button type="button" className="psPrimary" onClick={submit} disabled={!draft.userReviewedSource}>
     <Plus size={14}/> Add reviewed observation
    </button>
   </div>
  </details>
  {error&&<p className="psError" role="alert">{error}</p>}
  <p className="psCaveat">{overview.caveat}</p>
 </section>;
}
