import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_FLOW_CONFIGURATION,simulateProductionFlow,validateFlowConfiguration,type FlowConfiguration} from '../lib/production-flow';
const base=():FlowConfiguration=>({...DEFAULT_FLOW_CONFIGURATION,jobs:3,stages:DEFAULT_FLOW_CONFIGURATION.stages.map(s=>({...s,durationHours:s.id==='print'?2:0,hourlyRate:s.id==='print'?5:0}))});
test('single-resource batch matches hand-calculated queue, flow and cost',()=>{
 const r=simulateProductionFlow(base());
 assert.equal(r.makespanHours,6);assert.equal(r.meanLeadTimeHours,4);assert.equal(r.meanQueueTimeHours,2);
 assert.equal(r.timeAverageWip,2);assert.equal(r.busyResourceCostUSD,30);assert.equal(r.stations[1].utilization,1);
 assert.equal(r.events.length,18);assert.equal(r.completedJobs,3);
});
test('parallel printers and spaced releases match analytical results',()=>{
 const p=base();p.stages[1].capacity=2;const r=simulateProductionFlow(p);
 assert.equal(r.makespanHours,4);assert.equal(r.stations[1].utilization,.75);
 assert.ok(Math.abs(r.meanLeadTimeHours-8/3)<1e-12);
 const spaced=simulateProductionFlow({...base(),arrivalIntervalHours:3});
 assert.equal(spaced.meanQueueTimeHours,0);assert.equal(spaced.makespanHours,8);assert.equal(spaced.meanLeadTimeHours,2);
});
test('downstream queue preserves FIFO precedence and lead-time conservation',()=>{
 const p=base();p.jobs=2;p.stages[3].durationHours=3;
 const r=simulateProductionFlow(p);assert.equal(r.makespanHours,8);assert.equal(r.meanLeadTimeHours,6.5);assert.equal(r.meanQueueTimeHours,1.5);
 for(let job=1;job<=p.jobs;job++){
  const events=r.events.filter(e=>e.job===job);for(let i=1;i<events.length;i++)assert.equal(events[i].arrivalHours,events[i-1].finishHours);
 }
 for(const stage of p.stages)for(let resource=1;resource<=stage.capacity;resource++){
  const events=r.events.filter(e=>e.stageId===stage.id&&e.resource===resource).sort((a,b)=>a.startHours-b.startHours);
  for(let i=1;i<events.length;i++)assert.ok(events[i].startHours>=events[i-1].finishHours);
 }
 assert.equal(r.meanLeadTimeHours,r.meanQueueTimeHours+p.stages.reduce((sum,s)=>sum+s.durationHours,0));
 assert.deepEqual(simulateProductionFlow(p),r);
});
test('flow model rejects impossible capacities and malformed inputs',()=>{
 for(const jobs of [0,101,1.5,NaN])assert.throws(()=>simulateProductionFlow({...base(),jobs}));
 const p=base();p.stages[1].capacity=0;assert.throws(()=>simulateProductionFlow(p));
 assert.doesNotThrow(()=>validateFlowConfiguration(p,false)); // safely restore an editable draft
 assert.throws(()=>simulateProductionFlow({...base(),stages:base().stages.map(s=>({...s,durationHours:0}))}));
 assert.throws(()=>validateFlowConfiguration({...base(),printTimeSource:'orientation-estimate'}));
});

test('portable flow import recomputes outcomes and rejects a mismatched run',async()=>{
 const {readFileSync}=await import('node:fs');const {File}=await import('node:buffer');
 const {analyzeOrientations}=await import('../lib/orientation-engine');
 const {DEFAULT_SETTINGS,requestFor}=await import('../lib/analysis-workspace');
 const {exportPortableProject,importPortableProject}=await import('../lib/project-transfer');
 const bytes=Uint8Array.from(readFileSync('public/verification/cube-10mm.stl'));
 const file=new File([bytes],'cube.stl') as unknown as globalThis.File;
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 const configuration=base();
 const result={...analyzeOrientations(bytes.buffer,requestFor(DEFAULT_SETTINGS)),generatedAt:'2026-10-26T00:00:00Z',algorithm:'test',runId:'flow-test',configuration:DEFAULT_SETTINGS,source:{fileName:'cube.stl',fileHashSha256:hash,byteSize:bytes.byteLength},productionFlowSetup:configuration,productionFlow:{runId:'flow-test',createdAt:'2026-10-26T00:00:00Z',configuration,result:simulateProductionFlow(configuration)}};
 const packed=JSON.parse(await exportPortableProject('Flow test',file,DEFAULT_SETTINGS,result,null));
 packed.result.productionFlow.result.makespanHours=999999;
 const imported=await importPortableProject(JSON.stringify(packed));assert.equal(imported.result!.productionFlow!.result.makespanHours,6);
 packed.result.productionFlow.runId='wrong';
 await assert.rejects(importPortableProject(JSON.stringify(packed)),/different analysis run/);
});
