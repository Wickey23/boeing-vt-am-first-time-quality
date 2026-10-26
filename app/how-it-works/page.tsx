import Link from "next/link";
import AppShell from "@/components/v2/AppShell";
import {Box,ClipboardList,Factory,GitCompare,Activity,FileCheck2,ShieldCheck} from "lucide-react";
const steps=[
 {name:"Part",question:"What are we manufacturing?",detail:"Upload a real STL, check its original dimensions and units, or open a clearly labeled teaching model."},
 {name:"Requirements",question:"What must it withstand?",detail:"Keep service forces and fixtures attached to the original part. Unknown requirements stay visible rather than counted as passed."},
 {name:"Print process",question:"How will it be manufactured?",detail:"Choose LPBF for geometric orientation screening, or use a separate synthetic laser-wire or laser-powder DED wall to study deposition and factory flow."},
 {name:"Options",question:"Which strategies can be compared?",detail:"For LPBF, rank sampled build orientations using geometric metrics. For the DED teaching wall, compare alternate deposition paths and commanded motion time."},
 {name:"Simulations",question:"Which models apply?",detail:"Run supported original-part service-load calculations and steady conduction with reviewed assumptions; use the DED example to compare a deterministic factory flow. Absent physics remains unavailable."},
 {name:"Decision",question:"What does the evidence support?",detail:"Review constraint failures, model assumptions, missing properties and research tradeoffs. No quality, strength, fatigue or flight-acceptance pass is inferred."},
 {name:"Report",question:"What can we reproduce or share?",detail:"Export an STL study PDF and project backup, or DED teaching scenario JSON and Simio-ready CSV tables with explicit evidence labels."}
];
export default function HowItWorks(){return <AppShell title="How ORIENTAI Works">
 <section className="studioCard"><h2>One part. One workflow. Seven decisions.</h2>
 <p>Start in the Engineering Workspace and move through each step. The selected part stays visible; inputs and named service cases are saved locally and retained between steps.</p>
 <Link className="studioAction primary" href="/orientation">Open guided workspace →</Link>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginTop:20}}>
 {steps.map((s,i)=><article key={s.name} style={{padding:16,border:"1px solid #345369",borderRadius:12,background:"#102b40"}}><small>STEP {i+1}</small><h3 style={{margin:"6px 0"}}>{s.name}</h3><strong>{s.question}</strong><p>{s.detail}</p></article>)}
 </div>
 <h2 style={{marginTop:24}}>LPBF vs. DED</h2><p>These are not interchangeable metal 3D-printing workflows. LPBF builds within a powder bed and must consider recoating, build direction and supports. DED feeds wire or powder into a moving energy source, requiring substrate, bead/track and head-access planning. The current DED path planner applies only to the explicitly synthetic single-bead wall — not arbitrary uploaded STLs.</p>
 <div style={{display:"flex",gap:12,flexWrap:"wrap"}}><Link className="studioAction secondary" href="/orientation?example=ded">Open DED example →</Link><Link className="studioAction secondary" href="/simulation/benchmarks">View solver benchmarks →</Link></div>
 <h2 style={{marginTop:24}}>Interpret results correctly</h2>
 <p>Geometric estimates are not generated supports. The existing voxel FEM and steady-conduction solvers use idealized boundary conditions and are not process-level manufacturing validation. The DED factory-flow example is a deterministic reference model; exported CSV files are not a licensed Simio run.</p>
 <p><strong>Never treat a score or a successfully completed calculation as aerospace qualification, verified machine printability or first-time manufacturing acceptance.</strong></p>
 <p>Advanced diagnostic tools remain available in the research section of the sidebar, but the guided workspace is the primary path for engineering reviews.</p>
 </section>
 </AppShell>}
