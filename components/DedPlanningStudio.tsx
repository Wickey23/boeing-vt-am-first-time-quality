"use client";
import {useEffect,useMemo,useState} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {useAnalysis} from "@/components/AnalysisProvider";
import {DED_WALL_EXAMPLE,planDedWall,simulateReferenceFlow,createSimioExchange,type DedWallInput} from "@/lib/ded-planning";
import {zipTextFiles} from "@/lib/zip-store";

const DedWallViewer=dynamic(()=>import("@/components/DedWallViewer"),{ssr:false});
const STORAGE_KEY="orientai-ded-teaching-scenario-v1";
const geometryFields:Array<[keyof DedWallInput,string]>=[
 ["wallLengthMm","Nominal wall length (mm)"],
 ["wallHeightMm","Nominal wall height (mm)"],
 ["beadWidthMm","Assumed bead width (mm)"],
 ["beadHeightMm","Assumed bead height (mm)"],
 ["substrateLengthMm","Substrate length (mm)"],
 ["substrateWidthMm","Substrate width (mm)"],
 ["substrateThicknessMm","Substrate thickness (mm)"]
];
const pathFields:Array<[keyof DedWallInput,string]>=[
 ["depositionSpeedMmS","Commanded deposition speed (mm/s)"],
 ["traverseSpeedMmS","Commanded reposition speed (mm/s)"],
 ["interpassDwellS","Interpass dwell (s)"]
];
const factoryFields:Array<[keyof DedWallInput,string]>=[
 ["setupMin","Preparation/setup (min)"],
 ["cooldownMin","Cooldown/station occupancy (min)"],
 ["machiningMin","Machining (min)"],
 ["inspectionMin","Inspection (min)"],
 ["batchSize","Number of identical jobs"],
 ["releaseIntervalMin","Time between job releases (min)"]
];
function numeric(value:unknown) {return typeof value==="number"&&Number.isFinite(value)?value:"";}
function numberText(value:number){return Number.isFinite(value)?value.toLocaleString(undefined,{maximumFractionDigits:3}):"—";}
export default function DedPlanningStudio(){
 const a=useAnalysis();
 const [input,setInput]=useState<DedWallInput>(DED_WALL_EXAMPLE);
 const [hydrated,setHydrated]=useState(false);
 const [exportError,setExportError]=useState("");
 useEffect(()=>{
  try{
   const saved=window.localStorage.getItem(STORAGE_KEY);
   if(saved){const data=JSON.parse(saved) as DedWallInput;planDedWall(data);setInput(data);}
  }catch{/* Bad saved drafts never block the teaching example. */}
  setHydrated(true);
 },[]);
 useEffect(()=>{if(!hydrated)return;try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(input));}catch{/* Export remains available if browser storage is off. */}},[hydrated,input]);
 const result=useMemo(()=>{
  try{const plan=planDedWall(input);return {plan,flow:simulateReferenceFlow(plan),error:""};}
  catch(e){return {plan:null,flow:null,error:e instanceof Error?e.message:"Invalid DED wall inputs."};}
 },[input]);
 const edit=(key:keyof DedWallInput,value:string)=>{setExportError("");setInput(s=>({...s,[key]:Number(value)}));};
 const reset=()=>{setInput({...DED_WALL_EXAMPLE});setExportError("");};
 const exportScenario=()=>{
  if(!result.plan||!result.flow)return;
  try{
   const files=createSimioExchange(result.plan,result.flow);
   const readme=[
    "ORIENTAI / Simio Data-Table Exchange - RESEARCH TEACHING SCENARIO",
    "",
    "This ZIP contains CSV inputs for creating a Simio model. It is NOT a Simio model",
    "file and was NOT produced by a Simio runtime.",
    "Source geometry: synthetic single-bead wall on rectangular substrate.",
    "Machine reach and collisions: NOT VERIFIED.",
    "Quality, residual stress, distortion, thermal simulation: NOT EVALUATED.",
    "",
    "In Simio, create a model with Source, Server/Resource and Sink stages.",
    "Create tables with matching CSV column names; use CSV Data Connectors and",
    "bindings to import jobs.csv, operations.csv and resources.csv.",
    "Map each operation sequence/resource and arrival schedule explicitly.",
    "Run validated experiments and export statistics; do not treat",
    "reference-results.csv as results from Simio.",
    "Duration assumptions are deterministic, capacity one and continuous availability.",
    "No stochastic failures, shifts, scrap, or rework are modeled.",
    "",
    "The process path and dimensions are illustrative, not printer G-code.",
    "No manufacturing or aerospace approval is claimed.",
    ""
   ].join("\n");
   const zip=zipTextFiles({...files,"README.txt":readme});
   const blob=new Blob([zip],{type:"application/zip"});
   const url=URL.createObjectURL(blob);
   const link=document.createElement("a");
   link.href=url;link.download="orientai-"+result.plan.scenarioId+"-simio-exchange.zip";
   document.body.appendChild(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(e){setExportError(e instanceof Error?e.message:"Export failed.");}
 };
 const fieldSet=(fields:Array<[keyof DedWallInput,string]>)=>fields.map(([key,label])=>
  <label key={key}>{label}<input type="number" step={key==="batchSize"?1:"any"} value={numeric(input[key])} onChange={e=>edit(key,e.target.value)}/></label>
 );
 if(!a.ready)return <p role="status">Restoring the workspace…</p>;
 return <>
  <section className="studioCard" style={{marginBottom:16}}>
   <h2>Process-correct DED planning · first working demonstrator</h2>
   <p>This workspace calculates deposition paths and commanded movement for a <strong>synthetic single-bead wall</strong> on a substrate, then compares a deterministic sequence of factory operations. It does not turn an arbitrary STL into executable deposition instructions.</p>
   <div className="guidedNotice">
    <strong>Part association: {a.file?"An STL is loaded: "+a.file.name:"No STL is loaded"}</strong>
    <p>{a.file?"Your uploaded component and saved service cases remain available in the Part Workspace. This DED wall is independent teaching geometry and these estimates DO NOT describe your uploaded part.":"Use the synthetic wall for the DED example, or open the Part Workspace to upload and analyze your own STL separately."}</p>
    <Link href="/orientation">Open part and service-load workspace →</Link>
   </div>
  </section>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,360px),1fr))",gap:16,alignItems:"start"}}>
   <section className="studioCard">
    <h2>1. Configure the metal deposition process</h2>
    <p>Only laser wire-fed and blown-powder DED are included in this research geometry demonstrator. Arc-wire and electron-beam DED require separate models.</p>
    <label>Process variant<select aria-label="DED process variant" value={input.process} onChange={e=>setInput(s=>({...s,process:e.target.value as DedWallInput["process"]}))}>
     <option value="DED_LB_WIRE">Laser wire-fed DED (hot-wire configuration not modeled)</option>
     <option value="DED_LB_POWDER">Laser powder-fed DED (capture efficiency not modeled)</option>
    </select></label>
    <label>Material identification (not qualified properties)<input value={input.materialLabel} maxLength={120} onChange={e=>setInput(s=>({...s,materialLabel:e.target.value}))}/></label>
    <h3>Nominal part and substrate geometry</h3>
    <div className="studioFields">{fieldSet(geometryFields)}</div>
    <h3>Deposition strategy and commanded motion</h3>
    <label>Track direction<select aria-label="Track strategy" value={input.strategy} onChange={e=>setInput(s=>({...s,strategy:e.target.value as DedWallInput["strategy"]}))}>
     <option value="alternating">Alternate direction between layers</option>
     <option value="one-way">Deposit in one direction; return without deposition</option>
    </select></label>
    <div className="studioFields">{fieldSet(pathFields)}</div>
    <label>Assumed laser power, optional (W)<input type="number" step="any" placeholder="Unknown" value={input.powerW??""} onChange={e=>setInput(s=>({...s,powerW:e.target.value===""?null:Number(e.target.value)}))}/></label>
    <small>When entered, power/speed produces linear energy (J/mm), not a predicted melt pool, porosity risk or pass/fail threshold.</small>
    <details style={{marginTop:12}}>
      <summary>Axis-aligned machine box (optional, not robot reach)</summary>
      <label><input type="checkbox" checked={input.machineEnvelopeMm!==null} onChange={e=>setInput(s=>({...s,machineEnvelopeMm:e.target.checked?{x:150,y:100,z:100}:null}))}/> Enter a nominal illustrative machine envelope</label>
      {input.machineEnvelopeMm&&<div className="studioFields">{(["x","y","z"] as const).map(axis=><label key={axis}>Box {axis.toUpperCase()} (mm)<input type="number" step="any" value={numeric(input.machineEnvelopeMm?.[axis])} onChange={e=>setInput(s=>({...s,machineEnvelopeMm:{...s.machineEnvelopeMm!,[axis]:Number(e.target.value)}}))}/></label>)}</div>}
      <p>A passing box check cannot verify motion axes, nozzle clearance, shielding, substrate clamps or actual process settings.</p>
    </details>
    <button onClick={reset} className="studioAction secondary" style={{marginTop:14}}>Reset example inputs</button>
   </section>
   <section className="studioCard">
    <h2>2. Inspect deposition sequence</h2>
    {result.plan?<><DedWallViewer plan={result.plan}/>
      <div className="studioFields" style={{marginTop:14}}>
        <div><small>Deposited tracks</small><h3>{result.plan.layers}</h3></div>
        <div><small>Total deposition length</small><h3>{numberText(result.plan.depositionLengthMm)} mm</h3></div>
        <div><small>Nominal bead-swept volume</small><h3>{numberText(result.plan.nominalVolumeMm3)} mm³</h3></div>
        <div><small>Commanded motion + dwell</small><h3>{numberText(result.plan.commandedSubtotalSeconds/60)} min</h3></div>
      </div>
      <p><strong>Deposition motion:</strong> {numberText(result.plan.depositionSeconds)} s · <strong>Reposition:</strong> {numberText(result.plan.repositionSeconds)} s · <strong>Dwell:</strong> {numberText(result.plan.interpassSeconds)} s</p>
      <p>Machine envelope: <strong>{result.plan.envelopeCheck==="NOT_CONFIGURED"?"Not evaluated":result.plan.envelopeCheck==="BOX_FITS"?"Nominal box fits — machine reach unverified":"Entered box exceeded"}</strong>.</p>
      <p>Power per travel length: {result.plan.linearEnergyJMm===null?"Not evaluated (power unknown)":numberText(result.plan.linearEnergyJMm)+" J/mm (input ratio only)"}.</p>
      <details><summary>Review full track schedule</summary><div style={{overflowX:"auto",maxHeight:220}}><table className="studioCandidateTable"><thead><tr><th>Layer</th><th>Direction</th><th>Start (s)</th><th>End (s)</th></tr></thead><tbody>{result.plan.tracks.map(t=><tr key={t.index}><td>{t.layer}</td><td>{t.to[0]>t.from[0]?"+X":"−X"}</td><td>{numberText(t.startTimeS)}</td><td>{numberText(t.endTimeS)}</td></tr>)}</tbody></table></div></details>
      <div className="guidedNotice"><strong>Engineering limitations</strong>{result.plan.warnings.map((w,i)=><p key={i}>{w}</p>)}<p>Thermal history, distortion, material strength and manufacturing acceptance: <strong>NOT EVALUATED</strong>.</p></div>
    </>:<p role="alert">Unable to calculate: {result.error}</p>}
   </section>
  </div>
  <section className="studioCard" style={{marginTop:16}}>
    <h2>3. Manufacturing flow · deterministic reference simulation</h2>
    <p>Configure example durations to estimate queueing for an identical batch. This is an internal, single-server, FIFO research model — <strong>not a Simio runtime, an observed factory forecast, or a first-pass quality predictor</strong>.</p>
    <div className="studioFields">{fieldSet(factoryFields)}</div>
    {result.flow&&result.plan?<><div className="studioFields" style={{marginTop:14}}>
      <div><small>Completed jobs (no scrap modeled)</small><h3>{result.flow.completed}</h3></div>
      <div><small>Mean lead time</small><h3>{numberText(result.flow.meanLeadTimeMin)} min</h3></div>
      <div><small>Mean queue time</small><h3>{numberText(result.flow.meanQueueTimeMin)} min</h3></div>
      <div><small>Throughput over modeled horizon</small><h3>{numberText(result.flow.throughputPerHour)} jobs/h</h3></div>
    </div>
    <details><summary>Resource utilization and assumptions</summary>
      {Object.entries(result.flow.utilization).map(([name,v])=><p key={name}>{name.replaceAll("_"," ")}: {numberText(v*100)}% busy (continuous availability assumed)</p>)}
      {result.flow.assumptions.map((a,i)=><p key={i}>{a}</p>)}
    </details>
    <button type="button" className="studioAction primary" onClick={exportScenario} style={{marginTop:14}}>Export scenario for Simio (ZIP)</button>
    {exportError&&<p role="alert">{exportError}</p>}
    <p><small>Includes CSV tables for operations, resources, jobs and tracks; a JSON manifest; internal reference results; and setup instructions. You must create/bind a model in licensed Simio to run a genuine Simio experiment.</small></p>
    </>:<p role="alert">Resolve the invalid input above before calculating or exporting a factory scenario.</p>}
  </section>
  <section className="studioCard" style={{marginTop:16}}>
    <h2>4. Engineering simulation and validation status</h2>
    <div className="studioFields">
      <article><strong>Service FEA</strong><p>Existing idealized part-specific voxel solver. Use the Part Workspace; actual mounting regions and conforming FEA remain to be implemented.</p><Link href="/orientation">Review service cases →</Link></article>
      <article><strong>Thermal history</strong><p>NOT EVALUATED for DED. Existing steady conduction calculations are not deposition thermal history.</p><Link href="/simulation/benchmarks">View verification benchmarks →</Link></article>
      <article><strong>Process distortion</strong><p>NOT EVALUATED. Requires measured thermal/distortion references, release assumptions and calibrated physics.</p></article>
      <article><strong>Manufacturing quality</strong><p>NOT EVALUATED. No defect or first-pass acceptance probability is predicted.</p></article>
    </div>
    <p>Research inspiration: NIST AM Bench 2025 laser hot-wire DED studies. The example dimensions and process settings above are illustrative, not reproduced NIST build conditions.</p>
  </section>
 </>;
}
