/** Deterministic terminating FIFO production-flow simulation. Hours and USD throughout. */
export type FlowStage={id:string;name:string;durationHours:number;capacity:number;hourlyRate:number};
export type FlowConfiguration={schema:1;jobs:number;arrivalIntervalHours:number;stages:FlowStage[];printTimeSource:'user-assumption'|'orientation-estimate';candidateId?:string};
export const DEFAULT_FLOW_CONFIGURATION:FlowConfiguration={schema:1,jobs:5,arrivalIntervalHours:0,printTimeSource:'user-assumption',stages:[
 {id:'prepare',name:'Build preparation',durationHours:1,capacity:1,hourlyRate:0},
 {id:'print',name:'Printing and in-machine cooling',durationHours:12,capacity:1,hourlyRate:0},
 {id:'depowder',name:'Depowder and plate handling',durationHours:1,capacity:1,hourlyRate:0},
 {id:'heat',name:'Heat treatment',durationHours:4,capacity:1,hourlyRate:0},
 {id:'support',name:'Support removal and finishing',durationHours:2,capacity:1,hourlyRate:0},
 {id:'inspect',name:'Inspection',durationHours:1,capacity:1,hourlyRate:0},
]};
export type FlowEvent={job:number;stageId:string;resource:number;arrivalHours:number;startHours:number;finishHours:number;waitHours:number};
export type FlowResult={version:string;events:FlowEvent[];makespanHours:number;meanLeadTimeHours:number;meanQueueTimeHours:number;completedJobs:number;throughputPerHour:number;timeAverageWip:number;busyResourceCostUSD:number;stations:{id:string;name:string;capacity:number;utilization:number;totalWaitHours:number;busyHours:number}[];assumptions:string[]};
export type FlowStudy={runId:string;createdAt:string;configuration:FlowConfiguration;result:FlowResult};
export function validateFlowConfiguration(value:unknown,strict=true):asserts value is FlowConfiguration{
 const v=value as FlowConfiguration;
 if(!v||v.schema!==1||!Number.isFinite(v.jobs)||!Number.isFinite(v.arrivalIntervalHours)||!Array.isArray(v.stages)||v.stages.length!==6||!['user-assumption','orientation-estimate'].includes(v.printTimeSource))throw Error('Invalid production-flow configuration.');
 if(v.printTimeSource==='orientation-estimate'&&(typeof v.candidateId!=='string'||!v.candidateId))throw Error('Orientation source is missing.');
 for(let i=0;i<v.stages.length;i++){
  const s=v.stages[i];if(!s||s.id!==DEFAULT_FLOW_CONFIGURATION.stages[i].id||typeof s.name!=='string'||s.name.length>80||![s.durationHours,s.capacity,s.hourlyRate].every(Number.isFinite))throw Error('Invalid process stage.');
  if(strict&&(!Number.isInteger(s.capacity)||s.capacity<1||s.capacity>8||s.durationHours<0||s.durationHours>10000||s.hourlyRate<0||s.hourlyRate>1e6))throw Error('Use 1–8 resources, 0–10,000 hours and nonnegative rates up to USD 1,000,000/hour.');
 }
 if(strict&&(!Number.isInteger(v.jobs)||v.jobs<1||v.jobs>100||v.arrivalIntervalHours<0||v.arrivalIntervalHours>10000))throw Error('Use 1–100 builds and an arrival interval from 0 to 10,000 hours.');
}
export function simulateProductionFlow(input:FlowConfiguration):FlowResult{
 validateFlowConfiguration(input);
 if(input.stages.every(s=>s.durationHours===0))throw Error('At least one process duration must be positive.');
 const releases=Array.from({length:input.jobs},(_,i)=>i*input.arrivalIntervalHours);
 let arrivals=releases.map((at,job)=>({job:job+1,at}));
 const events:FlowEvent[]=[];const stats:FlowResult['stations']=[];
 for(const stage of input.stages){
  const free=Array(stage.capacity).fill(0) as number[];const next:{job:number;at:number}[]=[];let waits=0;
  // Arrival order, with deterministic job ID tie breaking, implements FIFO.
  for(const item of [...arrivals].sort((a,b)=>a.at-b.at||a.job-b.job)){
   let resource=0;for(let r=1;r<free.length;r++)if(free[r]<free[resource])resource=r;
   const start=Math.max(item.at,free[resource]),finish=start+stage.durationHours,wait=start-item.at;
   free[resource]=finish;waits+=wait;events.push({job:item.job,stageId:stage.id,resource:resource+1,arrivalHours:item.at,startHours:start,finishHours:finish,waitHours:wait});
   next.push({job:item.job,at:finish});
  }
  arrivals=next;stats.push({id:stage.id,name:stage.name,capacity:stage.capacity,utilization:0,totalWaitHours:waits,busyHours:input.jobs*stage.durationHours});
 }
 const makespan=Math.max(...arrivals.map(x=>x.at));
 const totalLead=arrivals.reduce((sum,x)=>sum+x.at-releases[x.job-1],0);
 const totalWait=events.reduce((sum,e)=>sum+e.waitHours,0);
 for(const s of stats)s.utilization=s.busyHours/(s.capacity*makespan);
 return {version:'deterministic-fifo-flow-0.1',events,makespanHours:makespan,meanLeadTimeHours:totalLead/input.jobs,
 meanQueueTimeHours:totalWait/input.jobs,completedJobs:input.jobs,throughputPerHour:input.jobs/makespan,
 timeAverageWip:totalLead/makespan,busyResourceCostUSD:input.stages.reduce((sum,s)=>sum+input.jobs*s.durationHours*s.hourlyRate,0),stations:stats,
 assumptions:['Terminating deterministic FIFO simulation; starts empty at time zero and drains all released builds.',
 'One part per build; no nesting, plate packing or furnace batching. Every job follows the same route and times.',
 'Dedicated independent resources at each stage, unlimited queues and 24/7 availability; no shared operators, calendars, transport or breakdowns.',
 'Printing stage occupies its printer for the entire entered duration. Add in-machine cooldown to an orientation print estimate before use; editing changes its basis to user-assumption.',
 'Zero-duration stages are skipped in time. Rates charge busy resource time only; zero rates mean uncosted, not free.',
 'Times and capacities are scenario assumptions, not measured plant data. No acceptance, rework, scrap or defect probabilities are inferred.',
 'Finite-batch throughput/utilization are not steady-state estimates. This is not a native Simio model or a part-physics simulation.']};
}
