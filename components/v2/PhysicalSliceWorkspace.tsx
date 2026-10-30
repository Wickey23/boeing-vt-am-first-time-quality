"use client";
import {useEffect,useRef,useState} from "react";
import {useAnalysis} from "../AnalysisProvider";
import LpbfStlPartialLayerPanel from "./LpbfStlPartialLayerPanel";
import MetalScanPathPanel from "./MetalScanPathPanel";
import MetalBuildEditor from "./MetalBuildEditor";
import type {PhysicalScanPlan} from "@/lib/lpbf-physical-schedule";
import type {PhysicalSliceResult,SliceOptions} from "@/lib/lpbf-physical-slicer";
import type {RegisteredPhysicalScan} from "@/lib/lpbf-slice-registration";
import "./physical-slice-workspace.css";

export type SlicePreview={partHash:string;slices:PhysicalSliceResult;registration:RegisteredPhysicalScan|null;scanPlan:PhysicalScanPlan|null;selectedLayer:number};
type ResultMessage=
 |{type:"result";partSha256:string;result:PhysicalSliceResult;registration:RegisteredPhysicalScan|null;scanPlan:PhysicalScanPlan|null}
 |{type:"error";error:string};
const DEFAULT_ROTATION={x:0,y:0,z:0};
const DEFAULT_PLACEMENT={x:0,y:0,z:0};
export default function PhysicalSliceWorkspace({partHash,confirmed,onSnapshot}:{partHash:string|null;confirmed:boolean;onSnapshot?:(snapshot:SlicePreview|null)=>void}){
 const a=useAnalysis();
 const [pitch,setPitch]=useState(1);
 const [thickness,setThickness]=useState(.2);
 const [rotation,setRotation]=useState(DEFAULT_ROTATION);
 const [translation,setTranslation]=useState(DEFAULT_PLACEMENT);
 const [scanFile,setScanFile]=useState<File|null>(null);
 const [approved,setApproved]=useState(false);
 const [status,setStatus]=useState<"idle"|"running"|"done"|"failed"|"cancelled">("idle");
 const [error,setError]=useState("");
 const [slices,setSlices]=useState<PhysicalSliceResult|null>(null);
 const [registration,setRegistration]=useState<RegisteredPhysicalScan|null>(null);
 const [scanPlan,setScanPlan]=useState<PhysicalScanPlan|null>(null);
 const [selectedLayer,setSelectedLayer]=useState(0);
 const worker=useRef<Worker|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const requestId=useRef(0);
 const clean=()=>{
  if(timer.current)clearTimeout(timer.current);
  timer.current=null;
  worker.current?.terminate();
  worker.current=null;
 };
 const invalidate=()=>{
  requestId.current++;clean();setApproved(false);setStatus("idle");setError("");
  setSlices(null);setRegistration(null);setScanPlan(null);setSelectedLayer(0);
  onSnapshot?.(null);
 };
 // All dependent geometry/CSV/approval results become stale when source or units change.
 useEffect(()=>{
  requestId.current++;clean();
  setApproved(false);setStatus("idle");setError("");
  setSlices(null);setRegistration(null);setScanPlan(null);setSelectedLayer(0);
  onSnapshot?.(null);
 },[a.file,a.settings.unitScale,partHash,confirmed]);
 useEffect(()=>()=>{requestId.current++;clean()},[]);
 const setRot=(axis:"x"|"y"|"z",value:number)=>{invalidate();setRotation(x=>({...x,[axis]:value}));};
 const setPosition=(axis:"x"|"y"|"z",value:number)=>{invalidate();setTranslation(x=>({...x,[axis]:value}));};
 const handleScan=(file?:File)=>{
  invalidate();setScanFile(null);
  if(!file)return;
  if(!file.name.toLowerCase().endsWith(".csv")||file.size<1||file.size>256*1024){
   setStatus("failed");setError("Optional physical scan CSV must be UTF-8, .csv, and 1–256 KB.");return;
  }
  setScanFile(file);
 };
 const run=async()=>{
  if(!a.file||!confirmed||!partHash||!approved||status==="running")return;
  if(!Number.isFinite(pitch)||pitch<.04||pitch>5||!Number.isFinite(thickness)||thickness<.01||thickness>1){
   setError("XY pitch must be 0.04–5 mm and physical layer height must be 0.01–1 mm.");return;
  }
  const token=++requestId.current;
  clean();setError("");setStatus("running");setSlices(null);setRegistration(null);setScanPlan(null);
  onSnapshot?.(null);
  try{
   const [part,csv]=await Promise.all([a.file.arrayBuffer(),scanFile?scanFile.arrayBuffer():Promise.resolve(undefined)]);
   if(token!==requestId.current)return;
   const options:SliceOptions={unitScaleToMm:a.settings.unitScale,xyPitchMm:pitch,layerThicknessMm:thickness,rotationDeg:rotation,translationMm:translation};
   const w=new Worker(new URL("../../workers/lpbf-physical-slicer.worker.ts",import.meta.url));
   worker.current=w;
   timer.current=setTimeout(()=>{
    if(token===requestId.current){clean();setStatus("failed");setError("Physical slice worker exceeded 120 seconds. Reduce geometry/resolution.");}
   },120000);
   w.onmessage=(event:MessageEvent<ResultMessage>)=>{
    if(token!==requestId.current)return;
    clean();
    const data=event.data;
    if(data.type==="error"){setStatus("failed");setError(data.error);return;}
    if(data.partSha256!==partHash){
     setStatus("failed");setError("Part hash changed during computation; results discarded.");return;
    }
    setSlices(data.result);setRegistration(data.registration);setScanPlan(data.scanPlan);setStatus("done");setSelectedLayer(0);
    onSnapshot?.({partHash,selectedLayer:0,slices:data.result,registration:data.registration,scanPlan:data.scanPlan});
   };
   w.onerror=()=>{if(token===requestId.current){clean();setStatus("failed");setError("Local physical slice worker failed. No result was published.");}};
   const transfer:ArrayBuffer[]=[part];
   if(csv)transfer.push(csv);
   w.postMessage({part,partSha256:partHash,options,scanCsv:csv,scanFileName:scanFile?.name},transfer);
  }catch(e){if(token===requestId.current){clean();setStatus("failed");setError(e instanceof Error?e.message:"Unable to read STL/CSV locally.");}}
 };
 const cancel=()=>{requestId.current++;clean();setStatus("cancelled");setError("Local geometry study canceled; no new result was published.");};
 const exportReport=()=>{
  if(!slices||!partHash)return;
  const record={schema:"orientai.physical-stl-slice.v1",createdAt:new Date().toISOString(),
   name:a.file?.name,sourceSha256:partHash,slices,registration,
   claim:"Research-only sampled real-STL physical layer geometry and optional CSV geometric audit. No machine/thermal solver or print-quality prediction."};
  const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;
  link.download="orientai-physical-slices-"+partHash.slice(0,12)+".json";
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 const layer=slices?.layers[Math.min(selectedLayer,slices.layers.length-1)];
 return <details className="oaPhysicalSlice" aria-label="Real STL physical-layer geometry">
  <summary>Physical STL layers & scan-to-part preflight <small>local geometry · no thermal simulation</small></summary>
  <p className="oaSubtle">Generate a bounded, source-hashed raster of the actual uploaded STL at physical build layers. This is different from the coarse virtual slabs in the thermal demo. Sampled XY cells can lose small walls, cavities or contours; inspect every warning.</p>
  <MetalBuildEditor file={a.file} partHash={partHash} unitScale={a.settings.unitScale} confirmed={confirmed}
   recipe={{rotationDeg:rotation,translationMm:translation}} onApply={next=>{invalidate();setRotation(next.rotationDeg);setTranslation(next.translationMm);}}/>
  <div className="oaPhysicalSliceParams">
   <label>Physical layer thickness (mm)
    <input aria-label="Physical STL layer thickness" type="number" min=".01" max="1" step=".01" value={thickness} disabled={status==="running"}
     onChange={e=>{invalidate();setThickness(Number(e.target.value));}}/></label>
   <label>XY raster pitch (mm)
    <input aria-label="Physical STL raster pitch" type="number" min=".04" max="5" step=".1" value={pitch} disabled={status==="running"}
     onChange={e=>{invalidate();setPitch(Number(e.target.value));}}/></label>
  </div>
  <details className="oaPhysicalSliceAdvanced"><summary>Build orientation and placement — optional</summary>
   <p className="oaSubtle">Angles are XYZ Euler rotations in degrees around the original STL bounds center; translations are in mm after rotation. Scan CSV coordinates must already use this same transformed world frame.</p>
   <div className="oaPhysicalSliceParams">
    {(["x","y","z"] as const).map(axis=><label key={"rotation"+axis}>Rotation {axis.toUpperCase()} (°)
      <input aria-label={"Physical STL rotation "+axis.toUpperCase()} type="number" step="any" value={rotation[axis]} disabled={status==="running"}
       onChange={e=>setRot(axis,Number(e.target.value))}/></label>)}
    {(["x","y","z"] as const).map(axis=><label key={"translation"+axis}>Placement {axis.toUpperCase()} (mm)
      <input aria-label={"Physical STL placement "+axis.toUpperCase()} type="number" step="any" value={translation[axis]} disabled={status==="running"}
       onChange={e=>setPosition(axis,Number(e.target.value))}/></label>)}
   </div>
  </details>
  <label className="oaPhysicalSliceFile">Optional user-supplied physical scan CSV
   <input aria-label="Import physical path for slice registration" type="file" accept=".csv,text/csv" disabled={status==="running"}
    onChange={e=>handleScan(e.target.files?.[0])}/></label>
  <p className="oaSubtle">CSV header: <code>layer,z_mm,t0_s,t1_s,x0_mm,y0_mm,x1_mm,y1_mm,power_w</code>. You can <a href="/verification/cube-10mm-physical-scan.csv" download>download a synthetic cube test plan</a>. No STL or path is sent to ARC or another AI service.</p>
  {scanFile&&<p className="oaSubtle">Optional source selected: {scanFile.name}. A SHA-256 and geometric alignment check will run with the STL.</p>}
  <label className="oaLpbfApproval"><input aria-label="Approve local physical STL slice assumptions" type="checkbox"
   checked={approved} disabled={status==="running"||!confirmed} onChange={e=>{setApproved(e.target.checked);setSlices(null);setRegistration(null);}}/>
   I have confirmed the STL dimensions, process units, build frame, selected pitch and physical layer height. I understand partial occupancy is an approximation and the imported scan is not machine-verified.</label>
  {!confirmed&&<p className="oaStudyError">Confirm STL units and dimensions before running this local geometry preflight.</p>}
  <div className="oaRunActions">
   <button className="oaRunButton" type="button" disabled={!confirmed||!partHash||!approved||status==="running"} onClick={()=>void run()}>Calculate physical STL layers</button>
   {status==="running"&&<button className="oaSecondaryRun" type="button" onClick={cancel}>Cancel physical slicing</button>}
  </div>
  {status==="running"&&<p role="status" className="oaSubtle">Computing physical cross-section sample rays from the real STL in a browser worker…</p>}
  {error&&<p role="alert" className="oaStudyError">{error}</p>}
  {slices&&layer&&<section className="oaPhysicalSliceResults" role="region" aria-label="Real physical STL slice results">
   <p className="oaLpbfWarning"><strong>Geometry screening only.</strong> These are actual STL-aligned physical layer samples, not a thermal field, exact contour slicer, native machine program or proof of print quality.</p>
   <div className="oaPhysicalSliceStats">
    <div><small>Real physical layers</small><strong>{slices.grid.physicalLayers}</strong></div>
    <div><small>Raster pitch</small><strong>{slices.grid.xyPitchMm} mm</strong></div>
    <div><small>Sampled volume difference</small><strong>{(slices.geometry.relativeVolumeDifference*100).toFixed(2)}%</strong></div>
    <div><small>Partial boundary cells</small><strong>{slices.grid.boundaryCells}</strong></div>
   </div>
   <label className="oaPhysicalSliceSlider">Inspect physical layer {selectedLayer+1} / {slices.grid.physicalLayers}
    <input aria-label="Inspect physical STL layer" type="range" min="0" max={slices.layers.length-1} value={selectedLayer}
     onChange={e=>{const next=Number(e.target.value);setSelectedLayer(next);
      if(partHash&&slices)onSnapshot?.({partHash,slices,registration,scanPlan,selectedLayer:next});}}/></label>
   <div className="oaPhysicalSliceInspect">
    <div className="oaPhysicalSliceGrid">
     {layer.cells.length<=4500?
      <svg role="img" aria-label={"Sampled STL physical layer "+(selectedLayer+1)+" raster, not a thermal map"}
       viewBox={`0 0 ${slices.grid.columns} ${slices.grid.rows}`} preserveAspectRatio="xMidYMid meet">
       {layer.cells.map(c=><rect key={c.x+"-"+c.y} x={c.x} y={slices.grid.rows-1-c.y}
        width={1} height={1} fill="#61b9dc" opacity={Math.max(.15,c.coverage)}/>)}
      </svg>:<p>More than 4,500 material cells: visualization disabled for performance. Inspect numeric area below or export JSON.</p>}
    </div>
    <div className="oaPhysicalSliceLabels">
     <p><strong>Layer Z</strong> {layer.bottomZMm.toFixed(4)}–{layer.topZMm.toFixed(4)} mm</p>
     <p><strong>Sample Z</strong> {layer.sampleZMm.toFixed(4)} mm</p>
     <p><strong>Estimated section area</strong> {layer.areaMm2.toFixed(3)} mm²</p>
     <p><strong>Raster material cells</strong> {layer.cells.length}</p>
     <p><strong>Fractional boundary cells</strong> {layer.partialCells}</p>
    </div>
   </div>
   <p className="oaSubtle">STL SHA-256: <code>{slices.partSha256}</code>. Signed mesh volume {slices.geometry.analyticalMeshVolumeMm3.toFixed(3)} mm³, estimated sampled volume {slices.geometry.sampledVolumeMm3.toFixed(3)} mm³.</p>
   <details><summary>Resolution, topology and model limitations</summary>
    {slices.diagnostics.map((d,i)=><p className="oaSubtle" key={i}>{d}</p>)}
   </details>
   {registration&&<div role="region" aria-label="Scan-to-STL registration" className="oaPhysicalSliceRegistration">
    <strong>{registration.status==="BLOCKED"?"Scan registration blocked":"Physical scan geometrically registered"}</strong>
    <p>Powered path samples outside represented material: {registration.beamSamplesOutsideMaterial} / {registration.beamSamples}. Maximum physical layer Z difference: {registration.maxLayerZResidualMm.toPrecision(4)} mm.</p>
    <p>Commanded laser energy {registration.commandedLaserEnergyJ.toPrecision(5)} J; this is a CSV energy sum, not simulated absorbed energy.</p>
    <p>Scan SHA-256: <code>{registration.scanSourceSha256}</code>.</p>
    {registration.blockers.map((b,i)=><p key={i} role="alert" className="oaStudyError">{b}</p>)}
    {registration.warnings.map((w,i)=><p key={i} className="oaSubtle">{w}</p>)}
    {scanPlan&&<MetalScanPathPanel slices={slices} scan={scanPlan} registration={registration} selectedLayer={selectedLayer} onSelectLayer={next=>{setSelectedLayer(next);if(partHash)onSnapshot?.({partHash,slices,registration,scanPlan,selectedLayer:next});}}/>}
    <p><strong>Partial-layer solver:</strong> only the separate user-approved research calculation below can run; no thermal solver executes during scan registration.</p>
    {scanFile&&<LpbfStlPartialLayerPanel key={partHash+"-"+registration.scanSourceSha256+"-"+slices.grid.xyPitchMm+"-"+slices.grid.layerThicknessMm} partHash={partHash!} scan={scanFile} slices={slices} registration={registration} options={{
     unitScaleToMm:a.settings.unitScale,xyPitchMm:pitch,layerThicknessMm:thickness,rotationDeg:rotation,translationMm:translation
    }}/>} 
   </div>}
   <button className="oaSecondaryRun" type="button" onClick={exportReport}>Export audited physical STL slices JSON</button>
  </section>}
 </details>;
}
