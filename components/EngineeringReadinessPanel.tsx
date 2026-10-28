"use client";
import type {EngineeringReadiness,ReadinessGate} from "@/lib/engineering-readiness";
type Step=ReadinessGate["next"];
export default function EngineeringReadinessPanel({report,onGoTo}:{report:EngineeringReadiness;onGoTo:(step:Step)=>void}){
 return <section className="copilotReadiness" aria-label="Engineering evidence readiness" data-testid="engineering-readiness">
  <div className="copilotReadinessTop"><div>
   <small>ENGINEERING EVIDENCE</small><h3>What can this study support?</h3>
   <p>{report.counts.ready} documented/calculated areas · {report.counts.review} needing review · {report.counts.unavailable} unsupported</p>
  </div><span className="copilotResearchStatus">Research only · not qualified</span></div>
  <div className="copilotReadinessGates">{report.gates.map(gate=><div key={gate.id} className="copilotReadinessItem">
   <span className={"copilotReadinessDot "+gate.status} aria-label={gate.status}>{gate.status==="ready"?"✓":gate.status==="not-available"?"—":"!"}</span>
   <div><strong>{gate.title}</strong><p>{gate.detail}</p></div>
  </div>)}</div>
  <div className="copilotReadinessNext"><strong>Recommended next action</strong>
   <p>{report.nextAction.reason}</p>
   <button type="button" onClick={()=>onGoTo(report.nextAction.step)}>Open {report.nextAction.title}</button>
  </div>
  <details className="copilotReadinessLimit"><summary>What this summary does not establish</summary>
   {report.caveats.map(text=><p key={text}>{text}</p>)}
  </details>
 </section>;
}
