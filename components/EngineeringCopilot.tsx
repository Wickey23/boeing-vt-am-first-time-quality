"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {useAnalysis} from "@/components/AnalysisProvider";
import {usePartInspection} from "@/components/PartInspection";
import ViewerErrorBoundary from "@/components/ViewerErrorBoundary";
import EngineeringRunbook from "@/components/EngineeringRunbook";
import {completedPart,allowsGeometryRanking} from "@/lib/engineering-journey";
import {activeServiceCase} from "@/lib/service-plan";
import {END_FACES,type EndFace} from "@/lib/service-load";
import type {ProcessKind} from "@/lib/engineering-journey";
import {
 addProjectSource,blankKnowledge,createMessage,findEvidence,localCopilotReply,nextEngineeringQuestion,
 restoreKnowledge,updateSourceNotes,type ProjectKnowledge,type CopilotMessage,type ProjectSource
} from "@/lib/copilot-context";
import {applyIntakeAnswer,getIntakeStep,intakeProgress} from "@/lib/engineering-intake";
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
 const [intakeDraft,setIntakeDraft]=useState("");
 const factsRef=useRef<HTMLDetailsElement|null>(null);
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
 // Display only a review warning; this is not a validated machine fit test.
 const largestPartExtent=inspect.data?Math.max(...Object.values(inspect.data.dimensions)):0;
 const largestConfiguredAxis=Math.max(a.settings.x,a.settings.y,a.settings.z);
 const dimensionReview=Boolean(inspect.data&&largestConfiguredAxis>0&&largestPartExtent>1.5*largestConfiguredAxis);
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
   setNotice("References registered. Supported text and DOCX/XLSX documents were extracted locally. PDFs and legacy DOC/XLS still require engineer excerpts or explicit approved processing.");
  }catch(e){setError(e instanceof Error?e.message:"Could not read reference document");}
  finally{setDocBusy(false);}
 };
 const removeSource=(id:string)=>{docs.current.delete(id);setKnowledge(s=>s?{...s,sources:s.sources.filter(x=>x.id!==id),
   messages:[]}:s);};
 const opts={
  partName:a.journey.mode==="ded-example"?"DED teaching wall":a.file?.name??null,
  confirmed:verified,
  hasOrientation:orientationReady,
  loadsReviewed:acknowledgedLoads&&Boolean(knowledge?.reviewedRequirements.trim()),
  process:a.journey.process
 };
 const append=(items:CopilotMessage[])=>setKnowledge(s=>s?{...s,messages:[...s.messages,...items].slice(-45)}:s);
 const intakeStep=knowledge?getIntakeStep(knowledge,{partName:opts.partName,confirmed:verified,
  loadsReviewed:opts.loadsReviewed,process:opts.process}):null;
 const progressSteps=knowledge?intakeProgress(knowledge,{partName:opts.partName,confirmed:verified,
  loadsReviewed:opts.loadsReviewed,process:opts.process,hasOrientation:orientationReady}):[];
 const saveGuidedAnswer=()=>{
  if(!knowledge||!intakeStep?.field||!intakeDraft.trim())return;
  try{
   const next=applyIntakeAnswer(knowledge,intakeStep,intakeDraft);
   const answer=intakeDraft.trim();
   const following=getIntakeStep(next,{partName:opts.partName,confirmed:verified,
     loadsReviewed:opts.loadsReviewed,process:opts.process});
   setKnowledge({...next,messages:[...next.messages,
    createMessage("user",answer,"user"),
    createMessage("assistant","Recorded as engineer-supplied context, not a verified design requirement. Next: "+following.question,"local_guide")].slice(-45)});
   setIntakeDraft("");
  }catch(e){setError(e instanceof Error?e.message:"Answer could not be saved.");}
 };
 const openFacts=()=>{
  if(factsRef.current){factsRef.current.open=true;factsRef.current.scrollIntoView({behavior:"smooth",block:"start"});}
 };
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
 const editService=(next:typeof activeCase.input)=>{setAcknowledgedLoads(false);a.setServiceSetup(next);};
 const saveContext=()=>{
  if(!knowledge)return;
  const selectedCandidate=a.result?.candidates.find(c=>c.id===a.selected);
  const structural=a.result?.structural?.candidateId===a.selected?a.result.structural.field:null;
  const thermal=a.result?.thermal?.candidateId===a.selected?a.result.thermal.field:null;
  const packageData={
   schema:"orientai-engineering-evidence-v1",
   exportedAt:new Date().toISOString(),
   project:{name:a.projectName,geometryFileName:a.file?.name??null,geometryHashSha256:partKey,
    manufacturingProcess:a.journey.process,unitsConfirmed:verified,settings:a.settings},
   engineeringContext:knowledge,
   serviceCases:a.servicePlan.cases.map(c=>({id:c.id,name:c.name,input:c.input,
    note:"Engineer must independently verify boundary conditions, material parameters and applicable loads."})),
   selectedOrientation:selectedCandidate?{
    id:selectedCandidate.id,buildHeightMm:selectedCandidate.buildHeightMm,
    supportProxyMm3:selectedCandidate.supportProxyMm3,fitsEnvelope:selectedCandidate.fitsEnvelope
   }:null,
   analysis:a.result?{
    runId:a.result.runId,source:a.result.source,generatedAt:a.result.generatedAt,
    candidateCount:a.result.candidates.length,
    structural:structural?{solver:structural.solver,mesh:structural.mesh,assessment:structural.assessment,limitations:structural.limitations}:null,
    steadyThermal:thermal?{solver:thermal.solver,mesh:thermal.mesh,minC:thermal.min,maxC:thermal.max,limitations:thermal.limitations}:null
   }:null,
   dataIncluded:{rawStl:false,documentBinary:false,fullNumericalFields:false},
   limitations:[
    "Research calculations only; not first-time quality, structural certification or print approval.",
    "LPBF geometric support proxy is not generated support geometry or qualified machine feasibility.",
    "Service FEM uses idealized isotropic elasticity and end-face loading; material, fixture and load sources require engineer review.",
    "Steady conduction does not simulate metal-AM thermal history, residual stress or print distortion.",
    "Extracted document text and notes are context, not independently validated requirements."
   ]
  };
  const body=JSON.stringify(packageData,null,2);
  const blob=new Blob([body],{type:"application/json"}),u=URL.createObjectURL(blob);
  const anchor=document.createElement("a");anchor.href=u;anchor.download="orientai-"+(partKey??"context").slice(0,12)+"-context.json";
  document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
 };
 const references=useMemo(()=>findEvidence(sourceList,knowledge?.reviewedRequirements||knowledge?.componentName||"",4),[sourceList,knowledge?.reviewedRequirements,knowledge?.componentName]);
 const verifiedStructural=Boolean(a.result?.structural&&isLPBF);
 const verifiedThermal=Boolean(a.result?.thermal&&isLPBF);
 if(!a.ready||!knowledge)return <div className="copilotLoading" role="status">Restoring the part and engineering context…</div>;
 return <div className="copilotGrid">
  <div className="copilotJourney" aria-label="Engineering workflow progress">
   <div><span className="copilotJourneyEyebrow">ACTIVE PROJECT</span><strong>{a.projectName}</strong><small>{verified?"STL dimensions confirmed":"Geometry review required"} · {sourceList.length} reference{sourceList.length===1?"":"s"}</small></div>
   <ol>{progressSteps.map(step=><li key={step.key} className={step.done?"done":"pending"}>
    <span aria-hidden="true">{step.done?"✓":"○"}</span><span>{step.label}</span>
   </li>)}</ol>
  </div>
  <section className="copilotLeft">
    <header className="copilotHeading"><h2>Part workspace</h2><p>The uploaded geometry stays linked to its requirements and study results.</p></header>
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
    {a.file&&<div className="copilotSummary"><strong>{a.file.name}</strong><span>{inspect.data?"Scaled bounds: "+Object.values(inspect.data.dimensions).map(x=>x.toFixed(2)).join(" × ")+" mm":"Inspecting dimensions…"}</span></div>}
    <label className="copilotUpload">Upload or replace target STL
     <input type="file" accept=".stl" aria-label="Upload target STL" onChange={e=>{upload(e.target.files?.[0]??null);e.currentTarget.value="";}}/>
    </label>
    {a.file&&!verified&&<div className="copilotConfirm">
      <label>STL units<select aria-label="STL input units" value={a.settings.unitScale} onChange={e=>a.update("unitScale",Number(e.target.value))}>
       <option value={1}>Millimeters</option><option value={25.4}>Inches</option><option value={1000}>Meters</option></select></label>
      <p className="copilotUnitHelp">STL files do not encode physical units. The dimensions above use the selected scale; confirm them against your actual CAD part.</p>
      {dimensionReview&&<div className="copilotUnitNotice" role="status"><strong>Review the selected units and machine envelope</strong><p>The part's scaled bounding dimensions are much larger than the largest configured machine axis ({largestConfiguredAxis.toFixed(0)} mm). This could be a units mismatch or a part requiring different equipment. It is not a machine feasibility calculation.</p></div>}
      {inspect.data?.audit.findings.filter(f=>f.level==="blocker").map(f=><p role="alert" key={f.code}>{f.code}: {f.message}</p>)}
      <button type="button" disabled={!inspect.data||inspect.data.audit.findings.some(f=>f.level==="blocker")} onClick={()=>a.confirmPart()}>Confirm inspected dimensions and units</button>
    </div>}
    <div className="copilotSummary"><label style={{margin:0,flex:1}}>Manufacturing process
      <select aria-label="Copilot manufacturing process" value={a.journey.process} onChange={e=>a.setJourneyProcess(e.target.value as ProcessKind)}>
      <option value="PBF_LB_METAL">Laser powder bed fusion (LPBF)</option>
      <option value="DED_LB_WIRE">Laser wire DED (arbitrary-part pathing unsupported)</option>
      <option value="DED_LB_POWDER">Laser powder DED (arbitrary-part pathing unsupported)</option>
      </select></label><span>Geometry: <b>{stat(verified)}</b></span></div>
    <details className="copilotDocs copilotFold">
      <summary>Assembly documents <span>{sourceList.length} attached · open to manage</span></summary>
      <div className="copilotFoldBody"><h3>Assembly documentation</h3>
      <p>Attach drawings, requirements and assembly documentation. Plain-text formats are read locally. Text, DOCX, and XLSX can be extracted locally. PDFs and scanned drawings require manually reviewed excerpts; extracted text is not verified engineering evidence.</p>
      <label>Reference documents
        <input aria-label="Add reference documents" type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.xls,.txt,.md,.csv,.json" disabled={docBusy} onChange={e=>{void uploadDocuments(e.target.files);e.currentTarget.value="";}}/>
      </label>
      {sourceList.map(s=><details key={s.id} className="copilotDocItem">
        <summary><span><strong>{s.id} · {s.name}</strong><small>{s.extraction==="local_text"?"Text extracted locally":s.extraction==="local_document"?"Office text extracted locally":s.extraction==="engineer_excerpt"?"Engineer excerpt only":"Content not extracted"}</small></span></summary>
        <p>{(s.extraction==="local_text"||s.extraction==="local_document")?"The locally extracted text is available for source-backed questions. Confirm engineering applicability before using values.":"PDF/legacy Office attachment recorded. Paste relevant passages with page numbers. An explicitly authorized PDF may be passed to AI when supported."}</p>
        <label>Relevant excerpt or engineer notes<textarea aria-label={"Notes for "+s.name} rows={3} value={s.engineerNotes} onChange={e=>setKnowledge(k=>k?{...k,sources:updateSourceNotes(k.sources,s.id,e.target.value),messages:[]}:k)}/></label>
        {s.extractedText&&<details><summary>View extracted text</summary><pre>{s.extractedText.slice(0,2500)}</pre></details>}
        <button className="copilotSmall" type="button" onClick={()=>removeSource(s.id)}>Remove reference</button>
      </details>)}
      {!sourceList.length&&<p className="copilotMuted">No assembly references attached yet.</p>}
      </div></details>
    <details ref={factsRef} className="copilotFacts copilotFold">
      <summary>Engineering facts and boundary conditions <span>{knowledge.componentName?"In progress":"Needs context"} · open to edit</span></summary>
      <div className="copilotFoldBody"><h3>Reviewed engineering facts</h3>
      <label>Component identity / role<input aria-label="Component role" placeholder="e.g. Frame support bracket, not inferred from STL" value={knowledge.componentName} onChange={e=>update("componentName",e.target.value)}/></label>
      <label>Larger assembly / interfaces<textarea aria-label="Assembly context" placeholder="Where the part sits; what connects to it; relevant part IDs" rows={3} value={knowledge.assemblyContext} onChange={e=>update("assemblyContext",e.target.value)}/></label>
      <label>Mounting / force locations<textarea aria-label="Attachment context" placeholder="Documented fixture and load locations; state uncertainties" rows={2} value={knowledge.attachmentNotes} onChange={e=>update("attachmentNotes",e.target.value)}/></label>
      <label>Confirmed requirements<textarea aria-label="Reviewed requirements" placeholder="Loads, tolerances, material specifications, source references" rows={3} value={knowledge.reviewedRequirements} onChange={e=>update("reviewedRequirements",e.target.value)}/></label>
      {a.file&&verified&&<details className="copilotDocItem">
       <summary>Review numerical service-load boundary conditions</summary>
       <p>Only an idealized entire end-face clamp and total opposite-face load are currently modeled. Choose verified values; the defaults are research examples, not part requirements.</p>
       <label>Fixed end face (original STL axes)
       <select aria-label="Copilot fixed end face" value={activeCase.input.fixedFace??"z-min"} onChange={e=>editService({...activeCase.input,fixedFace:e.target.value as EndFace})}>
       {END_FACES.map(face=><option key={face} value={face}>{face}</option>)}</select></label>
       {([["forceXN","Force X (N)"],["forceYN","Force Y (N)"],["forceZN","Force Z (N)"]] as const).map(([key,label])=>
       <label key={key}>{label}<input aria-label={"Copilot "+label} type="number" value={activeCase.input[key]??0}
        onChange={e=>editService({...activeCase.input,[key]:Number(e.target.value)})}/></label>)}
       <label>Young's modulus (MPa, engineer-supplied)
         <input aria-label="Copilot Young modulus" type="number" value={activeCase.input.youngModulusMPa} onChange={e=>editService({...activeCase.input,youngModulusMPa:Number(e.target.value)})}/>
       </label><label>Poisson ratio<input aria-label="Copilot Poisson ratio" type="number" step="any" value={activeCase.input.poissonRatio} onChange={e=>editService({...activeCase.input,poissonRatio:Number(e.target.value)})}/></label>
       <Link href="/orientation?step=requirements">Edit multiple load cases in guided workspace</Link>
      </details>}
      <label className="copilotCheck"><input type="checkbox" checked={acknowledgedLoads} onChange={e=>setAcknowledgedLoads(e.target.checked)}/> I reviewed the actual load cases and material assumptions; default forces are not confirmed design requirements.</label>
      <button type="button" className="copilotSmall" onClick={saveContext}>Export engineering context and study review (JSON)</button>
      </div></details>
  </section>
  <section className="copilotRight">
    <header className="copilotHeading"><h2>Engineering guide <span className="copilotMode">{aiEnabled?"Local + optional AI":"Local guided mode"}</span></h2><p>Describe the part, confirm engineering assumptions, then execute supported numerical tools.</p></header>
    <div className="copilotPrompt">
     <div className="copilotQuestionMeta">NEXT ENGINEERING DECISION <span>{intakeStep?.title}</span></div>
     <p>{intakeStep?.question}</p>
     <small>{intakeStep?.hint}</small>
     {intakeStep?.field?<div className="copilotGuidedInput">
       <textarea rows={3} aria-label="Answer current engineering question" value={intakeDraft}
        onChange={e=>setIntakeDraft(e.target.value)} placeholder="Describe the part using known engineering facts. Include document IDs where possible."/>
       <button type="button" onClick={saveGuidedAnswer} disabled={!intakeDraft.trim()}>Save answer and continue</button>
      </div>:intakeStep?.stage==="review"?<button type="button" className="copilotNextAction" onClick={openFacts}>Review load and material inputs</button>:
       intakeStep?.stage==="unsupported"?<div className="copilotUnsupported">DED planning for this STL is not implemented. Change the process to LPBF for supported screening, or use <Link href="/orientation?example=ded">the synthetic DED example</Link>.</div>:
       intakeStep?.stage==="ready"?<div className="copilotNextHint">Review the guided simulation plan below and run only the applicable analyses.</div>:null}
    </div>
    <div className="copilotTimeline" ref={timeline} aria-label="Engineering conversation" role="log">
      {!knowledge.messages.length&&<div className="copilotBubble assistant"><b>Guided engineering intake</b><p>Start with the current question above. Your answers are recorded as engineer-provided context. The assistant does not assume loads, material allowables, or that a simulation has run.</p></div>}
      {knowledge.messages.map(m=><div key={m.id} className={"copilotBubble "+m.role}>
       <b>{m.role==="user"?"Engineer":m.origin==="model"?"AI engineering assistant":"Local engineering guide"}</b>
       <p>{m.text}</p>
       {m.sourceIds.length>0&&<small>References: {m.sourceIds.join(", ")} · verify the actual source before using for FEA</small>}
      </div>)}
    </div>
    <label className="copilotAsk">Ask about the part or its requirements
      <textarea aria-label="Message engineering copilot" placeholder="What information should I confirm about this part's role, attachments, loads and material before analysis?" rows={3} value={draft} onChange={e=>setDraft(e.target.value)}/>
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
     <EngineeringRunbook verified={verified} partSha256={partKey??undefined} sourceIds={sourceList.map(x=>x.id)} loadsReviewed={acknowledgedLoads&&Boolean(knowledge.reviewedRequirements.trim())} requirementsDocumented={Boolean(knowledge.attachmentNotes.trim()&&knowledge.reviewedRequirements.trim())}/>
     <details className="copilotAdvanced"><summary>Advanced: individual simulation controls and result fields</summary>
      <p>Use these only if you need to run a solver separately. The Guided simulation plan above is the primary workflow.</p>
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
     </details>
     <details className="copilotAdvanced"><summary>Document evidence preview</summary>
     <div className="copilotEvidence"><strong>Context retrieval preview</strong>
      {references.length?references.map((h,i)=><p key={i}><b>[{h.sourceId} {h.line}] {h.fileName}</b> — {h.excerpt.slice(0,260)}{h.origin==="engineer_excerpt"?" (engineer-entered)":""}</p>):
       <p>No extractable reference text matches the current engineering context yet. Enter document excerpts with identifiers before citing them as evidence.</p>}
     </div></details>
    </div>
  </section>
 </div>;
}
