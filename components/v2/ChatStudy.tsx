"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {useAnalysis} from "@/components/AnalysisProvider";
import {usePartInspection} from "@/components/PartInspection";
import {completedPart} from "@/lib/engineering-journey";
import {screenCandidate} from "@/lib/part-screening";
import {failureCoverage,coverageSummary} from "@/lib/failure-coverage";
import ChatServiceStudy from "@/components/v2/ChatServiceStudy";
import ChatLpbfStudy from "@/components/v2/ChatLpbfStudy";
import type {LpbfResult} from "@/lib/lpbf-transient";
import type {ServiceStudyResults} from "@/components/UnifiedServiceStudy";
import {ArrowUp,Box as BoxIcon,CheckCircle2,ChevronDown,ChevronUp,FileUp,Paperclip,Play,RotateCcw,ShieldAlert,SlidersHorizontal,SquareArrowOutUpRight,X,LoaderCircle,AlertTriangle,FileText} from "lucide-react";
import ViewerErrorBoundary from "@/components/ViewerErrorBoundary";
import "./chat-study.css";
const ModelViewer=dynamic(()=>import("@/components/ModelViewer"),{ssr:false});
type Message={id:string;role:"user"|"assistant";text:string;createdAt:string;source:"engineer"|"local"|"run"|"service";runId?:string};
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
   (v.role==="user"||v.role==="assistant")&&["engineer","local","run","service"].includes(v.source))
   .slice(-70).map(v=>({...v,text:v.text.slice(0,4000)}));
 }catch{return [];}
}
export default function ChatStudy(){
 const a=useAnalysis();
 const inspect=usePartInspection(a.file,a.settings.unitScale);
 const [fingerprint,setFingerprint]=useState<{file:File|null;hash:string}|null>(null);
 const partHash=fingerprint?.file===a.file?fingerprint.hash:null;
 const [historyKey,setHistoryKey]=useState<string|null>(null);
 const [messages,setMessages]=useState<Message[]>(emptyMessages);
 const [draft,setDraft]=useState("");
 const [attachError,setAttachError]=useState("");
 const [showArtifact,setShowArtifact]=useState(false);
 const [showOverhangs,setShowOverhangs]=useState(false);
 const [showSupports,setShowSupports]=useState(false);
 const [layer,setLayer]=useState(100);
 const [playing,setPlaying]=useState(false);
 const [showMethods,setShowMethods]=useState(true);
 const [showService,setShowService]=useState(false);
 const [showLpbf,setShowLpbf]=useState(false);
 const [lpbfSession,setLpbfSession]=useState<{hash:string;scale:number;result:LpbfResult}|null>(null);
 const [lpbfFrameIndex,setLpbfFrameIndex]=useState(0);
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
 const bottom=useRef<HTMLDivElement>(null);
 const pendingRun=useRef<string|null>(null);
 const isConfirmed=completedPart(a.journey,a.file,a.settings.unitScale);
 const canScreen=Boolean(a.file&&isConfirmed&&a.journey.process==="PBF_LB_METAL");
 const currentRun=Boolean(a.result&&partHash&&a.result.source.fileHashSha256===partHash&&
   a.result.configuration.unitScale===a.settings.unitScale);
 const selected=useMemo(()=>currentRun?a.result?.candidates.find(v=>v.id===a.selected)??a.result?.candidates[0]:undefined,[a.result,a.selected,currentRun]);
 const findings=useMemo(()=>selected&&a.result?screenCandidate(selected,a.result.candidates):[],[selected,a.result]);
 const meshFindings=inspect.data?.audit.findings??[];
 const serviceCurrent=Boolean(serviceStudy&&a.file&&partHash&&partHash===serviceStudy.partSha256&&
  serviceStudy.unitScale===a.settings.unitScale&&serviceStudy.process===a.journey.process&&isConfirmed);
 const lpbfValid=Boolean(lpbfSession&&partHash&&lpbfSession.hash===partHash&&lpbfSession.scale===a.settings.unitScale&&
  a.journey.process==="PBF_LB_METAL"&&isConfirmed);
 const lpbfResult=lpbfValid?lpbfSession?.result:null;
 const lpbfFrame=lpbfResult?.frames[Math.min(lpbfFrameIndex,lpbfResult.frames.length-1)];
 const serviceField=lpbfFrame&&resultField==="lpbf"?lpbfFrame.field:
  serviceCurrent&&resultField==="stress"?serviceStudy?.structural?.stress:
  serviceCurrent&&resultField==="displacement"?serviceStudy?.structural?.displacement:
  serviceCurrent&&resultField==="thermal"?serviceStudy?.thermal:undefined;
 const coverage=failureCoverage({hasMeshAudit:Boolean(inspect.data),hasOrientationRun:currentRun,
  hasStructuralStudy:serviceCurrent&&Boolean(serviceStudy?.structural),
  hasSteadyThermalStudy:serviceCurrent&&Boolean(serviceStudy?.thermal),
  hasLpbfTransient:Boolean(lpbfResult),process:a.journey.process});
 const coverageCounts=coverageSummary(coverage);
 const append=(message:Message)=>setMessages(old=>[...old,message].slice(-70));
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
  setLpbfSession(null);setShowLpbf(false);setLpbfFrameIndex(0);
 },[partHash,a.ready]);
 useEffect(()=>{if(historyKey&&historyKey===keyPrefix+partHash){
  try{localStorage.setItem(historyKey,JSON.stringify(messages.slice(-70)))}catch{}
 }},[historyKey,partHash,messages]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth",block:"end"})},[messages.length,a.busy,a.progress,a.result?.runId]);
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
  const lower=question.toLowerCase();
  let response:string;
  if(/\b(lpbf|laser|scan.path|transient|print.thermal|thermal.history)\b/.test(lower)){
    response=a.file?"Open the LPBF research thermal panel below. Review material, machine and solid-state assumptions, then approve the thermal worker. It computes coarse heat diffusion, not melt-pool physics or defect probability.":"Upload an STL, verify units and choose LPBF to start.";
    setShowLpbf(true);
   }else if(/\b(service|fea|finite.element|structural|stress|displacement|steady.conduction|thermal study)\b/.test(lower)){
    response=a.file?"Open the Engineer-approved numerical studies card below. Confirm actual service loads, fixtures, elastic material properties and thermal boundary conditions before running the real workers. Stress and steady temperature are not print-induced defects.":"Upload the part, then review engineering boundary conditions in the service study card.";
    setShowService(true);
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
  setLayer(100);setPlaying(false);setShowArtifact(false);
 };
 const doScreen=()=>{
  if(!canScreen||a.busy)return;
  pendingRun.current=null;
  a.retry();
 };
 const overlay=showOverhangs?"overhang":selected?"orientation":"geometry";
 return <div className={"oaStudy"+(showArtifact?" oaStudySplit":"")}>
  <section className="oaStudyChat" aria-label="Engineering conversation">
   <div className="oaStudyFeed" role="log" aria-label="Engineering chat messages">
    {messages.length===0&&!a.file&&<div className="oaStudyEmpty"><h1>What should we analyze?</h1><p>Upload an STL and I'll show the model, real mesh inspection, and the supported manufacturing screening steps.</p></div>}
    {messages.map(m=><div key={m.id} className={"oaStudyMessage "+(m.role==="user"?"oaEngineer":"oaAssistant")}>
     {m.role==="assistant"&&<div className="oaAssistantMark" aria-hidden="true">O</div>}
     <div className="oaMessageBody">
      {m.role==="user"?<div className="oaUserBubble">{m.text}</div>:<>
       <div className="oaMessageText">{m.text}</div>
       {m.source==="local"&&<small className="oaMessageSource">Local engineering guide · no external AI request</small>}
       {m.source==="run"&&<small className="oaMessageSource">Executed geometry worker · run {m.runId?.slice(0,8)}</small>}
        {m.source==="service"&&<small className="oaMessageSource">Executed engineer-approved service workers · job {m.runId?.slice(0,8)}</small>}
      </>}
     </div>
    </div>)}
    {a.file&&<article className="oaInChatModel" aria-label="Uploaded STL model in chat">
      <header><span><BoxIcon size={17}/> Uploaded model · {a.file.name}</span><button onClick={()=>setShowArtifact(v=>!v)} type="button"><SquareArrowOutUpRight size={15}/> {showArtifact?"Close side view":"Open side view"}</button></header>
      {!showArtifact&&<div className="oaInlineViewer"><ViewerErrorBoundary><ModelViewer url={url} unitScale={a.settings.unitScale} rotation={serviceField?undefined:selected?.rotation} overhangDeg={a.settings.overhangDeg} showOverhangs={!serviceField&&showOverhangs} showSupports={!serviceField&&showSupports} buildFraction={resultField==="lpbf"&&lpbfFrame?lpbfFrame.fraction:serviceField?undefined:layer/100} field={serviceField} fieldLabel={resultField==="lpbf"?"Solid-state LPBF research temperature":resultField==="stress"?"Service stress":resultField==="displacement"?"Service displacement":resultField==="thermal"?"Steady temperature":undefined}/></ViewerErrorBoundary></div>}
      <div className="oaModelMetadata">
       <span>{inspect.data?inspect.data.audit.triangles.toLocaleString()+" mesh triangles":"Inspecting mesh..."}</span>
       <span>{inspect.data?Object.values(inspect.data.dimensions).map(n=>n.toFixed(1)).join(" × ")+" mm (selected units)":"Dimensions pending"}</span>
      </div>
      <div className="oaModelControls"><label>STL coordinate units
       <select aria-label="STL coordinate units" value={a.settings.unitScale} onChange={e=>a.update("unitScale",Number(e.target.value))}>
        <option value={1}>Millimeters</option><option value={25.4}>Inches</option><option value={1000}>Meters</option>
       </select></label>
       <button type="button" onClick={()=>a.confirmPart()} disabled={!inspect.data||isConfirmed}> {isConfirmed?"Units confirmed":"Confirm units & dimensions"}</button>
      </div>
      <p className="oaSubtle">STL does not encode units. Confirm against the source drawing. 3D color is geometric screening, not a predicted defect field.</p>
     </article>}
    {a.file&&<section className="oaProcessCard" aria-label="Analysis workflow">
      <header><span><SlidersHorizontal size={17}/> Engineering analysis activity</span><span className="oaProcessLabel">{a.busy?"Analyzing":currentRun?"Screening complete":"Preflight"}</span></header>
      <div className="oaProcessSteps">
       <div><CheckCircle2 size={16} className="oaStepDone"/> <span>STL loaded locally</span><small>Complete</small></div>
       <div>{inspect.data?<CheckCircle2 size={16} className="oaStepDone"/>:inspect.error?<AlertTriangle size={16} className="oaStepWarn"/>:<LoaderCircle size={16} className="oaSpin"/>}<span>Mesh topology and dimensions</span><small>{inspect.error?"Failed":inspect.data?"Complete":"Running"}</small></div>
       <div>{isConfirmed?<CheckCircle2 size={16} className="oaStepDone"/>:<AlertTriangle size={16} className="oaStepWarn"/>}<span>Engineer confirms units</span><small>{isConfirmed?"Confirmed":"Required"}</small></div>
       <div>{a.busy?<LoaderCircle size={16} className="oaSpin"/>:currentRun?<CheckCircle2 size={16} className="oaStepDone"/>:<span className="oaStepDot"/>}<span>Orientation sweep & geometric support screening</span><small>{a.busy?Math.round(a.progress*100)+"%":currentRun?"Complete":"Not run"}</small></div>
       <div><span className="oaStepDot"/><span>Print thermal history / residual stress / defect models</span><small>Not implemented</small></div>
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
    {a.file&&<section className="oaFindingsCard" aria-label="Risk assessment results">
     <header><ShieldAlert size={18}/><strong>Failure-risk assessment</strong><span>{meshFindings.length+findings.length} screening findings</span></header>
     {!inspect.data&&!inspect.error&&<p>Waiting for actual mesh inspection...</p>}
     {inspect.data&&meshFindings.map((f,i)=><div className="oaFinding" key={f.code+i}><strong>{f.code} · {f.level==="blocker"?"Mesh blocker":"Review"}</strong><p>{f.message}</p><small>Source: uploaded mesh topology audit</small></div>)}
     {currentRun&&findings.map((f,i)=><div className="oaFinding" key={f.code+i}><strong>{f.code} · {f.severity==="blocker"?"Geometric blocker":"Review"}</strong><p>{f.message}</p><small>Basis: {f.basis}</small></div>)}
     {inspect.data&&!meshFindings.length&&<p className="oaSubtle">No edge-topology warnings from this limited mesh audit. Self-intersections, defects, material behavior and print feasibility have not been established.</p>}
     {currentRun&&findings.length===0&&<p className="oaSubtle">No additional findings under the current geometric screening rules. This is not a claim of first-time quality.</p>}
     <details className="oaUnavailable"><summary>Failure mechanisms not assessed <ChevronDown size={15}/></summary>
      <p>Porosity, melt-pool instability, cracking, fatigue, anisotropic strength, print thermal history, residual stress and distortion require process-specific calibrated models, material data and experimental verification.</p>
      <p>Steady heat conduction and idealized service-load FEM are available only as separate, approved studies and do not predict the print's defect formation.</p>
     </details>
    </section>}
    {a.file&&<section className="oaCoverageCard" aria-label="Failure mode assessment coverage">
      <div className="oaBuildTitle"><strong>Failure-mode coverage</strong><span>{coverageCounts.screened} screened · {coverageCounts.calculated} calculated · {coverageCounts.notAssessed} unassessed</span></div>
      <p className="oaSubtle">These statuses show which checks actually ran. Service stress and heat-conduction results do not qualify any print-related failure mechanism as assessed.</p>
      <div className="oaCoverageRows">{coverage.map(item=><details key={item.id} className="oaCoverageRow">
       <summary><span className="oaCoverageName">{item.name}</span><span className={"oaCoverageStatus oaState-"+item.state}>{item.state==="screened"?"Screened":item.state==="calculated"?"Calculated":"Not assessed"}</span></summary>
       <p><strong>Method:</strong> {item.method}</p><p><strong>Limitations:</strong> {item.limitations}</p><p><strong>Next inputs:</strong> {item.nextInput}</p>
      </details>)}</div>
     </section>}
    {a.file&&<section className="oaBuildPreview" aria-label="Print buildup visualization">
      <div className="oaBuildTitle"><strong>Layer buildup preview</strong><span>{layer}% of the model height</span></div>
      <div className="oaRunActions"><button className="oaSecondaryRun" type="button" onClick={()=>{if(layer>=100)setLayer(1);setPlaying(v=>!v);}}>{playing?"Pause build preview":"Play build preview"}</button><button className="oaSecondaryRun" type="button" onClick={()=>{setPlaying(false);setLayer(1);}}>Restart</button></div>
      <input aria-label="Layer buildup percentage" type="range" min="1" max="100" step="1" value={layer} onChange={e=>{setPlaying(false);setLayer(Number(e.target.value))}}/>
      <p className="oaSubtle">The model viewer clips the actual STL geometry at the selected build height. This is a visualization of geometric progression only—not real toolpaths, layer timing, temperature evolution or material deposition physics.</p>
      <div className="oaToggleControls">
       <label><input type="checkbox" checked={showOverhangs} onChange={e=>setShowOverhangs(e.target.checked)}/> Highlight down-facing surfaces</label>
       <label><input type="checkbox" checked={showSupports} onChange={e=>setShowSupports(e.target.checked)}/> Conceptual support preview</label>
      </div>
     </section>}
    <div ref={bottom}/>
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
      <button type="button" className="oaStudySend" onClick={submit} disabled={!draft.trim()||!historyKey} aria-label="Send message"><ArrowUp size={20}/></button>
     </div>
    </div>
    <small>Local research guide · External ARC AI is not enabled here. Numerical work requires engineering review.</small>
   </div>
  </section>
  {showArtifact&&a.file&&<aside className="oaStudyArtifact" aria-label="Expanded 3D engineering model">
   <header><span><BoxIcon size={18}/> {a.file.name}</span><button type="button" onClick={()=>setShowArtifact(false)} aria-label="Close 3D viewer"><X size={19}/></button></header>
   <div className="oaArtifactCanvas"><ViewerErrorBoundary><ModelViewer url={url} unitScale={a.settings.unitScale} rotation={serviceField?undefined:selected?.rotation} overhangDeg={a.settings.overhangDeg} showOverhangs={!serviceField&&showOverhangs} showSupports={!serviceField&&showSupports} buildFraction={resultField==="lpbf"&&lpbfFrame?lpbfFrame.fraction:serviceField?undefined:layer/100} field={serviceField} fieldLabel={resultField==="lpbf"?"Solid-state LPBF research temperature":resultField==="stress"?"Service stress":resultField==="displacement"?"Service displacement":resultField==="thermal"?"Steady temperature":undefined}/></ViewerErrorBoundary></div>
   <p>Live STL geometry · {serviceField?resultField+" calculated research field":overlay+" view · build height "+layer+"%"} · Research only</p>
   <Link href="/copilot/advanced">Open advanced numerical studies <SquareArrowOutUpRight size={14}/></Link>
  </aside>}
  <Link className="oaAdvancedLink" href="/copilot/advanced">Advanced engineering controls, documents and numerical studies <SquareArrowOutUpRight size={14}/></Link>
 </div>;
}
