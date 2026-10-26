'use client';
import {useState} from 'react';
import Link from 'next/link';
import AppShell from '@/components/v2/AppShell';
import {useAnalysis} from '@/components/AnalysisProvider';
import {DEFAULT_FLOW_CONFIGURATION,simulateProductionFlow,type FlowConfiguration} from '@/lib/production-flow';

export default function ProductionFlow(){
 const a=useAnalysis();const [confirmed,setConfirmed]=useState(false),[error,setError]=useState('');
 const input=a.result?.productionFlowSetup??DEFAULT_FLOW_CONFIGURATION;
 const study=a.result?.productionFlow;
 const candidate=a.result?.candidates.find(c=>c.id===a.selected);
 const change=(next:FlowConfiguration)=>{setConfirmed(false);setError('');try{a.setProductionFlowSetup(next)}catch(e){setError(e instanceof Error?e.message:'Invalid input')}};
 const run=()=>{if(!a.result)return;setError('');try{const result=simulateProductionFlow(input);a.attachProductionFlow({runId:a.result.runId,createdAt:new Date().toISOString(),configuration:input,result})}catch(e){setError(e instanceof Error?e.message:'Simulation failed')}};
 return <AppShell title="Production Flow" focused>
 <section className="studioCard"><h1>How long will the manufacturing route take?</h1><p>This process-flow simulation follows builds through queues and workstations. Part physics answers a different question: how the component responds to heat and loads.</p>
 <p><Link href="/orientation">Return to the part and its physics studies →</Link></p>
 <p>Deterministic research scenario · one part per build · no quality prediction · not a native Simio model.</p>
 {!a.ready?<p role="status">Restoring project…</p>:!a.result?<p>Upload your part and run an orientation search in the Part Workspace first. This keeps the production study tied to the same geometry and manufacturing run.</p>:<>
 <p><strong>Active part:</strong> {a.result.source.fileName} · {a.result.candidates.length} orientations available</p><p style={{overflowWrap:'anywhere'}}>Analysis run: {a.result.runId}</p>
 <h2>1. Describe the production scenario</h2><p>Default durations are illustrative teaching inputs. Replace them with measured or documented estimates from your team. All rates start at zero, meaning costs have not been supplied.</p>
 <div className="studioFields"><label>Number of builds<input type="number" min="1" max="100" value={input.jobs} onChange={e=>change({...input,jobs:Number(e.target.value)})}/></label><label>Build release interval (hours)<input type="number" min="0" step="any" value={input.arrivalIntervalHours} onChange={e=>change({...input,arrivalIntervalHours:Number(e.target.value)})}/></label></div>
 <p>Zero release interval means all builds are waiting at time zero. Capacity is the number of independent parallel workstations, each processing one build at a time.</p>
 {candidate&&<button className="studioAction secondary" onClick={()=>change({...input,printTimeSource:'orientation-estimate',candidateId:candidate.id,stages:input.stages.map(s=>s.id==='print'?{...s,durationHours:candidate.estimatedBuildHours}:s)})}>Use selected orientation print estimate</button>}
 <p>Print-time basis: {input.printTimeSource==='orientation-estimate'?'geometric estimate for '+input.candidateId:'user scenario assumption'}. Orientation estimates use fixed layer-time assumptions and exclude cooling. Add any printer-occupying cooldown to the printing duration; editing it records a user assumption.</p>
 {input.stages.map(stage=><fieldset key={stage.id} style={{margin:'16px 0',border:'1px solid #cbd5e1',borderRadius:8,padding:16}}><legend>{stage.name}</legend><div className="studioFields">
 <label>{stage.name} duration (hours)<input type="number" min="0" step="any" value={stage.durationHours} onChange={e=>change({...input,printTimeSource:stage.id==='print'?'user-assumption':input.printTimeSource,stages:input.stages.map(s=>s.id===stage.id?{...s,durationHours:Number(e.target.value)}:s)})}/></label>
 <label>{stage.name} resources<input type="number" min="1" max="8" value={stage.capacity} onChange={e=>change({...input,stages:input.stages.map(s=>s.id===stage.id?{...s,capacity:Number(e.target.value)}:s)})}/></label>
 <label>{stage.name} busy-hour rate (USD/hour)<input type="number" min="0" step="any" value={stage.hourlyRate} onChange={e=>change({...input,stages:input.stages.map(s=>s.id===stage.id?{...s,hourlyRate:Number(e.target.value)}:s)})}/></label></div></fieldset>)}
 <p>Route: preparation → printing/cooling → depowder → heat treatment → support removal/finishing → inspection. Your team's actual sequence may differ; do not apply this scenario until it matches the intended process.</p>
 <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I reviewed the route, durations, capacities and cost assumptions.</label>
 <button className="studioAction primary" disabled={!confirmed} onClick={run}>Run production-flow simulation</button>
 {error&&<p role="alert">{error}</p>}
 {study&&<section aria-label="Production simulation results"><h2>2. Review the production results</h2>
 <div className="studioFields"><p><strong>Batch completion:</strong> {study.result.makespanHours.toFixed(2)} h</p><p><strong>Mean lead time:</strong> {study.result.meanLeadTimeHours.toFixed(2)} h/build</p><p><strong>Mean queue time:</strong> {study.result.meanQueueTimeHours.toFixed(2)} h/build</p><p><strong>Completed builds:</strong> {study.result.completedJobs}</p></div>
 <p>Finite-batch throughput: {study.result.throughputPerHour.toFixed(3)} builds/hour. Time-average work in progress: {study.result.timeAverageWip.toFixed(2)} builds.</p>
 <p>Cost for supplied busy-resource rates: USD {study.result.busyResourceCostUSD.toFixed(2)}. {study.configuration.stages.some(s=>s.durationHours>0&&s.hourlyRate===0)?'Incomplete costing: one or more active stages has no rate.':''} Excludes idle time, material and any unmodeled expenses.</p>
 <div style={{overflowX:'auto'}}><table className="studioCandidateTable"><caption>Resource use and queue delay</caption><thead><tr><th>Stage</th><th>Resources</th><th>Utilization over batch</th><th>Total queue delay (h)</th></tr></thead><tbody>{study.result.stations.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.capacity}</td><td>{(s.utilization*100).toFixed(1)}%</td><td>{s.totalWaitHours.toFixed(2)}</td></tr>)}</tbody></table></div>
 <p>Utilization and waiting time identify capacity-pressure candidates. Confirm a bottleneck by changing one capacity or time and rerunning; the busiest station is not automatically the bottleneck.</p>
 <details><summary>Event schedule for every build</summary><div style={{overflowX:'auto',maxHeight:420}}><table className="studioCandidateTable"><thead><tr><th>Build</th><th>Stage</th><th>Resource</th><th>Arrival (h)</th><th>Start (h)</th><th>Finish (h)</th><th>Wait (h)</th></tr></thead><tbody>{[...study.result.events].sort((a,b)=>a.startHours-b.startHours||a.job-b.job).map(e=><tr key={e.job+'-'+e.stageId}><td>{e.job}</td><td>{study.configuration.stages.find(s=>s.id===e.stageId)?.name}</td><td>{e.resource}</td><td>{e.arrivalHours.toFixed(2)}</td><td>{e.startHours.toFixed(2)}</td><td>{e.finishHours.toFixed(2)}</td><td>{e.waitHours.toFixed(2)}</td></tr>)}</tbody></table></div></details>
 <h3>Model assumptions</h3><ul>{study.result.assumptions.map(s=><li key={s}>{s}</li>)}</ul>
 <p>Build acceptance, rework, scrap and first-time quality: not evaluated. Completing inspection in this model does not mean a part passed inspection.</p>
 <Link className="studioAction primary" href="/report">Download the consolidated engineering report</Link>
 <p>This study is saved with the active analysis and included in project backups and JSON/PDF reports. Editing scenario inputs clears its result; changing manufacturing settings starts a new analysis and clears this scenario. Save a project revision to retain a scenario for comparison.</p>
 </section>}
 </>}
 </section></AppShell>;
}
