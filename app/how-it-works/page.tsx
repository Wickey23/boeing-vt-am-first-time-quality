import Link from "next/link";
import AppShell from "@/components/v2/AppShell";

const steps=[
 {name:"Part Geometry",detail:"Upload an STL (up to 20 MB), inspect its mesh and dimensions, confirm the coordinate units, and run geometric orientation screening. STL geometry alone does not establish service conditions."},
 {name:"Engineering Context",detail:"Describe the part function, assembly relationships, forces, attachment interfaces and requirements. Add engineering documents, review relevant excerpts, and enter machine-specific LPBF process limits. Unknown data remains unassessed."},
 {name:"Failure Assessment",detail:"Review the deterministic manufacturing and service-risk register, evidence and uncertainty, remaining work and manufacturing flow. Export the traceable assessment PDF or available analysis data."}
];
export default function HowItWorks(){return <AppShell title="How ORIENTAI Works">
 <section className="studioCard">
  <h2>One part. Three stages. One engineering assessment.</h2>
  <p>The current ORIENTAI workbench is the primary application. Its uploaded STL, engineering context, analysis and report remain in the same study; the 3D viewer stays visible as you move through stages.</p>
  <Link className="studioAction primary" href="/copilot/workbench">Open current engineering study</Link>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12,marginTop:20}}>
   {steps.map((s,i)=><article key={s.name} style={{padding:16,border:"1px solid #345369",borderRadius:9,background:"#102b40"}}>
    <small>STAGE {i+1} OF 3</small><h3>{s.name}</h3><p>{s.detail}</p>
   </article>)}
  </div>
  <h2 style={{marginTop:24}}>Main navigation</h2>
  <p><strong>New study</strong> resets the active study; <strong>Current study</strong> returns to the workbench; <strong>Engineering reports</strong> opens its Failure Assessment stage. The top-bar <strong>Metal AM</strong> control opens process settings in Engineering Context without switching interfaces.</p>
  <h2 style={{marginTop:24}}>Research and compatibility tools</h2>
  <p>Older numerical, orientation, DED and ML tools remain available separately for research. They are not a second primary study workflow, and they must not be confused with the current assessment report.</p>
  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
   <Link className="studioAction secondary" href="/orientation">Guided research workflow</Link>
   <Link className="studioAction secondary" href="/orientation/advanced">Advanced geometry and solvers</Link>
   <Link className="studioAction secondary" href="/simulation/lab">DED teaching example</Link>
   <Link className="studioAction secondary" href="/simulation/benchmarks">Solver benchmarks</Link>
   <Link className="studioAction secondary" href="/report/legacy">Legacy numerical report</Link>
  </div>
  <h2 style={{marginTop:24}}>Engineering interpretation</h2>
  <p>Geometric overhang/support screening and process-window checks are rule-based evidence, not a validated prediction of cracks, porosity, distortion or first-time print success. Steady thermal or idealized structural calculations are not transient LPBF build simulation or qualification. Uploaded engineering information must be reviewed before it is treated as a design requirement.</p>
  <p><strong>Do not upload controlled Boeing data to this public research prototype. Results do not certify manufacturing or service acceptance.</strong></p>
 </section>
</AppShell>}
