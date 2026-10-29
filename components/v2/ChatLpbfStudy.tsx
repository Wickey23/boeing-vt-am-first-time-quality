"use client";
import {useEffect,useRef,useState} from "react";
import {LPBF_DEMO_INPUTS,LPBF_MODEL_VERSION,validateLpbfInputs,type LpbfInputs,type LpbfResult} from "@/lib/lpbf-transient";
import {useAnalysis} from "@/components/AnalysisProvider";
import {MOVING_DEMO_INPUTS,MOVING_SOURCE_VERSION,validateMovingInputs} from "@/lib/lpbf-moving-source";
import {Play,Square,AlertTriangle} from "lucide-react";
const labels:Partial<Record<keyof LpbfInputs,string>>={
 laserPowerW:"Laser power (W)",scanSpeedMmS:"Scan speed (mm/s)",hatchSpacingMm:"Hatch spacing (mm)",
 layerThicknessMm:"Layer thickness (mm)",absorbedFraction:"Effective solid energy coupling (0–1)",
 recoatSecondsPerLayer:"Recoating dwell per physical layer (s)",densityKgM3:"Density (kg/m³)",
 specificHeatJKgK:"Specific heat (J/kg·K)",conductivityWmK:"Conductivity (W/m·K)",
 solidusC:"Nominal material solidus (°C)",ambientTemperatureC:"Ambient temperature (°C)",
 plateTemperatureC:"Build plate temperature (°C)",convectionWm2K:"Convective coefficient (W/m²·K)",
 resolution:"Thermal voxel resolution (6–16)"
};
type Event={type:"progress";done:number;total:number}|{type:"result";result:LpbfResult;partHash:string}|{type:"error";error:string};
export default function ChatLpbfStudy({partHash,confirmed,onResult,onFocus}:{
 partHash:string|null;confirmed:boolean;
 onResult:(v:LpbfResult|null)=>void;onFocus:(frame:number)=>void
}){
 const a=useAnalysis();
 const [inputs,setInputs]=useState<LpbfInputs>(LPBF_DEMO_INPUTS);
 const [mode,setMode]=useState<"uniform"|"moving">("uniform");
 const [movingExtra,setMovingExtra]=useState({beamRadiusMm:MOVING_DEMO_INPUTS.beamRadiusMm,liquidusC:MOVING_DEMO_INPUTS.liquidusC,latentHeatJKg:MOVING_DEMO_INPUTS.latentHeatJKg});
 const [approved,setApproved]=useState(false);
 const [status,setStatus]=useState<"idle"|"running"|"completed"|"failed"|"cancelled">("idle");
 const [progress,setProgress]=useState(0),[error,setError]=useState("");
 const [result,setResult]=useState<LpbfResult|null>(null);
 const worker=useRef<Worker|null>(null),seq=useRef(0),timeout=useRef<ReturnType<typeof setTimeout>|null>(null);
 const enabled=Boolean(a.file&&partHash&&partHash!=="no-part"&&confirmed&&a.journey.process==="PBF_LB_METAL");
 let invalid="";
 try{if(mode==="moving")validateMovingInputs({...inputs,...movingExtra});else validateLpbfInputs(inputs);}catch(e){invalid=e instanceof Error?e.message:"Invalid inputs";}
 const close=()=>{if(timeout.current)clearTimeout(timeout.current);timeout.current=null;worker.current?.terminate();worker.current=null;};
 const invalidate=()=>{
  seq.current++;close();setApproved(false);setResult(null);onResult(null);setStatus("idle");setProgress(0);setError("");
 };
 useEffect(()=>{invalidate();return()=>{seq.current++;close()};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[partHash,a.file,a.settings.unitScale,a.journey.process]);
 const change=(key:keyof LpbfInputs,value:number)=>{if(status==="running")return;setInputs(prev=>({...prev,[key]:value}));invalidate();};
 const changeExtra=(key:keyof typeof movingExtra,value:number)=>{if(status==="running")return;setMovingExtra(prev=>({...prev,[key]:value}));invalidate();};
 const changeMode=(next:"uniform"|"moving")=>{if(status==="running"||mode===next)return;invalidate();setMode(next);if(next==="moving")setInputs({...MOVING_DEMO_INPUTS});else setInputs({...LPBF_DEMO_INPUTS});};
 const cancel=()=>{seq.current++;close();setStatus("cancelled");setError("Study cancelled. No result was published.");};
 const exportSummary=()=>{
  if(!result||!a.file||!partHash)return;
  const record={
   schema:"orientai.lpbf-research-run.v1",createdAt:new Date().toISOString(),
   part:{fileName:a.file.name,sha256:partHash,unitScaleToMm:a.settings.unitScale},
   model:result.engine,inputApproval:"engineer-acknowledged-research-assumptions",
   inputs:result.inputs,mesh:result.mesh,summary:result.summary,
   snapshots:result.frames.map(({field,...frame})=>frame),
   limitations:result.limitations,
   notice:"Research heat-flow only. No calibrated print-defect or qualification predictions. Surface field arrays are not included."
  };
  const uri=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:"application/json"}));
  const anchor=document.createElement("a");anchor.href=uri;anchor.download="orientai-lpbf-thermal-"+partHash.slice(0,12)+".json";
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(uri),2000);
 };
 const run=async()=>{
  if(!enabled||!approved||invalid||status==="running"||!a.file||!partHash)return;
  const token=++seq.current;close();setError("");setResult(null);onResult(null);setStatus("running");setProgress(0);
  try{
   const buffer=await a.file.arrayBuffer();if(token!==seq.current)return;
   const w=new Worker(new URL("../../workers/lpbf-transient.worker.ts",import.meta.url));worker.current=w;
   timeout.current=setTimeout(()=>{if(token===seq.current){close();setStatus("failed");setError("Transient research worker timed out after 120 seconds; no result published.");}},120000);
   w.onmessage=(event:MessageEvent<Event>)=>{
    if(token!==seq.current)return;const msg=event.data;
    if(msg.type==="progress"){setProgress(Math.max(0,Math.min(100,Math.round(msg.done/msg.total*100))));return;}
    close();
    if(msg.type==="error"){setStatus("failed");setError(msg.error);return;}
    if(msg.partHash!==partHash){setStatus("failed");setError("Part identity changed. Discarded stale result.");return;}
    setResult(msg.result);onResult(msg.result);setStatus("completed");setProgress(100);onFocus(msg.result.frames.length-1);
   };
   w.onerror=()=>{if(token===seq.current){close();setStatus("failed");setError("Thermal worker failed. No result published.");}};
   w.postMessage({file:buffer,unitScale:a.settings.unitScale,inputs:mode==="moving"?{...inputs,...movingExtra}:{...inputs},partHash,mode},[buffer]);
  }catch(e){if(token===seq.current){close();setStatus("failed");setError(e instanceof Error?e.message:"Could not start thermal study.");}}
 };
 return <section className="oaLpbfRunbook" aria-label="LPBF process thermal research study">
  <h3>Layer-resolved heat-flow prototype <small>{mode==="moving"?MOVING_SOURCE_VERSION:LPBF_MODEL_VERSION}</small></h3>
  <label className="oaLpbfMode">Research thermal model
   <select aria-label="Thermal model" value={mode} disabled={status==="running"}
    onChange={e=>changeMode(e.target.value as "uniform"|"moving")}>
    <option value="uniform">Coarse uniform slab source (solid-state)</option>
    <option value="moving">Moving Gaussian raster + latent heat (experimental)</option>
   </select></label>
  <p className="oaSubtle">{mode==="moving"?
   "A generated, repeating serpentine raster moves a Gaussian heat source across each coarse activated slab. A linear equilibrium solidus–liquidus enthalpy interval adds latent heat. The tool does not use actual machine scan paths, resolve a real beam spot, or validate melt-pool geometry.":
   "Coarse layer activation and solid-state 3D voxel heat diffusion. Uniform absorbed heat per virtual slab, idealized plate contact and convection. No moving laser, latent heat, melt pool, powder-bed physics or calibrated failure predictions."}</p>
  <div className="oaLpbfInputs">{(Object.entries(labels) as [keyof LpbfInputs,string][]).map(([key,label])=>
   <label key={key}>{label}<input aria-label={label} type="number" step="any" disabled={status==="running"}
    value={inputs[key]} onChange={e=>change(key,Number(e.target.value))}/></label>)}</div>
  {mode==="moving"&&<div className="oaLpbfInputs oaMovingInputs">
   <label>Gaussian beam radius (mm)<input aria-label="Gaussian beam radius (mm)" type="number" step="any" disabled={status==="running"} value={movingExtra.beamRadiusMm} onChange={e=>changeExtra("beamRadiusMm",Number(e.target.value))}/></label>
   <label>Liquidus temperature (°C)<input aria-label="Liquidus temperature (°C)" type="number" step="any" disabled={status==="running"} value={movingExtra.liquidusC} onChange={e=>changeExtra("liquidusC",Number(e.target.value))}/></label>
   <label>Latent heat of fusion (J/kg)<input aria-label="Latent heat of fusion (J/kg)" type="number" step="any" disabled={status==="running"} value={movingExtra.latentHeatJKg} onChange={e=>changeExtra("latentHeatJKg",Number(e.target.value))}/></label>
  </div>}
  <p className="oaSubtle">The shown Ti-6Al-4V-like parameters are an illustrative teaching starting point, <strong>not verified material properties or a qualified machine parameter set</strong>. Replace every value with documented conditions before interpreting a result.</p>
  <label className="oaLpbfApproval"><input aria-label="Approve research thermal assumptions" checked={approved} disabled={status==="running"} onChange={e=>setApproved(e.target.checked)} type="checkbox"/>
    I have reviewed the material properties, energy coupling, scan assumptions, geometry and units. I understand this is an unvalidated research approximation, not a validated LPBF or failure simulation.</label>
  {!enabled&&<p className="oaStudyError">Upload an STL, confirm units and select LPBF before running this worker.</p>}
  {invalid&&<p role="alert" className="oaStudyError">{invalid}</p>}
  <div className="oaRunActions"><button type="button" className="oaRunButton" disabled={!enabled||!!invalid||!approved||status==="running"} onClick={()=>void run()}><Play size={15}/> Run research thermal worker</button>
   {status==="running"&&<button type="button" className="oaSecondaryRun" onClick={cancel}><Square size={13}/> Cancel</button>}
  </div>
  {status==="running"&&<><progress aria-label="Transient worker progress" className="oaRunProgress" max={100} value={progress}/><p role="status" className="oaSubtle">Calculating virtual build slabs: {progress}%</p></>}
  {error&&<p role="alert" className="oaStudyError">{error}</p>}
  {result&&<div className="oaLpbfResult" aria-label="Research thermal result">
   <div className="oaLpbfMetrics">
    <div><small>Represented layers</small><strong>{result.mesh.virtualSlabs} slabs / {result.mesh.nominalLayers} nominal layers</strong></div>
    <div><small>Modeled build duration</small><strong>{(result.summary.elapsedSeconds/60).toFixed(1)} min</strong></div>
    <div><small>Peak modeled temperature</small><strong>{result.summary.peakSolidTemperatureC.toFixed(1)} °C</strong></div>
    <div><small>Energy-balance error</small><strong>{(result.summary.relativeEnergyImbalance*100).toFixed(4)}%</strong></div>
   </div>
   {result.engine===MOVING_SOURCE_VERSION?
   <p role="status" className="oaLpbfWarning"><AlertTriangle size={16}/> Research enthalpy approximation: {result.summary.exceedsSolidus?
    "Model enters the equilibrium phase-change interval, but calculated melt fractions and temperature fields are not calibrated to a physical melt pool.":
    "Temperatures remain below the assumed solidus for this model, which does not establish print failure absence."} Actual laser spot, powder thermophysics and phase-boundary geometry are unresolved.</p>:
   result.summary.exceedsSolidus?<p role="alert" className="oaLpbfWarning"><AlertTriangle size={16}/> Temperature crossed the supplied solidus. Solid-state model assumptions have broken down; peak temperature and implied melt behavior are not validated.</p>:
   <p className="oaSubtle">Numerical energy accounting passed. This does not establish experimental model validity.</p>}
   <p className="oaSubtle">Total assumed coupled laser energy: {result.summary.absorbedEnergyJ.toFixed(1)} J. {result.engine===MOVING_SOURCE_VERSION?"Heat source follows an invented serpentine raster on coarse slabs; actual scan paths and beam-scale temperatures are not resolved.":"Mean-field history is represented by coarse slabs, not physical scan tracks."}</p>
   <button className="oaSecondaryRun" type="button" onClick={()=>onFocus(result.frames.length-1)}>Inspect transient temperature in 3D</button>
   <button className="oaSecondaryRun" type="button" onClick={exportSummary}>Export research run JSON</button>
  </div>}
 </section>;
}
