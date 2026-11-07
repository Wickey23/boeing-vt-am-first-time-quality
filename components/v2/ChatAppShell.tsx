"use client";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useEffect,useState} from "react";
import {useAnalysis} from "@/components/AnalysisProvider";
import {PanelLeft,SquarePen,MessageSquare,FileText,FlaskConical,BookOpen,Box,ChevronDown,X,ShieldCheck,LayoutDashboard,Cloud,Layers,HelpCircle,Settings2,PanelLeftClose,PanelLeftOpen} from "lucide-react";
import "./chat-shell.css";
import "./orientai-unified.css";
import EngineeringBuildTicker from "./EngineeringBuildTicker";

/** The chat-first shell is intentionally isolated from the legacy engineering dashboard.
 * Older research routes retain their current shell until their workflows are migrated. */
export default function ChatAppShell({children,title="ORIENTAI"}:{children:React.ReactNode;title?:string}){
 const path=usePathname();
 const router=useRouter();
 const analysis=useAnalysis();
 const professional=path==="/copilot/workbench";
 const [mobileOpen,setMobileOpen]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const [navPreferenceLoaded,setNavPreferenceLoaded]=useState(false);
 useEffect(()=>{
  if(!professional)return;
  try{setCollapsed(window.localStorage.getItem("orientai-workbench-nav-collapsed-v1")==="true");}catch{}
  setNavPreferenceLoaded(true);
 },[professional]);
 useEffect(()=>{
  if(!professional||!navPreferenceLoaded)return;
  try{window.localStorage.setItem("orientai-workbench-nav-collapsed-v1",String(collapsed));}catch{}
 },[collapsed,professional,navPreferenceLoaded]);
 const newStudy=()=>{
  analysis.startUploadedProject();
  if(typeof window!=="undefined")window.dispatchEvent(new Event("orientai-new-study"));
  setMobileOpen(false);
  router.push("/copilot/workbench");
 };
 const toggle=()=>{
  if(typeof window!=="undefined"&&window.matchMedia("(max-width: 780px)").matches)setMobileOpen(v=>!v);
  else setCollapsed(v=>!v);
 };
 const nav=(href:string,label:string,Icon:typeof MessageSquare)=>(
  <Link href={href} onClick={()=>setMobileOpen(false)} aria-label={label}
   className={"oaNavItem"+(path===href?" oaNavActive":"")}
   aria-current={path===href?"page":undefined} title={label}>
   <Icon size={18} strokeWidth={1.85}/><span className="oaNavText">{label}</span>
  </Link>
 );
 return <div className={"oaRoot"+(collapsed?" oaIsCollapsed":"")+(professional?" oaProfessionalShell":"")}>
  {mobileOpen&&<button className="oaScrim" aria-label="Close sidebar" onClick={()=>setMobileOpen(false)}/>}
  <aside id="oa-workbench-navigation" className={"oaSidebar"+(mobileOpen?" oaMobileOpen":"")} aria-label="Workspace sidebar">
   <div className="oaSidebarTop">
    <Link href="/copilot/workbench" className="oaBrand" onClick={()=>setMobileOpen(false)} title="ORIENTAI home">
     <span className="oaBrandSymbol">O</span><span className="psBrandStack"><span className="oaBrandText">ORIENTAI</span>{professional&&<small>Engineering AI for<br/>Metal Additive Manufacturing</small>}</span>
    </Link>
    <button className="oaMobileClose" aria-label="Close sidebar" onClick={()=>setMobileOpen(false)}><X size={20}/></button>
   </div>
   <button type="button" className="oaNewChat" onClick={newStudy} title="New study" aria-label="New study">
    <SquarePen size={19}/><span className="oaNavText">New study</span>
   </button>
   <nav className="oaNavigation" aria-label="Primary navigation">
    {nav("/copilot/workbench","Current study",MessageSquare)}
    
    {nav("/report","Engineering reports",FileText)}
   </nav>
   <div className="oaSidebarSection">
    <div className="oaSidebarSectionTitle">WORKSPACE</div>
    <div className="oaCurrentStudy" title={analysis.projectName}>
     <Box size={17}/><span className="oaNavText">{analysis.file?analysis.projectName:"No part uploaded"}</span>
    </div>
   </div>
   <details className="oaAdvanced">
    <summary aria-label="Engineering tools" title="Engineering tools" onClick={e=>{if(professional&&collapsed){e.preventDefault();setCollapsed(false);}}}><FlaskConical size={17}/><span className="oaNavText">Engineering tools</span><ChevronDown className="oaAdvancedArrow" size={15}/></summary>
    <div className="oaAdvancedLinks">
     <Link href="/orientation" onClick={()=>setMobileOpen(false)}>Legacy research orientation tools</Link>
     <Link href="/simulation/benchmarks" onClick={()=>setMobileOpen(false)}>Simulation benchmarks</Link>
     <Link href="/ml" onClick={()=>setMobileOpen(false)}>ML experiments</Link>
     <Link href="/orientation?example=ded" onClick={()=>setMobileOpen(false)}>Launch DED example</Link>
     <Link href="/validation" onClick={()=>setMobileOpen(false)}>Validation</Link>
     <Link href="/how-it-works" onClick={()=>setMobileOpen(false)}><BookOpen size={14}/> Technical guide</Link>
    </div>
   </details>
   {!professional&&<EngineeringBuildTicker/>}
   {professional&&<div className="psSidebarLinks">
    <Link href="/copilot/advanced" title="Advanced research studies" aria-label="Advanced research studies" onClick={()=>setMobileOpen(false)}><Settings2 size={16}/> Advanced research studies</Link>
    <Link href="/how-it-works" title="Help and support" aria-label="Help and support" onClick={()=>setMobileOpen(false)}><HelpCircle size={16}/> Help & support</Link>
   </div>}
   <div className="oaSidebarFooter">
    {professional?<span className="psVTIcon">VT</span>:<ShieldCheck size={17}/>}
    <span className="oaNavText">{professional?<>Virginia Tech<small>Research prototype</small></>:"Virginia Tech · Research prototype"}</span>
   </div>
  </aside>
  <div className="oaBody">
   {professional?   <header className="oaTopbar">
    <div className="psTopbarIdentity">
     <button type="button" className="oaIconButton psDesktopSidebarButton"
      onClick={()=>setCollapsed(value=>!value)} aria-controls="oa-workbench-navigation" aria-expanded={!collapsed}
      aria-label={collapsed?"Expand navigation":"Collapse navigation"} title={collapsed?"Expand navigation":"Collapse navigation"}>
      {collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}
     </button>
     <button type="button" className="oaIconButton psMobileSidebarButton" onClick={toggle}
      aria-label={mobileOpen?"Close navigation":"Open navigation"} aria-controls="oa-workbench-navigation"
      aria-expanded={mobileOpen} title="Toggle navigation"><PanelLeft size={20}/></button>
     <Box size={24} strokeWidth={1.9}/>
     <div><strong>ORIENTAI</strong><span>· Engineering Study</span></div>
    </div>
    <div className="psTopbarActions">
     <span className="psSaveState" role="status"><Cloud size={16}/>{!analysis.ready?"Loading study…":analysis.storageError?"Local save issue":analysis.saving?"Saving locally…":"Saved locally"}</span>
     <button type="button" className="psProcessLink" aria-label="Open Metal AM process settings" title="Open process parameters in Engineering Context" onClick={()=>window.dispatchEvent(new CustomEvent("orientai-open-stage",{detail:"context"}))}><Layers size={17}/> Metal AM <ChevronDown size={15}/></button>
    </div>
   </header>:   <header className="oaTopbar">
    <div className="oaTopLeft">
     <button type="button" className="oaIconButton" onClick={toggle} aria-label="Toggle sidebar" title="Toggle sidebar">
      <PanelLeft size={20}/>
     </button>
     <button type="button" className="oaTopNew oaIconButton" onClick={newStudy} aria-label="New study" title="New study"><SquarePen size={19}/></button>
     <div className="oaModelName">{title==="ORIENTAI"?"ORIENTAI":title}<span className="oaModelSuffix"> · Engineering AI</span></div>
    </div>
    <span className="oaResearchLabel">Research prototype</span>
   </header>}
   <main className="oaMain" id="main-content">{children}</main>
   <div className="oaBottomDisclaimer">ORIENTAI supports engineering review. Results do not certify a part or guarantee first-time quality.</div>
  </div>
 </div>;
}
