"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowUp,FileBox,FileUp,Paperclip,ShieldCheck,X} from "lucide-react";
import {useAnalysis} from "@/components/AnalysisProvider";

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
  router.push("/copilot");
 };
 return <section className="oaHome" aria-label="Start an engineering conversation">
  <h1 className="oaGreeting">What are we working on today?</h1>
  <p className="oaSubGreeting">Ask about a metal-AM component, or upload an STL to begin.</p>
  <div className="oaComposerArea">
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
   {analysis.file&&<div className="oaExisting">Current saved part: {analysis.file.name} · <Link href="/copilot">Open existing study</Link></div>}
   <p className="oaHomeHelp"><ShieldCheck size={13} style={{verticalAlign:"middle",marginRight:5}}/>STL files are processed locally. External AI use requires separate authorization in the engineering study.</p>
  </div>
 </section>;
}
