import Link from "next/link";
import ChatAppShell from "@/components/v2/ChatAppShell";
const steps=[
 {name:"Part Geometry",detail:"Upload an STL (up to 20 MB), inspect the mesh and dimensions, confirm units, and run geometric orientation screening. Shape alone cannot establish service conditions."},
 {name:"Engineering Context",detail:"Describe the part function, assembly relationships, load interfaces and requirements. Review supporting evidence and enter applicable metal LPBF process settings."},
 {name:"Failure Assessment",detail:"Inspect traceable deterministic screening results, known and unassessed failure mechanisms, recommended actions and the engineering evidence report."}
];
export default function HowItWorks(){return <ChatAppShell title="How ORIENTAI Works">
 <div className="oaGuide">
  <header className="oaGuideIntro">
   <span className="oaGuideEyebrow">ORIENTAI · Engineering workflow</span>
   <h1>One part. Three stages. One engineering assessment.</h1>
   <p>Start a study on the homepage or resume the workbench. The selected part stays visible in the 3D viewer as you progress from geometry to application context and an evidence-backed assessment.</p>
  </header>
  <div className="oaGuideActions"><Link className="oaGuideLink oaGuideLinkPrimary" href="/copilot/workbench">Open current engineering study</Link><Link className="oaGuideLink" href="/">Start a new study</Link></div>
  <section className="oaGuideGrid" aria-label="Engineering workflow stages">
   {steps.map((s,i)=><article className="oaGuideCard" key={s.name}>
    <span className="oaGuideNumber">STAGE {String(i+1).padStart(2,"0")} / 03</span>
    <h3>{s.name}</h3><p>{s.detail}</p>
   </article>)}
  </section>
  <section className="oaGuideSection">
   <h2>How navigation works</h2>
   <p><strong>New study</strong> starts a fresh study. <strong>Current study</strong> returns to the same workbench. <strong>Engineering reports</strong> opens Failure Assessment. The top-bar Metal AM control opens process settings inside Engineering Context.</p>
  </section>
  <section className="oaGuideSection">
   <h2>Advanced research tools</h2>
   <p>Legacy orientation, advanced engineering solvers, DED teaching examples, machine-learning experiments, and benchmark reports remain separate research tools. They are not alternative entry points to the main assessment workflow.</p>
   <div className="oaGuideActions">
    <Link className="oaGuideLink" href="/orientation">Guided research workflow</Link>
    <Link className="oaGuideLink" href="/orientation/advanced">Advanced geometry and solvers</Link>
    <Link className="oaGuideLink" href="/simulation/lab">DED teaching example</Link>
    <Link className="oaGuideLink" href="/simulation/benchmarks">Solver benchmarks</Link>
    <Link className="oaGuideLink" href="/report/legacy">Legacy numerical report</Link>
   </div>
  </section>
  <section className="oaGuideSection">
   <h2>Engineering interpretation and data</h2>
   <p>Geometric screening and process-range checks are deterministic rule-based evidence—not validated predictions of cracking, porosity, fatigue or first-attempt success. Steady thermal and idealized structural studies do not qualify a printed part.</p>
   <div className="oaGuideNote"><p>Do not upload controlled Boeing data to this public research prototype. Results are engineering decision support, not manufacturing or service certification.</p></div>
  </section>
 </div>
 </ChatAppShell>}
