"use client";
import {useEffect,useRef,useState} from "react";
import type {BuildEdit,BuildEditAssessment,BuildEditSuggestion,BuildEnvelope} from "@/lib/metal-build-edit";

type Reply=
 |{type:"preview";assessment:BuildEditAssessment;suggestions:BuildEditSuggestion[]}
 |{type:"export";output:{stl:string;sourceSha256:string;outputSha256:string;assessment:BuildEditAssessment}}
 |{type:"error";error:string};

export default function MetalBuildEditor({file,partHash,unitScale,confirmed,recipe,onApply}:{
 file:File|null;partHash:string|null;unitScale:number;confirmed:boolean;
 recipe:BuildEdit;onApply:(next:BuildEdit)=>void;
}){
 const [envelope,setEnvelope]=useState<BuildEnvelope>({x:250,y:250,z:300});
 const [approved,setApproved]=useState(false);
 const [status,setStatus]=useState<"idle"|"running"|"ready"|"failed">("idle");
 const [assessment,setAssessment]=useState<BuildEditAssessment|null>(null);
 const [suggestions,setSuggestions]=useState<BuildEditSuggestion[]>([]);
 const [error,setError]=useState("");
 const [exportNote,setExportNote]=useState("");
 const worker=useRef<Worker|null>(null),seq=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const stop=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;worker.current?.terminate();worker.current=null;};
 // Never let a preview survive a changed source, units, machine or transform.
 useEffect(()=>{
  seq.current++;stop();setAssessment(null);setSuggestions([]);setError("");
  setExportNote("");setStatus("idle");setApproved(false);
 },[file,partHash,unitScale,confirmed,
   recipe.rotationDeg.x,recipe.rotationDeg.y,recipe.rotationDeg.z,
   recipe.translationMm.x,recipe.translationMm.y,recipe.translationMm.z,
   envelope.x,envelope.y,envelope.z]);
 useEffect(()=>()=>{seq.current++;stop();},[]);
 const ready=Boolean(file&&partHash&&confirmed&&approved);
 const updateEnvelope=(axis:keyof BuildEnvelope,n:number)=>setEnvelope(v=>({...v,[axis]:n}));
 const updateAxis=(kind:"rotationDeg"|"translationMm",axis:"x"|"y"|"z",value:number)=>
  onApply({...recipe,[kind]:{...recipe[kind],[axis]:value}});
 const execute=async(kind:"preview"|"export")=>{
  if(!ready||status==="running"||!file||!partHash)return;
  if(kind==="export"&&(!assessment||!assessment.insideConfiguredEnvelope))return;
  const id=++seq.current;stop();setStatus("running");setError("");setExportNote("");
  try{
   const source=await file.arrayBuffer();
   if(id!==seq.current)return;
   const w=new Worker(new URL("../../workers/metal-build-edit.worker.ts",import.meta.url));
   worker.current=w;
   const timeout=setTimeout(()=>{
    if(id===seq.current){stop();setStatus("failed");setError("Local metal preparation exceeded 60 seconds. Use a smaller STL.");}
   },60000);
   timer.current=timeout;
   w.onmessage=(event:MessageEvent<Reply>)=>{
    clearTimeout(timeout);
    if(id!==seq.current)return;
    stop();
    const data=event.data;
    if(data.type==="error"){setStatus("failed");setError(data.error);return;}
    if(data.type==="preview"){
     if(data.assessment.sourceSha256!==partHash){setStatus("failed");setError("Source STL changed; edited result was rejected.");return;}
     setAssessment(data.assessment);setSuggestions(data.suggestions);setStatus("ready");
     return;
    }
    if(data.output.sourceSha256!==partHash){setStatus("failed");setError("Export source hash mismatch; file discarded.");return;}
    const blob=new Blob([data.output.stl],{type:"model/stl"});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");anchor.href=url;
    anchor.download=(file.name.replace(/\.stl$/i,"")||"part")+"-ORIENTAI-edited-mm.stl";
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    setExportNote("Edited STL downloaded. Output SHA-256: "+data.output.outputSha256+". Re-upload this separate file to inspect the edited 3D geometry; the original remains unchanged.");
    setStatus("ready");
   };
   w.onerror=()=>{clearTimeout(timeout);if(id===seq.current){stop();setStatus("failed");setError("Local metal preparation worker failed.");}};
   w.postMessage({type:kind,source,sourceSha256:partHash,scale:unitScale,recipe,envelope},[source]);
  }catch(e){if(id===seq.current){stop();setStatus("failed");setError(e instanceof Error?e.message:"STL could not be loaded.");}}
 };
 return <details className="oaBuildEditor" aria-label="Metal build model preparation">
  <summary>Prepare part for metal build · rotate, position & export STL <small>local non-destructive geometry</small></summary>
  <p className="oaSubtle">Rotate and position actual STL coordinates, inspect the configured build envelope, and export a separate transformed STL. Suggestions compare geometric build height only—not strength, distortion or first-time quality. This uses the same rotation and translation recipe as the physical slice workspace below.</p>
  <div className="oaPhysicalSliceParams">
   {(["x","y","z"] as const).map(axis=><label key={"r"+axis}>Rotation {axis.toUpperCase()} (°)
    <input aria-label={"Editor rotation "+axis.toUpperCase()} type="number" step="1" min="-360" max="360" value={recipe.rotationDeg[axis]} disabled={status==="running"}
     onChange={e=>updateAxis("rotationDeg",axis,Number(e.target.value))}/></label>)}
   {(["x","y","z"] as const).map(axis=><label key={"p"+axis}>Translation {axis.toUpperCase()} (mm)
    <input aria-label={"Editor translation "+axis.toUpperCase()} type="number" step="1" value={recipe.translationMm[axis]} disabled={status==="running"}
     onChange={e=>updateAxis("translationMm",axis,Number(e.target.value))}/></label>)}
  </div>
  <p className="oaSubtle">Machine envelope (millimeters). These are editable example dimensions, <strong>not</strong> a verified machine preset.</p>
  <div className="oaPhysicalSliceParams">
   {(["x","y","z"] as const).map(axis=><label key={"e"+axis}>Build envelope {axis.toUpperCase()} (mm)
    <input aria-label={"Editor build envelope "+axis.toUpperCase()} type="number" min="1" max="20000" step="1" value={envelope[axis]} disabled={status==="running"}
     onChange={e=>updateEnvelope(axis,Number(e.target.value))}/></label>)}
  </div>
  <label className="oaLpbfApproval"><input type="checkbox" aria-label="Approve metal build editor assumptions" checked={approved}
   disabled={!confirmed||status==="running"} onChange={e=>setApproved(e.target.checked)}/>
   I verified STL units, source dimensions and this machine's build envelope. I understand only rigid geometry is edited; supports, scans, service loads and thermal fields are not updated.</label>
  {!confirmed&&<p className="oaSubtle">Confirm the uploaded STL units and dimensions before editing.</p>}
  <div className="oaRunActions">
   <button type="button" className="oaSecondaryRun" onClick={()=>void execute("preview")} disabled={!ready||status==="running"}>Inspect model placement</button>
   <button type="button" className="oaRunButton" onClick={()=>void execute("export")}
    disabled={!ready||status==="running"||!assessment?.insideConfiguredEnvelope||Boolean(assessment.sourceAudit.openEdges||assessment.sourceAudit.nonManifoldEdges)}>
    Export edited STL (mm)</button>
  </div>
  {status==="running"&&<p role="status" className="oaSubtle">Applying approved rigid transformation locally; original STL remains unchanged…</p>}
  {error&&<p role="alert" className="oaStudyError">{error}</p>}
  {assessment&&<section className="oaBuildEditorResults" role="region" aria-label="Metal model placement assessment">
   <p><strong>Envelope:</strong> {assessment.insideConfiguredEnvelope?"Geometry fits configured bounding envelope":"Geometry outside configured bounding envelope"}.
    <strong> Build height:</strong> {assessment.boundsMm.dimensions.z.toFixed(3)} mm. <strong>Triangles:</strong> {assessment.triangleCount}.</p>
   <p><strong>Edited bounds (mm):</strong> X {assessment.boundsMm.min.x.toFixed(2)} to {assessment.boundsMm.max.x.toFixed(2)};
    Y {assessment.boundsMm.min.y.toFixed(2)} to {assessment.boundsMm.max.y.toFixed(2)};
    Z {assessment.boundsMm.min.z.toFixed(2)} to {assessment.boundsMm.max.z.toFixed(2)}.</p>
   {assessment.constraintIssues.map((v,i)=><p role="alert" className="oaStudyError" key={i}>{v}</p>)}
   {assessment.sourceAudit.openEdges>0&&<p role="alert" className="oaStudyError">{assessment.sourceAudit.openEdges} open edges: mesh repair required before export.</p>}
   <div className="oaBuildEditorSuggestions"><strong>Geometric suggestions (not AI defect predictions)</strong>
    {suggestions.map(s=><div key={s.id} className="oaBuildEditorSuggestion">
     <div><strong>{s.title}</strong><p>{s.explanation}</p></div>
     {s.proposal&&<button type="button" className="oaSecondaryRun" disabled={status==="running"} onClick={()=>onApply(s.proposal!)}>Apply geometry</button>}
    </div>)}
   </div>
   <p className="oaSubtle">Original SHA-256: <code>{assessment.sourceSha256}</code>. This editor does not create manufacturer toolpaths, certify recoater clearance, or automatically remap engineering loads.</p>
  </section>}
  {exportNote&&<p role="status" className="oaSubtle">{exportNote}</p>}
 </details>;
}
