"use client";
import {useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
 ArrowRight,ArrowUp,Box,Check,CheckCircle2,ChevronDown,ClipboardCheck,Maximize2,MoreHorizontal,Compass,Hand,Eye,PanelLeftClose,PanelLeftOpen,GripVertical,
 Download,FileText,FileUp,Info,Layers,MessageSquare,Pause,Play,RotateCcw,Minimize2,
 Search,ShieldAlert,ShieldCheck,SlidersHorizontal,SquareArrowOutUpRight,X
} from "lucide-react";
import {useAnalysis} from "@/components/AnalysisProvider";
import {usePartInspection} from "@/components/PartInspection";
import {completedPart} from "@/lib/engineering-journey";
import {screenCandidate} from "@/lib/part-screening";
import {failureCoverage,coverageSummary} from "@/lib/failure-coverage";
import {evaluatePrebuild} from "@/lib/prebuild-assessment";
import {manufacturingProcessFlow} from "@/lib/manufacturing-process-flow";
import {assessLpbfProcessWindow,emptyProcessQualityInput,PROCESS_PARAMETERS,type ProcessQualityInput} from "@/lib/lpbf-process-quality";
import {createCopilotReviewPDF} from "@/lib/copilot-review-pdf";
import {reportPDF,downloadJSON} from "@/lib/engineering-report";
import {assessEngineeringReadiness} from "@/lib/engineering-readiness";
import {findEvidence,localCopilotReply} from "@/lib/copilot-context";
import {explainPartFailureModes} from "@/lib/part-failure-explanation";
import {activeParameterBindings} from "@/lib/engineering-parameter-binding";
import {activeServiceCase} from "@/lib/service-plan";
import {useStudioContext} from "./useStudioContext";
import {usePartFeedback} from "./usePartFeedback";
import StudioCanvasFallback from "./StudioCanvasFallback";
import ProfessionalGeometryStage from "./ProfessionalGeometryStage";
import ProfessionalProcessPanel from "./ProfessionalProcessPanel";
import ProfessionalAssessmentPanel from "./ProfessionalAssessmentPanel";
import ViewerErrorBoundary from "@/components/ViewerErrorBoundary";
import "./professional-study.css";
import "./professional-density.css";
import "./professional-reference.css";
import "./professional-enterprise.css";
import "./professional-workspace-layout.css";
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
 const [fitScreen]=useState(true);
 const [viewerExpanded,setViewerExpanded]=useState(false);
 const [studyHidden,setStudyHidden]=useState(false);
 const [viewerPercent,setViewerPercent]=useState(42);
 const [prefsLoaded,setPrefsLoaded]=useState(false);
 const [resizing,setResizing]=useState(false);
 const dragActive=useRef(false);
 const workbenchRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  try{
   const stored=Number(window.localStorage.getItem("orientai-workbench-viewer-percent-v1"));
   if(Number.isFinite(stored)&&stored>=35&&stored<=64)setViewerPercent(stored);
  }catch{}
  setPrefsLoaded(true);
 },[]);
 useEffect(()=>{
  if(!prefsLoaded)return;
  try{window.localStorage.setItem("orientai-workbench-viewer-percent-v1",String(viewerPercent));}catch{}
 },[viewerPercent,prefsLoaded]);
 const setWidthFromPointer=(clientX:number)=>{
  const rect=workbenchRef.current?.getBoundingClientRect();
  if(!rect||rect.width<1)return;
  setViewerPercent(Math.round(Math.max(35,Math.min(64,(rect.right-clientX)/rect.width*100))));
 };
 const [cameraView,setCameraView]=useState("iso");
 const [previewYaw,setPreviewYaw]=useState(0);
 const [viewerReset,setViewerReset]=useState(0);
 const [showBuildDirection,setShowBuildDirection]=useState(false);
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
 const [externalAiReady,setExternalAiReady]=useState(false);
 const [externalAiApproved,setExternalAiApproved]=useState(false);
 const [externalAiBusy,setExternalAiBusy]=useState(false);
 useEffect(()=>{
  let live=true;
  void fetch("/api/engineering-copilot",{method:"GET",cache:"no-store"})
   .then(async r=>r.ok?await r.json():null)
   .then(data=>{if(live)setExternalAiReady(data?.enabled===true);})
   .catch(()=>{if(live)setExternalAiReady(false);});
  return()=>{live=false;};
 },[]);
 const [reviewing,setReviewing]=useState("");
 const [rationale,setRationale]=useState("");
 const [uploadBusy,setUploadBusy]=useState(false);
 const [processInput,setProcessInput]=useState<ProcessQualityInput>(emptyProcessQualityInput);
 const [processStoreKey,setProcessStoreKey]=useState<string|null>(null);
 const [dropActive,setDropActive]=useState(false);
 const partFileInput=useRef<HTMLInputElement>(null);
 const stageScroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const panel=stageScroll.current;
  if(!panel)return;
  panel.scrollTop=0;
  const id=window.requestAnimationFrame(()=>{if(stageScroll.current)stageScroll.current.scrollTop=0;});
  return()=>window.cancelAnimationFrame(id);
 },[stage,a.file]);
 const ctx=useStudioContext(partHash);
 const feedback=usePartFeedback(partHash);
 useEffect(()=>{
  const key=partHash?"orientai.lpbf.window.v1:"+partHash+":"+a.settings.unitScale:null;
  setProcessStoreKey(null);
  if(!key){setProcessInput(emptyProcessQualityInput());return;}
  try{
   const raw=localStorage.getItem(key);
   const prior=raw?JSON.parse(raw) as ProcessQualityInput:null;
   if(prior&&typeof prior.machine==="string"&&typeof prior.material==="string"&&
    typeof prior.parameterSet==="string"&&typeof prior.reference==="string"&&
    typeof prior.referenceReviewed==="boolean"&&
    PROCESS_PARAMETERS.every(p=>prior.values?.[p.id]===null||
     typeof prior.values?.[p.id]==="number"&&Number.isFinite(prior.values[p.id]))&&
    PROCESS_PARAMETERS.every(p=>prior.windows?.[p.id]&&
     ["min","max"].every(field=>{
      const value=prior.windows[p.id][field as "min"|"max"];
      return value===null||typeof value==="number"&&Number.isFinite(value);
     })))setProcessInput(prior);
   else setProcessInput(emptyProcessQualityInput());
  }catch{setProcessInput(emptyProcessQualityInput());}
  setProcessStoreKey(key);
 },[partHash,a.settings.unitScale]);
 useEffect(()=>{
  const key=partHash?"orientai.lpbf.window.v1:"+partHash+":"+a.settings.unitScale:null;
  if(!key||processStoreKey!==key)return;
  try{localStorage.setItem(key,JSON.stringify(processInput));}
  catch{setError("Browser storage could not save the process-window review.");}
 },[partHash,a.settings.unitScale,processStoreKey,processInput]);
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
 const processAssessment=assessLpbfProcessWindow(processInput);
 const prebuild=evaluatePrebuild({
  fileName:a.file?.name??null,unitsConfirmed:isConfirmed,process:a.journey.process,
  mesh:inspect.data?.audit??null,selected:currentRun?selected??null:null,
  allCandidates:currentRun?a.result?.candidates??[]:[],
  componentName:ctx.knowledge?.componentName??"",assemblyContext:ctx.knowledge?.assemblyContext??"",
  attachmentNotes:ctx.knowledge?.attachmentNotes??"",requirements:ctx.knowledge?.reviewedRequirements??"",
  documentCount:ctx.sources.length,reviewedEvidenceCount:ctx.reviewed.length,
  processWindow:partHash&&isConfirmed&&a.journey.process==="PBF_LB_METAL"?processAssessment:null,
  hasStructuralStudy:Boolean(currentRun&&a.result?.structural),
  hasSteadyThermalStudy:Boolean(currentRun&&a.result?.thermal),coverage
 });
 const manufacturingFlow=manufacturingProcessFlow({
  hasPart:Boolean(a.file),unitsConfirmed:isConfirmed,hasGeometryRun:currentRun,
  hasAssemblyContext:Boolean(ctx.knowledge?.componentName&&ctx.knowledge.assemblyContext),
  hasReviewedEvidence:ctx.reviewed.length>0,
  hasRiskAssessment:currentRun&&isConfirmed,hasBlockers:prebuild.disposition==="geometry-blocked",
  hasExternalTestResults:feedback.records.length>0
 });
 const candidates=useMemo(()=>ctx.candidates.filter(c=>!ctx.reviewed.some(r=>r.key===c.key)),[ctx.candidates,ctx.reviewed]);
 const next=!a.file?{title:"Upload STL",detail:"Select the component you want to assess.",action:"Upload part",to:"geometry" as Stage}:
  !isConfirmed?{title:"Confirm dimensions",detail:"Verify units against the source drawing.",action:"Review units",to:"geometry" as Stage}:
  !currentRun?{title:"Screen geometry",detail:"Run local build-orientation and overhang checks.",action:"Run screening",to:"geometry" as Stage}:
  !ctx.sources.length?{title:"Add engineering context",detail:"Define the part's application and assembly role.",action:"Add context",to:"context" as Stage}:
  !ctx.reviewed.length?{title:"Review source evidence",detail:"Confirm which document excerpts apply to this part.",action:"Review evidence",to:"context" as Stage}:
  {title:"Review failure mechanisms",detail:"Inspect screened findings and remaining unknowns.",action:"Review risks",to:"assessment" as Stage};
 const advanceWorkflow=()=>{
  if(!a.file){partFileInput.current?.click();return;}
  if(!isConfirmed){
   setStage("geometry");
   window.requestAnimationFrame(()=>document.getElementById("ps-units-confirmation")?.scrollIntoView({block:"nearest",behavior:"smooth"}));
   return;
  }
  if(!currentRun){setStage("geometry");a.retry();return;}
  setStage(next.to);stageScroll.current?.scrollTo({top:0,behavior:"instant"});
 };

 const attach=(file:File|undefined)=>{
  if(!file)return;
  if(!file.name.toLowerCase().endsWith(".stl")||file.size<1||file.size>20*1024*1024){setError("Select a nonempty STL file up to 20 MB.");return;}
  a.upload(file);a.setProjectName(file.name.replace(/\.stl$/i,""));setError("");setStage("geometry");
 };
 const send=async()=>{
  const q=draft.trim();if(!q||externalAiBusy)return;
  let response:string;
  if(!a.file)response="Upload an STL first. I can then inspect dimensions, geometric manufacturing concerns, and the assembly information you provide.";
  else if(/\b(fail(?:ure|ures|ing)?|risks?|defects?|porosity|crack(?:s|ing)?|distort(?:ion)?|quality|printability|support|overhang|stress|build|improve|recommend)\b/i.test(q)){
   response=explainPartFailureModes({
    partName:a.file.name,unitsConfirmed:isConfirmed,hasOrientation:currentRun,
    meshFindings,orientationFindings:findings,coverage,prebuild,
    assemblyKnown:Boolean(ctx.knowledge?.componentName.trim()&&ctx.knowledge?.assemblyContext.trim()),
    requirementsKnown:Boolean(ctx.knowledge?.attachmentNotes.trim()&&ctx.knowledge?.reviewedRequirements.trim()),
    documentCount:ctx.sources.length,reviewedCount:ctx.reviewed.length
   });
  }else if(ctx.knowledge){
   const result=localCopilotReply(ctx.knowledge,q,{
    partName:a.file.name,confirmed:isConfirmed,hasOrientation:currentRun,
    loadsReviewed:ctx.reviewed.some(x=>x.category==="load"),process:a.journey.process
   });
   response=result.text;
  }else response="The part is loading. Confirm the STL units and upload an assembly document to begin contextual review.";
  if(/\b(assembly|requirement|load|material|fixture|document)\b/i.test(q))setStage("context");
  setDraft("");setShowThread(true);
  if(externalAiReady&&externalAiApproved&&a.file){
   setExternalAiBusy(true);
   try{
    const res=await fetch("/api/engineering-copilot",{
     method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({
      allowExternal:true,message:q,
      project:{name:a.projectName,partName:a.file.name,confirmed:isConfirmed,
       process:a.journey.process,componentName:ctx.knowledge?.componentName??"",
       assemblyContext:ctx.knowledge?.assemblyContext??"",
       attachmentNotes:ctx.knowledge?.attachmentNotes??"",
       requirements:ctx.knowledge?.reviewedRequirements??"",
       hasOrientation:currentRun,
       screeningFindings:prebuild.findings.filter(f=>f.status!=="unassessed").slice(0,10)
        .map(f=>({id:f.id,title:f.title,observation:f.observation,basis:f.basis}))},
      // Only engineer-reviewed excerpts; no binary CAD, PDFs or raw attachments.
      sources:ctx.reviewed.slice(0,8).map(e=>({
       id:e.sourceId,name:e.sourceName,text:e.excerpt,notes:e.reviewerNote
      })),
      history:thread.slice(-8)
     })
    });
    const payload=await res.json();
    if(!res.ok||typeof payload.text!=="string")throw Error(payload.error||"Model response unavailable");
    response="External AI explanation (not a numerical solver or validated prediction):\n"+payload.text;
   }catch(e){
    response="External AI unavailable ("+(e instanceof Error?e.message:"request failed")+").\n\n"+
     "Local evidence-based guidance:\n"+response;
   }finally{setExternalAiBusy(false);}
  }
  setThread(t=>([...t,{role:"user" as const,text:q},{role:"assistant" as const,text:response}]).slice(-24));
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
    projectName:a.projectName,partName:a.file.name,partSha256:partHash,process:a.journey.process,modelFile:a.file,
    unitsConfirmed:isConfirmed,createdAt:new Date().toISOString(),knowledge:k,
    reviewedEvidence:ctx.reviewed,approvedBindings,readiness,
    coverage,prebuild,manufacturingFlow,feedbackRecords:feedback.records,
    processWindow:a.journey.process==="PBF_LB_METAL"?processAssessment:null,
    geometricConcerns:[...meshFindings.map(f=>({code:f.code,message:f.message,basis:"STL mesh-topology audit",severity:f.level})),
     ...(currentRun?findings.map(f=>({code:f.code,message:f.message,basis:f.basis,severity:f.severity})):[])],
    geometry:inspect.data?{
     dimensionsMm:inspect.data.dimensions,
     triangles:inspect.data.audit.triangles,
     openEdges:inspect.data.audit.openEdges,
     nonManifoldEdges:inspect.data.audit.nonManifoldEdges,
     disconnectedShells:inspect.data.audit.disconnectedShells,
     smallestEdgeMm:inspect.data.audit.smallestEdgeMm,
     surfaceAreaMm2:inspect.data.audit.surfaceAreaMm2,
     solidVolumeMm3:inspect.data.audit.solidVolumeMm3
    }:undefined,
    selectedOrientation:selected?{
     id:selected.id,buildHeightMm:selected.buildHeightMm,downFacingAreaMm2:selected.downFacingAreaMm2,
     supportProxyMm3:selected.supportProxyMm3,overhangFraction:selected.overhangFraction,
     contactAreaMm2:selected.contactAreaMm2,rotation:selected.rotation
    }:undefined
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
 const modelRotation={x:selected?.rotation.x??0,y:selected?.rotation.y??0,z:(selected?.rotation.z??0)+previewYaw};
 return <div ref={workbenchRef}
   className={"psRoot psFit psReferenceRoot"+(viewerExpanded?" psViewerExpanded":"")+(studyHidden?" psStudyHidden":"")+(resizing?" psResizing":"")}
   style={{"--ps-viewer-width":viewerPercent+"%"} as CSSProperties}
   aria-label="ORIENTAI professional engineering workbench">
  <div id="ps-engineering-study" className="psWorkingColumn">
   <header className="psWorkspaceHeader">
    <nav className="psStepper" aria-label="Assessment stages">
     {stageEntries.map(({id,label},i)=><button type="button" key={id}
      className={"psStep"+(stage===id?" psActive":"")}
      aria-current={stage===id?"step":undefined}
      onClick={()=>{setStage(id);stageScroll.current?.scrollTo({top:0,behavior:"instant"});}}>
      <span className="psStepCount">{i+1}</span>
      <span className="psStepContent"><strong>{label}</strong></span>
     </button>)}
    </nav>
   </header>
   <div className="psWorkflowBar" role="region" aria-label="Recommended workflow action">
    <div className="psWorkflowSummary"><strong>Next: {next.title}</strong><span>{next.detail}</span></div>
    <button type="button" onClick={advanceWorkflow} disabled={a.busy}>
     {a.busy?"Analyzing...":next.action} <ArrowRight size={14}/>
    </button>
    {a.file&&isConfirmed&&<button type="button" className="psWorkflowReport" onClick={()=>{setStage("assessment");stageScroll.current?.scrollTo({top:0,behavior:"instant"});}}
     aria-label="Open pre-build assessment report">Report <FileText size={14}/></button>}
   </div>
   <div className="psStageScroll" ref={stageScroll} role="region" aria-label="Active assessment stage">
    {stage==="geometry"&&<ProfessionalGeometryStage
     file={a.file} url={url} inspection={inspect.data} inspectionError={inspect.error}
     unitScale={a.settings.unitScale} unitsConfirmed={isConfirmed} meshFindings={meshFindings}
     selected={selected} findings={findings} hasRun={currentRun}
     busy={a.busy} progress={a.progress} analysisError={a.error}
     onUpload={()=>partFileInput.current?.click()}
     onAttachFile={attach}
     onChangeUnits={v=>a.update("unitScale",v)} onConfirm={a.confirmPart}
     onRun={a.retry} onContinue={()=>setStage("context")} onQuickView={()=>setViewerExpanded(true)}
    />}
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
      {a.journey.process==="PBF_LB_METAL"&&<ProfessionalProcessPanel
       input={processInput} onChange={setProcessInput} confirmed={isConfirmed}/>}
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
    {stage==="assessment"&&<ProfessionalAssessmentPanel
     assessment={prebuild} coverage={coverage} flow={manufacturingFlow}
     hasPart={Boolean(a.file)} canExport={Boolean(a.file&&partHash&&isConfirmed)}
     hasGeometry={currentRun} exportBusy={exportBusy}
     feedback={feedback.records} feedbackError={feedback.error}
     onAddFeedback={feedback.add} onRemoveFeedback={feedback.remove}
     onExport={()=>void exportEvidence()} onGeometryExport={()=>void exportGeometry()}
     onJsonExport={()=>{if(currentRun&&a.result)downloadJSON(a.result,a.selected);}}
     onNavigate={nextStage=>{setStage(nextStage);stageScroll.current?.scrollTo({top:0,behavior:"instant"});}}
     onInspectOverhangs={()=>{setShowOverhangs(true);setShowSupports(false);setCameraView("iso");setViewerExpanded(false);}}
    />}
   </div>
   <div className="psAssistant">
    {showThread&&thread.length>0&&<div className="psThread" role="log" aria-label="Engineering assistant messages">
     <div className="psThreadHeader"><strong><MessageSquare size={15}/> Engineering conversation</strong><button type="button" onClick={()=>setShowThread(false)} aria-label="Collapse conversation"><X size={15}/></button></div>
     <div className="psThreadItems">{thread.map((m,i)=><p key={i} className={m.role==="user"?"psHumanMessage":"psAssistantMessage"}><strong>{m.role==="user"?"You":"ORIENTAI · Local guide"}</strong>{m.text}</p>)}</div>
    </div>}
    <div className="psExternalAiSwitch">
     {externalAiReady?<label><input type="checkbox" checked={externalAiApproved}
      onChange={e=>setExternalAiApproved(e.target.checked)}/>
      Use external AI for explanation. This sends my message, entered context and reviewed passages only, not STL bytes. Never include controlled data.</label>:
      <span>Local evidence-based guide · External model unavailable on this deployment</span>}
    </div>
    <div className="psAskBox">
     <textarea aria-label="Ask ORIENTAI" rows={2} value={draft} onChange={e=>setDraft(e.target.value)}
      onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}}}
      placeholder="Ask about this part, its assembly context, or its potential failures…"/>
     <div><span><MessageSquare size={15}/> Source-backed local engineering guide</span>
      <button type="button" aria-label="Send message" disabled={!draft.trim()||externalAiBusy} onClick={()=>void send()}><ArrowUp size={17}/></button></div>
    </div>
    {error&&<p role="alert" className="psError">{error}</p>}
    <small>Engineering decision support only · No print-quality certification · Numerical studies require engineer-approved inputs</small>
   </div>
  </div>
  {!studyHidden&&!viewerExpanded&&<div className="psPaneResizeHandle" role="separator"
   aria-label="Resize study and 3D viewer panels" aria-orientation="vertical"
   aria-valuemin={35} aria-valuemax={64} aria-valuenow={viewerPercent}
   aria-valuetext={"Viewer "+viewerPercent+" percent of workbench"} tabIndex={0}
   title="Drag to resize the panels, or use left and right arrow keys"
   onPointerDown={e=>{e.preventDefault();dragActive.current=true;setResizing(true);e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{if(dragActive.current)setWidthFromPointer(e.clientX);}}
   onPointerUp={()=>{dragActive.current=false;setResizing(false);}}
   onPointerCancel={()=>{dragActive.current=false;setResizing(false);}}
   onKeyDown={e=>{
    if(e.key==="ArrowLeft"){e.preventDefault();setViewerPercent(v=>Math.min(64,v+2));}
    if(e.key==="ArrowRight"){e.preventDefault();setViewerPercent(v=>Math.max(35,v-2));}
    if(e.key==="Home"){e.preventDefault();setViewerPercent(35);}
    if(e.key==="End"){e.preventDefault();setViewerPercent(64);}
   }}>
   <GripVertical size={15} aria-hidden="true"/>
  </div>}
  <aside className="psViewerColumn" aria-label="Persistent engineering model viewer">
   <div className="psReferenceViewerCard">
    <header className="psReferenceViewerHeader">
     <strong><Box size={19}/>3D Viewer <span>· {projectName}</span></strong>
     <div className="psViewerHeaderActions">
      <button type="button" aria-controls="ps-engineering-study" aria-expanded={!studyHidden}
       aria-label={studyHidden?"Show study panel":"Hide study panel"}
       title={studyHidden?"Show analysis and engineering context":"Focus the CAD model"}
       onClick={()=>setStudyHidden(v=>!v)}>
       {studyHidden?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}
      </button>
      <button type="button" aria-label={viewerExpanded?"Close expanded viewer":"Expand 3D viewer"}
       title={viewerExpanded?"Return to workbench":"Expand the model viewer"}
       onClick={()=>setViewerExpanded(v=>!v)}>{viewerExpanded?<X size={17}/>:<Maximize2 size={17}/>}</button>
      <details className="psViewerMenu"><summary aria-label="Model viewer options"><MoreHorizontal size={17}/></summary>
       <div><button type="button" onClick={()=>setViewerReset(n=>n+1)}><RotateCcw size={14}/> Reset camera</button>
        <button type="button" onClick={()=>setCameraView("iso")}><Eye size={14}/> Isometric view</button></div>
      </details>
     </div>
    </header>
    <div className="psViewerFrame psReferenceViewport">
     {a.file?<ViewerErrorBoundary fallback={<StudioCanvasFallback url={url} buildFraction={layer/100}/>}>
      <ModelViewer key={viewerReset} url={url} unitScale={a.settings.unitScale} rotation={modelRotation} fitPadding={1.10}
       cameraView={cameraView} onCameraViewChange={setCameraView}
       overhangDeg={a.settings.overhangDeg} showOverhangs={showOverhangs} showSupports={showSupports}
       buildFraction={layer/100}/>
     </ViewerErrorBoundary>:<div className="psViewerEmpty"><Box size={33}/><strong>No model loaded</strong><small>Upload an STL to inspect its actual geometry here.</small></div>}
     <div className="psBuildAxis" aria-hidden="true"><b>+Z</b><span className="psAxisX">X</span><span className="psAxisY">Y</span></div>
     {showBuildDirection&&<div className="psBuildDirectionLabel" role="status">Build axis ↑ · visualization</div>}
    </div>
    <div className="psViewerToolbar" role="toolbar" aria-label="3D model navigation">
     <div className="psCameraButtons">
      <button type="button" aria-label="Isometric view" title="Isometric view" aria-pressed={cameraView==="iso"} onClick={()=>setCameraView("iso")}><Box size={17}/></button>
      <button type="button" aria-label="Top view" title="Top view" aria-pressed={cameraView==="top"} onClick={()=>setCameraView("top")}><Compass size={17}/></button>
      <button type="button" aria-label="Front view" title="Front view" aria-pressed={cameraView==="front"} onClick={()=>setCameraView("front")}><Eye size={17}/></button>
      <button type="button" aria-label="Side view" title="Side view" aria-pressed={cameraView==="side"} onClick={()=>setCameraView("side")}><Hand size={17}/></button>
      <button type="button" aria-label="Fit model view" title="Fit model view" onClick={()=>{setCameraView("iso");setViewerReset(n=>n+1);}}><Maximize2 size={17}/></button>
     </div>
     <select aria-label="Geometry display mode" value={showSupports?"supports":showOverhangs?"overhangs":"solid"}
      onChange={e=>{const v=e.target.value;setShowOverhangs(v==="overhangs");setShowSupports(v==="supports");}}>
      <option value="solid">Solid</option><option value="overhangs">Overhangs</option><option value="supports">Supports</option>
     </select>
    </div>
    <div className="psViewerStatusLine" role="status">
     <span><span className="psStatusDot"/> {a.file?"STL geometry":"No part loaded"}</span>
     <span>{a.file?(isConfirmed?"Units confirmed":"Units unconfirmed"):"Awaiting file"}</span>
    </div>
    <details className="psReferenceViewSettings psEngineeringInspector">
     <summary><SlidersHorizontal size={15}/> Display & build settings <ChevronDown size={15}/></summary>
     <div className="psEngineeringInspectorBody">
      <div className="psOrientationControl">
       <label htmlFor="ps-yaw-select">Visual Z rotation <Info size={14}/></label>
       <select id="ps-yaw-select" aria-label="Build orientation angle" disabled={!a.file}
        value={previewYaw} onChange={e=>setPreviewYaw(Number(e.target.value))}>
        <option value={0}>0°</option><option value={90}>90°</option>
        <option value={180}>180°</option><option value={270}>270°</option>
       </select>
      </div>
      <div className="psOverlayControl">
       <label htmlFor="ps-overhang-overlay">Highlight geometric overhangs</label>
       <input id="ps-overhang-overlay" type="checkbox" aria-label="Preview geometric overhang overlay"
        checked={showOverhangs} onChange={e=>{setShowOverhangs(e.target.checked);if(e.target.checked)setShowSupports(false);}}/>
      </div>
      <div className="psOverlayControl">
       <label htmlFor="ps-build-axis-toggle">Show build direction</label>
       <input id="ps-build-axis-toggle" type="checkbox" checked={showBuildDirection}
        onChange={e=>setShowBuildDirection(e.target.checked)}/>
      </div>
      <details className="psBuildDisclosure">
       <summary>Geometry buildup preview <span>{layer}% <ChevronDown size={14}/></span></summary>
       <input type="range" aria-label="Build progression percentage" min={1} max={100} value={layer}
        onChange={e=>{setPlaying(false);setLayer(Number(e.target.value));}}/>
       <div className="psPlayback">
        <button type="button" onClick={()=>{if(layer>=100)setLayer(1);setPlaying(p=>!p);}}>{playing?<Pause size={14}/>:<Play size={14}/>} {playing?"Pause build":"Play build"}</button>
        <button type="button" onClick={()=>{setPlaying(false);setLayer(1);}}><RotateCcw size={14}/> Restart</button>
       </div>
      </details>
      <small className="psViewerMethodNote">Geometry-only visualization. Supports and build progression are conceptual, not process simulations.</small>
     </div>
    </details>
   </div>
  </aside>
  <input ref={partFileInput} type="file" accept=".stl" className="psHiddenInput" aria-label="Select STL part" onChange={e=>attach(e.target.files?.[0])}/>
 </div>;
}
