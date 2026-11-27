"use client";
import {useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
 ArrowRight,ArrowUp,Box,Check,CheckCircle2,ChevronDown,ClipboardCheck,Maximize2,MoreHorizontal,Compass,Hand,Eye,PanelLeftClose,PanelLeftOpen,GripVertical,
 Download,FileText,FileUp,Info,Layers,MessageSquare,Pause,Play,RotateCcw,Minimize2,
 Search,ShieldAlert,ShieldCheck,SlidersHorizontal,SquareArrowOutUpRight,X
,Ruler} from "lucide-react";
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
import GuidedStudyHelp from "./GuidedStudyHelp";
import RiskPreflight from "./RiskPreflight";
import ProfessionalProcessPanel from "./ProfessionalProcessPanel";
import ProfessionalAssessmentPanel from "./ProfessionalAssessmentPanel";
import ViewerErrorBoundary from "@/components/ViewerErrorBoundary";
import "./professional-study.css";
import "./professional-density.css";
import "./professional-reference.css";
import "./professional-enterprise.css";
import "./professional-workspace-layout.css";
import "./professional-cad-layout.css";
import {appendMeasurement,distanceMm,type MeshPick,type MeshSnapMode} from "@/lib/cad-mesh-measurement";
import type {SectionView} from "@/lib/cad-section-plane";
import UnifiedServiceStudy,{type ServiceStudyResults} from "@/components/UnifiedServiceStudy";
import "../copilot.css";
import "./cad-advanced-workspace.css";
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
 const [compactPropertiesOpen,setCompactPropertiesOpen]=useState(false);
 const [viewerPercent,setViewerPercent]=useState(42);
 const [cadLayout,setCadLayout]=useState(true);
 const [cadAssistantOpen,setCadAssistantOpen]=useState(false);
 const [cadViewerPercent,setCadViewerPercent]=useState(58);
 const activeViewerPercent=cadLayout?cadViewerPercent:viewerPercent;
 const setActiveViewerPercent=cadLayout?setCadViewerPercent:setViewerPercent;
 const [prefsLoaded,setPrefsLoaded]=useState(false);
 const [resizing,setResizing]=useState(false);
 const dragActive=useRef(false);
 const workbenchRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  try{
   setCadLayout(window.localStorage.getItem("orientai-cad-layout-v1")!=="false");
   const cadStored=Number(window.localStorage.getItem("orientai-cad-viewer-percent-v1"));
   if(Number.isFinite(cadStored)&&cadStored>=35&&cadStored<=64)setCadViewerPercent(cadStored);
   const stored=Number(window.localStorage.getItem("orientai-workbench-viewer-percent-v1"));
   if(Number.isFinite(stored)&&stored>=35&&stored<=64)setViewerPercent(stored);
  }catch{}
  setPrefsLoaded(true);
 },[]);
 useEffect(()=>{
  if(!prefsLoaded)return;
  try{window.localStorage.setItem("orientai-workbench-viewer-percent-v1",String(viewerPercent));}catch{}
 },[viewerPercent,prefsLoaded]);
 useEffect(()=>{
  if(!prefsLoaded)return;
  try{window.localStorage.setItem("orientai-cad-layout-v1",String(cadLayout));window.localStorage.setItem("orientai-cad-viewer-percent-v1",String(cadViewerPercent));}catch{}
 },[cadLayout,cadViewerPercent,prefsLoaded]);
 const setWidthFromPointer=(clientX:number)=>{
  const rect=workbenchRef.current?.getBoundingClientRect();
  if(!rect||rect.width<1)return;
  setActiveViewerPercent(Math.round(Math.max(35,Math.min(64,(cadLayout?clientX-rect.left:rect.right-clientX)/rect.width*100))));
 };
 const [cameraView,setCameraView]=useState("iso");
 const [previewYaw,setPreviewYaw]=useState(0);
 const [orientationDraft,setOrientationDraft]=useState<{x:number;y:number;z:number}|null>(null);
 const [serviceDockOpen,setServiceDockOpen]=useState(false);
 const [serviceDockMounted,setServiceDockMounted]=useState(false);
 const [sandboxService,setSandboxService]=useState<ServiceStudyResults|null>(null);
 const [sandboxField,setSandboxField]=useState<"geometry"|"stress"|"displacement"|"thermal">("geometry");
 useEffect(()=>{setOrientationDraft(null);},[a.file,a.settings.unitScale,a.selected,cadLayout]);
 const [viewerReset,setViewerReset]=useState(0);
 const [showBuildDirection,setShowBuildDirection]=useState(false);
 const [partHash,setPartHash]=useState<string|null>(null);
 const [url,setUrl]=useState<string|undefined>();
 const [showOverhangs,setShowOverhangs]=useState(false);
 const [measureMode,setMeasureMode]=useState(false);
 const [rendererFailed,setRendererFailed]=useState(false);
 const [sectionView,setSectionView]=useState<SectionView|null>(null);
 useEffect(()=>{setSectionView(null);},[a.file,a.settings.unitScale]);
 const [meshPicks,setMeshPicks]=useState<MeshPick[]>([]);
 const [snapMode,setSnapMode]=useState<MeshSnapMode>("surface");
 useEffect(()=>{setMeasureMode(false);setMeshPicks([]);},[a.file,a.settings.unitScale]);
 const [showSupports,setShowSupports]=useState(false);
 const [highlightTriangles,setHighlightTriangles]=useState<number[]>([]);
 const [riskEnvelope,setRiskEnvelope]=useState({x:250,y:250,z:300});
 const [riskAngle,setRiskAngle]=useState(45);
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
 useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("stage");setStage(requested==="assessment"||requested==="context"?requested:"geometry");if(requested==="assessment"||requested==="context")setCompactPropertiesOpen(true);setLayer(100);setPlaying(false);setThread([]);},[a.file]);
 useEffect(()=>{try{const pending=sessionStorage.getItem("orientai-pending-message-v1");if(pending){setDraft(pending);setShowThread(true);setCompactPropertiesOpen(true);sessionStorage.removeItem("orientai-pending-message-v1");}}catch{}},[]);
 useEffect(()=>{const open=(e:Event)=>{const requested=(e as CustomEvent<string>).detail;if(requested==="geometry"||requested==="context"||requested==="assessment"){setStage(requested);setCompactPropertiesOpen(true);setStudyHidden(false);setViewerExpanded(false);stageScroll.current?.scrollTo({top:0,behavior:"instant"});}};window.addEventListener("orientai-open-stage",open);return()=>window.removeEventListener("orientai-open-stage",open);},[]);
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
 const hasStructuralStudy=Boolean(currentRun&&selected&&a.result?.structural?.candidateId===selected.id);
 const hasSteadyThermalStudy=Boolean(currentRun&&selected&&a.result?.thermal?.candidateId===selected.id);
 const meshFindings=inspect.data?.audit.findings??[];
 const coverage=failureCoverage({
  hasMeshAudit:Boolean(inspect.data),hasOrientationRun:currentRun,
  hasStructuralStudy:hasStructuralStudy,
  hasSteadyThermalStudy:hasSteadyThermalStudy,
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
  hasStructuralStudy:hasStructuralStudy,
  hasSteadyThermalStudy:hasSteadyThermalStudy,coverage
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
  !(ctx.knowledge?.componentName?.trim()&&ctx.knowledge?.assemblyContext?.trim())?
   {title:"Describe the part",detail:"Add the component function and its assembly role. Drawings and documents are optional for an initial screen.",action:"Add context",to:"context" as Stage}:
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
    hasNumericalServiceStudy:hasStructuralStudy||Boolean(serviceCurrent&&sandboxService?.structural),
    hasSteadyThermalStudy:hasSteadyThermalStudy||Boolean(serviceCurrent&&sandboxService?.thermal),
    hasLpbfGeometryCandidates:currentRun
   });
   const approvedBindings=activeParameterBindings(k.parameterBindings,ctx.sources,ctx.reviewed,activeServiceCase(a.servicePlan));
   const pdf=await createCopilotReviewPDF({
    projectName:a.projectName,partName:a.file.name,partSha256:partHash,process:a.journey.process,modelFile:a.file,
    unitsConfirmed:isConfirmed,createdAt:new Date().toISOString(),knowledge:k,
    reviewedEvidence:ctx.reviewed,approvedBindings,readiness,
    study:serviceCurrent&&sandboxService?{jobId:sandboxService.jobId,
     stressMPa:sandboxService.structural?.solver.maxVonMisesMPa,
     displacementMm:sandboxService.structural?.solver.maxDisplacementMm,
     temperatureMinC:sandboxService.thermal?.min,temperatureMaxC:sandboxService.thermal?.max,
     structuralModel:sandboxService.structural?.solver.model,thermalModel:sandboxService.thermal?.solver.model}:undefined,
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
 const serviceCurrent=Boolean(sandboxService&&partHash===sandboxService.partSha256&&sandboxService.unitScale===a.settings.unitScale&&sandboxService.process===a.journey.process&&isConfirmed);
 const resultField=serviceCurrent&&cadLayout&&!rendererFailed?(sandboxField==="stress"?sandboxService?.structural?.stress:sandboxField==="displacement"?sandboxService?.structural?.displacement:sandboxField==="thermal"?sandboxService?.thermal:undefined):undefined;
 const currentReviewed=ctx.knowledge?.partKey===partHash?ctx.reviewed:[];
 const currentBindings=activeParameterBindings(ctx.knowledge?.partKey===partHash?ctx.knowledge.parameterBindings:[],ctx.sources,currentReviewed,activeServiceCase(a.servicePlan));
 const canOrient=Boolean(cadLayout&&a.file&&!rendererFailed&&!resultField);
 const activeOrientation=canOrient?orientationDraft:null;
 const displayedRotation=resultField?{x:0,y:0,z:0}:activeOrientation??modelRotation;
 const canSection=Boolean(cadLayout&&a.file&&!rendererFailed&&!activeOrientation&&!resultField);
 const activeSection=canSection?sectionView:undefined;
 const canMeasure=Boolean(cadLayout&&a.file&&isConfirmed&&layer===100&&!showSupports&&!rendererFailed&&!activeSection&&!activeOrientation&&!resultField);
 useEffect(()=>{if(!canSection)setSectionView(null);},[canSection]);
 useEffect(()=>{if(!canOrient)setOrientationDraft(null);},[canOrient]);
 const activePicks=canMeasure&&measureMode?meshPicks:[];
 useEffect(()=>{if(!canMeasure){setMeasureMode(false);setMeshPicks([]);}},[canMeasure]);
 return <div ref={workbenchRef}
   className={"psRoot psFit psReferenceRoot"+(viewerExpanded?" psViewerExpanded":"")+(studyHidden?" psStudyHidden":"")+(resizing?" psResizing":"")+(cadLayout?" psCadLayout":"")+(compactPropertiesOpen?" psCompactPropertiesOpen":"")}
   style={{"--ps-viewer-width":activeViewerPercent+"%"} as CSSProperties}
   aria-label="ORIENTAI professional engineering workbench">
  {cadLayout&&<div className="psCadRibbon" role="region" aria-label="CAD analysis commands">
   <div className="psCadGroup"><button type="button" onClick={()=>partFileInput.current?.click()}><FileUp size={17}/>Import STL</button>
    <button type="button" onClick={()=>{setCameraView("iso");setViewerReset(n=>n+1);}}><Maximize2 size={17}/>Fit model</button></div>
   <div className="psCadGroup">{stageEntries.map(({id,label,Icon})=><button type="button" key={id}
    aria-pressed={stage===id&&!studyHidden} onClick={()=>{setStage(id);setCompactPropertiesOpen(true);setStudyHidden(false);setViewerExpanded(false);stageScroll.current?.scrollTo({top:0,behavior:"instant"});}}>
    <Icon size={17}/>{label}</button>)}</div>
   <div className="psCadGroup"><button type="button" disabled={!a.file} aria-pressed={serviceDockOpen} onClick={()=>{setServiceDockMounted(true);setServiceDockOpen(v=>!v);setViewerExpanded(false);setCompactPropertiesOpen(false);}}><SlidersHorizontal size={17}/>Simulate</button></div>
   <div className="psCadGroup"><button type="button" disabled={!canOrient} aria-pressed={Boolean(activeOrientation)} title="Preview arbitrary rotation without changing the selected analysis candidate" onClick={()=>{setOrientationDraft(v=>v?null:{...modelRotation});setSectionView(null);setMeasureMode(false);setMeshPicks([]);setHighlightTriangles([]);setPlaying(false);setLayer(100);setShowSupports(false);}}><RotateCcw size={17}/>Orient</button></div>
   <div className="psCadGroup"><button type="button" disabled={!canSection} aria-pressed={Boolean(activeSection)} title="Clip the displayed mesh along a build axis" onClick={()=>{setSectionView(v=>v?null:{axis:"Z",percent:50,reverse:false});setMeasureMode(false);setMeshPicks([]);setPlaying(false);setLayer(100);setShowSupports(false);}}><Layers size={17}/>Section</button></div>
   <div className="psCadGroup"><button type="button" disabled={!canMeasure} title={rendererFailed?"3D rendering is unavailable; retry 3D to measure": "Confirm units, show full geometry and turn off supports before measuring"} aria-pressed={measureMode} onClick={()=>{setMeasureMode(v=>!v);setMeshPicks([]);}}><Ruler size={17}/>Measure</button></div>
   <div className="psCadGroup"><button type="button" disabled={!a.file} aria-pressed={showOverhangs}
    onClick={()=>{setShowOverhangs(v=>!v);setShowSupports(false);}}><Layers size={17}/>Overhangs</button></div>
   <div className="psCadGroup"><button type="button" disabled={!a.file||!isConfirmed||a.busy} onClick={()=>{setStage("geometry");setCompactPropertiesOpen(true);setStudyHidden(false);a.retry();}}><Play size={17}/>{a.busy?"Screening…":"Run screening"}</button></div>
   <span className="psCadStudyName" title={projectName}>{projectName}</span>
  </div>}
  <div id="ps-engineering-study" className="psWorkingColumn">
   {cadLayout&&<div className="psCompactPropertyHeader"><strong>Study properties</strong><button type="button" aria-label="Close properties" onClick={()=>setCompactPropertiesOpen(false)}><X size={18}/></button></div>}
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
    {stage!=="geometry"&&<GuidedStudyHelp stage={stage} hasPart={Boolean(a.file)}
     unitsConfirmed={isConfirmed} geometryScreened={currentRun}
     hasContext={Boolean(ctx.knowledge?.componentName?.trim()&&ctx.knowledge?.assemblyContext?.trim())}
     hasReferences={ctx.sources.length>0} hasReviewedSources={ctx.reviewed.length>0}
     busy={a.busy} onUpload={()=>partFileInput.current?.click()}
     onConfirmUnits={()=>{setStage("geometry");window.requestAnimationFrame(()=>document.getElementById("ps-units-confirmation")?.scrollIntoView({block:"center",behavior:"smooth"}));}}
     onRunGeometry={()=>{setStage("geometry");a.retry();}}
     onStage={next=>{setStage(next);stageScroll.current?.scrollTo({top:0,behavior:"instant"});}}/>}

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
    {stage==="assessment"&&a.file&&<div className="psPanel" aria-label="Part-localized LPBF geometry screening" style={{margin:"12px 18px",padding:16}}>
     <RiskPreflight file={a.file} partHash={partHash} unitScale={a.settings.unitScale}
      confirmed={isConfirmed} rotationDeg={modelRotation}
      envelopeMm={riskEnvelope} overhangThresholdDeg={riskAngle}
      onEnvelopeChange={(axis,value)=>setRiskEnvelope(prev=>({...prev,[axis]:value}))}
      onAngleChange={setRiskAngle}
      onFocus={triangles=>{setSandboxField("geometry");setOrientationDraft(null);setHighlightTriangles(triangles);if(triangles.length){setShowSupports(false);setShowOverhangs(false);setCameraView("iso");setLayer(100);}}}/>
     {highlightTriangles.length>0&&<div role="status" style={{fontSize:12,padding:"10px 12px",borderRadius:7,marginTop:10,border:"1px solid currentColor"}}>
      Highlighting {highlightTriangles.length.toLocaleString()} source-STL triangles in the adjacent 3D viewer. This marks geometric regions requiring review, not measured defects.
      <button type="button" style={{marginLeft:12,padding:"5px 9px"}} onClick={()=>setHighlightTriangles([])}>Clear highlighted region</button>
     </div>}
    </div>}
    {stage==="assessment"&&<ProfessionalAssessmentPanel
     assessment={prebuild} coverage={coverage} flow={manufacturingFlow}
     hasPart={Boolean(a.file)} canExport={Boolean(a.file&&partHash&&isConfirmed)}
     hasGeometry={currentRun} exportBusy={exportBusy}
     feedback={feedback.records} feedbackError={feedback.error}
     onAddFeedback={feedback.add} onRemoveFeedback={feedback.remove}
     onExport={()=>void exportEvidence()} onGeometryExport={()=>void exportGeometry()}
     onJsonExport={()=>{if(currentRun&&a.result)downloadJSON(a.result,a.selected);}}
     onNavigate={nextStage=>{setStage(nextStage);stageScroll.current?.scrollTo({top:0,behavior:"instant"});}}
     onInspectOverhangs={()=>{setSandboxField("geometry");setOrientationDraft(null);setShowOverhangs(true);setShowSupports(false);setCameraView("iso");setViewerExpanded(false);}}
    />}
   </div>
   <div className={"psAssistant"+(cadLayout&&!cadAssistantOpen&&!showThread?" psCadAssistantCollapsed":"")}>
    {cadLayout&&<button type="button" className="psCadAssistantToggle" aria-expanded={cadAssistantOpen||showThread} onClick={()=>{setCadAssistantOpen(!(cadAssistantOpen||showThread));if(showThread)setShowThread(false);}}><MessageSquare size={15}/> Engineering assistant <ChevronDown size={14}/></button>}
    <div className="psAssistantContent">
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
  </div>
  {!studyHidden&&!viewerExpanded&&<div className="psPaneResizeHandle" role="separator"
   aria-label="Resize study and 3D viewer panels" aria-orientation="vertical"
   aria-valuemin={35} aria-valuemax={64} aria-valuenow={activeViewerPercent}
   aria-valuetext={"Viewer "+activeViewerPercent+" percent of workbench"} tabIndex={0}
   title="Drag to resize the panels, or use left and right arrow keys"
   onPointerDown={e=>{e.preventDefault();dragActive.current=true;setResizing(true);e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{if(dragActive.current)setWidthFromPointer(e.clientX);}}
   onPointerUp={()=>{dragActive.current=false;setResizing(false);}}
   onPointerCancel={()=>{dragActive.current=false;setResizing(false);}}
   onKeyDown={e=>{
    if(e.key==="ArrowLeft"){e.preventDefault();setActiveViewerPercent(v=>cadLayout?Math.max(35,v-2):Math.min(64,v+2));}
    if(e.key==="ArrowRight"){e.preventDefault();setActiveViewerPercent(v=>cadLayout?Math.min(64,v+2):Math.max(35,v-2));}
    if(e.key==="Home"){e.preventDefault();setActiveViewerPercent(35);}
    if(e.key==="End"){e.preventDefault();setActiveViewerPercent(64);}
   }}>
   <GripVertical size={15} aria-hidden="true"/>
  </div>}
  <aside className="psViewerColumn" aria-label="Persistent engineering model viewer">
   <div className="psReferenceViewerCard">
    <header className="psReferenceViewerHeader">
     <strong><Box size={19}/>3D Viewer <span>· {projectName}</span></strong>
     <div className="psViewerHeaderActions">
      {cadLayout&&<button type="button" className="psCompactPropertiesToggle" aria-label="Study properties" aria-expanded={compactPropertiesOpen} aria-controls="ps-engineering-study" onClick={()=>{setCompactPropertiesOpen(v=>!v);setStudyHidden(false);}}><SlidersHorizontal size={17}/> Properties</button>}
      <button type="button" className="psCadModeToggle" aria-pressed={cadLayout} aria-label="CAD workspace layout" title="Switch between model-first and guided study layouts" onClick={()=>{setCadLayout(v=>!v);setViewerExpanded(false);setStudyHidden(false);}}>CAD</button>
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
     {a.file?<ViewerErrorBoundary onRendererFailure={setRendererFailed} fallback={<StudioCanvasFallback url={url} buildFraction={layer/100}/>}>
      <ModelViewer key={viewerReset} url={url} unitScale={a.settings.unitScale} rotation={displayedRotation} fitPadding={1.10} cadStyle={cadLayout}
       cameraView={cameraView} onCameraViewChange={setCameraView}
       overhangDeg={a.settings.overhangDeg} showOverhangs={!resultField&&showOverhangs} showSupports={!resultField&&showSupports}
       field={resultField} fieldLabel={sandboxField==="stress"?"Service stress":sandboxField==="displacement"?"Displacement":sandboxField==="thermal"?"Steady temperature":undefined}
       buildFraction={resultField?1:layer/100} sectionView={activeSection??undefined} highlightTriangles={activeOrientation||resultField?undefined:highlightTriangles} meshPicks={activePicks} snapMode={snapMode} onMeshPick={canMeasure&&measureMode?pick=>setMeshPicks(points=>appendMeasurement(points,pick)):undefined}/>
     </ViewerErrorBoundary>:<div className="psViewerEmpty"><Box size={33}/><strong>No model loaded</strong><small>Upload an STL to inspect its actual geometry here.</small>{cadLayout&&<button type="button" className="psCadEmptyImport" onClick={()=>partFileInput.current?.click()}><FileUp size={16}/> Import part</button>}</div>}
     {serviceCurrent&&cadLayout&&<div className="psSandboxFields" role="group" aria-label="Sandbox service result fields">
      {(["geometry","stress","displacement","thermal"] as const).map(mode=><button key={mode} type="button" aria-pressed={sandboxField===mode} disabled={mode!=="geometry"&&(rendererFailed||(mode==="thermal"?!sandboxService?.thermal:!sandboxService?.structural))} onClick={()=>{setSandboxField(mode);setOrientationDraft(null);setSectionView(null);setMeasureMode(false);setMeshPicks([]);setPlaying(false);setLayer(100);}}>{mode==="geometry"?"Geometry":mode==="stress"?"Stress":mode==="displacement"?"Displacement":"Steady temperature"}</button>)}
      {resultField&&<small>Original part axes · research service result, not print-process prediction</small>}
     </div>}
     {activeOrientation&&<section className="psMeshMeasure" aria-label="Orientation preview">
      <header><strong>Build orientation preview</strong><button type="button" aria-label="Close orientation preview" onClick={()=>setOrientationDraft(null)}><X size={15}/></button></header>
      {(["x","y","z"] as const).map(axis=><label key={axis}>{axis.toUpperCase()} rotation <output>{activeOrientation[axis]}°</output><input type="range" aria-label={axis.toUpperCase()+" rotation preview"} min={-360} max={360} step={1} value={activeOrientation[axis]} onChange={e=>setOrientationDraft(v=>v?{...v,[axis]:Number(e.target.value)}:null)}/></label>)}
      <button type="button" onClick={()=>setOrientationDraft({x:0,y:0,z:0})}>Original axes</button> <button type="button" onClick={()=>setOrientationDraft({...modelRotation})}>Restore selected orientation</button>
      <small>Temporary XYZ Euler rotation preview. Does not change the selected analysis candidate, run a solver, or alter report evidence. Close to return to the study orientation.</small>
     </section>}
     {activeSection&&<section className="psMeshMeasure" aria-label="Section view">
      <header><strong>Section view</strong><button type="button" aria-label="Close section view" onClick={()=>setSectionView(null)}><X size={15}/></button></header>
      <label>Build axis <select aria-label="Section build axis" value={activeSection.axis} onChange={e=>setSectionView(v=>v?{...v,axis:e.target.value as SectionView["axis"]}:null)}><option value="X">X</option><option value="Y">Y</option><option value="Z">Z (build direction)</option></select></label>
      <label>Plane position <output>{activeSection.percent}%</output><input type="range" aria-label="Section plane position" min={0} max={100} value={activeSection.percent} onChange={e=>setSectionView(v=>v?{...v,percent:Number(e.target.value)}:null)}/></label>
      <label><input type="checkbox" checked={activeSection.reverse} onChange={e=>setSectionView(v=>v?{...v,reverse:e.target.checked}:null)}/> Reverse retained side</label>
      <button type="button" onClick={()=>setSectionView(v=>v?{...v,percent:50}:null)}>Center plane</button>
      <small>Visual clipping only, relative to oriented mesh bounds. No section cap, physical slice, contour area or print-process simulation is calculated.</small>
     </section>}
     {cadLayout&&measureMode&&canMeasure&&<section className="psMeshMeasure" aria-label="Mesh measurement">
      <header><strong>Measure mesh</strong><button type="button" aria-label="Close measurement" onClick={()=>{setMeasureMode(false);setMeshPicks([]);}}><X size={15}/></button></header>
      <label>Pick mode <select aria-label="Measurement snap mode" value={snapMode} onChange={e=>{setSnapMode(e.target.value as MeshSnapMode);setMeshPicks([]);}}><option value="surface">Surface point</option><option value="vertex">Nearest mesh vertex</option><option value="edge">Nearest mesh edge</option></select></label>
      <p>{activePicks.length===0?"Click a point on the STL surface.":activePicks.length===1?"Click a second surface point.":"Click again to start a new measurement."}</p>
      {activePicks.map((pick,i)=><div key={i}><b>Point {i+1} · Triangle {pick.triangle}</b><div>X {pick.point.x.toFixed(3)} · Y {pick.point.y.toFixed(3)} · Z {pick.point.z.toFixed(3)} mm</div><div>Triangle area {pick.areaMm2.toFixed(3)} mm²</div>{pick.mode&&pick.mode!=="surface"&&<div>Snap correction {(pick.snapDistanceMm??0).toFixed(3)} mm</div>}</div>)}
      {activePicks.length===2&&<output aria-label="Point distance">Distance: {distanceMm(activePicks[0].point,activePicks[1].point).toFixed(3)} mm</output>}
      <button type="button" onClick={()=>setMeshPicks([])} disabled={!activePicks.length}>Clear points</button>
      <small>Original STL coordinates. Vertex/edge modes snap to the clicked triangle, including triangulation diagonals; not inferred CAD features or certified metrology.</small>
     </section>}
     {cadLayout&&<div className="psCadViewCube" role="group" aria-label="Model view cube">
      <button type="button" className="psCubeTop" aria-label="Cube top view" aria-pressed={cameraView==="top"} onClick={()=>setCameraView("top")}>TOP</button>
      <button type="button" className="psCubeFront" aria-label="Cube front view" aria-pressed={cameraView==="front"} onClick={()=>setCameraView("front")}>FRONT</button>
      <button type="button" className="psCubeSide" aria-label="Cube side view" aria-pressed={cameraView==="side"} onClick={()=>setCameraView("side")}>SIDE</button>
      <button type="button" className="psCubeIso" aria-label="Cube isometric view" aria-pressed={cameraView==="iso"} onClick={()=>setCameraView("iso")}><Box size={13}/> ISO</button>
     </div>}
     <div className="psBuildAxis" aria-hidden="true"><b>+Z</b><span className="psAxisX">X</span><span className="psAxisY">Y</span></div>
     {showBuildDirection&&<div className="psBuildDirectionLabel" role="status">Build axis ↑ · visualization</div>}
     {!activeOrientation&&!resultField&&highlightTriangles.length>0&&<div role="status" style={{position:"absolute",left:12,bottom:12,padding:"6px 10px",fontSize:12,borderRadius:6,background:"#152c3b",color:"#ecf6ff",pointerEvents:"none"}}>
      {highlightTriangles.length.toLocaleString()} geometric-risk triangles highlighted
     </div>}
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
      onChange={e=>{const v=e.target.value;setShowOverhangs(v==="overhangs");setShowSupports(v==="supports");if(v==="supports"){setOrientationDraft(null);setSectionView(null);}}}>
      <option value="solid">Solid</option><option value="overhangs">Overhangs</option><option value="supports">Supports</option>
     </select>
    </div>
    <div className="psViewerStatusLine" role="status">
     <span><span className="psStatusDot"/> {a.file?"STL geometry":"No part loaded"}</span>
     <span>{resultField?"Service result · original part axes":activeOrientation?"Orientation preview · results unchanged":a.file?(isConfirmed?"Units confirmed":"Units unconfirmed"):"Awaiting file"}</span>
    </div>
    <details className="psReferenceViewSettings psEngineeringInspector">
     <summary><SlidersHorizontal size={15}/> Display & build settings <ChevronDown size={15}/></summary>
     <div className="psEngineeringInspectorBody">
      <div className="psOrientationControl">
       <label htmlFor="ps-yaw-select">Visual Z rotation <Info size={14}/></label>
       <select id="ps-yaw-select" aria-label="Build orientation angle" disabled={!a.file}
        value={previewYaw} onChange={e=>{setOrientationDraft(null);setPreviewYaw(Number(e.target.value));}}>
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
        onChange={e=>{setOrientationDraft(null);setSectionView(null);setPlaying(false);setLayer(Number(e.target.value));}}/>
       <div className="psPlayback">
        <button type="button" onClick={()=>{setOrientationDraft(null);setSectionView(null);if(layer>=100)setLayer(1);setPlaying(p=>!p);}}>{playing?<Pause size={14}/>:<Play size={14}/>} {playing?"Pause build":"Play build"}</button>
        <button type="button" onClick={()=>{setOrientationDraft(null);setSectionView(null);setPlaying(false);setLayer(1);}}><RotateCcw size={14}/> Restart</button>
       </div>
      </details>
      <small className="psViewerMethodNote">Geometry-only visualization. Supports and build progression are conceptual, not process simulations.</small>
     </div>
    </details>
   </div>
  </aside>
  {serviceDockMounted&&<aside className="psServiceDock cadAdvancedWorkspace" aria-label="Sandbox simulation setup" hidden={!serviceDockOpen||!cadLayout}>
   <header className="psServiceDockHeader"><strong>Service simulation</strong><button type="button" aria-label="Close simulation setup" onClick={()=>setServiceDockOpen(false)}><X size={17}/></button></header>
   <div className="psServiceDockScroll copilotMainPanel"><p className="psServiceScope">Shared solver and job ledger. Results use original STL axes; export the study job record here. Current service numerical summaries and job ID are included in the evidence PDF; full contour arrays are not. Export the job record for approved inputs and execution history.</p>
    <UnifiedServiceStudy verified={isConfirmed&&ctx.knowledge?.partKey===partHash} partSha256={partHash??undefined} sourceIds={[...new Set(currentReviewed.map(x=>x.sourceId))]} reviewedEvidence={currentReviewed} parameterBindings={currentBindings} onResults={next=>{setSandboxService(next);if(!next)setSandboxField("geometry");}} onOpenResults={()=>{setSandboxField("stress");setServiceDockOpen(false);setOrientationDraft(null);setSectionView(null);setMeasureMode(false);setMeshPicks([]);setPlaying(false);setLayer(100);}}/>
   </div>
  </aside>}
  {cadLayout&&<nav className="psCadDocumentTabs" aria-label="Study document tabs">
   {stageEntries.map(({id,label,Icon})=><button type="button" key={id} aria-current={stage===id?"page":undefined}
    onClick={()=>{setStage(id);setCompactPropertiesOpen(true);setStudyHidden(false);setViewerExpanded(false);}}>
    <Icon size={14}/>{label}</button>)}
   <Link href="/copilot/advanced"><SlidersHorizontal size={14}/>Advanced studies</Link>
   <Link href="/validation"><ShieldCheck size={14}/>Validation</Link>
   <Link href="/how-it-works"><Info size={14}/>Technical guide</Link>
  </nav>}
  <input ref={partFileInput} type="file" accept=".stl" className="psHiddenInput" aria-label="Select STL part" onChange={e=>attach(e.target.files?.[0])}/>
 </div>;
}
