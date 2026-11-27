"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import type {runRegisteredLayerExperiment} from "@/lib/lpbf-registered-layer-experiment";
import {PHYSICAL_SCAN_HEADER} from "@/lib/lpbf-physical-schedule";
import ResearchThermalPlayback from "./ResearchThermalPlayback";
type Result=Awaited<ReturnType<typeof runRegisteredLayerExperiment>>;
const SCAN=PHYSICAL_SCAN_HEADER+"\n0,0.5,0,0.01,0.25,0.25,0.75,0.25,0.1\n1,1,0.01,0.02,0.75,0.25,0.75,0.25,0\n1,1,0.02,0.03,0.75,0.25,0.25,0.25,0.1";
export default function ResearchThermalLab(){
 const [approved,setApproved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState<Result|null>(null);
 const current=useRef(0),worker=useRef<Worker|null>(null),timer=useRef<number|null>(null);
 const release=()=>{worker.current?.terminate();worker.current=null;if(timer.current!==null)window.clearTimeout(timer.current);timer.current=null;};
 useEffect(()=>()=>{current.current++;release();},[]);
 const cancel=()=>{current.current++;release();setBusy(false);setError("Research run cancelled.");};
 async function run(){
  if(!approved||busy)return;
  const id=++current.current;setBusy(true);setResult(null);setError("");
  try{
   const response=await fetch("/verification/cube-10mm.stl");
   if(!response.ok)throw Error("Public verification fixture unavailable.");
   const stl=await response.arrayBuffer();
   const expectedPartSha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",stl)),v=>v.toString(16).padStart(2,"0")).join("");
   if(id!==current.current)return;
   const csv=new TextEncoder().encode(SCAN).buffer;
   const w=new Worker(new URL("../workers/research-layer-experiment.worker.ts",import.meta.url));worker.current=w;
   timer.current=window.setTimeout(()=>{if(id===current.current){current.current++;release();setBusy(false);setError("Research worker exceeded its time limit.");}},30000);
   w.onmessage=(e:MessageEvent<{id:number;ok:boolean;result?:Result;error?:string}>)=>{
    if(id!==current.current||e.data.id!==id)return;release();setBusy(false);
    if(e.data.ok&&e.data.result)setResult(e.data.result);else setError(e.data.error??"Research worker returned no result.");
   };
   w.onerror=()=>{if(id!==current.current)return;release();setBusy(false);setError("Research worker failed.");};
   w.postMessage({id,stl,csv,expectedPartSha256},[stl,csv]);
  }catch(e){if(id===current.current){release();setBusy(false);setError(e instanceof Error?e.message:"Unable to start research experiment.");}}
 }
 return <main style={{padding:24,maxWidth:980,margin:"auto",display:"grid",gap:16}}>
  <Link href="/copilot/workbench">Return to CAD sandbox</Link>
  <h1>Physical-layer thermal research lab</h1>
  <p>This separate experimental page uses a public synthetic cube scaled to 1 mm, two 0.5 mm layers, a 0.5 mm XY pitch and three explicit scan commands. It does not use your uploaded part or production simulation results.</p>
  <p>Illustrative constant properties and 0.1 W commanded power are numerical test inputs, not an alloy or printing recipe. No melting, distortion, failure probability or qualified process prediction is provided.</p>
  <label><input type="checkbox" checked={approved} disabled={busy} onChange={e=>setApproved(e.target.checked)}/> I understand this is an unvalidated synthetic research experiment.</label>
  <div><button type="button" disabled={!approved||busy} onClick={()=>void run()}>{busy?"Running research worker…":"Run synthetic thermal experiment"}</button>{busy&&<button type="button" onClick={cancel}>Cancel experiment</button>}</div>
  {error&&<p role="alert">{error}</p>}
  {result&&<><p role="status">Research experiment completed: {result.thermal.grid.cellCount} cells, {result.thermal.grid.layers} layers, commanded energy {result.thermal.energy.commandedJ.toFixed(6)} J, absorbed energy {result.thermal.energy.absorbedJ.toFixed(6)} J.</p>
   <p>Relative numerical energy imbalance: {result.thermal.energy.relativeImbalance.toExponential(3)}. Conservation does not establish experimental accuracy.</p>
   <ResearchThermalPlayback thermal={result.thermal} geometry={result.geometry}/>
   <button type="button" onClick={()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=u;a.download="orientai-synthetic-thermal-research.json";a.click();window.setTimeout(()=>URL.revokeObjectURL(u),1500);}}>Export research result JSON</button>
  </>}
 </main>;
}
