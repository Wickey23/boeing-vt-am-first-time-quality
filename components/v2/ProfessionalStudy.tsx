"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
 ArrowRight,ArrowUp,Box,Check,CheckCircle2,ChevronDown,ClipboardCheck,
 Download,FileText,FileUp,Info,Layers,MessageSquare,Pause,Play,RotateCcw,
 Search,ShieldAlert,ShieldCheck,SlidersHorizontal,SquareArrowOutUpRight,X
} from "lucide-react";
import {useAnalysis} from "@/components/AnalysisProvider";
import {usePartInspection} from "@/components/PartInspection";
import {completedPart} from "@/lib/engineering-journey";
import {screenCandidate} from "@/lib/part-screening";
import {failureCoverage,coverageSummary} from "@/lib/failure-coverage";
import {createCopilotReviewPDF} from "@/lib/copilot-review-pdf";
import {reportPDF,downloadJSON} from "@/lib/engineering-report";
import {assessEngineeringReadiness} from "@/lib/engineering-readiness";
import {findEvidence,localCopilotReply} from "@/lib/copilot-context";
import {activeParameterBindings} from "@/lib/engineering-parameter-binding";
import {activeServiceCase} from "@/lib/service-plan";
import {useStudioContext} from "./useStudioContext";
import StudioCanvasFallback from "./StudioCanvasFallback";
import ViewerErrorBoundary from "@/components/ViewerErrorBoundary";
import "./professional-study.css";
const ModelViewer=dynamic(()=>import("@/components/ModelViewer"),{ssr:false});
type Stage="geometry"|"context"|"assessment";
type ChatItem={role:"user"|"assistant";text:string};
const stageEntries=[
 {id:"geometry" as const,label:"Part Geometry",detail:"Inspect & validate",Icon:Box},
 {id:"context" as const,label:"Engineering Context",detail:"Assembly & requirements",Icon:FileText},
 {id:"assessment" as const,label:"Failure Assessment",detail:"Risks & report",Icon:ClipboardCheck}
];
export default function ProfessionalStudy(){
 const a=useAnalysis();
 const inspect=usePartInspection(a.file,a.settings.unitScale);
 const [stage,setStage]=useState<Stage>("geometry");
 const [partHash,setPartHash]=useState<string|null>(null);
 const [url,setUrl]=useState<string|undefined>();
 const [showOverhangs,setShowOverhangs]=useState(false);
 const [showSupports,setShowSupports]=useState(false);
 const [layer,setLayer]=useState(100);
 const [playing,setPlaying]=useState(false);
 const [exportBusy,setExportBusy]=useState(false);
 const [error,setError]=useState("");
 const [draft,setDraft]=useState("");
 const [thread,setThread]=useState<ChatItem[]>([]);
 const [showThread,setShowThread]=useState(false);
 const [reviewing,setReviewing]=useState("");
 const [rationale,setRationale]=useState("");
 const [uploadBusy,setUploadBusy]=useState(false);
 const [dropActive,setDropActive]=useState(false);
 const partFileInput=useRef<HTMLInputElement>(null);
 const ctx=useStudioContext(partHash);
 const isConfirmed=completedPart(a.journey,a.file,a.settings.unitScale);
 useEffect(()=>{
  if(!a.file){setPartHash(null);setUrl(undefined);return;}
  const object=URL.createObjectURL(a.file);setUrl(object);
  let active=true;setPartHash(null);
  void a.file.arrayBuffer().then(bytes=>crypto.subtle.digest("SHA-256",bytes)).then(hash=>{
   if(active)setPartHash(Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,"0")).join(""));
  }).catch(()=>{if(active)setError("Could not identify the uploaded STL.");});
  return()=>{active=false;URL.revokeObjectURL(object);};
 },[a.file]);
 useEffect(()=>{setStage("geometry");setLayer(100);setPlaying(false);setThread([]);},[a.file]);
 useEffect(()=>{
  if(!playing)return;
  const id=setInterval(()=>setLayer(n=>Math.min(100,n+1)),95);
  return()=>clearInterval(id);
 },[playing]);
 useEffect(()=>{if(playing&&layer>=100)setPlaying(false);},[playing,layer]);
 const currentRun=Boolean(a.result&&partHash&&a.result.source.fileHashSha256===partHash&&
  a.result.configuration.unitScale===a.settings.unitScale);
 const selected=currentRun?(a.result?.candidates.find(c=>c.id===a.selected)??a.result?.candidates[0]):undefined;
 const findings=selected&&currentRun&&a.result?screenCandidate(selected,a.result.candidates):[];
 const meshFindings=inspect.data?.audit.findings??[];
 const coverage=failureCoverage({
  hasMeshAudit:Boolean(inspect.data),hasOrientationRun:currentRun,
  hasStructuralStudy:Boolean(currentRun&&a.result?.structural),
  hasSteadyThermalStudy:Boolean(currentRun&&a.result?.thermal),
  process:a.journey.process
 });
 const counts=coverageSummary(coverage);
 const candidates=useMemo(()=>ctx.candidates.filter(c=>!ctx.reviewed.some(r=>r.key===c.key)),[ctx.candidates,ctx.reviewed]);
 const next=!a.file?{title:"Upload a part",detail:"Begin with an STL model.",action:"Upload STL",to:"geometry" as Stage}:
  !isConfirmed?{title:"Confirm dimensions",detail:"Verify the source STL units before analysis.",action:"Review dimensions",to:"geometry" as Stage}:
  !ctx.sources.length?{title:"Provide engineering context",detail:"Add an assembly reference or describe the intended function.",action:"Add context",to:"context" as Stage}:
  !ctx.reviewed.length?{title:"Review source evidence",detail:"Confirm which document excerpts apply to this part.",action:"Review evidence",to:"context" as Stage}:
  !currentRun?{title:"Run geometry screening",detail:"Evaluate candidate LPBF orientations and geometric concerns.",action:"Run screening",to:"geometry" as Stage}:
  {title:"Review the assessment",detail:"Inspect calculated screens, unassessed mechanisms and evidence.",action:"View findings",to:"assessment" as Stage};
 const attach=(file:File|undefined)=>{
  if(!file)return;
  if(!file.name.toLowerCase().endsWith(".stl")||file.size<1||file.size>20*1024*1024){setError("Select a nonempty STL file up to 20 MB.");return;}
  a.upload(file);a.setProjectName(file.name.replace(/\.stl$/i,""));setError("");setStage("geometry");
 };
 const send=()=>{
  const q=draft.trim();if(!q)return;
  let response:string;
  if(!a.file)response="Upload an STL first. I can then inspect dimensions, geometric manufacturing concerns, and the assembly information you provide.";
  else if(ctx.knowledge){
   const result=localCopilotReply(ctx.knowledge,q,{
    partName:a.file.name,confirmed:isConfirmed,hasOrientation:currentRun,
    loadsReviewed:ctx.reviewed.some(x=>x.category==="load"),process:a.journey.process
   });
   response=result.text;
  }else response="The part is loading. Confirm the STL units and upload an assembly document to begin contextual review.";
  if(/\b(assembly|requirement|load|material|fixture|document)\b/i.test(q))setStage("context");
  setThread(t=>([...t,{role:"user" as const,text:q},{role:"assistant" as const,text:response}]).slice(-24));
  setShowThread(true);setDraft("");
 };
 const exportEvidence=async()=>{
  if(!a.file||!partHash||!ctx.knowledge){setError("Confirm the part identity before exporting.");return;}
  setExportBusy(true);setError("");
  try{
   const k=ctx.knowledge;
   const readiness=assessEngineeringReadiness({
    fileName:a.file.name,unitsConfirmed:isConfirmed,process:a.journey.process,
    componentName:k.componentName,assemblyContext:k.assemblyContext,attachmentNotes:k.attachmentNotes,
    requirements:k.reviewedRequirements,documentCount:ctx.sources.length,
    reviewedEvidenceCount:ctx.reviewed.length,
    hasNumericalServiceStudy:Boolean(currentRun&&a.result?.structural),
    hasSteadyThermalStudy:Boolean(currentRun&&a.result?.thermal),
    hasLpbfGeometryCandidates:currentRun
   });
   const approvedBindings=activeParameterBindings(k.parameterBindings,ctx.sources,ctx.reviewed,activeServiceCase(a.servicePlan));
   const pdf=await createCopilotReviewPDF({
    projectName:a.projectName,partName:a.file.name,partSha256:partHash,process:a.journey.process,
    unitsConfirmed:isConfirmed,createdAt:new Date().toISOString(),knowledge:k,
    reviewedEvidence:ctx.reviewed,approvedBindings,readiness,
    coverage,
    geometricConcerns:[...meshFindings.map(f=>({code:f.code,message:f.message,basis:"STL mesh-topology audit"})),
     ...(currentRun?findings.map(f=>({code:f.code,message:f.message,basis:f.basis})):[])]
   });
   pdf.save("orientai-engineering-evidence-"+partHash.slice(0,8)+".pdf");
  }catch(e){setError(e instanceof Error?e.message:"Unable to export engineering evidence.");}
  finally{setExportBusy(false);}
 };
 const exportGeometry=async()=>{
  if(!currentRun||!a.result)return;
  setExportBusy(true);setError("");
  try{await reportPDF(a.result,a.selected,a.file);}
  catch(e){setError(e instanceof Error?e.message:"Unable to export geometry report.");}
  finally{setExportBusy(false);}
 };
 const projectName=a.file?.name??"No model uploaded";
 return <div className="psRoot" aria-label="ORIENTAI professional engineering workbench">
  <div className="psWorkingColumn">
   <header className="psWorkspaceHeader">
    <div className="psHeadline">
     <div><span className="psEyebrow">ENGINEERING WORKSPACE</span><h1>Pre-build assessment</h1></div>
     <div className="psHeaderMeta"><span className="psFileName" title={projectName}>{projectName}</span><span className="psResearch">Research prototype</span></div>
    </div>
    <nav className="psStepper" aria-label="Assessment stages">
     {stageEntries.map(({id,label,detail,Icon},i)=><button type="button" key={id}
      className={"psStep"+(stage===id?" psActive":"")}
      aria-current={stage===id?"step":undefined}
      onClick={()=>setStage(id)}>
      <span className="psStepCount">{i+1}</span>
      <span className="psStepContent"><strong>{label}</strong><small>{detail}</small></span>
      <Icon size={16} aria-hidden="true"/>
     </button>)}
    </nav>
    <div className="psNextAction">
     <div><strong>Next step</strong><span>{next.detail}</span></div>
     <button type="button" onClick={()=>{
      if(!a.file)partFileInput.current?.click();
      else setStage(next.to);
     }}>{next.action}<ArrowRight size={15}/></button>
    </div>
   </header>
   <div className="psStageScroll" role="region" aria-label="Active assessment stage">
    {stage==="geometry"&&<section className="psStage" aria-label="Part geometry stage">
     <div className="psSectionHead"><span>STAGE 01 / PART GEOMETRY</span><h2>Inspect and confirm the model</h2><p>Review the actual mesh and dimensional scale before performing a metal-AM screening.</p></div>
     {!a.file?<div className="psEmptyCard" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();attach(e.dataTransfer.files[0]);}}>
      <Box size={34}/><h3>Upload the part you want to evaluate</h3><p>STL geometry is processed locally in your browser. Confirm its dimensions before the first analysis.</p>
      <button type="button" onClick={()=>partFileInput.current?.click()}><FileUp size={16}/> Upload STL</button>
      <small>Supported: STL, up to 20 MB</small></div>:
     <>
      <article className="psPanel psPartCard">
       <div className="psPanelHeading"><strong><Box size={17}/> Uploaded model</strong><span className="psGoodStatus"><CheckCircle2 size={14}/> Loaded locally</span></div>
       <div className="psPartDetails"><div className="psPartIdentity"><span className="psPartIcon"><Box size={21}/></span>
        <div><strong>{a.file.name}</strong><small>{(a.file.size/1024).toFixed(0)} KB · STL mesh</small></div></div>
        <button type="button" className="psSubtleButton" onClick={()=>partFileInput.current?.click()}>Replace model</button>
       </div>
       <div className="psFactGrid">
        <section className="psFactBlock" aria-label="Mesh inspection">
         <div className="psFactTitle"><ShieldCheck size={16}/><strong>Geometry validation</strong></div>
         <dl>
          <div><dt>Triangles</dt><dd>{inspect.data?.audit.triangles.toLocaleString()??"Inspecting…"}</dd></div>
          <div><dt>Open edges</dt><dd>{inspect.data?.audit.openEdges.toLocaleString()??"—"}</dd></div>
          <div><dt>Disconnected shells</dt><dd>{inspect.data?.audit.disconnectedShells.toLocaleString()??"—"}</dd></div>
         </dl>
         <small>{meshFindings.length?meshFindings.length+" mesh finding(s) need review":inspect.data?"No edge-topology findings detected":"Awaiting mesh inspection"}</small>
        </section>
        <section className="psFactBlock" aria-label="Dimensions and units">
         <div className="psFactTitle"><SlidersHorizontal size={16}/><strong>Dimensions & units</strong></div>
         <div className="psDimensions"><span>X × Y × Z</span><strong>{inspect.data?Object.values(inspect.data.dimensions).map(v=>v.toFixed(1)).join(" × ")+" mm":"Calculating…"}</strong></div>
         <div className="psUnitRow"><label>STL coordinate units
          <select aria-label="STL coordinate units" value={a.settings.unitScale} onChange={e=>a.update("unitScale",Number(e.target.value))}>
           <option value={1}>Millimeters</option><option value={25.4}>Inches</option><option value={1000}>Meters</option>
          </select></label>
          <button type="button" disabled={!inspect.data||isConfirmed} onClick={a.confirmPart}>{isConfirmed?"Confirmed":"Confirm units & dimensions"}</button>
         </div>
        </section>
       </div>
       {meshFindings.length>0&&<details className="psMeshIssues"><summary>{meshFindings.length} mesh findings to investigate <ChevronDown size={15}/></summary>
        {meshFindings.map(f=><p key={f.code}><strong>{f.level} · {f.code}</strong> — {f.message}</p>)}</details>}
       <p className="psCaveat">STL files don't contain physical units. Geometry screening does not establish printability or mechanical strength.</p>
      </article>
      <article className="psPanel">
       <div className="psPanelHeading"><strong><Layers size={17}/> Engineering analysis activity</strong><span>{a.busy?"Running":currentRun?"Completed":"Preflight"}</span></div>
       <div className="psActivityRows">
        <div><CheckCircle2 size={16}/><span>STL loaded locally</span><small>Complete</small></div>
        <div><CheckCircle2 size={16}/><span>Mesh topology & dimensions</span><small>{inspect.data?"Complete":"Pending"}</small></div>
        <div><span className="psStepBubble">3</span><span>LPBF orientation screening</span><small>{currentRun?"Complete":a.busy?"Running":isConfirmed?"Ready":"Units needed"}</small></div>
       </div>
       {a.busy&&<div className="psProgress"><div style={{width:Math.round(a.progress*100)+"%"}}/><span>{Math.round(a.progress*100)}% · Analyzing geometric orientations</span></div>}
       <div className="psActionRow">
        <button type="button" className="psPrimary" onClick={a.retry} disabled={!isConfirmed||a.busy||!a.file}>
         {a.busy?"Analyzing…":currentRun?"Rerun screening":"Run geometry screening"}<ArrowRight size={15}/>
        </button>
        <button type="button" className="psSecondary" onClick={()=>setStage("context")}>Continue to context</button>
       </div>
       {a.error&&<p role="alert" className="psError">{a.error}</p>}
      </article>
      {currentRun&&selected&&<article className="psPanel psOrientationResults">
       <div className="psPanelHeading"><strong>Selected orientation · {selected.id}</strong><span>Geometry-only estimate</span></div>
       <div className="psThreeStats"><div><span>Build height</span><strong>{selected.buildHeightMm.toFixed(1)} mm</strong></div>
        <div><span>Down-facing area</span><strong>{selected.downFacingAreaMm2.toFixed(1)} mm²</strong></div>
        <div><span>Support proxy</span><strong>{selected.supportProxyMm3.toFixed(1)} mm³</strong></div></div>
       {findings.map(f=><p key={f.code} className="psFinding"><ShieldAlert size={16}/><span>{f.message}</span></p>)}
       <small>Support volumes are geometric proxies; the viewer does not simulate laser physics.</small>
      </article>}
      <details className="psTechnicalDisclosure"><summary><SlidersHorizontal size={15}/> Advanced engineering tools <ChevronDown size={15}/></summary>
       <p>Keep existing numerical stress, thermal research, LPBF slicing and process checks in the dedicated technical workspace.</p>
       <Link href="/copilot/advanced">Open numerical engineering studies <SquareArrowOutUpRight size={14}/></Link>
       <Link href="/copilot">Open original full engineering study <SquareArrowOutUpRight size={14}/></Link>
      </details>
     </>}
    </section>}
    {stage==="context"&&<section className="psStage" aria-label="Engineering context stage">
     <div className="psSectionHead"><span>STAGE 02 / ENGINEERING CONTEXT</span><h2>What must this part do?</h2><p>Combine the part geometry with reviewed assembly context. Do not assume loads or fixtures from an STL alone.</p></div>
     {!a.file?<p className="psNotice">Upload an STL in Part Geometry before attaching part-specific requirements.</p>:<>
      <article className="psPanel psContextPanel">
       <div className="psPanelHeading"><strong><FileText size={17}/> Assembly and requirements</strong><span>{ctx.sources.length} references</span></div>
       <label className={"psDocumentDrop"+(dropActive?" psDragging":"")} onDragOver={e=>{e.preventDefault();setDropActive(true);}}
        onDragLeave={e=>{e.preventDefault();setDropActive(false);}}
        onDrop={e=>{e.preventDefault();setDropActive(false);void ctx.addDocuments(e.dataTransfer.files);}}>
        <FileUp size={25}/><strong>{ctx.busy?"Reading document…":"Upload assembly or engineering document"}</strong>
        <span>Choose or drop PDF, DOCX, XLSX or text · Max 3 MB each</span>
        <input type="file" aria-label="Upload assembly documents" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.json,.log" onChange={e=>{void ctx.addDocuments(e.target.files);e.currentTarget.value="";}}/>
       </label>
       {ctx.sources.length>0&&<div className="psSourceList">{ctx.sources.map(doc=><details key={doc.id}>
        <summary><FileText size={16}/><span><strong>{doc.name}</strong><small>{doc.id} · {doc.extraction==="not_extracted"?"No automatic text extraction":"Local text available"}</small></span><ChevronDown size={15}/></summary>
        <div><label>Source excerpts, with page or drawing number<textarea rows={3} value={doc.engineerNotes} onChange={e=>ctx.setNotes(doc.id,e.target.value)} placeholder="E.g. Page 4: bolted mounting interface (requires verification)"/></label>
         {doc.extractedText&&<details><summary>View extracted text</summary><pre>{doc.extractedText.slice(0,2500)}</pre></details>}
         <button type="button" className="psTextButton" onClick={()=>ctx.removeSource(doc.id)}>Remove reference</button>
        </div>
       </details>)}</div>}
       <p className="psCaveat">PDFs are registered but not automatically parsed. Add verified page-numbered excerpts. Documents stay in browser storage; do not upload controlled Boeing data.</p>
      </article>
      <article className="psPanel">
       <div className="psPanelHeading"><strong><ClipboardCheck size={17}/> Engineering context</strong><span>Engineer-supplied · unverified</span></div>
       <div className="psContextFields">
        {([
         ["componentName","Component function","e.g. Mounting bracket for actuator"],
         ["assemblyContext","Assembly relationships","Connected parts and intended location"],
         ["attachmentNotes","Loads and attachment interfaces","Bolts, fixtures, load directions and missing data"],
         ["reviewedRequirements","Service requirements","Material, tolerances, loads and acceptance criteria"]
        ] as const).map(([field,label,placeholder])=><label key={field}>{label}
         {field==="componentName"?<input value={ctx.knowledge?.[field]??""} onChange={e=>ctx.setField(field,e.target.value)} placeholder={placeholder}/>:
          <textarea rows={2} value={ctx.knowledge?.[field]??""} onChange={e=>ctx.setField(field,e.target.value)} placeholder={placeholder}/>}
        </label>)}
       </div>
       <p className="psCaveat">Document text and notes are not automatically entered as validated FEM loads or material allowables.</p>
      </article>
      <article className="psPanel">
       <div className="psPanelHeading"><strong><ShieldCheck size={17}/> Source evidence</strong><span>{ctx.reviewed.length} reviewed · {candidates.length} suggested</span></div>
       {ctx.reviewed.length>0&&<div className="psEvidenceReviewed">{ctx.reviewed.map(e=><p key={e.key}><CheckCircle2 size={15}/> <span>{e.category} · [{e.sourceId} {e.locator}] {e.excerpt.slice(0,140)}</span></p>)}</div>}
       {candidates.length===0&&<p className="psCaveat">Add reference text containing assembly interfaces, materials, loads or requirements to see reviewable passages.</p>}
       {candidates.slice(0,4).map(e=><div className="psEvidenceItem" key={e.key}>
        <div><span>{e.category}</span><small>[{e.sourceId} {e.locator}] {e.sourceName}</small></div>
        <p>{e.excerpt}</p>
        <button type="button" className="psTextButton" onClick={()=>{setReviewing(reviewing===e.key?"":e.key);setRationale("");}}>Review relevance</button>
        {reviewing===e.key&&<div className="psEvidenceEdit"><label>Why does this passage apply to this part?
         <textarea rows={2} value={rationale} onChange={v=>setRationale(v.target.value)} placeholder="Explain relevance and any uncertainty"/></label>
         <button disabled={rationale.trim().length<8} onClick={()=>{ctx.review(e,rationale);setReviewing("");setRationale("");}}>Confirm passage relevance</button></div>}
       </div>)}
       <div className="psActionRow"><Link className="psSecondary" href="/copilot/advanced">Review approved solver inputs <SquareArrowOutUpRight size={14}/></Link>
        <button type="button" className="psPrimary" onClick={()=>setStage("assessment")}>Review assessment <ArrowRight size={15}/></button></div>
      </article>
      {ctx.error&&<p className="psError" role="alert">{ctx.error}</p>}
     </>}
    </section>}
    {stage==="assessment"&&<section className="psStage" aria-label="Failure assessment stage">
     <div className="psSectionHead"><span>STAGE 03 / FAILURE ASSESSMENT</span><h2>Engineering evidence and risks</h2><p>Separate actual geometric screens from research calculations and manufacturing failures that remain unassessed.</p></div>
     <div className="psSummaryGrid">
      <div><CheckCircle2 size={17}/><strong>{counts.screened}</strong><small>Geometry screens</small></div>
      <div><Layers size={17}/><strong>{counts.calculated}</strong><small>Research calculations</small></div>
      <div><Info size={17}/><strong>{counts.notAssessed}</strong><small>Not assessed</small></div>
     </div>
     <article className="psPanel">
      <div className="psPanelHeading"><strong><ShieldAlert size={17}/> Part-specific concerns</strong><span>{(meshFindings.length+findings.length)} flagged</span></div>
      {!a.file?<p>Upload the model to begin screening.</p>:!currentRun?<div className="psNotice">Confirm STL units and run geometric screening to populate this section.</div>:
       [...meshFindings.map(f=>({code:f.code,message:f.message,basis:"Mesh topology",severity:f.level})),
        ...findings.map(f=>({code:f.code,message:f.message,basis:f.basis,severity:f.severity}))].length===0?
       <p className="psCaveat">No findings from completed geometric rules. This does not imply the part will print successfully.</p>:
       <div className="psRiskFindings">{[...meshFindings.map(f=>({code:f.code,message:f.message,basis:"Mesh topology",severity:f.level})),
        ...findings.map(f=>({code:f.code,message:f.message,basis:f.basis,severity:f.severity}))].map((f,i)=><div key={f.code+i}>
        <span className="psPriority">{f.severity}</span><div><strong>{f.code}</strong><p>{f.message}</p><small>{f.basis}</small></div></div>)}</div>}
     </article>
     <div className="psRiskColumns">
      {(["Manufacturing risks","In-service behavior"] as const).map(group=><article className="psPanel" key={group}>
       <div className="psPanelHeading"><strong>{group}</strong></div>
       {coverage.filter(f=>group==="Manufacturing risks"?f.category!=="service":f.category==="service").map(f=><details key={f.id} className="psRiskItem">
        <summary><span>{f.name}</span><small className={f.state!=="not-assessed"?"psCalculated":""}>{f.state==="not-assessed"?"Not assessed":f.state==="screened"?"Screened":"Calculated"}</small></summary>
        <p><strong>Method:</strong> {f.method}</p><p><strong>Limitation:</strong> {f.limitations}</p><p><strong>Next input:</strong> {f.nextInput}</p>
       </details>)}
      </article>)}
     </div>
     <article className="psPanel psReportCard">
      <div><span className="psEyebrow">ENGINEERING DELIVERABLE</span><h3>Pre-build assessment report</h3><p>Download actual geometry results or the source-backed engineering context. Both reports identify limitations; neither certifies the part.</p></div>
      <div className="psReportButtons">
       <button type="button" className="psPrimary" onClick={()=>void exportEvidence()} disabled={!a.file||!partHash||!isConfirmed||exportBusy}><Download size={15}/> Export evidence PDF</button>
       <button type="button" className="psSecondary" onClick={()=>void exportGeometry()} disabled={!currentRun||exportBusy}><Download size={15}/> Geometry analysis PDF</button>
       <button type="button" className="psTextButton" onClick={()=>{if(currentRun&&a.result)downloadJSON(a.result,a.selected);}} disabled={!currentRun}>Download analysis JSON</button>
      </div>
     </article>
     <p className="psCaveat">Unassessed is not low risk. Neither part orientation nor idealized service response provides validated LPBF defect probabilities.</p>
    </section>}
   </div>
   <div className="psAssistant">
    {showThread&&thread.length>0&&<div className="psThread" role="log" aria-label="Engineering assistant messages">
     <div className="psThreadHeader"><strong><MessageSquare size={15}/> Engineering conversation</strong><button type="button" onClick={()=>setShowThread(false)} aria-label="Collapse conversation"><X size={15}/></button></div>
     <div className="psThreadItems">{thread.map((m,i)=><p key={i} className={m.role==="user"?"psHumanMessage":"psAssistantMessage"}><strong>{m.role==="user"?"You":"ORIENTAI · Local guide"}</strong>{m.text}</p>)}</div>
    </div>}
    <div className="psAskBox">
     <textarea aria-label="Ask ORIENTAI" rows={2} value={draft} onChange={e=>setDraft(e.target.value)}
      onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
      placeholder="Ask about this part, its assembly context, or its potential failures…"/>
     <div><span><MessageSquare size={15}/> Source-backed local engineering guide</span>
      <button type="button" aria-label="Send message" disabled={!draft.trim()} onClick={send}><ArrowUp size={17}/></button></div>
    </div>
    {error&&<p role="alert" className="psError">{error}</p>}
    <small>Engineering decision support only · No print-quality certification · Numerical studies require engineer-approved inputs</small>
   </div>
  </div>
  <aside className="psViewerColumn" aria-label="Persistent engineering model viewer">
   <header className="psViewerHeader"><strong><Box size={18}/>{projectName}</strong><span>CAD / STL GEOMETRY</span></header>
   <div className="psViewerFrame">
    {a.file?<ViewerErrorBoundary fallback={<StudioCanvasFallback url={url} buildFraction={layer/100}/>}>
     <ModelViewer url={url} unitScale={a.settings.unitScale} rotation={selected?.rotation}
      overhangDeg={a.settings.overhangDeg} showOverhangs={showOverhangs} showSupports={showSupports}
      buildFraction={layer/100}/>
    </ViewerErrorBoundary>:<div className="psViewerEmpty"><Box size={35}/><strong>No model loaded</strong><small>Upload an STL to inspect its geometry here.</small></div>}
   </div>
   <section className="psViewerControls">
    <div className="psPanelHeading"><strong>Metal AM engineering view</strong><span>Geometry</span></div>
    <div className="psToggleRow">
     <button className={!showOverhangs&&!showSupports?"psToggleActive":""} onClick={()=>{setShowOverhangs(false);setShowSupports(false);}}>Solid part</button>
     <button aria-pressed={showOverhangs} className={showOverhangs?"psToggleActive":""} onClick={()=>setShowOverhangs(v=>!v)}>Overhang faces</button>
     <button aria-pressed={showSupports} className={showSupports?"psToggleActive":""} onClick={()=>setShowSupports(v=>!v)}>Conceptual supports</button>
    </div>
    <div className="psBuildRow"><strong>Build progression</strong><span>{layer}%</span></div>
    <input type="range" aria-label="Build progression percentage" value={layer} min={1} max={100}
     onChange={e=>{setPlaying(false);setLayer(Number(e.target.value));}}/>
    <div className="psPlayback">
     <button onClick={()=>{if(layer>=100)setLayer(1);setPlaying(p=>!p);}}>{playing?<Pause size={14}/>:<Play size={14}/>} {playing?"Pause build":"Play build"}</button>
     <button onClick={()=>{setPlaying(false);setLayer(1);}}><RotateCcw size={14}/> Restart</button>
    </div>
    <small>STL geometry preview. Support posts are conceptual, not machine-ready. Build progression is not a deposition or thermal simulation.</small>
   </section>
   <div className="psViewerBottom">
    <div><span className="psEyebrow">STUDY EVIDENCE</span><p>{ctx.sources.length} documents · {ctx.reviewed.length} reviewed excerpts · {counts.notAssessed} unassessed risks</p></div>
    <button type="button" onClick={()=>setStage("assessment")}>Open results <ArrowRight size={14}/></button>
   </div>
  </aside>
  <input ref={partFileInput} type="file" accept=".stl" className="psHiddenInput" aria-label="Select STL part" onChange={e=>attach(e.target.files?.[0])}/>
 </div>;
}
