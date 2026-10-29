"use client";
import {useEffect,useRef,useState} from "react";
import {useAnalysis} from "../AnalysisProvider";
import type {LpbfResult,LpbfProbePoint,LpbfProbeHistory} from "@/lib/lpbf-transient";
import type {MovingInputs} from "@/lib/lpbf-moving-source";
import type {ScanPlan} from "@/lib/lpbf-scan-plan";
import type {NominalLayerMap} from "@/lib/lpbf-layer-mapping";
type WorkerMessage=
 |{type:"progress";partHash:string;done:number;total:number}
 |{type:"result";partHash:string;engine:string;probe:LpbfProbeHistory;layerMapping:NominalLayerMap;summary:LpbfResult["summary"]}
 |{type:"error";error:string};
function exportText(name:string,content:string,mime:string){
 const uri=URL.createObjectURL(new Blob([content],{type:mime}));
 const link=document.createElement("a");link.href=uri;link.download=name;
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(uri),2000);
}
export default function LpbfProbePanel({baseline,partHash,inputs,scanPlan}:{
 baseline:LpbfResult;partHash:string;inputs:MovingInputs;scanPlan?:ScanPlan;
}){
 const a=useAnalysis();
 const [point,setPoint]=useState<LpbfProbePoint>({xMm:0,yMm:0,zMm:0});
 const [status,setStatus]=useState<"idle"|"running"|"complete"|"error"|"cancelled">("idle");
 const [progress,setProgress]=useState(0),[error,setError]=useState("");
 const [history,setHistory]=useState<WorkerMessage&{type:"result"}|null>(null);
 const worker=useRef<Worker|null>(null),token=useRef(0),timeout=useRef<ReturnType<typeof setTimeout>|null>(null);
 const stop=()=>{if(timeout.current)clearTimeout(timeout.current);timeout.current=null;worker.current?.terminate();worker.current=null;};
 useEffect(()=>()=>{token.current++;stop()},[]);
 const change=(key:keyof LpbfProbePoint,v:number)=>{
  if(status==="running")return;
  token.current++;setHistory(null);setStatus("idle");setError("");
  setPoint(prev=>({...prev,[key]:v}));
 };
 const cancel=()=>{token.current++;stop();setStatus("cancelled");setError("Probe run cancelled. No temperature history published.");};
 const validPoint=Object.values(point).every(v=>Number.isFinite(v)&&Math.abs(v)<=100000);
 const run=async()=>{
  if(!a.file||!validPoint||status==="running")return;
  const active=++token.current;stop();setHistory(null);setStatus("running");setError("");setProgress(0);
  try{
   const file=await a.file.arrayBuffer();
   if(active!==token.current)return;
   const w=new Worker(new URL("../../workers/lpbf-probe.worker.ts",import.meta.url));
   worker.current=w;
   timeout.current=setTimeout(()=>{
    if(active===token.current){stop();setStatus("error");setError("Probe worker exceeded its 120-second limit.");}
   },120000);
   w.onmessage=(event:MessageEvent<WorkerMessage>)=>{
    if(active!==token.current)return;
    const msg=event.data;
    if(msg.type==="progress"){
     if(msg.partHash!==partHash){cancel();return;}
     setProgress(Math.round(100*msg.done/msg.total));return;
    }
    stop();
    if(msg.type==="error"){setStatus("error");setError(msg.error);return;}
    if(msg.partHash!==partHash||msg.engine!==baseline.engine){
     setStatus("error");setError("Study identity changed. Probe history withheld.");return;
    }
    setHistory(msg);setStatus("complete");
   };
   w.onerror=()=>{if(active===token.current){stop();setStatus("error");setError("Thermal probe worker failed.");}};
   w.postMessage({file,unitScale:a.settings.unitScale,partHash,inputs,
    baseline,scanPlan,probePoint:{...point}},[file]);
  }catch(e){
   if(active===token.current){stop();setStatus("error");setError(e instanceof Error?e.message:"Cannot start thermal probe.");}
  }
 };
 const exportCsv=()=>{
  if(!history)return;
  const rows=["time_s,voxel_temperature_c,virtual_slab,laser_power_w,laser_on",
   ...history.probe.sampledPoints.map(s=>[s.timeSeconds,s.temperatureC,
    s.virtualSlab,s.laserPowerW,s.laserActive?1:0].join(","))];
  exportText("orientai-internal-probe-"+partHash.slice(0,12)+".csv",rows.join("\n")+"\n","text/csv");
 };
 const exportJson=()=>{
  if(!history)return;
  exportText("orientai-internal-probe-"+partHash.slice(0,12)+".json",JSON.stringify({
   schema:"orientai.lpbf-internal-probe.v1",partSha256:partHash,
   sourceScanSha256:scanPlan?.sha256??null,engine:history.engine,
   physicalUnitScaleToMm:a.settings.unitScale,inputAssumptions:baseline.inputs,
   probe:history.probe,layerMapping:history.layerMapping,energyAccounting:history.summary,
   validationStatus:"UNVALIDATED_INTERNAL_VOXEL_HISTORY",
   nistTamScrCompatibility:"NOT_COMPARABLE_WITH_CURRENT_COARSE_GRID"
  },null,2),"application/json");
 };
 const probe=history?.probe,points=probe?.sampledPoints??[];
 const tMin=points[0]?.timeSeconds??0,tMax=points.at(-1)?.timeSeconds??1;
 const tempMin=Math.min(...points.map(x=>x.temperatureC)),tempMax=Math.max(...points.map(x=>x.temperatureC));
 const width=560,height=220,padding=28;
 const tX=(t:number)=>padding+(t-tMin)/Math.max(1e-12,tMax-tMin)*(width-2*padding);
 const tempY=(temp:number)=>height-padding-(temp-tempMin)/Math.max(1e-6,tempMax-tempMin)*(height-2*padding);
 const line=points.map(p=>tX(p.timeSeconds).toFixed(2)+","+tempY(p.temperatureC).toFixed(2)).join(" ");
 const grouped=baseline.layerMapping??history?.layerMapping;
 return <section className="oaProbePanel" aria-label="High-rate internal thermal voxel history">
  <h3>Thermal voxel probe — solver-step history</h3>
  <p className="oaSubtle">Select a point in original STL millimeters. The worker samples the **nearest occupied internal thermal voxel center** while the heat source moves. This is not a surface thermography pixel, a high-fidelity melt-pool model or experimental validation.</p>
  <div className="oaProbeFields">{(["xMm","yMm","zMm"] as const).map(key=><label key={key}>
   {key==="xMm"?"X":key==="yMm"?"Y":"Z"} (mm)
   <input type="number" step="any" aria-label={"Probe "+key} disabled={status==="running"}
    value={point[key]} onChange={e=>change(key,Number(e.target.value))}/></label>)}</div>
  <div className="oaRunActions">
   <button type="button" className="oaRunButton" disabled={!validPoint||status==="running"||!a.file} onClick={()=>void run()}>
    Run internal thermal probe</button>
   {status==="running"&&<button type="button" className="oaSecondaryRun" onClick={cancel}>Cancel probe</button>}
  </div>
  {status==="running"&&<><progress aria-label="Thermal probe progress" max={100} value={progress} className="oaRunProgress"/>
   <p role="status" className="oaSubtle">Recomputing approved moving-source study: {progress}%</p></>}
  {error&&<p role="alert" className="oaStudyError">{error}</p>}
  {probe&&<div role="region" aria-label="Calculated internal thermal probe" className="oaProbeResult">
   <p className="oaLpbfWarning">Numerical internal-voxel temperature only. The reported per-step maximum is not a measured melt-pool peak. Sampling intervals and unresolved spot/voxel ratio limit thermal interpretation.</p>
   <div className="oaLpbfMetrics">
    <div><small>Solver-step peak</small><strong>{probe.observedStepPeakC.toFixed(2)} °C</strong></div>
    <div><small>Recorded samples</small><strong>{points.length} of {probe.actualStepsObserved} steps after activation</strong></div>
    <div><small>Maximum sample gap</small><strong>{probe.maximumSampleGapSeconds.toPrecision(4)} s</strong></div>
    <div><small>Voxel center offset</small><strong>{probe.registrationOffsetMm.toPrecision(3)} mm</strong></div>
   </div>
   <svg className="oaProbePlot" viewBox="0 0 560 220" role="img" aria-label="Simulated internal voxel temperature versus modeled elapsed time">
    <rect x="0" y="0" width="560" height="220" rx="10" fill="#0c1928"/>
    <line x1={padding} y1={padding} x2={padding} y2={height-padding} stroke="#9eb8c6"/>
    <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#9eb8c6"/>
    <polyline points={line} fill="none" stroke="#f0b66d" strokeWidth="2.5" strokeLinejoin="round"/>
    <text x="35" y="19" fontSize="11" fill="#c4d5dc">T (°C) {Number.isFinite(tempMax)?tempMax.toFixed(1):""}</text>
    <text x="35" y="211" fontSize="11" fill="#c4d5dc">{Number.isFinite(tempMin)?tempMin.toFixed(1):""}</text>
    <text x="385" y="211" fontSize="11" fill="#c4d5dc">{tMin.toFixed(4)}–{tMax.toFixed(4)} s</text>
   </svg>
   <p className="oaSubtle">Nearest internal center ({probe.sampledVoxelCenterMm.xMm.toFixed(3)}, {probe.sampledVoxelCenterMm.yMm.toFixed(3)}, {probe.sampledVoxelCenterMm.zMm.toFixed(3)}) mm; virtual voxel width {probe.voxelWidthMm.toFixed(3)} mm; activated at {probe.voxelActivationTimeSeconds.toFixed(5)} s. Plot samples were decimated by {probe.samplingStrideSteps} solver steps. The maximum is tracked independently at each integration step.</p>
   {grouped&&<details className="oaProbeLayerMap"><summary>Physical-to-virtual layer index manifest</summary>
    <p className="oaSubtle">{grouped.disclaimer}</p>
    <p className="oaSubtle">{grouped.physicalLayerCount} nominal layers of {grouped.physicalLayerThicknessMm} mm are grouped across {grouped.slabs.length} occupied thermal voxel slabs. {grouped.unmappedNominalIndices.length} nominal layer centers are not in occupied solid slabs.</p>
    <div className="oaTraceTable"><table><thead><tr><th>Virtual slab</th><th>Voxel Z</th><th>Nominal layer indices</th></tr></thead>
     <tbody>{grouped.slabs.map(s=><tr key={s.slab}><td>{s.slab}</td><td>{s.voxelZIndex}</td><td>{s.nominalPhysicalLayerIndices.length?s.nominalPhysicalLayerIndices.join(", "):"None"}</td></tr>)}</tbody></table></div>
   </details>}
   <div className="oaRunActions">
    <button type="button" className="oaSecondaryRun" onClick={exportCsv}>Export probe samples CSV</button>
    <button type="button" className="oaSecondaryRun" onClick={exportJson}>Export probe provenance JSON</button>
   </div>
  </div>}
 </section>;
}
