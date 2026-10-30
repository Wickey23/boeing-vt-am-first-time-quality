"use client";
import {useEffect,useRef,useState} from "react";
import {useAnalysis} from "../AnalysisProvider";
import type {SliceOptions,PhysicalSliceResult} from "@/lib/lpbf-physical-slicer";
import type {RegisteredPhysicalScan} from "@/lib/lpbf-slice-registration";
import type {ResearchMaterial} from "@/lib/lpbf-stl-partial-layer";
import type {PartialLayerResult} from "@/lib/lpbf-partial-layer";

type Message=
 |{type:"progress";stage:"slice"|"register"|"integrate";done:number;total:number}
 |{type:"result";result:PartialLayerResult;geometry:{version:string;layerCount:number;sampledVolumeDifference:number;sourceSha256:string;scanSha256:string;source:string}}
 |{type:"error";error:string};

const demo:ResearchMaterial={
 powerCouplingFraction:.25,beamRadiusMm:2.5,densityKgM3:4420,specificHeatJKgK:560,
 powderConductivityWmK:2,solidConductivityWmK:15,convectionWm2K:10,
 ambientTemperatureC:22,plateTemperatureC:22
};
const labels:Record<keyof ResearchMaterial,string>={
 powerCouplingFraction:"Assumed effective beam energy fraction (0–1)",
 beamRadiusMm:"Assumed Gaussian beam radius (mm)",
 densityKgM3:"Assumed effective mass density (kg/m³)",
 specificHeatJKgK:"Assumed effective specific heat (J/kg/K)",
 powderConductivityWmK:"Assumed powder conductivity (W/m/K)",
 solidConductivityWmK:"Assumed consolidated conductivity (W/m/K)",
 convectionWm2K:"Assumed convection coefficient (W/m²/K)",
 ambientTemperatureC:"Ambient temperature (°C)",
 plateTemperatureC:"Plate temperature (°C)"
};
export default function LpbfStlPartialLayerPanel({
 partHash,scan,slices,registration,options
}:{partHash:string;scan:File;slices:PhysicalSliceResult;registration:RegisteredPhysicalScan;options:SliceOptions}){
 const a=useAnalysis();
 const [material,setMaterial]=useState<ResearchMaterial>({...demo,beamRadiusMm:Math.max(0.5,slices.grid.xyPitchMm/2)});
 const [approved,setApproved]=useState(false);
 const [status,setStatus]=useState<"idle"|"running"|"done"|"failed"|"cancelled">("idle");
 const [error,setError]=useState("");
 const [progress,setProgress]=useState({stage:"slice",done:0,total:1});
 const [result,setResult]=useState<PartialLayerResult|null>(null);
 const [frame,setFrame]=useState(0);
 const [viewLayer,setViewLayer]=useState(0);
 const worker=useRef<Worker|null>(null),timeout=useRef<ReturnType<typeof setTimeout>|null>(null),sequence=useRef(0);
 const stop=()=>{if(timeout.current)clearTimeout(timeout.current);timeout.current=null;worker.current?.terminate();worker.current=null;};
 useEffect(()=>()=>{sequence.current++;stop()},[]);
 const invalidate=()=>{sequence.current++;stop();setStatus("idle");setApproved(false);setResult(null);setError("");setFrame(0);setViewLayer(0);};
 // Retaining partially occupied geometry would be incompatible with full-cell mass
 // and face-area assumptions in the existing numerical scheme.
 const problems:string[]=[];
 if(registration.status==="BLOCKED"||registration.blockers.length)problems.push("Scan registration contains unresolved blockers.");
 if(slices.grid.boundaryCells>0)problems.push("Sampled material has "+slices.grid.boundaryCells+" fractional boundary cells; full-cell heat physics would misrepresent mass.");
 if(slices.geometry.relativeVolumeDifference>.02)problems.push("Sampled STL volume differs by >2% from the enclosed mesh volume.");
 if(slices.grid.physicalLayers<2||slices.grid.physicalLayers>40)problems.push("Research model supports only 2–40 actual physical layers.");
 if(slices.grid.representedCells<2||slices.grid.representedCells>1500)problems.push("Research model supports only 2–1,500 full cells.");
 if(slices.layers.some(l=>l.cells.length===0))problems.push("At least one physical layer is missing occupied geometry.");
 const allowed=problems.length===0;
 const run=async()=>{
  if(!allowed||!a.file||!approved||status==="running")return;
  const token=++sequence.current;
  stop();setStatus("running");setError("");setResult(null);setFrame(0);setViewLayer(0);setProgress({stage:"slice",done:0,total:1});
  try{
   const [part,scanCsv]=await Promise.all([a.file.arrayBuffer(),scan.arrayBuffer()]);
   if(token!==sequence.current)return;
   const w=new Worker(new URL("../../workers/lpbf-stl-partial-layer.worker.ts",import.meta.url));
   worker.current=w;
   timeout.current=setTimeout(()=>{
    if(token===sequence.current){stop();setStatus("failed");setError("Solver timed out after 120 seconds. No temperature data was published.");}
   },120000);
   w.onmessage=(event:MessageEvent<Message>)=>{
    if(token!==sequence.current)return;
    const msg=event.data;
    if(msg.type==="progress"){setProgress({stage:msg.stage,done:msg.done,total:msg.total});return;}
    stop();
    if(msg.type==="error"){setStatus("failed");setError(msg.error);return;}
    if(msg.result.partSha256!==partHash||msg.result.sourceSha256!==registration.scanSourceSha256){
     setStatus("failed");setError("Part/scan source changed since engineer review. Research result discarded.");return;
    }
    setResult(msg.result);setFrame(Math.max(0,msg.result.layers.length-1));setViewLayer(msg.result.grid.layers-1);setStatus("done");
   };
   w.onerror=()=>{if(token===sequence.current){stop();setStatus("failed");setError("Research worker terminated without results.");}};
   w.postMessage({
    approved:true,part,scanCsv,partSha256:partHash,
    scanSha256:registration.scanSourceSha256,scanName:scan.name,
    options,material
   },[part,scanCsv]);
  }catch(e){if(token===sequence.current){stop();setStatus("failed");setError(e instanceof Error?e.message:"Could not start research solver.");}}
 };
 const exportResult=()=>{
  if(!result)return;
  const content={schema:"orientai.lpbf-stl-partial-layer-research.v1",createdAt:new Date().toISOString(),
   source:{partName:a.file?.name,partHash,scanName:scan.name,scanSha256:registration.scanSourceSha256},
   geometry:{version:slices.version,grid:slices.grid,meshVolumeMm3:slices.geometry.analyticalMeshVolumeMm3},
   inputs:material,registration,result,
   qualification:"UNVALIDATED NUMERICAL RESEARCH ONLY. No actual melt pool, pore probability, residual stress, cracking, dimensional accuracy or production approval."};
  const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download="orientai-unvalidated-partial-layer-"+partHash.slice(0,12)+".json";
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 const active=result?.layers[Math.min(frame,result.layers.length-1)];
 const fieldCells=result?.finalCells.filter(c=>c.layer===viewLayer)??[];
 const allTemps=result?.finalCells.map(c=>c.temperatureC)??[];
 const tempMin=allTemps.length?Math.min(...allTemps):0,tempMax=allTemps.length?Math.max(...allTemps):0;
 const range=Math.max(.001,tempMax-tempMin);
 const gridCols=slices.grid.columns,gridRows=slices.grid.rows;
 return <section className="oaStlSolver" role="region" aria-label="Approved real STL partial-layer research solver">
  <h4>3D partial-layer research solver <small>unvalidated finite-volume approximation</small></h4>
  <p className="oaSubtle">This separate worker uses fully represented cells from the uploaded STL, the matched CSV scan order, and the reviewed values below. It does not compute a physical melt pool, phase transformation or first-time-quality probability. Reported “consolidation” is a beam-footprint heuristic, not measured melting.</p>
  {problems.map((p,i)=><p className="oaStudyError" role="alert" key={i}>{p}</p>)}
  {!allowed&&<p className="oaSubtle">To use this restricted solver, run a fully resolved public cube with 1 mm layers and 5 mm XY pitch, using the <a href="/verification/cube-10mm-10-layer-partial-research.csv" download>10-layer synthetic demonstration scan CSV</a>, or develop appropriate partial-volume physics for nonrectangular parts. Do not force a fit by ignoring geometry warnings.</p>}
  <details className="oaPhysicalSliceAdvanced">
   <summary>Review numerical material, beam and boundary assumptions</summary>
   <p className="oaSubtle">The starting Ti-alloy-like numbers are illustrative and not an approved alloy property sheet. Replace values with documented inputs for your case. No temperature-dependent property, latent heat, measured beam, raster convergence or calibrated powder model is provided.</p>
   <div className="oaPhysicalSliceParams">
    {(Object.entries(labels) as [keyof ResearchMaterial,string][]).map(([key,label])=>
     <label key={key}>{label}<input type="number" aria-label={label} step="any" value={material[key]}
      disabled={status==="running"} onChange={e=>{invalidate();setMaterial(prev=>({...prev,[key]:Number(e.target.value)}));}}/></label>)}
   </div>
  </details>
  <label className="oaLpbfApproval">
   <input type="checkbox" aria-label="Approve unvalidated physical STL research solver" checked={approved}
    disabled={!allowed||status==="running"} onChange={e=>setApproved(e.target.checked)}/>
   I reviewed the source-hashed physical geometry, scan commands, effective material assumptions and boundary conditions. I approve only this unvalidated research calculation and understand no defect or print qualification is predicted.
  </label>
  <div className="oaRunActions">
   <button className="oaRunButton" type="button" disabled={!allowed||!approved||status==="running"} onClick={()=>void run()}>Run STL-linked partial-layer research</button>
   {status==="running"&&<button className="oaSecondaryRun" type="button" onClick={()=>{sequence.current++;stop();setStatus("cancelled");setError("Research worker cancelled. No calculated result retained.");}}>Cancel 3D research worker</button>}
  </div>
  {status==="running"&&<><progress className="oaRunProgress" aria-label="Real STL partial-layer worker progress" max={100} value={progress.total?Math.round(progress.done/progress.total*100):0}/>
   <p role="status" className="oaSubtle">{progress.stage==="slice"?"Rebuilding real STL physical slices":progress.stage==="register"?"Verifying exact scan-to-slice registration":"Integrating unvalidated 3D thermal cell field"}: {progress.done} / {progress.total}.</p></>}
  {error&&<p role="alert" className="oaStudyError">{error}</p>}
  {result&&active&&<div role="region" aria-label="Unvalidated STL-linked partial-layer research results" className="oaStlSolverResult">
   <p className="oaLpbfWarning"><strong>Numerical research, not experimental prediction.</strong> Energy conservation supports numerical accounting only; it cannot establish physically correct temperature, melting, cracks, pores or aerospace fitness.</p>
   <div className="oaPhysicalSliceStats">
    <div><small>Physical layers</small><strong>{result.grid.layers}</strong></div>
    <div><small>Finite-volume cells</small><strong>{result.grid.cellCount}</strong></div>
    <div><small>Peak final-cell temperature</small><strong>{Math.max(...result.finalCells.map(c=>c.peakTemperatureC)).toFixed(1)} °C</strong></div>
    <div><small>Energy imbalance</small><strong>{(100*result.energy.relativeImbalance).toPrecision(4)}%</strong></div>
    <div><small>Commanded energy</small><strong>{result.energy.commandedJ.toPrecision(5)} J</strong></div>
    <div><small>Research-coupled energy</small><strong>{result.energy.absorbedJ.toPrecision(5)} J</strong></div>
   </div>
   <label className="oaPhysicalSliceSlider">Scan command {frame+1} / {result.layers.length}
    <input type="range" aria-label="Research scan command timeline" min={0} max={result.layers.length-1} value={frame} onChange={e=>setFrame(Number(e.target.value))}/></label>
   <p className="oaSubtle">Layer {active.layer} · simulation time {active.timeSeconds.toFixed(5)} s · activated grid cells {active.activeCells} · heuristic consolidated cells {active.consolidatedCells} · modeled maximum {active.maximumTemperatureC.toFixed(2)} °C.</p>
   <div className="oaStlSolverField" aria-label="Computed final-cell thermal field">
    <label className="oaPhysicalSliceSlider">Inspect final computed cell temperatures for physical layer {viewLayer+1} / {result.grid.layers}
     <input type="range" aria-label="Final physical layer temperature field" min={0} max={result.grid.layers-1} value={viewLayer} onChange={e=>setViewLayer(Number(e.target.value))}/></label>
    <p className="oaSubtle">Calculated final-state cross-section; this does not display intermediate beam-scale temperature frames or physical melting. The scan-command slider above displays numerical summary values only.</p>
    <div className="oaPhysicalSliceInspect">
     <div className="oaPhysicalSliceGrid">
      <svg role="img" aria-label={`Research-only final calculated temperature of ${fieldCells.length} cells in physical layer ${viewLayer+1}`}
       viewBox={`0 0 ${gridCols} ${gridRows}`}>
       {fieldCells.map(c=><rect key={c.x+"-"+c.y} x={c.x} y={gridRows-1-c.y} width={1} height={1}
        fill={`hsl(${(240-240*(c.temperatureC-tempMin)/range).toFixed(0)} 85% 58%)`}/>)}
      </svg>
     </div>
     <div className="oaPhysicalSliceLabels">
      <p>Final calculated field for {fieldCells.length} represented full cells</p>
      <p><strong>Numerical global range:</strong> {tempMin.toFixed(2)} – {tempMax.toFixed(2)} °C</p>
      <p><strong>Layer final minimum:</strong> {fieldCells.length?Math.min(...fieldCells.map(c=>c.temperatureC)).toFixed(2):"N/A"} °C</p>
      <p><strong>Layer final maximum:</strong> {fieldCells.length?Math.max(...fieldCells.map(c=>c.temperatureC)).toFixed(2):"N/A"} °C</p>
      <p><strong>Interpretation:</strong> color represents relative numerical temperatures. It does not indicate observed porosity, cracks, material phase, or aerospace build acceptance.</p>
     </div>
    </div>
    <details><summary>Non-visual numeric cell temperatures (first 40 of this layer)</summary>
     <div className="oaTraceTable"><table><thead><tr><th>Grid X</th><th>Grid Y</th><th>Final °C</th><th>Peak °C</th><th>Heuristic state</th></tr></thead>
      <tbody>{fieldCells.slice(0,40).map(c=><tr key={c.x+"-"+c.y}><td>{c.x}</td><td>{c.y}</td><td>{c.temperatureC.toFixed(3)}</td><td>{c.peakTemperatureC.toFixed(3)}</td><td>{c.state}</td></tr>)}</tbody>
     </table></div>
    </details>
   </div>
   <details><summary>Scope, numerical assumptions and unassessed mechanisms</summary>{result.limitations.map((s,i)=><p className="oaSubtle" key={i}>{s}</p>)}</details>
   <button className="oaSecondaryRun" type="button" onClick={exportResult}>Export numerical research JSON</button>
  </div>}
 </section>;
}
