"use client";
import {useMemo,useState} from "react";
import type {ProjectSource} from "@/lib/copilot-context";
import type {ReviewedEvidence} from "@/lib/engineering-evidence";
import type {ServiceCase} from "@/lib/service-plan";
import type {ServiceSetup} from "@/lib/service-load";
import {
 activeParameterBindings,approveParameterBinding,proposeNumericalParameters,
 type ApprovedParameterBinding,type ParameterCandidate,type ParameterTarget
} from "@/lib/engineering-parameter-binding";

export default function EngineeringParameterReview({sources,reviewed,bindings,serviceCase,onApply,onRemove}:{
 sources:ProjectSource[];reviewed:ReviewedEvidence[];bindings:ApprovedParameterBinding[];
 serviceCase:ServiceCase;
 onApply:(binding:ApprovedParameterBinding,setup:ServiceSetup)=>void;
 onRemove:(id:string)=>void;
}){
 const [selected,setSelected]=useState<ParameterCandidate|null>(null);
 const [target,setTarget]=useState<ParameterTarget>("forceZN");
 const [sign,setSign]=useState<"positive"|"negative">("positive");
 const [reviewNote,setReviewNote]=useState("");
 const [verified,setVerified]=useState(false);
 const [error,setError]=useState("");
 const proposals=useMemo(()=>proposeNumericalParameters(reviewed,sources),[reviewed,sources]);
 const current=useMemo(()=>activeParameterBindings(bindings,sources,reviewed,serviceCase),[bindings,sources,reviewed,serviceCase]);
 const select=(candidate:ParameterCandidate)=>{
  setSelected(candidate);
  setTarget(candidate.suggestedTarget??"forceZN");
  setSign(candidate.normalizedMagnitude<0?"negative":"positive");
  setReviewNote("");setVerified(false);setError("");
 };
 const apply=()=>{
  if(!selected)return;
  try{
   const {binding,setup}=approveParameterBinding({
    candidate:selected,target,serviceCase,sources,reviewedEvidence:reviewed,
    direction:selected.targetKind==="force"?(sign==="positive"?1:-1):undefined,
    rationale:reviewNote,independentlyVerified:verified
   });
   onApply(binding,setup);
   setSelected(null);setReviewNote("");setVerified(false);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Could not approve numerical mapping.");}
 };
 return <section className="copilotParameterReview" aria-label="Source to simulation parameters">
  <header><h3>Link reviewed evidence to solver inputs</h3>
   <p>ORIENTAI identifies numbers in your reviewed source passages and converts compatible units. <strong>It does not decide force direction, identify fixtures, or approve the value.</strong> A numerical mapping updates the active service case only after your separate confirmation.</p>
  </header>
  <div className="parameterSummary">{current.length} current linked input{current.length===1?"":"s"} · {proposals.length} candidate value{proposals.length===1?"":"s"} · Active case: {serviceCase.name}</div>
  {bindings.length>0&&<div className="parameterBindings">
   <h4>Saved input provenance</h4>
   {bindings.map(binding=>{
    const valid=current.some(x=>x.id===binding.id);
    return <div className={"parameterBinding "+(valid?"":"parameterStale")} key={binding.id}>
     <div><b>[{binding.sourceId} {binding.locator}] {binding.target} = {binding.value} {binding.normalizedUnit}</b>
      <span>{valid?"Current source and case value":"Stale: source, review, case or value changed"}</span>
     </div>
     <small>{binding.reviewNote}</small>
     <button type="button" className="copilotSmall" onClick={()=>onRemove(binding.id)}>Remove provenance record</button>
    </div>;
   })}
  </div>}
  {!proposals.length?<p className="parameterEmpty">No values available from current reviewed evidence. Review a load or material excerpt in the Documents step. You can always enter independently established solver parameters manually.</p>:
   <div className="parameterSuggestions">
    {proposals.map(candidate=><div key={candidate.key} className="parameterCandidate">
     <div className="parameterRow"><div><strong>[{candidate.sourceId} {candidate.locator}] {candidate.rawQuantity}</strong>
      <small>Normalized: {candidate.normalizedMagnitude} {candidate.normalizedUnit} · {candidate.targetKind==="force"?"Candidate load":candidate.targetKind==="elastic"?"Candidate elastic modulus":"Candidate Poisson ratio"}</small></div>
      {candidate.uncertain&&<span className="parameterUncertain">Unverified wording</span>}
     </div>
     <p>{candidate.excerpt}</p>
     {selected?.key===candidate.key?
      <div className="parameterApproval">
       <p>Specify the original-STL coordinate axis and signed direction. The current fixture remains an independent engineering assumption. This mapping does not confirm structural or aerospace suitability.</p>
       <label>Numerical parameter
        <select aria-label="Parameter target" value={target} onChange={e=>setTarget(e.target.value as ParameterTarget)}>
         {candidate.targetKind==="force"?<>
          <option value="forceXN">X force (N)</option><option value="forceYN">Y force (N)</option><option value="forceZN">Z force (N)</option>
         </>:candidate.targetKind==="elastic"?<option value="youngModulusMPa">Young's modulus (MPa)</option>:<option value="poissonRatio">Poisson ratio</option>}
        </select>
       </label>
       {candidate.targetKind==="force"&&<label>Signed force direction in original STL axes
        <select aria-label="Signed force direction" value={sign} onChange={e=>setSign(e.target.value as typeof sign)}>
         <option value="positive">Positive axis (+)</option><option value="negative">Negative axis (−)</option>
        </select>
       </label>}
       <div className="parameterPreview"><strong>Proposed input:</strong> {target} = {candidate.targetKind==="force"?(sign==="negative"?-1:1)*Math.abs(candidate.normalizedMagnitude):candidate.normalizedMagnitude} {candidate.normalizedUnit}</div>
       <label>Engineering review and source applicability
        <textarea aria-label="Numerical mapping rationale" rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
         placeholder="Confirm why this quantity applies to this actual part and case. Identify the documented force direction or independently verified assumptions."/>
       </label>
       <label className="parameterConfirmation"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>
        I independently checked this magnitude, units, original-part direction, applicability and source uncertainty; I authorize updating this service-case input. This is not simulation approval.
       </label>
       {candidate.uncertain&&<p className="parameterUncertaintyText">This source explicitly contains uncertainty. Do not apply the number unless you have independently verified it. Otherwise keep it as an unapproved research note.</p>}
       {error&&<p role="alert" className="parameterError">{error}</p>}
       <div className="parameterButtons">
        <button type="button" onClick={apply} disabled={!verified||reviewNote.trim().length<15}>Apply reviewed value to service case</button>
        <button type="button" className="copilotSmall" onClick={()=>{setSelected(null);setError("");}}>Cancel</button>
       </div>
      </div>:
      <button type="button" className="copilotSmall" onClick={()=>select(candidate)}>Review numeric mapping</button>}
    </div>)}
   </div>}
  <p className="parameterCaution">Source review and numerical mapping are separate from accepting the structural worker's idealized end-face fixtures, isotropic properties and overall simulation plan.</p>
 </section>;
}
