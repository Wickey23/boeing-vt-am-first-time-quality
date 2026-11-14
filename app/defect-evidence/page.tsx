"use client";
import {useState} from "react";
import Link from "next/link";
import {evaluateHeldOutDefects,type DefectValidationInput,type ValidationSummary} from "@/lib/lpbf-defect-validation";
const demo:DefectValidationInput={
 defect:"lack-of-fusion",material:"SYNTHETIC ALLOY",machine:"SYNTHETIC MACHINE",
 processRevision:"demo",inspectedOutcomeDefinition:"Synthetic binary inspected defect",
 sourceReference:"SYNTHETIC DATA — NOT MEASURED",split:"held-out-builds",decisionThreshold:0.5,
 cases:[{id:"a",buildId:"B1",actualDefect:true,predictedProbability:.8},
 {id:"b",buildId:"B2",actualDefect:false,predictedProbability:.1},
 {id:"c",buildId:"B3",actualDefect:true,predictedProbability:.3},
 {id:"d",buildId:"B4",actualDefect:false,predictedProbability:.7},
 {id:"e",buildId:"B5",actualDefect:true,predictedProbability:null}]
};
const pct=(x:number|null)=>x===null?"Not estimable":(100*x).toFixed(1)+"%";
export default function DefectEvidence(){
 const [json,setJson]=useState(JSON.stringify(demo,null,2));
 const [summary,setSummary]=useState<ValidationSummary|null>(null);
 const [error,setError]=useState("");
 const run=()=>{try{setSummary(evaluateHeldOutDefects(JSON.parse(json) as DefectValidationInput));setError("");}
 catch(e){setSummary(null);setError(e instanceof Error?e.message:"Invalid JSON");}};
 const open=async(file?:File)=>{if(!file)return;if(file.size>2e6){setError("JSON file must be under 2 MB.");return;}
  setJson(await file.text());setSummary(null);setError("");};
 return <main style={{maxWidth:900,margin:"auto",padding:"36px 24px",background:"#101a25",color:"#ecf3f6",minHeight:"100vh"}}>
  <Link href="/">← ORIENTAI home</Link><h1>LPBF defect prediction evidence</h1>
  <p>Independently inspect model predictions against held-out builds. This page calculates metrics only; it does not train or run a failure predictor, prove the data split, or approve a print.</p>
  <p><strong>Safety:</strong> The initial values are synthetic demonstration cases, not manufacturing results. This browser-local calculator does not send evidence to a server. Do not upload controlled or customer-owned data to a public deployment.</p>
  <label>Import JSON evidence (up to 2 MB) <input type="file" accept=".json" onChange={e=>void open(e.target.files?.[0])}/></label>
  <p><label htmlFor="json-input">Evaluation input with machine, material, inspection definition, source, and inspected cases</label></p>
  <textarea id="json-input" value={json} onChange={e=>{setJson(e.target.value);setSummary(null);}}
   style={{boxSizing:"border-box",width:"100%",minHeight:290,background:"#172638",color:"white",padding:12,border:"1px solid #6c8596",borderRadius:8}}/>
  <p><button type="button" onClick={run} style={{padding:"10px 20px"}}>Evaluate held-out cases</button></p>
  {error&&<p role="alert">{error}</p>}
  {summary&&<section aria-label="Held-out prediction statistics">
   <h2>{summary.scope.source===demo.sourceReference?"Synthetic demo results — not real validation":"User-entered evidence — provenance not independently verified"}</h2>
   <p>{summary.scope.defect}: {summary.scope.material} · {summary.scope.machine} · {summary.scope.processRevision}</p>
   <p>Inspected cases: {summary.sampleSize}; build IDs: {summary.distinctBuilds}; abstained: {summary.abstained}; prediction coverage: {pct(summary.coverage)}.</p>
   <p>Defect precision: {pct(summary.precision)}; recall: {pct(summary.recall)}; specificity: {pct(summary.specificity)}; balanced accuracy: {pct(summary.balancedAccuracy)}.</p>
   <p>Brier score: {summary.brierScore===null?"Not estimable":summary.brierScore.toFixed(4)}; observed prevalence: {pct(summary.observedPrevalence)}.</p>
   <p>TP {summary.confusion.tp} · FP {summary.confusion.fp} · TN {summary.confusion.tn} · FN {summary.confusion.fn}</p>
   {summary.warnings.map((w,i)=><p key={i}>{w}</p>)}
  </section>}
 </main>;
}
