"use client";
import {useEffect,useRef,useState} from "react";
import {useAnalysis} from "../AnalysisProvider";
import type {LpbfResult} from "@/lib/lpbf-transient";
import type {MovingInputs} from "@/lib/lpbf-moving-source";
import LpbfPhysicalStackPanel from "./LpbfPhysicalStackPanel";
import {PHYSICAL_SCAN_HEADER,parsePhysicalScanCsv,type PhysicalScanAudit} from "@/lib/lpbf-physical-schedule";

type AuditMessage=
 |{type:"result";partSha256:string;sourceSha256:string;audit:PhysicalScanAudit}
 |{type:"error";error:string};
export default function LpbfPhysicalSchedulePanel({
 baseline,partHash,stackInputs
}:{baseline:LpbfResult;partHash:string;stackInputs?:MovingInputs}){
 const a=useAnalysis();
 const [csv,setCsv]=useState<File|null>(null);
 const [previewCount,setPreviewCount]=useState(0);
 const [approved,setApproved]=useState(false);
 const [status,setStatus]=useState<"idle"|"running"|"complete"|"error"|"cancelled">("idle");
 const [error,setError]=useState("");
 const [audit,setAudit]=useState<PhysicalScanAudit|null>(null);
 const worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),seq=useRef(0);
 const stop=()=>{
  if(timer.current)clearTimeout(timer.current);timer.current=null;
  worker.current?.terminate();worker.current=null;
 };
 useEffect(()=>()=>{seq.current++;stop()},[]);
 const invalidate=()=>{
  seq.current++;stop();setAudit(null);setApproved(false);setStatus("idle");setError("");
 };
 const upload=async(file?:File)=>{
  invalidate();setCsv(null);setPreviewCount(0);
  if(!file)return;
  const token=seq.current;
  try{
   if(!file.name.toLowerCase().endsWith(".csv")||file.size===0||file.size>256*1024)
    throw Error("Select a nonempty UTF-8 CSV smaller than 256 KB.");
   const parsed=parsePhysicalScanCsv(new TextDecoder("utf-8",{fatal:true}).decode(await file.arrayBuffer()),file.name);
   if(token!==seq.current)return;
   setCsv(file);setPreviewCount(parsed.commands.length);
  }catch(e){if(token===seq.current){setStatus("error");setError(e instanceof Error?e.message:"Could not parse physical-layer CSV.");}}
 };
 const run=async()=>{
  if(!a.file||!csv||!approved||status==="running")return;
  const token=++seq.current;stop();setAudit(null);setError("");setStatus("running");
  try{
   const [part,data]=await Promise.all([a.file.arrayBuffer(),csv.arrayBuffer()]);
   if(token!==seq.current)return;
   const w=new Worker(new URL("../../workers/lpbf-physical-schedule.worker.ts",import.meta.url));
   worker.current=w;
   timer.current=setTimeout(()=>{
    if(token!==seq.current)return;
    stop();setStatus("error");setError("Physical scan audit exceeded 120 seconds; no report created.");
   },120000);
   w.onmessage=(event:MessageEvent<AuditMessage>)=>{
    if(token!==seq.current)return;
    stop();
    if(event.data.type==="error"){setStatus("error");setError(event.data.error);return;}
    if(event.data.partSha256!==partHash){
     setStatus("error");setError("Part identity changed. Physical schedule report discarded.");return;
    }
    setAudit(event.data.audit);setStatus("complete");
   };
   w.onerror=()=>{
    if(token!==seq.current)return;
    stop();setStatus("error");setError("Physical scan audit worker failed.");
   };
   w.postMessage({
    part,csv:data,partSha256:partHash,
    fileName:csv.name,unitScale:a.settings.unitScale,
    voxelResolution:baseline.inputs.resolution,
    nominalLayerThicknessMm:baseline.inputs.layerThicknessMm
   },[part,data]);
  }catch(e){
   if(token!==seq.current)return;
   stop();setStatus("error");setError(e instanceof Error?e.message:"Unable to run physical schedule audit.");
  }
 };
 const cancel=()=>{
  seq.current++;stop();setStatus("cancelled");
  setError("Schedule audit cancelled. No report published.");
 };
 const exportAudit=()=>{
  if(!audit)return;
  const record={
   schema:"orientai.lpbf-physical-scan-audit.v1",createdAt:new Date().toISOString(),
   part:{sha256:partHash,fileName:a.file?.name,unitsToMm:a.settings.unitScale},
   source:csv?.name,thermalBaseline:{
    engine:baseline.engine,inputs:baseline.inputs,mesh:baseline.mesh,
    virtualScanSha256:baseline.scanPlan?.sha256??null,
    modeledDurationSeconds:baseline.summary.elapsedSeconds,
    modeledAbsorbedEnergyJ:baseline.summary.absorbedEnergyJ
   },audit,
   notice:"Physical-layer laser command chronology audit only; not applied to the thermal solver or validated against machine execution."
  };
  const uri=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=uri;link.download="orientai-physical-scan-audit-"+partHash.slice(0,12)+".json";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(uri),2000);
 };
 return <details className="oaPhysicalSchedule" aria-label="Physical-layer laser schedule audit">
  <summary>Physical-layer laser schedule — timing audit (not simulated)</summary>
  <p className="oaSubtle">Import physical-layer commands with **absolute timestamps** to verify their order, power, laser-off travel and layer-height progression. This is a separate preflight audit: the current coarse thermal solver does **not** run these commands or resolve individual physical layers.</p>
  <label className="oaTraceFile">Physical-layer command CSV
   <input aria-label="Import physical-layer scan CSV" type="file" accept=".csv,text/csv"
    disabled={status==="running"} onChange={e=>void upload(e.target.files?.[0])}/></label>
  <p className="oaSubtle"><a href="/verification/cube-10mm-physical-scan.csv" download>Download synthetic 50-layer example CSV</a> (for the public cube STL only; never a production machine recipe).</p>
  <p className="oaSubtle">Exact header: <code>{PHYSICAL_SCAN_HEADER}</code>. Times are absolute seconds from declared file origin, not nominal travel times. Each row specifies start/end laser position and power. Include explicit zero-power dwell/travel for transitions. Z and X/Y are original STL-aligned millimeters, not machine coordinates unless registered.</p>
  {csv&&<p role="status" className="oaSubtle">Parsed {previewCount} physical commands from {csv.name}. File is not sent to an AI service. Source identity and geometric alignment are checked by the local worker.</p>}
  <label className="oaLpbfApproval">
   <input type="checkbox" aria-label="Approve physical schedule coordinate and clock assumptions"
    checked={approved} disabled={status==="running"} onChange={e=>{setApproved(e.target.checked);setAudit(null);}}/>
   I reviewed the physical layer heights, STL coordinate origin, units and absolute time origin. I understand this audits commanded data only and does not perform a physics simulation or verify machine execution.
  </label>
  <div className="oaRunActions">
   <button type="button" className="oaRunButton" disabled={!csv||!approved||status==="running"||!a.file}
    onClick={()=>void run()}>Audit physical scan chronology</button>
   {status==="running"&&<button type="button" className="oaSecondaryRun" onClick={cancel}>Cancel audit</button>}
  </div>
  {status==="running"&&<p role="status" className="oaSubtle">Validating source SHA-256, command timing and physical-layer alignment…</p>}
  {error&&<p role="alert" className="oaStudyError">{error}</p>}
  {audit&&<div role="region" aria-label="Physical scan chronology audit result" className="oaPhysicalResults">
   <p className="oaLpbfWarning"><strong>Not simulated.</strong> Command time/energy below are from your CSV; the existing thermal temperature fields were NOT recomputed from this physical-layer schedule.</p>
   <div className="oaLpbfMetrics">
    <div><small>Physical layers supplied</small><strong>{audit.suppliedLayerCount}</strong></div>
    <div><small>Virtual thermal slabs</small><strong>{audit.virtualSlabCount}</strong></div>
    <div><small>Maximum layer Z registration residual</small><strong>{audit.maxAbsoluteLayerZResidualMm.toPrecision(4)} mm</strong></div>
    <div><small>Total commanded time</small><strong>{audit.commandedTimeSeconds.toPrecision(5)} s</strong></div>
    <div><small>Laser-on time</small><strong>{audit.laserOnSeconds.toPrecision(5)} s</strong></div>
    <div><small>Laser-off time</small><strong>{audit.laserOffSeconds.toPrecision(5)} s</strong></div>
    <div><small>Commanded laser energy</small><strong>{audit.totalCommandedLaserEnergyJ.toPrecision(5)} J</strong></div>
   </div>
   <p className="oaSubtle">Source SHA-256: <code>{audit.sourceSha256}</code>. This does not verify a physical machine file's origin or actual galvo movement.</p>
   <p className="oaSubtle">The existing thermal run represented {baseline.mesh.virtualSlabs} virtual slabs and {baseline.mesh.nominalLayers} nominal layers. Its duration of {baseline.summary.elapsedSeconds.toPrecision(5)} s and coupled energy of {baseline.summary.absorbedEnergyJ.toPrecision(5)} J are independent and must not be interpreted as results from the physical command CSV.</p>
   {audit.missingIntermediateLayerIndices.length>0&&<p role="alert" className="oaStudyError">Missing physical layer indices: {audit.missingIntermediateLayerIndices.slice(0,25).join(", ")}{audit.missingIntermediateLayerIndices.length>25?" …":""}</p>}
   {audit.unrepresentedLayers.length>0&&<p role="alert" className="oaStudyError">Unrepresented physical layers: {audit.unrepresentedLayers.slice(0,25).join(", ")}{audit.unrepresentedLayers.length>25?" …":""}</p>}
   <details className="oaProbeLayerMap"><summary>Physical-layer chronology and voxel correspondence</summary>
    <div className="oaTraceTable"><table><thead><tr><th>Layer</th><th>Z (mm)</th><th>Time (s)</th><th>On/Off commands</th><th>Energy (J)</th><th>Z residual (mm)</th><th>Virtual slab</th></tr></thead>
     <tbody>{audit.layers.slice(0,150).map(l=><tr key={l.layer}>
      <td>{l.layer}</td><td>{l.zMm.toFixed(3)}</td>
      <td>{l.startSeconds.toFixed(4)}–{l.endSeconds.toFixed(4)}</td>
      <td>{l.laserOnCommands}/{l.laserOffCommands}</td>
      <td>{l.commandedLaserEnergyJ.toPrecision(4)}</td>
      <td>{l.zRegistrationResidualMm.toPrecision(4)}</td>
      <td>{l.virtualSlab===null?"Not represented":l.virtualSlab}</td>
     </tr>)}</tbody></table></div>
    {audit.layers.length>150&&<p className="oaSubtle">Showing first 150 physical layers. Full audited layer chronology is available in JSON.</p>}
   </details>
   <details className="oaProbeLayerMap"><summary>Unresolved physics and source-provenance limitations</summary>
    {audit.warnings.map((v,i)=><p key={i} className="oaSubtle">{v}</p>)}
   </details>
   <button type="button" className="oaSecondaryRun" onClick={exportAudit}>Export physical scan audit JSON</button>
   {stackInputs&&csv&&<LpbfPhysicalStackPanel key={audit.sourceSha256+"-"+partHash} scan={csv} audit={audit} partHash={partHash} inputs={stackInputs}/>}
   {!stackInputs&&<p className="oaSubtle">For an independent 1D enthalpy-column research run, use the moving-source or imported-path model with documented latent-heat properties. The uniform solid-state model only supports chronology auditing.</p>}
  </div>}
 </details>;
}
