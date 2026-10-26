"use client";
import Link from "next/link";
import AppShell from "@/components/v2/AppShell";
import DedPlanningStudio from "@/components/DedPlanningStudio";
export default function SimulationCenter(){
 return <AppShell title="DED Teaching Lab">
  <div className="guidedIntro">
   <p className="guidedEyebrow">ORIENTAI · MANUFACTURING SIMULATION</p>
   <h2>Understand the build, the part, and the manufacturing route.</h2>
   <p>DED path planning and deterministic manufacturing-flow comparison are working teaching tools. FEA, thermal and distortion capabilities carry independent evidence limits, not a single generalized simulation pass.</p>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:18}}>
    <Link className="studioAction secondary" href="/orientation">Part Workspace / service FEA →</Link>
    <Link className="studioAction secondary" href="/simulation/benchmarks">Numerical solver benchmarks →</Link>
   </div>
  </div>
  <DedPlanningStudio/>
 </AppShell>;
}
