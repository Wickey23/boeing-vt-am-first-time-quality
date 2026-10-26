"use client";
import Link from "next/link";import {usePathname} from "next/navigation";
import {LayoutDashboard,Box,BrainCircuit,FileCheck2,Menu,ChevronRight,FlaskConical,Settings2,BookOpen,Activity} from "lucide-react";
import {useState} from "react";
const items=[{href:"/",label:"Projects",icon:LayoutDashboard},{href:"/orientation",label:"Current analysis",icon:Box},{href:"/report",label:"Engineering report",icon:FileCheck2}];
export default function AppShell({title,children,focused=false}:{focused?:boolean;number?:number;title:string;children:React.ReactNode}){const path=usePathname(),[open,setOpen]=useState(false);return <div className="studioRoot"><aside className={"studioSidebar "+(open?"mobileOpen":"")}><Link className="studioBrand" href="/"><div className="studioBrandMark">AM</div><div><strong>ORIENT<span>AI</span></strong><small>Virginia Tech · Senior Design</small></div></Link><div className="studioNavTitle">PROJECT WORKFLOW</div>
<nav aria-label="Main navigation">{items.map(item=>{const Icon=item.icon;return <Link key={item.href} href={item.href} className={"studioNavLink "+(path===item.href||item.href==="/orientation"&&path.startsWith("/orientation")?"current":"")} onClick={()=>setOpen(false)}><Icon size={19}/><span>{item.label}</span>{path===item.href&&<ChevronRight size={15}/>}</Link>})}</nav>
<details className="researchNavigation" style={{marginTop:22}}><summary>Advanced & research tools</summary><nav>
<Link className="studioNavLink" href="/orientation/advanced" onClick={()=>setOpen(false)}>Advanced part studies</Link>
<Link className="studioNavLink" href="/simulation/benchmarks" onClick={()=>setOpen(false)}>Solver benchmarks</Link>
<Link className="studioNavLink" href="/simulation/lab" onClick={()=>setOpen(false)}>Standalone DED teaching lab</Link>
<Link className="studioNavLink" href="/ml" onClick={()=>setOpen(false)}>ML experiments</Link>
<Link className="studioNavLink" href="/validation" onClick={()=>setOpen(false)}>Validation methods</Link>
<Link className="studioNavLink" href="/how-it-works" onClick={()=>setOpen(false)}>Help & technical guide</Link>
</nav></details><div className="studioSidebarFoot"><span className="studioIndicator"/>Research platform <small>Not qualified for production use</small></div></aside><div className="studioContent"><header className="studioTopbar"><button className="studioMenu" onClick={()=>setOpen(v=>!v)} aria-label="Toggle navigation"><Menu size={22}/></button><div className="studioCrumb">Workspace <ChevronRight size={14}/> <strong>{title}</strong></div><div className="studioTopRight"><span className="studioTopStatus">Research mode</span><span className="studioAvatar">VT</span></div></header><main className="studioMain">{!focused&&<div className="studioHeading"><div><div className="studioEyebrow">AEROSPACE ADDITIVE MANUFACTURING</div><h1>{title}</h1></div></div>}{children}</main></div></div>}
