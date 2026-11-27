"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowUp,FileBox,FileUp,Paperclip,ShieldCheck,X} from "lucide-react";
import {useAnalysis} from "@/components/AnalysisProvider";
import {ORIENTAI_BENCHMARKS,createOrientaiBenchmarkStl,type BenchmarkPart} from "@/lib/orientai-benchmark-parts";

/** Entry composer: records the first local question and sends the engineer to the
 * existing part-aware study; it never sends attachments to an external AI service. */
export default function ChatLanding(){
 const router=useRouter();
 const analysis=useAnalysis();
 const [message,setMessage]=useState("");
 const [part,setPart]=useState<File|null>(null);
 const [error,setError]=useState("");
 const fileInput=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{
  const reset=()=>{setMessage("");setPart(null);setError("");if(fileInput.current)fileInput.current.value="";};
  window.addEventListener("orientai-new-study",reset);
  return ()=>window.removeEventListener("orientai-new-study",reset);
 },[]);
 const attach=(file:File|undefined)=>{
  if(!file)return;
  if(!file.name.toLowerCase().endsWith(".stl")||file.size<1||file.size>20*1024*1024){
   setError("Choose a nonempty STL file up to 20 MB. Other CAD formats are not yet supported.");
   return;
  }
  setPart(file);setError("");
 };
 const openBenchmark=(id:BenchmarkPart)=>{
  if(!analysis.ready)return;
  const partName=id+".stl";
  const file=new File([createOrientaiBenchmarkStl(id)],partName,{type:"model/stl"});
  analysis.startUploadedProject();
  analysis.update("unitScale",1);
  analysis.upload(file);
  analysis.setProjectName(id);
  try{sessionStorage.setItem("orientai-pending-message-v1","Review this synthetic benchmark geometry. Confirm units, compare orientation candidates, then inspect sampled physical layers. This is not a validated print-failure prediction.");}catch{}
  router.push("/copilot/workbench");
 };
 const submit=()=>{
  const prompt=message.trim();
  if(!analysis.ready){setError("Workspace is still loading. Please try again.");return;}
  if(!prompt&&!part)return;
  if(part){
   analysis.startUploadedProject();
   analysis.upload(part);
   analysis.setProjectName(part.name.replace(/\.stl$/i,""));
  }
  try{sessionStorage.setItem("orientai-pending-message-v1",prompt||"Help me review this uploaded part before analysis.");}
  catch{setError("This browser cannot save the initial message. You can still continue in the study.");}
  router.push("/copilot/workbench");
 };
 return <section className="oaHome oaDocumentCenter" aria-label="Start an engineering conversation">
  <div className="oaDocumentHeading"><FileBox size={18}/> ORIENTAI / Study manager</div>
  <h1 className="oaGreeting">Engineering studies</h1>
  <Link className="oaOpenSandbox" href="/copilot/workbench"><FileBox size={19}/> Open engineering sandbox</Link>
  <p className="oaSubGreeting">Import a part, open your saved study, or start with a research benchmark.</p>
  <div className="oaGuidedStart" role="region" aria-label="Start a guided part review" style={{width:"min(100%,760px)",border:"1px solid var(--oa-border)",borderRadius:16,padding:"22px 24px",background:"var(--oa-card)",display:"grid",gap:12}}>
    <strong style={{fontSize:19}}>New part study</strong>
    <p style={{fontSize:14,lineHeight:1.6,color:"var(--oa-muted)",margin:0}}>You do not need to know which analysis to run. Upload a metal 3D-printing STL, confirm its dimensions, tell us what the part does, and review the manufacturing concerns.</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:8,fontSize:12,color:"var(--oa-muted)"}}><span>1. Upload STL</span><span>→</span><span>2. Confirm size</span><span>→</span><span>3. Describe use</span><span>→</span><span>4. Review risks</span></div>
    <button type="button" disabled={!analysis.ready} onClick={()=>fileInput.current?.click()} style={{justifySelf:"start",padding:"12px 18px",border:0,borderRadius:9,fontWeight:700,fontSize:14,background:"var(--oa-strong)",color:"var(--oa-bg)",cursor:"pointer",maxWidth:"100%"}}><FileUp size={16} style={{verticalAlign:"middle",marginRight:7}}/>Upload STL to start guided review</button>
    <div role="group" aria-label="Synthetic research benchmark parts" style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8}}>
      <span style={{fontSize:12,color:"var(--oa-muted)"}}>Test with a synthetic part:</span>
      {ORIENTAI_BENCHMARKS.map(item=><button key={item.id} type="button" disabled={!analysis.ready}
       title={item.purpose} onClick={()=>openBenchmark(item.id)}
       style={{border:"1px solid var(--oa-border)",borderRadius:8,padding:"8px 10px",fontSize:12,background:"var(--oa-card)",color:"inherit",cursor:"pointer"}}>{item.name}</button>)}
    </div>
    <small style={{fontSize:12,color:"var(--oa-muted)"}}>Four deterministic STL teaching fixtures (mm), including the three research study parts. Engineer must confirm dimensions. No machine-validated claims.</small>
    {part&&<p role="status" style={{fontSize:13,margin:0}}>Selected {part.name}. Use Start conversation below to open the engineering study.</p>}
   </div>
  <div className="oaComposerArea">
   <div className="oaDocumentHeading"><ShieldCheck size={16}/> Optional engineering question</div>
   <div className="oaComposer">
    {part&&<div className="oaAttachment">
     <FileBox size={19}/><span className="oaAttachmentName" title={part.name}>{part.name}</span>
     <button type="button" aria-label="Remove attached file" onClick={()=>{setPart(null);if(fileInput.current)fileInput.current.value="";}}><X size={15}/></button>
    </div>}
    <textarea aria-label="Message ORIENTAI" placeholder="Message ORIENTAI..." value={message}
     onChange={e=>setMessage(e.target.value)}
     onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit();}}}
     rows={2} maxLength={3000}/>
    <div className="oaComposerBottom">
     <div className="oaComposerLeft">
      <input ref={fileInput} className="oaHiddenFile" aria-label="Select STL part" type="file" accept=".stl" onChange={e=>attach(e.target.files?.[0])}/>
      <button className="oaComposerAction" type="button" title="Attach STL geometry" onClick={()=>fileInput.current?.click()}>
       <Paperclip size={18}/> <span>Attach part</span>
      </button>
     </div>
     <button className="oaSend" type="button" disabled={!analysis.ready||(!message.trim()&&!part)}
      aria-label="Start conversation" title="Start conversation" onClick={submit}><ArrowUp size={19}/></button>
    </div>
   </div>
   {error&&<div className="oaHomeError" role="alert">{error}</div>}
   <div className="oaExamples" aria-label="Example engineering questions">
    <button type="button" className="oaExample" onClick={()=>setMessage("Inspect my component for potential metal 3D printing risks.")}>Inspect a part</button>
    <button type="button" className="oaExample" onClick={()=>setMessage("What engineering inputs are needed before I can run reliable failure-risk analyses?")}>Plan an analysis</button>
    <button type="button" className="oaExample" onClick={()=>setMessage("Explain the differences between LPBF and DED failure mechanisms.")}>Explore failure mechanisms</button>
   </div>
   {analysis.file&&<div className="oaExisting">Current saved part: {analysis.file.name} · <Link href="/copilot/workbench">Open existing study</Link></div>}
   <p className="oaHomeHelp"><ShieldCheck size={13} style={{verticalAlign:"middle",marginRight:5}}/>STL files are processed locally. External AI use requires separate authorization in the engineering study.</p>
  </div>
 </section>;
}
