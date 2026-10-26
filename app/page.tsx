import Link from "next/link";
import AppShell from "@/components/v2/AppShell";
import {ArrowUpRight,Box,ShieldCheck,FileText,PlayCircle} from "lucide-react";
export default function Home(){return <AppShell title="Projects">
 <section className="studioHero"><div>
 <span className="studioHeroEyebrow">ORIENTAI · METAL ADDITIVE MANUFACTURING</span>
 <h2>Start with your part.<br/>Understand your options.</h2>
 <p>One guided engineering workflow for checking your component, documenting service requirements, selecting a metal-printing process, evaluating supported manufacturing strategies, and exporting evidence.</p>
 <div className="studioHeroActions"><Link className="studioAction primary" href="/orientation">Open my engineering workspace <ArrowUpRight size={17}/></Link></div>
 <p style={{fontSize:12,marginTop:13}}>Your most recent part and settings are saved locally in this browser. Open the workspace to continue or begin a different project.</p>
 </div><div className="studioHeroArt"><Box size={155} strokeWidth={.85}/><div className="studioAxis">PART → REQUIREMENTS → PROCESS → DECISION</div></div></section>
 <div className="studioSectionTitle"><h2>Two ways to begin</h2><span>Same guided steps, clearly different evidence</span></div>
 <div className="studioTiles">
  <Link href="/orientation" className="studioTile"><Box size={25}/><strong>Upload an engineering part</strong><span>Start with your own STL or an aerospace teaching model. Examine original-part service loads and LPBF geometric orientation comparisons.</span><b>Continue part project →</b></Link>
  <Link href="/orientation?example=ded" className="studioTile"><PlayCircle size={25}/><strong>Explore a DED teaching project</strong><span>Use an explicitly synthetic single-bead wall to compare laser wire/powder DED tracks, nominal motion time and factory-flow assumptions. Not an arbitrary-STL path generator.</span><b>Start DED example →</b></Link>
  <Link href="/report" className="studioTile"><FileText size={25}/><strong>Review the evidence</strong><span>Export available STL study results with their assumptions and limitations, or use the example-project report step for DED exports.</span><b>Open reports →</b></Link>
 </div>
 <section className="studioInfoStrip" style={{marginTop:18}}><ShieldCheck size={19}/><div><strong>Decision support — not certification</strong><span>Geometric scores, idealized motion times, voxel numerical studies and factory-flow examples are not manufacturing approval or a probability of first-time acceptance.</span></div></section>
 </AppShell>}
