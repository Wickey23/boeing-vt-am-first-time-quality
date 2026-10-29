"use client";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useState} from "react";
import {useAnalysis} from "@/components/AnalysisProvider";
import {PanelLeft,PanelLeftClose,SquarePen,MessageSquare,FileText,FlaskConical,BookOpen,Box,ChevronDown,Menu,X,ShieldCheck} from "lucide-react";
import "./chat-shell.css";

/** The chat-first shell is intentionally isolated from the legacy engineering dashboard.
 * Older research routes retain their current shell until their workflows are migrated. */
export default function ChatAppShell({children,title="ORIENTAI"}:{children:React.ReactNode;title?:string}){
 const path=usePathname();
 const router=useRouter();
 const analysis=useAnalysis();
 const [mobileOpen,setMobileOpen]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const newStudy=()=>{
  analysis.startUploadedProject();
  if(typeof window!=="undefined")window.dispatchEvent(new Event("orientai-new-study"));
  setMobileOpen(false);
  router.push("/");
 };
 const toggle=()=>{
  if(typeof window!=="undefined"&&window.matchMedia("(max-width: 780px)").matches)setMobileOpen(v=>!v);
  else setCollapsed(v=>!v);
 };
 const nav=(href:string,label:string,Icon:typeof MessageSquare)=>(
  <Link href={href} onClick={()=>setMobileOpen(false)}
   className={"oaNavItem"+(path===href?" oaNavActive":"")}
   aria-current={path===href?"page":undefined} title={label}>
   <Icon size={18} strokeWidth={1.85}/><span className="oaNavText">{label}</span>
  </Link>
 );
 return <div className={"oaRoot"+(collapsed?" oaIsCollapsed":"")}>
  {mobileOpen&&<button className="oaScrim" aria-label="Close sidebar" onClick={()=>setMobileOpen(false)}/>}
  <aside className={"oaSidebar"+(mobileOpen?" oaMobileOpen":"")} aria-label="Workspace sidebar">
   <div className="oaSidebarTop">
    <Link href="/" className="oaBrand" onClick={()=>setMobileOpen(false)} title="ORIENTAI home">
     <span className="oaBrandSymbol">O</span><span className="oaBrandText">ORIENTAI</span>
    </Link>
    <button className="oaMobileClose" aria-label="Close sidebar" onClick={()=>setMobileOpen(false)}><X size={20}/></button>
   </div>
   <button type="button" className="oaNewChat" onClick={newStudy} title="New study">
    <SquarePen size={19}/><span className="oaNavText">New study</span>
   </button>
   <nav className="oaNavigation" aria-label="Primary navigation">
    {nav("/copilot","Current study",MessageSquare)}
    {nav("/report","Engineering reports",FileText)}
   </nav>
   <div className="oaSidebarSection">
    <div className="oaSidebarSectionTitle">WORKSPACE</div>
    <div className="oaCurrentStudy" title={analysis.projectName}>
     <Box size={17}/><span className="oaNavText">{analysis.file?analysis.projectName:"No part uploaded"}</span>
    </div>
   </div>
   <details className="oaAdvanced">
    <summary><FlaskConical size={17}/><span className="oaNavText">Engineering tools</span><ChevronDown className="oaAdvancedArrow" size={15}/></summary>
    <div className="oaAdvancedLinks">
     <Link href="/orientation" onClick={()=>setMobileOpen(false)}>Orientation workspace</Link>
     <Link href="/simulation/benchmarks" onClick={()=>setMobileOpen(false)}>Simulation benchmarks</Link>
     <Link href="/ml" onClick={()=>setMobileOpen(false)}>ML experiments</Link>
     <Link href="/validation" onClick={()=>setMobileOpen(false)}>Validation</Link>
     <Link href="/how-it-works" onClick={()=>setMobileOpen(false)}><BookOpen size={14}/> Technical guide</Link>
    </div>
   </details>
   <div className="oaSidebarFooter">
    <ShieldCheck size={17}/><span className="oaNavText">Virginia Tech · Research prototype</span>
   </div>
  </aside>
  <div className="oaBody">
   <header className="oaTopbar">
    <div className="oaTopLeft">
     <button type="button" className="oaIconButton" onClick={toggle} aria-label="Toggle sidebar" title="Toggle sidebar">
      <PanelLeft size={20}/>
     </button>
     <button type="button" className="oaTopNew oaIconButton" onClick={newStudy} aria-label="New study" title="New study"><SquarePen size={19}/></button>
     <div className="oaModelName">{title==="ORIENTAI"?"ORIENTAI":title}<span className="oaModelSuffix"> · Engineering AI</span></div>
    </div>
    <span className="oaResearchLabel">Research prototype</span>
   </header>
   <main className="oaMain" id="main-content">{children}</main>
   <div className="oaBottomDisclaimer">ORIENTAI supports engineering review. Results do not certify a part or guarantee first-time quality.</div>
  </div>
 </div>;
}
