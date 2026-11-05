"use client";
import {useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {useAnalysis} from "@/components/AnalysisProvider";
import {usePartInspection} from "@/components/PartInspection";
import {completedPart} from "@/lib/engineering-journey";
import {screenCandidate} from "@/lib/part-screening";
import {failureCoverage,coverageSummary} from "@/lib/failure-coverage";
import ChatServiceStudy from "@/components/v2/ChatServiceStudy";
import ChatLpbfStudy from "@/components/v2/ChatLpbfStudy";
import PhysicalSliceWorkspace,{type SlicePreview} from "@/components/v2/PhysicalSliceWorkspace";
import MetalSlicedSidePanel from "@/components/v2/MetalSlicedSidePanel";
import RiskPreflight from "@/components/v2/RiskPreflight";
import ProcessQualityReview,{type QualitySnapshot} from "@/components/v2/ProcessQualityReview";
import EngineeringAssessmentJourney,{type AssessmentStage} from "@/components/v2/EngineeringAssessmentJourney";
import EngineeringContextStage from "@/components/v2/EngineeringContextStage";
import EngineeringAssessmentResults from "@/components/v2/EngineeringAssessmentResults";
import {usePartKnowledge} from "@/components/v2/usePartKnowledge";
import {localCopilotReply} from "@/lib/copilot-context";
import {assessEngineeringReadiness} from "@/lib/engineering-readiness";
import {createCopilotReviewPDF} from "@/lib/copilot-review-pdf";
import {activeParameterBindings} from "@/lib/engineering-parameter-binding";
import {activeServiceCase} from "@/lib/service-plan";
import type {LpbfPreflight} from "@/lib/lpbf-risk-preflight";
import {reviewPhysicalLayerIslands} from "@/lib/lpbf-layer-island-review";
import {reviewUnitsFromFilename} from "@/lib/stl-unit-review";
import type {LpbfResult} from "@/lib/lpbf-transient";
import type {ServiceStudyResults} from "@/components/UnifiedServiceStudy";
import {ArrowUp,Box as BoxIcon,CheckCircle2,ChevronDown,ChevronUp,FileUp,Paperclip,Play,RotateCcw,ShieldAlert,SlidersHorizontal,SquareArrowOutUpRight,X,LoaderCircle,AlertTriangle,FileText} from "lucide-react";
import ViewerErrorBoundary from "@/components/ViewerErrorBoundary";
import STLCanvasFallback from "@/components/STLCanvasFallback";
import "./engineering-workbench.css";
import "./chat-study.css";
const ModelViewer=dynamic(()=>import("@/components/ModelViewer"),{ssr:false});
type Message={id:string;role:"user"|"assistant";text:string;createdAt:string;source:"engineer"|"local"|"run"|"service"|"model"|"external-error";runId?:string};
const keyPrefix="orientai-chat-study-v2-";
const emptyMessages:Message[]=[];
function makeMessage(role:Message["role"],text:string,source:Message["source"],runId?:string):Message{
 return {id:crypto.randomUUID(),role,text:text.slice(0,4000),source,createdAt:new Date().toISOString(),runId};
}
function restore(value:string|null):Message[]{
 try{
  const items=JSON.parse(value??"[]");
  if(!Array.isArray(items))return [];
  return items.filter(v=>v&&typeof v.id==="string"&&typeof v.text==="string"&&
   (v.role==="user"||v.role==="assistant")&&["engineer","local","run","service","model","external-error"].includes(v.source))
   .slice(-70).map(v=>({...v,text:v.text.slice(0,4000)}));
 }catch{return [];}
}
export default function ChatStudy(){
 const a=useAnalysis();
 const inspect=usePartInspection(a.file,a.settings.unitScale);
 const [fingerprint,setFingerprint]=useState<{file:File|null;hash:string}|null>(null);
 const partHash=fingerprint?.file===a.file?fingerprint.hash:null;
 const context=usePartKnowledge(partHash);
 const [activeStage,setActiveStage]=useState<AssessmentStage>("part");
 const [reportBusy,setReportBusy]=useState(false);
 const [reportError,setReportError]=useState("");
 useEffect(()=>setActiveStage("part"),[a.file]);
 const [historyKey,setHistoryKey]=useState<string|null>(null);
 const [messages,setMessages]=useState<Message[]>(emptyMessages);
 const [draft,setDraft]=useState("");
 const [aiAvailable,setAiAvailable]=useState(false);
 const [allowAi,setAllowAi]=useState(false);
 const [aiBusy,setAiBusy]=useState(false);
 const aiRequest=useRef<AbortController|null>(null);
 const aiEpoch=useRef(0);
 useEffect(()=>{
  let alive=true;
  fetch("/api/engineering-copilot",{cache:"no-store"})
   .then(r=>r.json()).then(v=>{if(alive)setAiAvailable(v?.enabled===true);})
   .catch(()=>{if(alive)setAiAvailable(false);});
  return()=>{alive=false;};
 },[]);
 // A changed part or units invalidates permission to share part-specific context.
 useEffect(()=>{
  aiEpoch.current++;
  aiRequest.current?.abort();
  aiRequest.current=null;
  setAiBusy(false);
  setAllowAi(false);
 },[a.file,a.settings.unitScale]);
 useEffect(()=>()=>{aiEpoch.current++;aiRequest.current?.abort();},[]);
 useEffect(()=>{setPhysicalPreview(null);setSideMode("model");},[a.file,a.settings.unitScale]);
 const [attachError,setAttachError]=useState("");
 const [showArtifact,setShowArtifact]=useState(false);
 const [sideMode,setSideMode]=useState<"model"|"sliced">("model");
 const [physicalPreview,setPhysicalPreview]=useState<SlicePreview|null>(null);
 const [preflight,setPreflight]=useState<LpbfPreflight|null>(null);
 const [processQuality,setProcessQuality]=useState<QualitySnapshot|null>(null);
 const [riskFocus,setRiskFocus]=useState<number[]>([]);
 const [panelWidth,setPanelWidth]=useState(40);
 const [resizingPanel,setResizingPanel]=useState(false);
 const [showOverhangs,setShowOverhangs]=useState(false);
 const [showSupports,setShowSupports]=useState(false);
 const [layer,setLayer]=useState(100);
 const [playing,setPlaying]=useState(false);
 const [showMethods,setShowMethods]=useState(false);
 const [showService,setShowService]=useState(false);
 const [showLpbf,setShowLpbf]=useState(false);
 const [lpbfSession,setLpbfSession]=useState<{hash:string;scale:number;result:LpbfResult}|null>(null);
 const [lpbfFrameIndex,setLpbfFrameIndex]=useState(0);
 const [playingThermal,setPlayingThermal]=useState(false);
 const [serviceStudy,setServiceStudy]=useState<ServiceStudyResults|null>(null);
 const [resultField,setResultField]=useState<"geometry"|"stress"|"displacement"|"thermal"|"lpbf">("geometry");
 useEffect(()=>{
  if(!playing)return;
  const tick=setInterval(()=>setLayer(v=>Math.min(100,v+1)),80);
  return()=>clearInterval(tick);
 },[playing]);
 useEffect(()=>{if(layer>=100&&playing)setPlaying(false);},[layer,playing]);
 const [url,setUrl]=useState<string|undefined>(undefined);
 const fileInput=useRef<HTMLInputElement>(null);
 const messageAnchor=useRef<HTMLDivElement>(null);
 const previousMessageId=useRef<string|null>(null);
 const pendingRun=useRef<string|null>(null);
 const layoutRef=useRef<HTMLDivElement>(null);
 const previouslyLoadedFile=useRef<File|null>(null);
 const sideToggleRef=useRef<HTMLButtonElement>(null);
 const sideCloseRef=useRef<HTMLButtonElement>(null);
 const closeSideView=()=>{
  setShowArtifact(false);
  setResizingPanel(false);
  sideToggleRef.current?.focus({preventScroll:true});
 };
 // Auto-open on upload and when the existing persisted part is restored.
 // Manual collapse remains respected for the same File object.
 useEffect(()=>{
  if(previouslyLoadedFile.current===a.file)return;
  previouslyLoadedFile.current=a.file;
  setShowArtifact(Boolean(a.file));
 },[a.file]);
 useEffect(()=>{
  if(!showArtifact)return;
  const onEscape=(e:KeyboardEvent)=>{
   if(e.key==="Escape"&&!e.defaultPrevented){
    e.preventDefault();
    setShowArtifact(false);
    setResizingPanel(false);
    sideToggleRef.current?.focus({preventScroll:true});
   }
  };
  window.addEventListener("keydown",onEscape);
  if(window.matchMedia("(max-width: 850px)").matches)sideCloseRef.current?.focus({preventScroll:true});
  return()=>window.removeEventListener("keydown",onEscape);
 },[showArtifact]);
 const setWidthFromPointer=(clientX:number)=>{
  const bounds=layoutRef.current?.getBoundingClientRect();
  if(!bounds||bounds.width<=0)return;
  setPanelWidth(Math.max(32,Math.min(64,Math.round(100*(bounds.right-clientX)/bounds.width))));
 };
 const isConfirmed=completedPart(a.journey,a.file,a.settings.unitScale);
 const activeSlicePreview=physicalPreview&&physicalPreview.partHash===partHash&&isConfirmed?physicalPreview:null;
 const sliceData=activeSlicePreview?.slices;
 const sliceIslandReview=useMemo(()=>sliceData?reviewPhysicalLayerIslands(sliceData):null,[sliceData]);
 const canScreen=Boolean(a.file&&isConfirmed&&a.journey.process==="PBF_LB_METAL");
 const currentRun=Boolean(a.result&&partHash&&a.result.source.fileHashSha256===partHash&&
   a.result.configuration.unitScale===a.settings.unitScale);
 const selected=useMemo(()=>currentRun?a.result?.candidates.find(v=>v.id===a.selected)??a.result?.candidates[0]:undefined,[a.result,a.selected,currentRun]);
 const findings=useMemo(()=>selected&&a.result?screenCandidate(selected,a.result.candidates):[],[selected,a.result]);
 const meshFindings=inspect.data?.audit.findings??[];
 const unitWarning=a.file&&inspect.data?reviewUnitsFromFilename(a.file.name,inspect.data.dimensions,a.settings.unitScale):null;
 const serviceCurrent=Boolean(serviceStudy&&a.file&&partHash&&partHash===serviceStudy.partSha256&&
  serviceStudy.unitScale===a.settings.unitScale&&serviceStudy.process===a.journey.process&&isConfirmed);
 const lpbfValid=Boolean(lpbfSession&&partHash&&lpbfSession.hash===partHash&&lpbfSession.scale===a.settings.unitScale&&
  a.journey.process==="PBF_LB_METAL"&&isConfirmed);
 const lpbfResult=lpbfValid?lpbfSession?.result:null;
 const lpbfFrame=lpbfResult?.frames[Math.min(lpbfFrameIndex,lpbfResult.frames.length-1)];
 useEffect(()=>{
  if(!playingThermal||!lpbfResult)return;
  const id=setInterval(()=>setLpbfFrameIndex(i=>Math.min(i+1,lpbfResult.frames.length-1)),600);
  return()=>clearInterval(id);
 },[playingThermal,lpbfResult]);
 useEffect(()=>{
  if(playingThermal&&lpbfResult&&lpbfFrameIndex>=lpbfResult.frames.length-1)setPlayingThermal(false);
 },[playingThermal,lpbfFrameIndex,lpbfResult]);
 const serviceField=lpbfFrame&&resultField==="lpbf"?lpbfFrame.field:
  serviceCurrent&&resultField==="stress"?serviceStudy?.structural?.stress:
  serviceCurrent&&resultField==="displacement"?serviceStudy?.structural?.displacement:
  serviceCurrent&&resultField==="thermal"?serviceStudy?.thermal:undefined;
 const coverage=failureCoverage({hasMeshAudit:Boolean(inspect.data),hasOrientationRun:currentRun,
  hasStructuralStudy:serviceCurrent&&Boolean(serviceStudy?.structural),
  hasSteadyThermalStudy:serviceCurrent&&Boolean(serviceStudy?.thermal),
  hasLpbfTransient:Boolean(lpbfResult),lpbfMethod:lpbfResult?.engine.includes("imported")?"imported":lpbfResult?.engine.includes("raster")?"moving":"uniform",process:a.journey.process});
 const coverageCounts=coverageSummary(coverage);
 const preflightCurrent=preflight?.sourceSha256===partHash&&preflight.unitScaleToMm===a.settings.unitScale&&
  preflight.rotationDeg.x===(selected?.rotation.x??0)&&preflight.rotationDeg.y===(selected?.rotation.y??0)&&
  preflight.rotationDeg.z===(selected?.rotation.z??0)?preflight:null;
 const processQualityCurrent=processQuality?.partHash===partHash&&
  processQuality.unitScale===a.settings.unitScale?processQuality:null;
 const append=(message:Message)=>setMessages(old=>[...old,message].slice(-70));

 const preflightNotice=useRef<string|null>(null);
 useEffect(()=>{
  if(!preflightCurrent||!partHash||historyKey!==keyPrefix+partHash)return;
  const flagged=preflightCurrent.findings.filter(f=>f.severity!=="unassessed");
  if(!flagged.length)return;
  const identity="preflight:"+partHash+":"+a.settings.unitScale+":"+
   Object.values(preflightCurrent.rotationDeg).join(",")+":"+
   Object.values(preflightCurrent.assumedEnvelopeMm).join(",")+":"+
   preflightCurrent.overhangThresholdDeg;
  if(preflightNotice.current===identity||messages.some(m=>m.runId===identity))return;
  preflightNotice.current=identity;
  const blockers=flagged.filter(f=>f.severity==="blocker");
  const review=flagged.filter(f=>f.severity==="attention");
  append(makeMessage("assistant","Automatic STL geometry review identified "+
   blockers.length+" geometric blockers and "+review.length+" review items: "+
   flagged.slice(0,3).map(f=>f.title).join("; ")+
   (flagged.length>3?"; and additional findings.":".")+
   " These are source-derived screening observations, not simulated metal-print defects or a failure probability. Review the evidence, selected 3D faces and recommended engineering actions in the Automatic part risk preflight panel.",
   "run",identity));
 },[preflightCurrent,partHash,historyKey,messages]);

 const processQualityNotice=useRef<string|null>(null);
 useEffect(()=>{
  if(!processQualityCurrent?.assessment.reviewedReference||!partHash||historyKey!==keyPrefix+partHash)return;
  const blockers=processQualityCurrent.assessment.findings.filter(f=>f.severity==="blocker");
  if(!blockers.length)return;
  const source=JSON.stringify({input:processQualityCurrent.input,partHash});
  let digest=2166136261;
  for(let i=0;i<source.length;i++){digest^=source.charCodeAt(i);digest=Math.imul(digest,16777619);}
  const identity="process-quality:"+partHash+":"+(digest>>>0).toString(16);
  if(processQualityNotice.current===identity||messages.some(m=>m.runId===identity))return;
  processQualityNotice.current=identity;
  append(makeMessage("assistant","The reviewed LPBF parameter settings triggered "+blockers.length+
   " deterministic process-window blocker(s): "+blockers.slice(0,3).map(f=>f.title).join("; ")+
   ". Stop process approval until the machine/material-specific limits and planned settings are reconciled. "+
   "These are configuration violations against engineer-entered bounds, not simulations of porosity, cracking or a print-failure probability. Review the Process quality preflight evidence.",
   "run",identity));
 },[processQualityCurrent,partHash,historyKey,messages]);

 const islandNotice=useRef<string|null>(null);
 useEffect(()=>{
  if(!sliceIslandReview||!sliceData||!partHash||historyKey!==keyPrefix+partHash)return;
  const candidates=sliceIslandReview.candidateCount;
  const resolutionConcern=sliceData.geometry.relativeVolumeDifference>0.08;
  if(!candidates&&!resolutionConcern)return;
  const identity="physical-layer-review:"+partHash+":"+sliceData.grid.xyPitchMm+":"+sliceData.grid.layerThicknessMm+":"+
   Object.values(sliceData.geometry.rotationDeg).join(",")+":"+Object.values(sliceData.geometry.translationMm).join(",");
  if(islandNotice.current===identity||messages.some(m=>m.runId===identity))return;
  islandNotice.current=identity;
  const lead=candidates?candidates+" candidate physical-layer islands found without raster-cell overlap in the preceding sampled layer. ":"";
  const accuracy=resolutionConcern?"Sampled volume differs by more than 8% from the STL enclosed-volume estimate; refine raster resolution and re-run. ":"";
  append(makeMessage("assistant","Physical STL layer review: "+lead+accuracy+
   "Inspect the flagged layers and actual support connectivity in the slicing panel. These are resolution-dependent geometric observations, not predicted print defects or recoater events.","run",identity));
 },[sliceIslandReview,sliceData,partHash,historyKey,messages]);

 useEffect(()=>{
  if(!a.file){setFingerprint({file:null,hash:"no-part"});return;}
  let active=true;
  a.file.arrayBuffer().then(x=>crypto.subtle.digest("SHA-256",x)).then(d=>{
   if(active)setFingerprint({file:a.file,hash:Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,"0")).join("")});
  }).catch(()=>{if(active)setFingerprint(null)});
  return()=>{active=false};
 },[a.file]);
 useEffect(()=>{
  if(!partHash||!a.ready)return;
  const key=keyPrefix+partHash;
  const existing=restore(localStorage.getItem(key));
  const prompt=sessionStorage.getItem("orientai-pending-message-v1");
  if(prompt!==null)sessionStorage.removeItem("orientai-pending-message-v1");
  if(prompt?.trim()){
   const user=makeMessage("user",prompt.trim(),"engineer");
   const answer=makeMessage("assistant",a.file?
    "The STL is attached below. I am inspecting the real geometry locally. Please verify its units before running orientation screening. Actual thermal build-history, residual-stress and defect-probability solvers are not available yet.":
    "I can help organize an engineering study. Upload an STL for mesh inspection, geometric screening and orientation comparisons. Process-physics predictions will be identified as unavailable until validated models are connected.","local");
   setMessages([...existing,user,answer].slice(-70));
  }else setMessages(existing);
  setHistoryKey(key);
  pendingRun.current=null;
  setServiceStudy(null);setResultField("geometry");setShowService(false);
  setLpbfSession(null);setShowLpbf(false);setLpbfFrameIndex(0);setPlayingThermal(false);
 },[partHash,a.ready]);
 useEffect(()=>{if(historyKey&&historyKey===keyPrefix+partHash){
  try{localStorage.setItem(historyKey,JSON.stringify(messages.slice(-70)))}catch{}
 }},[historyKey,partHash,messages]);
 // Only bring new chat messages into view; never jump to the analysis footer on load or solver updates.
 useEffect(()=>{
  const id=messages[messages.length-1]?.id??null;
  if(previousMessageId.current&&id&&id!==previousMessageId.current){
   messageAnchor.current?.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  previousMessageId.current=id;
 },[messages]);
 useEffect(()=>{
  if(!a.file){setUrl(undefined);return;}
  const object=URL.createObjectURL(a.file);
  setUrl(object);
  return()=>URL.revokeObjectURL(object);
 },[a.file]);
 useEffect(()=>{
  if(!currentRun||!a.result||!partHash||pendingRun.current===a.result.runId||historyKey!==keyPrefix+partHash)return;
  if(messages.some(m=>m.source==="run"&&m.runId===a.result?.runId)){pendingRun.current=a.result.runId;return;}
  pendingRun.current=a.result.runId;
  const best=a.result.candidates.find(c=>c.feasible);
  append(makeMessage("assistant",
    "Geometric orientation screening completed. Evaluated "+a.result.candidates.length+
    " orientations from the actual uploaded mesh. "+(best?
    "A geometrically feasible candidate was found. Inspect its down-facing surfaces, contact and support proxies below.":
    "No geometrically feasible orientation was found under the current configured constraints.")+
    " This is not a layer-by-layer thermal simulation or a validated probability of print success.","run",a.result.runId));
 },[currentRun,a.result,partHash,historyKey,messages]);
 useEffect(()=>{
  if(!serviceCurrent||!serviceStudy?.thermal||!serviceStudy.structural||!partHash||historyKey!==keyPrefix+partHash)return;
  if(messages.some(m=>m.source==="service"&&m.runId===serviceStudy.jobId))return;
  append(makeMessage("assistant",
   "Engineer-approved service study completed on the uploaded STL. The linear-elastic model calculated maximum von Mises stress "+
   serviceStudy.structural.solver.maxVonMisesMPa.toPrecision(5)+" MPa and displacement "+
   serviceStudy.structural.solver.maxDisplacementMm.toPrecision(5)+" mm. The separate steady-conduction model calculated "+
   serviceStudy.thermal.min.toPrecision(5)+" to "+serviceStudy.thermal.max.toPrecision(5)+
   " °C. These results use idealized service boundary conditions and do NOT simulate the printing process, residual stress, porosity or certification.",
   "service",serviceStudy.jobId));
 },[serviceCurrent,serviceStudy,partHash,historyKey,messages]);
 const submit=()=>{
  const question=draft.trim();
  if(!question||historyKey!==keyPrefix+partHash)return;
  append(makeMessage("user",question,"engineer"));
  if(aiAvailable&&allowAi){
   const epoch=++aiEpoch.current;
   aiRequest.current?.abort();
   const controller=new AbortController();
   aiRequest.current=controller;
   setAiBusy(true);setDraft("");
   const mesh=inspect.data;
   // No raw STL/document bytes or unreviewed source text are transmitted.
   const reviewedSources=context.reviewed.slice(0,12).map(e=>({
    id:e.sourceId,name:e.sourceName,
    text:"["+e.sourceId+" "+e.locator+"] "+e.excerpt,
    notes:"Engineer relevance rationale (not numerical approval): "+e.reviewerNote
   }));
   const localContext=[
    "Client-reported mesh measurements (not independently verified by the LLM):",
    mesh?"Dimensions in mm: "+Object.values(mesh.dimensions).map(v=>Number(v).toPrecision(5)).join(" x "):"Dimensions unavailable",
    mesh?"Triangle count: "+mesh.audit.triangles+", open edges: "+mesh.audit.openEdges+", non-manifold edges: "+mesh.audit.nonManifoldEdges:"Mesh audit unavailable",
    "Units confirmed by engineer: "+(isConfirmed?"yes":"no"),
    "Source part SHA-256: "+(partHash??"unavailable"),
    "Geometry screening: "+(currentRun?"completed locally":"not completed"),
     "Automatic LPBF geometry preflight: "+(preflightCurrent?
      preflightCurrent.findings.filter(f=>f.severity!=="unassessed").map(f=>f.code+": "+f.observation).join(" | "):
      "not yet completed for confirmed orientation"),
    "Melt-pool behavior, porosity, crack probability and aerospace qualification: NOT ASSESSED"
   ].join("\n");
   void (async()=>{
    try{
     const response=await fetch("/api/engineering-copilot",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({allowExternal:true,message:question,
       project:{name:a.projectName,partName:a.file?.name??"",confirmed:isConfirmed,
        process:a.journey.process,componentName:context.knowledge?.componentName||a.projectName,
        assemblyContext:context.knowledge?.assemblyContext||"",
        attachmentNotes:context.knowledge?.attachmentNotes||"",
        requirements:(context.knowledge?.reviewedRequirements||"")+"\\n\\n"+localContext,hasOrientation:currentRun},
       sources:reviewedSources,history:messages.slice(-10).map(m=>({role:m.role,text:m.text}))}),
      signal:controller.signal
     });
     const data=await response.json();
     if(epoch!==aiEpoch.current)return;
     if(!response.ok||typeof data.text!=="string")throw Error(typeof data.error==="string"?data.error:"The model did not return an answer.");
     append(makeMessage("assistant",data.text+"\n\nAI response only · No engineering solver was run by the language model.","model"));
    }catch(e){
     if(epoch!==aiEpoch.current||controller.signal.aborted)return;
     append(makeMessage("assistant","AI request failed: "+(e instanceof Error?e.message:"Model unavailable")+
      "\nThe local guide and separately approved simulation tools remain available.","external-error"));
    }finally{
     if(epoch===aiEpoch.current){setAiBusy(false);aiRequest.current=null;}
    }
   })();
   return;
  }
  const lower=question.toLowerCase();
  let response:string;
  if(/\b(assembly|documents?|references?|requirements?|interfaces?|load(?:s|ing)?|mount(?:s|ing)?|fixture|part.function)\b/.test(lower)&&context.knowledge){
   const local=localCopilotReply(context.knowledge,question,{
    partName:a.file?.name??null,confirmed:isConfirmed,hasOrientation:currentRun,
    loadsReviewed:context.reviewed.some(e=>e.category==="load"),process:a.journey.process
   });
   response=local.text+"\n\nOpen Engineering context to review the source passages and confirm their applicability.";
   setActiveStage("context");
  }else if(/\b(measur(?:e|ed|ement|ements)|thermograph(?:y|ic)|benchmark|validat(?:e|ion)|temperature trace|experiment(?:al)? data)\b/.test(lower)){
    response=a.file?
     "To compare a measured thermal trace, first run an approved LPBF thermal study below, then open the Measured thermal trace panel. Upload time_s,temperature_c,uncertainty_c,x_mm,y_mm,z_mm CSV data, identify the source and confirm position/time alignment. ORIENTAI reports exploratory temperature differences only; it cannot yet validate NIST AM Bench time-above-melt or cooling-rate observables, and no print-defect probability is available.":
     "Upload an STL and confirm units first. Benchmark comparisons also need an approved thermal research run, source-identified measurements, registered coordinates and the same time origin.";
    setShowLpbf(true);
   }else if(/\b(lpbf|laser|scan.path|transient|print.thermal|thermal.history)\b/.test(lower)){
    response=a.file?"Open the LPBF research thermal panel below. Review material, machine and solid-state assumptions, then approve the thermal worker. It computes coarse heat diffusion, not melt-pool physics or defect probability.":"Upload an STL, verify units and choose LPBF to start.";
    setShowLpbf(true);
   }else if(/\b(service|fea|finite.element|structural|stress|displacement|steady.conduction|thermal study)\b/.test(lower)){
    response=a.file?"Open the Engineer-approved numerical studies card below. Confirm actual service loads, fixtures, elastic material properties and thermal boundary conditions before running the real workers. Stress and steady temperature are not print-induced defects.":"Upload the part, then review engineering boundary conditions in the service study card.";
    setShowService(true);
   }else if(/\b(risks?|issues?|failures?|defects?|overhang|support|build.?plate|manufacturab)/.test(lower)){
    response=a.file?"Review the Automatic part risk preflight above for source-derived geometry issues, highlighted triangle regions, and actions. Confirm units first. This geometric evidence cannot predict cracking, porosity, recoater strikes or print quality; those require machine/process data and validated models.":"Upload an STL first. I will flag topology and elevated down-facing geometry after units are confirmed.";
   }else if(/run|simulat|predict|screen|analy[sz]|failure|risk|print/.test(lower)){
   response=!a.file?"Upload an STL to start local mesh inspection. I cannot simulate a part that has not been provided.":
   !isConfirmed?"First confirm the STL units and actual dimensions below. This prevents invalid physical scaling.":
   a.journey.process!=="PBF_LB_METAL"?"The uploaded arbitrary-part DED process simulation is not implemented; choose LPBF for supported geometric screening, or open the DED teaching example.":
   "The available analysis is geometric LPBF orientation screening. Select “Run geometry screening” below. I will show real worker progress, candidate geometry findings and unassessed physical failure modes. It will not estimate porosity or thermal distortion.";
  }else if(/unit|dimension|size/.test(lower)){
   response="STL stores coordinates but not physical units. Use the units selector and verify the reported dimensions against the engineering drawing. Changing the units invalidates current geometry-dependent results.";
  }else if(/stress|thermal|temperature|porosity|crack|warping/.test(lower)){
   response="A geometry file alone cannot determine that mechanism. Printing thermal history, residual stress, porosity and cracking require validated process models and compatible machine, material and path inputs. Separate idealized structural/steady thermal studies are available in Advanced engineering controls.";
  }else{
   response=a.file?"Your part is available in this conversation. I can inspect mesh integrity and compare LPBF geometric orientations after dimension confirmation. For service loads and technical source review, use the Advanced engineering controls.":"Upload a supported STL to attach it to this study. I will then show actual mesh inspection and available geometric manufacturing checks.";
  }
  append(makeMessage("assistant",response,"local"));setDraft("");
 };
 const attach=(file?:File)=>{
  if(!file)return;
  if(!file.name.toLowerCase().endsWith(".stl")||file.size<1||file.size>20*1024*1024){setAttachError("Choose a nonempty STL file up to 20 MB. STEP and other CAD formats are not supported yet.");return;}
  setAttachError("");
  a.upload(file);
  a.setProjectName(file.name.replace(/\.stl$/i,""));
  setLayer(100);setPlaying(false);setShowArtifact(true);
 };
 const loadSyntheticDemo=async()=>{
  try{
   const response=await fetch("/verification/lpbf-demo-cantilever-30mm.stl",{cache:"no-store"});
   if(!response.ok)throw Error("The synthetic reference STL could not be loaded.");
   const bytes=await response.arrayBuffer();
   attach(new File([bytes],"lpbf-demo-cantilever-30mm.stl",{type:"model/stl"}));
  }catch(e){setAttachError(e instanceof Error?e.message:"Unable to open synthetic part.");}
 };
 const doScreen=()=>{
  if(!canScreen||a.busy)return;
  pendingRun.current=null;
  a.retry();
 };
 const exportEvidencePDF=async()=>{
  if(!a.file||!partHash||!isConfirmed||!context.knowledge){
   setReportError("Confirm the STL dimensions and units before exporting.");return;
  }
  setReportBusy(true);setReportError("");
  try{
   const k=context.knowledge;
   const readiness=assessEngineeringReadiness({
    fileName:a.file.name,unitsConfirmed:isConfirmed,process:a.journey.process,
    componentName:k.componentName,assemblyContext:k.assemblyContext,
    attachmentNotes:k.attachmentNotes,requirements:k.reviewedRequirements,
    documentCount:context.sources.length,reviewedEvidenceCount:context.reviewed.length,
    hasNumericalServiceStudy:serviceCurrent&&Boolean(serviceStudy?.structural),
    hasSteadyThermalStudy:serviceCurrent&&Boolean(serviceStudy?.thermal),
    hasLpbfGeometryCandidates:currentRun
   });
   const bindings=activeParameterBindings(k.parameterBindings,context.sources,context.reviewed,activeServiceCase(a.servicePlan));
   const geometryFindings=[
    ...meshFindings.map(f=>({code:f.code,message:f.message,basis:"Uploaded mesh topology audit"})),
    ...(currentRun?findings.map(f=>({code:f.code,message:f.message,basis:f.basis})):[])
   ];
   const pdf=await createCopilotReviewPDF({
    projectName:a.projectName,partName:a.file.name,partSha256:partHash,
    process:a.journey.process,unitsConfirmed:isConfirmed,createdAt:new Date().toISOString(),
    knowledge:k,reviewedEvidence:context.reviewed,approvedBindings:bindings,readiness,coverage,geometryFindings,
    study:serviceCurrent&&serviceStudy?{
     jobId:serviceStudy.jobId,stressMPa:serviceStudy.structural?.solver.maxVonMisesMPa,
     displacementMm:serviceStudy.structural?.solver.maxDisplacementMm,
     temperatureMinC:serviceStudy.thermal?.min,temperatureMaxC:serviceStudy.thermal?.max,
     structuralModel:serviceStudy.structural?.solver.model,thermalModel:serviceStudy.thermal?.solver.model
    }:undefined
   });
   pdf.save((a.projectName||"orientai").replace(/[^a-z0-9_-]+/gi,"-").slice(0,50)+"-engineering-evidence.pdf");
  }catch(e){setReportError(e instanceof Error?e.message:"Engineering evidence export failed.");}
  finally{setReportBusy(false);}
 };
 const overlay=showOverhangs?"overhang":selected?"orientation":"geometry";
 return <div ref={layoutRef} className={"oaStudy"+(showArtifact?" oaStudySplit":"")+(resizingPanel?" oaStudyResizing":"")} style={{"--oa-panel-width":panelWidth+"%"} as CSSProperties}>
  <section className="oaStudyChat" aria-label="Engineering conversation">
   {a.file&&<EngineeringAssessmentJourney fileName={a.file.name} unitsConfirmed={isConfirmed} hasGeometryRun={currentRun}
     sourceCount={context.sources.length} reviewedCount={context.reviewed.length} activeStage={activeStage}
     onStageChange={setActiveStage} onReviewPart={()=>setActiveStage("part")}/>}


   <div className="oaStudyFeed" role="log" aria-label="Engineering chat messages">
    {messages.length===0&&!a.file&&<div className="oaStudyEmpty"><h1>What should we analyze?</h1><p>Upload an STL and I'll show the model, real mesh inspection, and the supported manufacturing screening steps.</p><button type="button" className="oaSecondaryRun" onClick={()=>void loadSyntheticDemo()}>Try synthetic cantilever bracket · known support-review geometry</button><small>Illustrative, non-qualified STL in millimeters. No Boeing data or external AI request.</small></div>}

    {activeStage==="part"&&<>
     <div className="oaStageIntro oaPartIntro"><span className="oaStageEyebrow">STAGE 01 / PART GEOMETRY</span><h1>Inspect and confirm the model</h1><p>Review the uploaded geometry, verify scale, and run the supported manufacturing screens before making engineering decisions.</p></div>
    {a.file&&<article className="oaInChatModel oaGeometryOverview" aria-label="Uploaded STL model in chat">
     <header><span><BoxIcon size={18}/> Part geometry · {a.file.name}</span>
      <button ref={sideToggleRef} onClick={()=>showArtifact?closeSideView():setShowArtifact(true)} type="button" aria-expanded={showArtifact} aria-controls="oa-engineering-side-panel"><SquareArrowOutUpRight size={15}/> {showArtifact?"Close side view":"Open side view"}</button>
     </header>
     {showArtifact&&<p className="oaSideViewHint">The uploaded STL is shown in the engineering viewer on the right.</p>}
     {!showArtifact&&<div className="oaInlineViewer"><ViewerErrorBoundary fallback={<STLCanvasFallback url={url} unitScale={a.settings.unitScale} rotation={serviceField?undefined:selected?.rotation} overhangDeg={a.settings.overhangDeg} showOverhangs={!serviceField&&showOverhangs} showSupports={!serviceField&&showSupports} buildFraction={serviceField?undefined:layer/100} highlightTriangles={!serviceField?riskFocus:undefined}/>}><ModelViewer highlightTriangles={!serviceField?riskFocus:undefined} url={url} unitScale={a.settings.unitScale} rotation={serviceField?undefined:selected?.rotation} overhangDeg={a.settings.overhangDeg} showOverhangs={!serviceField&&showOverhangs} showSupports={!serviceField&&showSupports} buildFraction={resultField==="lpbf"&&lpbfFrame?lpbfFrame.fraction:serviceField?undefined:layer/100} field={serviceField} fieldLabel={resultField==="lpbf"?(lpbfResult?.engine.includes("raster")?"Unvalidated raster-enthalpy temperature":"Solid-state LPBF research temperature"):resultField==="stress"?"Service stress":resultField==="displacement"?"Service displacement":resultField==="thermal"?"Steady temperature":undefined}/></ViewerErrorBoundary></div>}
     <div className="oaGeometryCards">
      <section className="oaGeometryFactCard" aria-label="STL mesh facts">
       <h2><CheckCircle2 size={17}/> Mesh inspection</h2>
       <dl>
        <div><dt>Triangles</dt><dd>{inspect.data?inspect.data.audit.triangles.toLocaleString():"Inspecting…"}</dd></div>
        <div><dt>Open edges</dt><dd>{inspect.data?inspect.data.audit.openEdges.toLocaleString():"—"}</dd></div>
        <div><dt>Non-manifold edges</dt><dd>{inspect.data?inspect.data.audit.nonManifoldEdges.toLocaleString():"—"}</dd></div>
        <div><dt>Mesh topology</dt><dd>{inspect.error?"Inspection failed":inspect.data?(meshFindings.length?"Review required":"Screening complete"):"Pending"}</dd></div>
       </dl>
       <p>Geometry-only mesh screening. No manufacturing defect prediction.</p>
      </section>
      <section className="oaGeometryFactCard oaGeometryUnitsCard" aria-label="Dimensions and STL units">
       <h2><BoxIcon size={17}/> Dimensions and units</h2>
       <div className="oaModelMetadata"><span>Bounds (X × Y × Z)</span><strong>{inspect.data?Object.values(inspect.data.dimensions).map(n=>n.toFixed(1)).join(" × ")+" mm":"Pending inspection"}</strong></div>
       <div className="oaModelControls"><label>STL coordinate units
        <select aria-label="STL coordinate units" value={a.settings.unitScale} onChange={e=>a.update("unitScale",Number(e.target.value))}>
         <option value={1}>Millimeters</option><option value={25.4}>Inches</option><option value={1000}>Meters</option>
        </select></label>
        <button type="button" onClick={()=>a.confirmPart()} disabled={!inspect.data||isConfirmed}>{isConfirmed?"Units confirmed":"Confirm units & dimensions"}</button>
       </div>
       <p>STL does not encode units. Confirm these against the source drawing.</p>
      </section>
     </div>
     {unitWarning&&<p className="oaUnitScaleWarning" role="alert"><AlertTriangle size={17}/><span><strong>Review apparent unit-scale mismatch.</strong> {unitWarning.message} If units are corrected, reconfirm against the source drawing.</span></p>}
    </article>}

    {a.file&&<section className="oaProcessCard" aria-label="Analysis workflow">
      <header><span><SlidersHorizontal size={17}/> Engineering analysis activity</span><span className="oaProcessLabel">{a.busy?"Analyzing":currentRun?"Screening complete":"Preflight"}</span></header>
      <div className="oaProcessSteps">
       <div><CheckCircle2 size={16} className="oaStepDone"/> <span>STL loaded locally</span><small>Complete</small></div>
       <div>{inspect.data?<CheckCircle2 size={16} className="oaStepDone"/>:inspect.error?<AlertTriangle size={16} className="oaStepWarn"/>:<LoaderCircle size={16} className="oaSpin"/>}<span>Mesh topology and dimensions</span><small>{inspect.error?"Failed":inspect.data?"Complete":"Running"}</small></div>
       <div>{isConfirmed?<CheckCircle2 size={16} className="oaStepDone"/>:<AlertTriangle size={16} className="oaStepWarn"/>}<span>Engineer confirms units</span><small>{isConfirmed?"Confirmed":"Required"}</small></div>
       <div>{a.busy?<LoaderCircle size={16} className="oaSpin"/>:currentRun?<CheckCircle2 size={16} className="oaStepDone"/>:<span className="oaStepDot"/>}<span>Orientation sweep & geometric support screening</span><small>{a.busy?Math.round(a.progress*100)+"%":currentRun?"Complete":"Not run"}</small></div>
       <div>{processQualityCurrent?.assessment.decision==="outside-declared-range"?
        <AlertTriangle size={16} className="oaStepWarn"/>:
        processQualityCurrent?.assessment.decision==="inside-declared-ranges"?
        <CheckCircle2 size={16} className="oaStepDone"/>:<span className="oaStepDot"/>}
        <span>Machine/material process-window review</span>
        <small>{processQualityCurrent?.assessment.decision==="outside-declared-range"?"Outside supplied limits":
         processQualityCurrent?.assessment.decision==="inside-declared-ranges"?"Within supplied limits · not qualified":"Evidence needed"}</small></div>
       <div><span className="oaStepDot"/><span>Calibrated defect probability / residual stress / fatigue</span><small>Not validated</small></div>
      </div>
      {a.busy&&<progress className="oaRunProgress" max={100} value={Math.round(a.progress*100)} aria-label="Geometry screening progress"/>}
      {inspect.error&&<p className="oaStudyError" role="alert">{inspect.error}</p>}
      {a.error&&<p className="oaStudyError" role="alert">{a.error}</p>}
      <div className="oaRunActions">
       <button type="button" onClick={doScreen} disabled={!canScreen||a.busy||!!inspect.error} className="oaRunButton"><Play size={15}/>{a.busy?"Screening geometry...":"Run geometry screening"}</button>
       {a.busy&&<button type="button" onClick={()=>a.cancel()} className="oaSecondaryRun">Cancel</button>}
       <button type="button" onClick={()=>setShowMethods(v=>!v)} className="oaSecondaryRun">{showMethods?"Hide":"Show"} methods</button>
      </div>
      {!isConfirmed&&<p className="oaSubtle">Confirm source units to enable orientation screening.</p>}
      {a.journey.process!=="PBF_LB_METAL"&&<p className="oaSubtle">Current uploaded-part process is not LPBF; this geometric orientation screen is unavailable.</p>}
      {showMethods&&<p className="oaSubtle">Inspection uses the STL mesh-audit worker. Orientation screening runs the existing local geometry worker. Estimated down-facing areas, build height and support quantities are geometric proxies, not a time-resolved melt/print simulation.</p>}
     </section>}

     {a.file&&<div className="oaStageContinue"><button type="button" onClick={()=>setActiveStage("context")}>Continue to engineering context <SquareArrowOutUpRight size={15}/></button></div>}
     <details className="oaAdvancedToolsDisclosure"><summary><SlidersHorizontal size={16}/> Additional engineering tools <ChevronDown size={16}/></summary>
      <div className="oaAdvancedToolsBody">
    {a.file&&a.journey.process==="PBF_LB_METAL"&&<RiskPreflight file={a.file} partHash={partHash} confirmed={isConfirmed}
      unitScale={a.settings.unitScale} rotationDeg={selected?.rotation??{x:0,y:0,z:0}}
      envelopeMm={{x:a.settings.x,y:a.settings.y,z:a.settings.z}} overhangThresholdDeg={a.settings.overhangDeg}
      onEnvelopeChange={(axis,value)=>a.update(axis,value)} onAngleChange={value=>a.update("overhangDeg",value)}
      onFocus={ids=>{setRiskFocus(ids);if(ids.length){setShowArtifact(true);setResultField("geometry");}}}
      onSummary={setPreflight}/>}
    {a.file&&a.journey.process==="PBF_LB_METAL"&&
     <ProcessQualityReview partHash={partHash} confirmed={isConfirmed}
      unitScale={a.settings.unitScale} onSummary={setProcessQuality}/>}

    {a.file&&a.journey.process==="PBF_LB_METAL"&&<PhysicalSliceWorkspace partHash={partHash} confirmed={isConfirmed} onSnapshot={snapshot=>{
      setPhysicalPreview(snapshot);
      if(snapshot){setSideMode("sliced");setShowArtifact(true);}
    }}/>}

    {a.file&&<section className="oaLpbfCard" aria-label="LPBF thermal process research">
      <div className="oaBuildTitle"><strong>LPBF layer heat-flow study</strong><span>{lpbfResult?"Research calculation completed":"Separate approval required"}</span></div>
      <p className="oaSubtle">This runs a coarse finite-volume transient diffusion model with virtual layer activation. It cannot predict porosity, cracking, melt-pool shape, or print-induced residual stress.</p>
      <button type="button" className="oaSecondaryRun" onClick={()=>setShowLpbf(v=>!v)}>{showLpbf?"Hide":"Review"} process thermal inputs</button>
      <div className="oaChatServiceVisibility" hidden={!showLpbf}>
       <ChatLpbfStudy partHash={partHash} confirmed={isConfirmed}
        onResult={result=>{setPlayingThermal(false);setLpbfSession(result&&partHash?{hash:partHash,scale:a.settings.unitScale,result}:null);if(!result)setResultField("geometry");}}
        onFocus={index=>{setLpbfFrameIndex(index);setResultField("lpbf");setShowArtifact(true);}}/>
      </div>
      {lpbfResult&&lpbfFrame&&<div className="oaLpbfFrameControls" aria-label="LPBF temperature history">
       <label>Thermal snapshot {Math.min(lpbfFrameIndex+1,lpbfResult.frames.length)} of {lpbfResult.frames.length}
        <input type="range" aria-label="Thermal snapshot frame" min={0} max={lpbfResult.frames.length-1}
          value={lpbfFrameIndex} onChange={e=>{setPlayingThermal(false);setLpbfFrameIndex(Number(e.target.value));setResultField("lpbf");setShowArtifact(true);}}/>
       </label>
       <div className="oaRunActions">
        <button type="button" className="oaSecondaryRun" onClick={()=>{
         if(lpbfFrameIndex>=lpbfResult.frames.length-1)setLpbfFrameIndex(0);
         setResultField("lpbf");setShowArtifact(true);setPlayingThermal(v=>!v);
        }}>{playingThermal?"Pause temperature history":"Play temperature history"}</button>
        <button type="button" className="oaSecondaryRun" onClick={()=>{setPlayingThermal(false);setLpbfFrameIndex(0);}}>Restart temperature history</button>
       </div>
       <div className="oaLpbfFrameMetrics">
        <span>Elapsed {(lpbfFrame.timeSeconds/60).toFixed(2)} min</span>
        <span>Build height {(lpbfFrame.fraction*100).toFixed(0)}%</span>
        <span>Max {lpbfFrame.maxC.toFixed(1)} °C</span>
       </div>
       {lpbfFrame.aboveSolidus&&<p className="oaLpbfWarning">Above supplied solidus: solid-state model not valid for this snapshot.</p>}
       <button className="oaSecondaryRun" type="button" onClick={()=>{setResultField("lpbf");setShowArtifact(true);}}>View calculated heat-flow field</button>
      </div>}
     </section>}
    {a.file&&<section className="oaServiceCard" aria-label="Approved structural and thermal calculations">
      <div className="oaBuildTitle"><strong>Numerical service studies</strong><span>{serviceCurrent&&serviceStudy?.thermal?"Calculated":"Engineer approval required"}</span></div>
      <p className="oaSubtle">Run real linear-elastic stress/displacement and steady-conduction calculations for the uploaded part. These are not laser-print, melting or residual-stress predictions.</p>
      <button type="button" className="oaSecondaryRun" onClick={()=>setShowService(v=>!v)}>{showService?"Close":"Review inputs and run"} numerical studies</button>
      <div className="oaChatServiceVisibility" hidden={!showService}><ChatServiceStudy partHash={partHash} verified={isConfirmed} onResults={next=>{setServiceStudy(next);if(!next)setResultField("geometry");}} onOpenResults={()=>{setResultField("stress");setShowArtifact(true);}}/></div>
      {serviceCurrent&&serviceStudy?.structural&&<div role="region" className="oaServiceSummary" aria-label="Calculated service results">
       <div><small>Maximum stress</small><strong>{serviceStudy.structural.solver.maxVonMisesMPa.toPrecision(4)} MPa</strong></div>
       <div><small>Maximum displacement</small><strong>{serviceStudy.structural.solver.maxDisplacementMm.toPrecision(4)} mm</strong></div>
       <div><small>Steady temperature</small><strong>{serviceStudy.thermal?serviceStudy.thermal.min.toFixed(2)+"–"+serviceStudy.thermal.max.toFixed(2)+" °C":"Not yet calculated"}</strong></div>
       <div className="oaFieldControls" aria-label="Service field overlays">
        <button type="button" aria-pressed={resultField==="stress"} onClick={()=>{setResultField("stress");setShowArtifact(true);}}>Stress</button>
        <button type="button" aria-pressed={resultField==="displacement"} onClick={()=>{setResultField("displacement");setShowArtifact(true);}}>Displacement</button>
        <button type="button" aria-pressed={resultField==="thermal"} disabled={!serviceStudy.thermal} onClick={()=>{setResultField("thermal");setShowArtifact(true);}}>Steady temperature</button>
        <button type="button" aria-pressed={resultField==="geometry"} onClick={()=>setResultField("geometry")}>Geometry</button>
       </div>
       <p className="oaSubtle">Fields are mapped to the original STL. Orientation rotation and geometric layer clipping are disabled while a service result field is selected.</p>
      </div>}
     </section>}

      </div>
     </details>
    </>}
    {activeStage==="context"&&a.file&&<EngineeringContextStage knowledge={context.knowledge} sources={context.sources} reviewed={context.reviewed}
      unitsConfirmed={isConfirmed} busy={context.busy} notice={context.notice} error={context.error}
      onAddDocuments={context.addDocuments} onFieldChange={context.updateField}
      onSourceNotes={context.updateNotes} onRemoveSource={context.removeSource}
      onReviewEvidence={context.reviewEvidence} onContinue={()=>setActiveStage("assessment")}/>}
    {activeStage==="assessment"&&a.file&&<EngineeringAssessmentResults fileName={a.file.name}
     unitsConfirmed={isConfirmed} hasGeometryRun={currentRun} coverage={coverage}
     findings={[
      ...meshFindings.map(f=>({code:f.code,message:f.message,basis:"Uploaded STL mesh-topology audit",level:f.level==="blocker"?"blocker" as const:"review" as const})),
      ...(currentRun?findings.map(f=>({code:f.code,message:f.message,basis:f.basis,level:f.severity==="blocker"?"blocker" as const:"review" as const})):[])
     ]}
     canRun={canScreen} busy={a.busy} onRunGeometry={doScreen} onOpenGeometry={()=>setActiveStage("part")} onOpenContext={()=>setActiveStage("context")}
     selectedOrientation={selected?{id:selected.id,buildHeightMm:selected.buildHeightMm,supportProxyMm3:selected.supportProxyMm3}:undefined} onExportReport={()=>void exportEvidencePDF()} reportBusy={reportBusy} reportError={reportError}/>}
    <section className="oaStudyTranscript" aria-label="Engineering conversation history">
     <div className="oaTranscriptHeading"><FileText size={16}/><strong>Engineering conversation</strong><span>{messages.length} messages</span></div>
    {messages.map(m=><div key={m.id} className={"oaStudyMessage "+(m.role==="user"?"oaEngineer":"oaAssistant")}>
     {m.role==="assistant"&&<div className="oaAssistantMark" aria-hidden="true">O</div>}
     <div className="oaMessageBody">
      {m.role==="user"?<div className="oaUserBubble">{m.text}</div>:<>
       <div className="oaMessageText">{m.text}</div>
       {m.source==="local"&&<small className="oaMessageSource">Local engineering guide · no external AI request</small>}
        {m.source==="external-error"&&<small className="oaMessageSource">External AI attempt failed · no solver executed · local engineering tools remain available</small>}
       {m.source==="run"&&<small className="oaMessageSource">Executed geometry worker · run {m.runId?.slice(0,8)}</small>}
       {m.source==="model"&&<small className="oaMessageSource">External AI · approved text and mesh summary only · no solver execution</small>}
        {m.source==="service"&&<small className="oaMessageSource">Executed engineer-approved service workers · job {m.runId?.slice(0,8)}</small>}
      </>}
     </div>
    </div>)}
    <div ref={messageAnchor} aria-hidden="true"/>

    </section>
   </div>
   <div className="oaStudyComposerArea">
    {attachError&&<p role="alert" className="oaStudyError">{attachError}</p>}
    <div className="oaStudyComposer">
     <textarea aria-label="Message ORIENTAI" value={draft} placeholder="Ask about this part, its risks, or the next analysis..."
      onChange={e=>setDraft(e.target.value)}
      onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit()}}}
      rows={2}/>
     <div className="oaStudyComposerActions">
      <input aria-label="Attach STL in conversation" ref={fileInput} type="file" accept=".stl" hidden onChange={e=>attach(e.target.files?.[0])}/>
      <button type="button" aria-label="Upload STL" title="Upload STL" onClick={()=>fileInput.current?.click()}><Paperclip size={19}/></button>
      <span>{a.file?.name??"Attach an STL to begin"}</span>
      <button type="button" className="oaStudySend" onClick={submit} disabled={!draft.trim()||!historyKey||aiBusy} aria-label="Send message"><ArrowUp size={20}/></button>
     </div>
    </div>
    {aiAvailable&&<label className="oaStudyAiConsent">
     <input aria-label="Authorize AI messages from main chat" type="checkbox" checked={allowAi}
      onChange={e=>setAllowAi(e.target.checked)}/>
     Use the configured external AI for each message while checked. I approve sharing chat, mesh measurements, engineer-entered assembly context and explicitly reviewed excerpts. Raw STL/document files are never sent. Do not include controlled Boeing data.
    </label>}
    <small>{aiBusy?"Consulting approved AI model…":allowAi&&aiAvailable?
     "External AI is configured, not connectivity-verified. AI answers are advisory; no physical solver runs from chat.":
     "Local engineering guide · External AI requires server configuration and explicit approval. Numerical work requires engineering review."}</small>
   </div>
  </section>
  {showArtifact&&a.file&&<div className="oaArtifactResize" role="separator" aria-label="Resize 3D model panel" aria-orientation="vertical" aria-valuemin={32} aria-valuemax={64} aria-valuenow={panelWidth} tabIndex={0}
    onKeyDown={e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();setPanelWidth(v=>Math.max(32,Math.min(64,v+(e.key==="ArrowLeft"?2:-2))));}else if(e.key==="Home"){e.preventDefault();setPanelWidth(64);}else if(e.key==="End"){e.preventDefault();setPanelWidth(32);}}}
    onPointerDown={e=>{if(e.pointerType==="mouse"&&e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);setResizingPanel(true);}}
    onPointerMove={e=>{if(resizingPanel)setWidthFromPointer(e.clientX);}}
    onPointerUp={e=>{setWidthFromPointer(e.clientX);setResizingPanel(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onPointerCancel={()=>setResizingPanel(false)}><span aria-hidden="true"/></div>}
  {showArtifact&&a.file&&<aside id="oa-engineering-side-panel" className="oaStudyArtifact" aria-label="Expanded 3D engineering model">
   <header><span><BoxIcon size={18}/> {a.file.name}</span><button ref={sideCloseRef} type="button" onClick={closeSideView} aria-label="Close 3D viewer" title="Collapse model side panel"><X size={19}/></button></header>
   {activeSlicePreview&&<div className="oaSideModeSwitch" role="group" aria-label="Model or sliced layer view">
     <button type="button" aria-pressed={sideMode==="model"} onClick={()=>setSideMode("model")}>3D model</button>
     <button type="button" aria-pressed={sideMode==="sliced"} onClick={()=>setSideMode("sliced")}>Physical layers</button>
    </div>}
   {activeSlicePreview&&sideMode==="sliced"?
    <MetalSlicedSidePanel preview={activeSlicePreview}/>:
    <div className="oaArtifactCanvas"><ViewerErrorBoundary fallback={<STLCanvasFallback url={url} unitScale={a.settings.unitScale} rotation={serviceField?undefined:selected?.rotation} overhangDeg={a.settings.overhangDeg} showOverhangs={!serviceField&&showOverhangs} showSupports={!serviceField&&showSupports} buildFraction={serviceField?undefined:layer/100} highlightTriangles={!serviceField?riskFocus:undefined}/>}><ModelViewer highlightTriangles={!serviceField?riskFocus:undefined} url={url} unitScale={a.settings.unitScale} rotation={serviceField?undefined:selected?.rotation} overhangDeg={a.settings.overhangDeg} showOverhangs={!serviceField&&showOverhangs} showSupports={!serviceField&&showSupports} buildFraction={resultField==="lpbf"&&lpbfFrame?lpbfFrame.fraction:serviceField?undefined:layer/100} field={serviceField} fieldLabel={resultField==="lpbf"?(lpbfResult?.engine.includes("raster")?"Unvalidated raster-enthalpy temperature":"Solid-state LPBF research temperature"):resultField==="stress"?"Service stress":resultField==="displacement"?"Service displacement":resultField==="thermal"?"Steady temperature":undefined}/></ViewerErrorBoundary></div>}
   <div className="oaMetalEngineeringTools" role="group" aria-label="Metal additive manufacturing engineering view"><strong>Metal AM engineering view</strong><div><button type="button" aria-pressed={resultField==="geometry"&&!showOverhangs&&!showSupports} onClick={()=>{setSideMode("model");setResultField("geometry");setShowOverhangs(false);setShowSupports(false);setLayer(100)}}>Solid part</button><button type="button" aria-pressed={showOverhangs} onClick={()=>{setSideMode("model");setResultField("geometry");setShowOverhangs(v=>!v)}}>Overhang faces</button><button type="button" aria-pressed={showSupports} onClick={()=>{setSideMode("model");setResultField("geometry");setShowSupports(v=>!v)}}>Conceptual supports</button></div><div className="oaMetalBuildPlayback"><button type="button" onClick={()=>{setSideMode("model");setResultField("geometry");if(layer>=100)setLayer(1);setPlaying(v=>!v);}}>{playing?"Pause build":"Play build"}</button><button type="button" onClick={()=>{setPlaying(false);setSideMode("model");setResultField("geometry");setLayer(1);}}>Restart</button></div><label>Build progression · {layer}%<input aria-label="Build progression percentage" type="range" min="1" max="100" value={layer} onChange={e=>{setPlaying(false);setSideMode("model");setResultField("geometry");setLayer(Number(e.target.value))}}/></label><small>STL geometry and geometric screening only. Supports are illustrative, not machine-ready structures or validated defect predictions.</small></div>
   <p>{activeSlicePreview&&sideMode==="sliced"?"Source-hashed sampled physical layers · geometry only · no machine program":
     "Live STL geometry · "+(serviceField?resultField+" calculated research field":overlay+" view · build height "+layer+"%")+" · Research only"}</p>
   {activeStage==="context"&&<div className="oaViewerContextNote"><strong>Assembly context</strong><span>{context.sources.length} references · {context.reviewed.length} reviewed passages</span><small>Geometry remains visible while you confirm how this part connects to its assembly. Source review does not identify load-bearing faces automatically.</small></div>}
   {activeStage==="assessment"&&<div className="oaViewerContextNote"><strong>Evidence coverage</strong><span>{coverageCounts.screened} screened · {coverageCounts.calculated} calculated · {coverageCounts.notAssessed} unassessed</span><small>Use only calculated or source-supported fields. No validated print-defect probability is available.</small></div>}
   <Link href="/copilot/advanced">Open advanced numerical studies <SquareArrowOutUpRight size={14}/></Link>
  </aside>}
  <Link className="oaAdvancedLink" href="/copilot/advanced">Advanced engineering controls, documents and numerical studies <SquareArrowOutUpRight size={14}/></Link>
 </div>;
}
