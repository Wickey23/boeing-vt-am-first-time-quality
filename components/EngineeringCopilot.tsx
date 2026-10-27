"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {useAnalysis} from "@/components/AnalysisProvider";
import {usePartInspection} from "@/components/PartInspection";
import ViewerErrorBoundary from "@/components/ViewerErrorBoundary";
import {completedPart,allowsGeometryRanking} from "@/lib/engineering-journey";
import {activeServiceCase} from "@/lib/service-plan";
import {
 addProjectSource,blankKnowledge,createMessage,findEvidence,localCopilotReply,nextEngineeringQuestion,
 restoreKnowledge,updateSourceNotes,type ProjectKnowledge,type CopilotMessage,type ProjectSource
} from "@/lib/copilot-context";
import "./copilot.css";
const Viewer=dynamic(()=>import("@/components/ModelViewer"),{ssr:false});
const Structural=dynamic(()=>import("@/components/PartStructuralPanel"),{ssr:false});
const Thermal=dynamic(()=>import("@/components/PartThermalPanel"),{ssr:false});
const storagePrefix="orientai-engineering-context-v1-";
const stat=(value:boolean)=>value?"Completed":"Not yet";
export default function EngineeringCopilot(){
 const a=useAnalysis();
 const [partKey,setPartKey]=useState<string|null>(null);
 const [knowledge,setKnowledge]=useState<ProjectKnowledge|null>(null);
 const [draft,setDraft]=useState("");
 const [busy,setBusy]=useState(false);
 const [docBusy,setDocBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [privacyConsent,setPrivacyConsent]=useState(false);
 const [includePdfs,setIncludePdfs]=useState(false);
 const [aiEnabled,setAiEnabled]=useState(false);
 const [acknowledgedLoads,setAcknowledgedLoads]=useState(false);
 const [structuralOpen,setStructuralOpen]=useState(false);
 const [thermalOpen,setThermalOpen]=useState(false);
 const [url,setUrl]=useState<string>();
 const [showFields,setShowFields]=useState<"geometry"|"stress"|"displacement"|"thermal">("geometry");
 const docs=useRef(new Map<string,File>());
 const timeline=useRef<HTMLDivElement|null>(null);
 const inspect=usePartInspection(a.file,a.settings.unitScale);
 const verified=completedPart(a.journey,a.file,a.settings.unitScale);
 const isLPBF=allowsGeometryRanking(a.journey);
 const currentCandidate=a.result?.candidates.find(c=>c.id===a.selected);
 const sourceList=knowledge?.sources??[];
 const orientationReady=Boolean(a.result&&isLPBF&&currentCandidate);
 const activeCase=activeServiceCase(a.servicePlan);
 useEffect(()=>{
  fetch("/api/engineering-copilot",{cache:"no-store"}).then(r=>r.json()).then(r=>setAiEnabled(r.enabled===true)).catch(()=>setAiEnabled(false));
 },[]);
 useEffect(()=>{
  if(!a.file){setUrl(undefined);return;}
  const object=URL.createObjectURL(a.file);setUrl(object);return()=>URL.revokeObjectURL(object);
 },[a.file]);
 useEffect(()=>{
  let current=true;
  docs.current.clear();setKnowledge(null);setPartKey(null);setPrivacyConsent(false);setIncludePdfs(false);setAcknowledgedLoads(false);
  if(!a.ready)return;
  if(a.journey.mode==="ded-example"){
   setPartKey("ded-example");return;
  }
  if(!a.file){setPartKey("empty");return;}
  a.file.arrayBuffer().then(buffer=>crypto.subtle.digest("SHA-256",buffer)).then(digest=>{
   if(!current)return;
   setPartKey(Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join(""));
  }).catch(()=>{if(current)setError("Could not fingerprint the STL; document context has not been loaded.");});
  return ()=>{current=false;};
 },[a.ready,a.file,a.journey.mode]);
 useEffect(()=>{
  if(!partKey)return;
  try{
   const saved=localStorage.getItem(storagePrefix+partKey);
   setKnowledge(saved?restoreKnowledge(JSON.parse(saved),partKey):blankKnowledge(partKey));
  }catch{setKnowledge(blankKnowledge(partKey));}
 },[partKey]);
 useEffect(()=>{
  if(!partKey||!knowledge||knowledge.partKey!==partKey)return;
  try{localStorage.setItem(storagePrefix+partKey,JSON.stringify({...knowledge,
   sources:knowledge.sources.map(s=>({...s,extractedText:s.extractedText.slice(0,30000)})),
   messages:knowledge.messages.slice(-35)}));}
  catch{setNotice("Local browser storage is full; copy your notes and export the project before leaving.");}
 },[partKey,knowledge]);
 useEffect(()=>{timeline.current?.scrollTo({top:timeline.current.scrollHeight,behavior:"smooth"});},[knowledge?.messages.length]);
 const update=(key:"componentName"|"assemblyContext"|"attachmentNotes"|"reviewedRequirements",v:string)=>
  setKnowledge(s=>s?{...s,[key]:v.slice(0,key==="componentName"?160:4000)}:s);
 const upload=(f:File|null)=>{
  if(!f)return;setNotice("");setError("");setPrivacyConsent(false);docs.current.clear();
  a.upload(f);a.setProjectName(f.name.replace(/\.stl$/i,""));
 };
 const uploadDocuments=async(files:FileList|null)=>{
  if(!files||!knowledge)return;
  setDocBusy(true);setError("");let updated=knowledge.sources;
  try{
   for(const file of Array.from(files)){
    updated=await addProjectSource(updated,file);
    docs.current.set(updated[updated.length-1].id,file);
   }
   setKnowledge(s=>s&&s.partKey===knowledge.partKey?{...s,sources:updated}:s);
   setNotice("References registered. Plain text was extracted locally; PDFs/Office documents require cited excerpts or explicitly approved AI input.");
  }catch(e){setError(e instanceof Error?e.message:"Could not read reference document");}
  finally{setDocBusy(false);}
 };
 const removeSource=(id:string)=>{docs.current.delete(id);setKnowledge(s=>s?{...s,sources:s.sources.filter(x=>x.id!==id),
   messages:s.messages.map(m=>({...m,sourceIds:m.sourceIds.filter(x=>x!==id)}))}:s);};
 const opts={
  partName:a.journey.mode==="ded-example"?"DED teaching wall":a.file?.name??null,
  confirmed:verified,
  hasOrientation:orientationReady,
  loadsReviewed:acknowledgedLoads&&Boolean(knowledge?.reviewedRequirements.trim()),
  process:a.journey.process
 };
 const append=(items:CopilotMessage[])=>setKnowledge(s=>s?{...s,messages:[...s.messages,...items].slice(-45)}:s);
 const askLocal=()=>{
  if(!knowledge)return;
  const question=draft.trim();
  const response=localCopilotReply(knowledge,question,opts);
  append([...(question?[createMessage("user",question,"user")]:[]),createMessage("assistant",response.text,"local_guide",response.sourceIds)]);
  setDraft("");
 };
 const askAI=async()=>{
  if(!knowledge||!privacyConsent||!aiEnabled||!draft.trim()||busy)return;
  setBusy(true);setError("");const prompt=draft.trim();
  const user=createMessage("user",prompt,"user");append([user]);setDraft("");
  try{
   let pdfs:{name:string;data:string}[]=[];
   if(includePdfs){
    for(const source of knowledge.sources.filter(s=>s.kind==="pdf").slice(0,2)){
     const file=docs.current.get(source.id);
     if(!file)continue;
     if(file.size>2_000_000)throw Error(source.name+" is too large to send. Limit PDF input to 2 MB.");
     const bytes=new Uint8Array(await file.arrayBuffer());
     let binary="";for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
     pdfs.push({name:source.name,data:btoa(binary)});
    }
   }
   const response=await fetch("/api/engineering-copilot",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({allowExternal:true,message:prompt,
     project:{name:a.projectName,partName:opts.partName,confirmed:verified,process:a.journey.process,
      componentName:knowledge.componentName,assemblyContext:knowledge.assemblyContext,
      attachmentNotes:knowledge.attachmentNotes,requirements:knowledge.reviewedRequirements,hasOrientation:orientationReady},
     history:knowledge.messages.slice(-10).map(m=>({role:m.role,text:m.text})),
     sources:knowledge.sources.map(s=>({id:s.id,name:s.name,text:s.extractedText,notes:s.engineerNotes})),
     pdfs})
   });
   const payload=await response.json();
   if(!response.ok)throw Error(typeof payload.error==="string"?payload.error:"AI request failed");
   append([createMessage("assistant",payload.text,"model",Array.isArray(payload.sourceIds)?payload.sourceIds:[])]);
  }catch(e){setError((e instanceof Error?e.message:"AI unavailable")+" No unsupported simulation was executed.");}
  finally{setBusy(false);}
 };
 const runGeometry=()=>{
  if(!verified||!isLPBF){setError("Confirm an uploaded STL and select LPBF geometric screening first.");return;}
  setError("");a.retry();setNotice("Started local orientation screening. The progress and results below come from the actual geometry worker.");
 };
 const saveContext=()=>{
  if(!knowledge)return;
  const body=JSON.stringify({...knowledge,rawPartBytesIncluded:false,documentBytesIncluded:false,
   engineeringReview:"Research context; engineer confirmations and source inspection required."},null,2);
  const blob=new Blob([body],{type:"application/json"}),u=URL.createObjectURL(blob);
  const anchor=document.createElement("a");anchor.href=u;anchor.download="orientai-"+(partKey??"context").slice(0,12)+"-context.json";
  document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
 };
 const references=useMemo(()=>findEvidence(sourceList,knowledge?.reviewedRequirements||knowledge?.componentName||"",4),[sourceList,knowledge?.reviewedRequirements,knowledge?.componentName]);
 const verifiedStructural=Boolean(a.result?.structural&&isLPBF);
 const verifiedThermal=Boolean(a.result?.thermal&&isLPBF);
 if(!a.ready||!knowledge)return <div className="copilotLoading" role="status">Restoring the part and engineering context…</div>;
 return <div className="copilotGrid">
  <section className="copilotLeft">
    <header className="copilotHeading"><h2>Part and assembly context</h2><p>One source of truth for the selected geometry, project references, and evidence.</p></header>
    <div className="copilotFrame">
      {url&&a.file?<ViewerErrorBoundary><Viewer url={url} unitScale={a.settings.unitScale}
        rotation={orientationReady?currentCandidate?.rotation:undefined} overhangDeg={a.settings.overhangDeg}
        showOverhangs={orientationReady} field={
        showFields==="stress"&&isLPBF?a.result?.structural?.field.stress:
        showFields==="displacement"&&isLPBF?a.result?.structural?.field.displacement:
        showFields==="thermal"&&isLPBF&&a.result?.thermal?.candidateId===a.selected?a.result.thermal.field:undefined
       } fieldLabel={showFields==="stress"?"Stress":showFields==="displacement"?"Displacement":showFields==="thermal"?"Steady temperature":undefined}/></ViewerErrorBoundary>:
        <div className="copilotEmpty"><strong>{a.journey.mode==="ded-example"?"DED teaching wall selected":"Upload your part STL"}</strong><span>{a.journey.mode==="ded-example"?"This is a synthetic example, not a real part.":"The AI uses your description and engineering documents to understand its role."}</span></div>}
    </div>
    {a.file&&<div className="copilotSummary"><strong>{a.file.name}</strong><span>{inspect.data?Object.values(inspect.data.dimensions).map(x=>x.toFixed(2)).join(" × ")+" mm":"Inspecting dimensions…"}</span></div>}
    <label className="copilotUpload">Upload or replace target STL
     <input type="file" accept=".stl" aria-label="Upload target STL" onChange={e=>{upload(e.target.files?.[0]??null);e.currentTarget.value="";}}/>
    </label>
    {a.file&&!verified&&<div className="copilotConfirm">
      <label>STL units<select aria-label="STL input units" value={a.settings.unitScale} onChange={e=>a.update("unitScale",Number(e.target.value))}>
       <option value={1}>Millimeters</option><option value={25.4}>Inches</option><option value={1000}>Meters</option></select></label>
      {inspect.data?.audit.findings.filter(f=>f.level==="blocker").map(f=><p role="alert" key={f.code}>{f.code}: {f.message}</p>)}
      <button type="button" disabled={!inspect.data||inspect.data.audit.findings.some(f=>f.level==="blocker")} onClick={()=>a.confirmPart()}>Confirm inspected dimensions and units</button>
    </div>}
    <div className="copilotSummary"><span>Process: <b>{a.journey.process}</b></span><span>Geometry: <b>{stat(verified)}</b></span></div>
    <div className="copilotDocs">
      <h3>Assembly documentation</h3>
      <p>Attach drawings, requirements and assembly documentation. Plain-text formats are read locally. PDF/Office content is not automatically interpreted as verified engineering data.</p>
      <label>Reference documents
        <input aria-label="Add reference documents" type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.xls,.txt,.md,.csv,.json" disabled={docBusy} onChange={e=>{void uploadDocuments(e.target.files);e.currentTarget.value="";}}/>
      </label>
      {sourceList.map(s=><details key={s.id} className="copilotDocItem">
        <summary><span><strong>{s.id} · {s.name}</strong><small>{s.extraction==="local_text"?"Text extracted locally":s.extraction==="engineer_excerpt"?"Engineer excerpt only":"Content not extracted"}</small></span></summary>
        <p>{s.extraction==="local_text"?"The text is available for local retrieval and optional AI questions.":"PDF/Office attachment recorded. Paste relevant passages with page numbers. An explicitly authorized PDF can also be passed to AI when supported."}</p>
        <label>Relevant excerpt or engineer notes<textarea aria-label={"Notes for "+s.name} rows={3} value={s.engineerNotes} onChange={e=>setKnowledge(k=>k?{...k,sources:updateSourceNotes(k.sources,s.id,e.target.value)}:k)}/></label>
        {s.extractedText&&<details><summary>View extracted text</summary><pre>{s.extractedText.slice(0,2500)}</pre></details>}
        <button className="copilotSmall" type="button" onClick={()=>removeSource(s.id)}>Remove reference</button>
      </details>)}
      {!sourceList.length&&<p className="copilotMuted">No assembly references attached yet.</p>}
    </div>
    <div className="copilotFacts">
      <h3>Reviewed engineering facts</h3>
      <label>Component identity / role<input aria-label="Component role" placeholder="e.g. Frame support bracket, not inferred from STL" value={knowledge.componentName} onChange={e=>update("componentName",e.target.value)}/></label>
      <label>Larger assembly / interfaces<textarea aria-label="Assembly context" placeholder="Where the part sits; what connects to it; relevant part IDs" rows={3} value={knowledge.assemblyContext} onChange={e=>update("assemblyContext",e.target.value)}/></label>
      <label>Mounting / force locations<textarea aria-label="Attachment context" placeholder="Documented fixture and load locations; state uncertainties" rows={2} value={knowledge.attachmentNotes} onChange={e=>update("attachmentNotes",e.target.value)}/></label>
      <label>Confirmed requirements<textarea aria-label="Reviewed requirements" placeholder="Loads, tolerances, material specifications, source references" rows={3} value={knowledge.reviewedRequirements} onChange={e=>update("reviewedRequirements",e.target.value)}/></label>
      <label className="copilotCheck"><input type="checkbox" checked={acknowledgedLoads} onChange={e=>setAcknowledgedLoads(e.target.checked)}/> I reviewed the actual load cases and material assumptions; default forces are not confirmed design requirements.</label>
      <button type="button" className="copilotSmall" onClick={saveContext}>Export context and cited notes (JSON)</button>
    </div>
  </section>
  <section className="copilotRight">
    <header className="copilotHeading"><h2>Engineering copilot</h2><p>Ask what matters about your part, then run supported calculations with traceable evidence.</p></header>
    <div className="copilotPrompt"><strong>Current next question</strong><p>{nextEngineeringQuestion(knowledge,opts)}</p></div>
    <div className="copilotTimeline" ref={timeline} aria-label="Engineering conversation" role="log">
      {!knowledge.messages.length&&<div className="copilotBubble assistant"><b>Local engineering guide</b><p>Upload the target STL and relevant assembly context. I'll help identify missing information and match your case to the supported solver. No simulation has been run yet.</p></div>}
      {knowledge.messages.map(m=><div key={m.id} className={"copilotBubble "+m.role}>
       <b>{m.role==="user"?"Engineer":m.origin==="model"?"AI engineering assistant":"Local engineering guide"}</b>
       <p>{m.text}</p>
       {m.sourceIds.length>0&&<small>References: {m.sourceIds.join(", ")} · verify the actual source before using for FEA</small>}
      </div>)}
    </div>
    <label className="copilotAsk">Ask about the part or its requirements
      <textarea aria-label="Message engineering copilot" placeholder="This STL represents a fuselage frame. Based on the attached assembly spec, what should I confirm before analyzing it?" rows={3} value={draft} onChange={e=>setDraft(e.target.value)}/>
    </label>
    <div className="copilotChatActions">
      <button type="button" onClick={askLocal} disabled={busy}>Use local guide</button>
      <button type="button" onClick={()=>void askAI()} disabled={busy||!aiEnabled||!privacyConsent||!draft.trim()}>{busy?"Consulting model…":"Ask AI about approved context"}</button>
    </div>
    <div className="copilotPrivacy">
     <label className="copilotCheck"><input aria-label="Authorize external AI" type="checkbox" checked={privacyConsent} onChange={e=>setPrivacyConsent(e.target.checked)}/> I confirm this information is approved for sharing with an external AI model. Do not use controlled Boeing/project data without written authorization.</label>
     {sourceList.some(s=>s.kind==="pdf")&&<label className="copilotCheck"><input type="checkbox" checked={includePdfs} onChange={e=>setIncludePdfs(e.target.checked)}/> Also transmit reattached PDFs (up to two, 2 MB each) to AI for this question</label>}
     <p>{aiEnabled?"External AI is available only when explicitly authorized. The STL itself is never transmitted.":"External AI is not enabled or configured on this deployment. The local engineering guide and simulation controls still work."}</p>
    </div>
    {(error||notice)&&<div className="copilotWarning" role="status">{error||notice}</div>}
    <div className="copilotProgress">
     <h3>Analysis execution</h3><p>Runs use the existing numerical engines, not model-generated results. You can see which computations finished.</p>
     <div className="copilotStages">
      <div><span>{verified?"✓":"○"}</span><b>Geometry inspection</b><small>{verified?"Units confirmed":"Requires verified units"}</small></div>
      <div><span>{a.busy?"◌":orientationReady?"✓":"○"}</span><b>LPBF orientation search</b><small>{a.busy?Math.round(a.progress*100)+"%":orientationReady?a.result?.candidates.length+" candidates":"Not run"}</small></div>
      <div><span>{verifiedStructural?"✓":"○"}</span><b>Service-load numerical study</b><small>{verifiedStructural?"Simplified FEM result":"Requires reviewed loads and solver execution"}</small></div>
      <div><span>{verifiedThermal?"✓":"○"}</span><b>Steady thermal study</b><small>{verifiedThermal?"Steady conduction result":"Not AM thermal history"}</small></div>
      <div><span>—</span><b>Transient distortion / qualification</b><small>Not implemented or verified</small></div>
     </div>
     {isLPBF?<button className="copilotPrimary" disabled={!verified||a.busy} onClick={runGeometry}>{a.busy?"Running orientation screening…":orientationReady?"Rerun geometric orientations":"Run supported orientation screening"}</button>:
       <p className="copilotWarning">This uploaded part has a DED configuration or the synthetic teaching example. This workspace cannot generate an arbitrary-STL DED toolpath or validated DED distortion analysis. <Link href="/orientation?example=ded">Open teaching model</Link>.</p>}
     {a.busy&&<progress aria-label="Orientation analysis progress" value={a.progress} max={1}/>}
     {orientationReady&&<div className="copilotResult">
       <p>Geometry worker completed: <strong>{a.result?.candidates.length}</strong> orientations. Currently selected: <strong>{currentCandidate?.id}</strong>.</p>
       <label>Orientation to inspect<select aria-label="Select orientation" value={a.selected??""} onChange={e=>a.select(e.target.value)}>{a.result?.candidates.map(c=><option key={c.id} value={c.id}>{c.id} · {c.buildHeightMm.toFixed(1)} mm · {c.feasible?"geometrically eligible":"not eligible"}</option>)}</select></label>
       <p>Support proxy: {currentCandidate?.supportProxyMm3.toFixed(1)} mm³ (not sliced supports). Build envelope check: {currentCandidate?.fitsEnvelope?"nominal bounding box fits":"does not fit"}.</p>
       <div className="copilotActions">
        <button onClick={()=>setStructuralOpen(x=>!x)}>{structuralOpen?"Hide":"Review and run"} service-load FEM</button>
        <button onClick={()=>setThermalOpen(x=>!x)}>{thermalOpen?"Hide":"Review and run"} steady conduction</button>
       </div>
       <label>3D result layer<select aria-label="Copilot viewer field" value={showFields} onChange={e=>setShowFields(e.target.value as typeof showFields)}>
        <option value="geometry">Geometry</option><option value="stress" disabled={!verifiedStructural}>Service stress</option>
        <option value="displacement" disabled={!verifiedStructural}>Displacement</option>
        <option value="thermal" disabled={!verifiedThermal}>Steady temperature</option></select></label>
       {structuralOpen&&<div className="copilotSolver"><Structural/></div>}
       {thermalOpen&&<div className="copilotSolver"><Thermal/></div>}
       <Link href="/orientation?step=decision">Compare candidates in engineering workspace</Link>
      </div>}
     <div className="copilotEvidence"><strong>Context retrieval preview</strong>
      {references.length?references.map((h,i)=><p key={i}><b>[{h.sourceId} {h.line}] {h.fileName}</b> — {h.excerpt.slice(0,260)}{h.origin==="engineer_excerpt"?" (engineer-entered)":""}</p>):
       <p>No extractable reference text matches the current engineering context yet. Enter document excerpts with identifiers before citing them as evidence.</p>}
     </div>
    </div>
  </section>
 </div>;
}
