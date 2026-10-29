"use client";
import {useEffect,useRef,useState} from "react";
import {useAnalysis} from "../AnalysisProvider";
import type {LpbfResult} from "@/lib/lpbf-transient";
import {
 LPBF_TRACE_CSV_HEADER,parseLpbfTraceCsv,compareLpbfSurfaceTrace,
 type ObservedTrace,type TraceComparison
} from "@/lib/lpbf-measurement-comparison";

/** Strictly an exploratory, spatially-registered trace difference calculation. */
export default function LpbfMeasurementPanel({baseline,partHash}:{
 baseline:LpbfResult;partHash:string;
}){
 const a=useAnalysis();
 const [trace,setTrace]=useState<ObservedTrace|null>(null);
 const [traceHash,setTraceHash]=useState("");
 const [sourceRef,setSourceRef]=useState("");
 const [classification,setClassification]=useState<"synthetic"|"reported-measurement">("synthetic");
 const [approved,setApproved]=useState(false);
 const [error,setError]=useState("");
 const [report,setReport]=useState<TraceComparison|null>(null);
 const [busy,setBusy]=useState(false);
 const current=useRef(0);
 useEffect(()=>()=>{current.current++},[]);
 const clear=()=>{
  current.current++;setTrace(null);setTraceHash("");setApproved(false);setReport(null);setError("");
 };
 const upload=async(file?:File)=>{
  if(!file)return;
  clear();const token=current.current;
  try{
   if(!file.name.toLowerCase().endsWith(".csv")||!file.size||file.size>256*1024)
    throw Error("Use a nonempty UTF-8 CSV no larger than 256 KB.");
   const bytes=await file.arrayBuffer();
   const decoded=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
   const parsed=parseLpbfTraceCsv(decoded,file.name);
   const digest=await crypto.subtle.digest("SHA-256",bytes);
   if(token!==current.current)return;
   setTraceHash(Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join(""));
   setTrace(parsed);
  }catch(e){if(token===current.current)setError(e instanceof Error?e.message:"Could not load thermal trace.");}
 };
 const compare=async()=>{
  if(!a.file||!trace||!traceHash||!sourceRef.trim()||!approved||busy)return;
  const token=++current.current;
  setBusy(true);setError("");setReport(null);
  try{
   const buffer=await a.file.arrayBuffer();
   const digest=await crypto.subtle.digest("SHA-256",buffer);
   const checked=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
   if(token!==current.current)return;
   if(checked!==partHash)throw Error("STL identity changed; comparison cancelled.");
   const compared=compareLpbfSurfaceTrace({
    meshBuffer:buffer,unitScale:a.settings.unitScale,partSha256:partHash,
    result:baseline,trace,sourceSha256:traceHash,
    dataClassification:classification,sourceReference:sourceRef,claimedTimingConfirmed:approved
   });
   if(token===current.current)setReport(compared);
  }catch(e){if(token===current.current)setError(e instanceof Error?e.message:"Trace comparison failed.");}
  finally{if(token===current.current)setBusy(false);}
 };
 const exportComparison=()=>{
  if(!report)return;
  const record={
   schema:"orientai.lpbf-exploratory-trace-comparison.v1",
   exportedAt:new Date().toISOString(),
   part:{sha256:partHash,filename:a.file?.name,unitsToMm:a.settings.unitScale},
   simulation:{engine:baseline.engine,inputs:baseline.inputs,scanPlan:baseline.scanPlan,
    numerics:baseline.numerics,mesh:baseline.mesh},
   trace:report,notice:"No experimentally validated defect or build-quality prediction. Preserve original STL and measurement CSV."
  };
  const uri=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=uri;link.download="orientai-thermal-trace-"+partHash.slice(0,12)+".json";
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(uri),2000);
 };
 return <section className="oaMeasurementPanel" aria-label="Exploratory thermal measurement comparison">
  <h3>Measured thermal trace — comparison readiness</h3>
  <p className="oaSubtle">Compare user-supplied thermal readings at ONE specified STL-surface location against the calculated end-of-virtual-slab snapshot temperatures. This is an exploratory discrepancy calculation, not experimental model validation.</p>
  <label className="oaTraceFile">Import temperature trace CSV
   <input aria-label="Import thermal measurement CSV" type="file" accept=".csv,text/csv" disabled={busy}
    onChange={e=>void upload(e.target.files?.[0])}/></label>
  <p className="oaSubtle">Exact header: <code>{LPBF_TRACE_CSV_HEADER}</code>. Coordinates are STL-aligned millimeters, times are seconds on the *same origin as the simulation*, temperatures and stated uncertainties are °C. Supply at least three ordered readings at a single position. This does not accept raw NIST thermography/HDF5.</p>
  {trace&&<p role="status" className="oaSubtle">Loaded {trace.samples.length} records at ({trace.location.xMm}, {trace.location.yMm}, {trace.location.zMm}) mm · file SHA-256 {traceHash.slice(0,16)}…</p>}
  <div className="oaTraceMetadata">
   <label>Data classification
    <select aria-label="Thermal trace classification" value={classification}
     onChange={e=>{setClassification(e.target.value as "synthetic"|"reported-measurement");setApproved(false);setReport(null);}}>
     <option value="synthetic">Synthetic / development fixture</option>
     <option value="reported-measurement">Reported physical measurement (not independently verified)</option>
    </select></label>
   <label>Source reference, instrument or synthetic generator
    <input aria-label="Thermal trace provenance" value={sourceRef} maxLength={500}
     onChange={e=>{setSourceRef(e.target.value);setApproved(false);setReport(null);}}
     placeholder="Dataset DOI, lab run ID, or synthetic generator description"/></label>
  </div>
  <label className="oaLpbfApproval"><input aria-label="Confirm thermal trace clock and location" type="checkbox"
   checked={approved} onChange={e=>{setApproved(e.target.checked);setReport(null);}}/>
   I have reviewed the specimen surface coordinates, model units, and common time origin. I understand that the tool will not automatically align clocks, authenticate measurement provenance, recover laser transients between snapshots, or establish experimental validation.
  </label>
  <div className="oaRunActions">
   <button type="button" className="oaRunButton" disabled={!a.file||!trace||!traceHash||!approved||!sourceRef.trim()||busy}
    onClick={()=>void compare()}>{busy?"Checking trace…":"Compare overlapping samples"}</button>
  </div>
  {error&&<p role="alert" className="oaStudyError">{error}</p>}
  {report&&<div role="region" aria-label="Exploratory thermal comparison results" className="oaTraceResults">
   <p className="oaLpbfWarning"><strong>Not validated.</strong> These errors compare coarse simulated temperatures against user-identified trace readings. They are NOT an AM Bench TAM/SCR assessment or qualification result.</p>
   <div className="oaLpbfMetrics">
    <div><small>Compared readings</small><strong>{report.comparedCount} / {report.inputSampleCount}</strong></div>
    <div><small>Mean absolute difference</small><strong>{report.maeC.toPrecision(4)} °C</strong></div>
    <div><small>RMSE (not accuracy)</small><strong>{report.rmseC.toPrecision(4)} °C</strong></div>
    <div><small>Signed bias (simulation − trace)</small><strong>{report.biasC.toPrecision(4)} °C</strong></div>
    <div><small>Geometric registration distance</small><strong>{report.registrationDistanceMm.toPrecision(4)} mm</strong></div>
    <div><small>Largest model snapshot gap</small><strong>{report.peakSnapshotSpacingSeconds.toPrecision(4)} s</strong></div>
   </div>
   <p className="oaSubtle">Location matched to STL vertex {report.matchedVertexIndex}; simulation cell width {report.thermalCellSizeMm.toPrecision(4)} mm. {report.unmatchedCount} supplied readings were outside the active model time window. {report.withinReportedUncertaintyCount}/{report.comparedCount} differences fall within user-reported measurement uncertainty; this is not a statistical validation test.</p>
   <details className="oaCoverageRow"><summary>Compare individual temperature readings</summary>
    <div className="oaTraceTable"><table><thead><tr><th>Time (s)</th><th>Measured (°C)</th><th>Calculated (°C)</th><th>Difference (°C)</th></tr></thead>
     <tbody>{report.pairs.slice(0,80).map((p,i)=><tr key={i}><td>{p.timeSeconds.toPrecision(4)}</td><td>{p.observedC.toPrecision(5)}</td><td>{p.predictedC.toPrecision(5)}</td><td>{p.differenceC.toPrecision(4)}</td></tr>)}</tbody></table></div>
    {report.pairs.length>80&&<p className="oaSubtle">Showing 80 of {report.pairs.length} readings. JSON export includes all matched readings.</p>}
   </details>
   <details className="oaCoverageRow"><summary>Comparison limits and missing validation</summary>
    {report.limitations.map((v,i)=><p key={i}>{v}</p>)}
   </details>
   <button type="button" className="oaSecondaryRun" onClick={exportComparison}>Export exploratory comparison JSON</button>
  </div>}
 </section>;
}
