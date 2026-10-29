/**
 * Local, exploratory comparison of uploaded pointwise thermal readings against
 * the coarse STL-surface temperature snapshots of a specific research run.
 *
 * NOT NIST AM Bench TAM/SCR validation: those require spatially registered
 * high-rate thermal histories and measured melting/cooling observables.
 */
import * as THREE from "three";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";
import type {LpbfResult} from "./lpbf-transient";
export const LPBF_TRACE_CSV_HEADER="time_s,temperature_c,uncertainty_c,x_mm,y_mm,z_mm";
export const LPBF_TRACE_COMPARISON_VERSION="lpbf-local-trace-comparison-0.1";
export type TraceSample={timeSeconds:number;temperatureC:number;uncertaintyC:number};
export type TraceLocation={xMm:number;yMm:number;zMm:number};
export type ObservedTrace={
 sourceName:string;location:TraceLocation;samples:TraceSample[];
};
export type TracePair={
 timeSeconds:number;observedC:number;predictedC:number;uncertaintyC:number;differenceC:number;
};
export type TraceComparison={
 version:typeof LPBF_TRACE_COMPARISON_VERSION;
 validationStatus:"EXPLORATORY_NOT_VALIDATED";
 amBenchTamScrStatus:"NOT_COMPARABLE";
 defectPredictionAvailable:false;
 measurementSourceAuthenticated:false;
 engine:string;
 sourceName:string;
 sourceSha256:string;
 partSha256:string;
 dataClassification:"synthetic"|"reported-measurement";
 sourceReference:string;
 claimedTimingConfirmed:boolean;
 measuredLocation:TraceLocation;
 matchedVertexIndex:number;
 registrationDistanceMm:number;
 thermalCellSizeMm:number;
 inputSampleCount:number;
 comparedCount:number;
 unmatchedCount:number;
 firstComparedSeconds:number;
 lastComparedSeconds:number;
 peakSnapshotSpacingSeconds:number;
 maeC:number;rmseC:number;biasC:number;
 withinReportedUncertaintyCount:number;
 pairs:TracePair[];
 limitations:string[];
};
const numeric=/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][-+]?\d+)?$/;
export function parseLpbfTraceCsv(text:string,sourceName="user-trace.csv"):ObservedTrace{
 if(text.length>256*1024)throw Error("Thermal trace CSV must be no larger than 256 KB.");
 const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith("#"));
 if(lines[0]!==LPBF_TRACE_CSV_HEADER)
  throw Error("Thermal trace CSV needs the exact header: "+LPBF_TRACE_CSV_HEADER);
 if(lines.length<4||lines.length>1501)
  throw Error("Thermal trace requires 3–1,500 timestamped readings.");
 const samples:TraceSample[]=[];
 let location:TraceLocation|undefined,previous=-Infinity;
 for(let i=1;i<lines.length;i++){
  const tokens=lines[i].split(",");
  if(tokens.length!==6||tokens.some(x=>!numeric.test(x.trim())))
   throw Error("Trace row "+(i+1)+" needs exactly six finite numeric values.");
  const v=tokens.map(Number);
  if(v.some(x=>!Number.isFinite(x)))throw Error("Nonfinite trace reading at row "+(i+1));
  const [timeSeconds,temperatureC,uncertaintyC,xMm,yMm,zMm]=v;
  if(timeSeconds<0||timeSeconds>14400||timeSeconds<=previous)
   throw Error("Trace times must increase strictly and lie between 0 and 14,400 s.");
  if(temperatureC< -273.15||temperatureC>4000||uncertaintyC<=0||uncertaintyC>1000)
   throw Error("Trace temperature or uncertainty is outside allowed physical bounds.");
  const point={xMm,yMm,zMm};
  if(Object.values(point).some(x=>Math.abs(x)>100000))
   throw Error("Trace coordinates exceed research geometry limits.");
  if(location&&Math.hypot(point.xMm-location.xMm,point.yMm-location.yMm,point.zMm-location.zMm)>1e-7)
   throw Error("Trace rows must describe ONE identical measured location in STL millimeters.");
  location=point;previous=timeSeconds;
  samples.push({timeSeconds,temperatureC,uncertaintyC});
 }
 return {sourceName:sourceName.replace(/[\r\n<>]/g,"").slice(0,100),location:location!,samples};
}
export function interpolateSurfaceTemperature(frames:LpbfResult["frames"],vertexIndex:number,timeSeconds:number){
 if(!frames.length||timeSeconds<frames[0].timeSeconds-1e-10||
   timeSeconds>frames[frames.length-1].timeSeconds+1e-10)return null;
 for(let i=0;i<frames.length;i++){
  const next=frames[i],prev=frames[i-1];
  if(!Number.isFinite(next.field.values[vertexIndex]))throw Error("Invalid computed surface field.");
  if(Math.abs(next.timeSeconds-timeSeconds)<1e-9)return next.field.values[vertexIndex];
  if(prev&&timeSeconds>=prev.timeSeconds&&timeSeconds<=next.timeSeconds){
   if(next.timeSeconds<=prev.timeSeconds)throw Error("Nonmonotone solver frame time.");
   const alpha=(timeSeconds-prev.timeSeconds)/(next.timeSeconds-prev.timeSeconds);
   return prev.field.values[vertexIndex]*(1-alpha)+next.field.values[vertexIndex]*alpha;
  }
 }
 return null;
}
export function compareLpbfSurfaceTrace(args:{
 meshBuffer:ArrayBuffer;unitScale:number;partSha256:string;
 result:LpbfResult;trace:ObservedTrace;sourceSha256:string;
 dataClassification:"synthetic"|"reported-measurement";sourceReference:string;
 claimedTimingConfirmed:boolean;
}):TraceComparison{
 const {meshBuffer,unitScale,partSha256,result,trace,sourceSha256,
  dataClassification,sourceReference,claimedTimingConfirmed}=args;
 if(!/^[a-f0-9]{64}$/.test(partSha256)||!/^[a-f0-9]{64}$/.test(sourceSha256))
  throw Error("Part and measurement source identities require SHA-256.");
 if(!sourceReference.trim()||sourceReference.length>500)
  throw Error("Identify the measurement source or synthetic trace generator.");
 if(!claimedTimingConfirmed)
  throw Error("Engineer must review STL alignment and model/measurement clock origin before comparison.");
 if(result.frames.length<2||!result.mesh.cellSizeMm)
  throw Error("The research solver lacks a comparable thermal time history.");
 if(!Number.isFinite(unitScale)||unitScale<=0)
  throw Error("Invalid STL unit conversion.");
 const g=new STLLoader().parse(meshBuffer);
 const p=g.getAttribute("position");
 const count=p.count,valuesLength=result.frames[0].field.values.length;
 if(count!==valuesLength||!count)throw Error("Thermal fields are not aligned to uploaded STL vertices.");
 let chosen=-1,nearest=Infinity,zMin=Infinity,zMax=-Infinity;
 for(let i=0;i<count;i++){
  const x=p.getX(i)*unitScale,y=p.getY(i)*unitScale,z=p.getZ(i)*unitScale;
  zMin=Math.min(zMin,z);zMax=Math.max(zMax,z);
  const d=Math.hypot(x-trace.location.xMm,y-trace.location.yMm,z-trace.location.zMm);
  if(d<nearest){nearest=d;chosen=i;}
 }
 g.dispose();
 if(!Number.isFinite(nearest)||nearest>result.mesh.cellSizeMm*.75)
  throw Error("Measurement coordinate does not align with an STL surface vertex within 0.75 thermal voxels. Register the physical location before comparing.");
 const height=zMax-zMin;
 if(!(height>0))throw Error("STL has no vertical build extent.");
 const depositedFraction=Math.max(0,Math.min(1,(trace.location.zMm-zMin)/height));
 const frames=result.frames.filter(f=>f.fraction+1e-9>=depositedFraction);
 if(frames.length<2)throw Error("Fewer than two thermal snapshots exist after the requested surface point becomes active. No time interpolation is justified.");
 const pairs:TracePair[]=[];
 for(const s of trace.samples){
  const predicted=interpolateSurfaceTemperature(frames,chosen,s.timeSeconds);
  if(predicted===null)continue;
  if(!Number.isFinite(predicted))throw Error("Nonfinite solver temperature.");
  pairs.push({timeSeconds:s.timeSeconds,observedC:s.temperatureC,predictedC:predicted,
   uncertaintyC:s.uncertaintyC,differenceC:predicted-s.temperatureC});
 }
 if(pairs.length<3)throw Error("Fewer than three readings overlap the active simulated time window. No error metric was calculated.");
 const n=pairs.length;
 const mae=pairs.reduce((a,p)=>a+Math.abs(p.differenceC),0)/n;
 const rmse=Math.sqrt(pairs.reduce((a,p)=>a+p.differenceC*p.differenceC,0)/n);
 const bias=pairs.reduce((a,p)=>a+p.differenceC,0)/n;
 const within=pairs.filter(p=>Math.abs(p.differenceC)<=p.uncertaintyC).length;
 const spacing=Math.max(...frames.slice(1).map((f,i)=>f.timeSeconds-frames[i].timeSeconds));
 if(!Number.isFinite(spacing)||spacing<=0)throw Error("Invalid simulated thermal frame spacing.");
 return {
  version:LPBF_TRACE_COMPARISON_VERSION,
  validationStatus:"EXPLORATORY_NOT_VALIDATED",amBenchTamScrStatus:"NOT_COMPARABLE",
  defectPredictionAvailable:false,measurementSourceAuthenticated:false,
  engine:result.engine,
  sourceName:trace.sourceName,sourceSha256,partSha256,
  dataClassification,sourceReference:sourceReference.trim(),claimedTimingConfirmed,
  measuredLocation:trace.location,matchedVertexIndex:chosen,registrationDistanceMm:nearest,
  thermalCellSizeMm:result.mesh.cellSizeMm,inputSampleCount:trace.samples.length,
  comparedCount:n,unmatchedCount:trace.samples.length-n,
  firstComparedSeconds:pairs[0].timeSeconds,lastComparedSeconds:pairs[n-1].timeSeconds,
  peakSnapshotSpacingSeconds:spacing,maeC:mae,rmseC:rmse,biasC:bias,
  withinReportedUncertaintyCount:within,pairs,
  limitations:[
   "EXPLORATORY NUMERICAL DISCREPANCY ONLY. This is not model validation, calibration, defect prediction, or a pass/fail decision.",
   "Model temperatures are nearest-voxel-projected to one STL vertex. The nearest geometric vertex is not proof of camera-pixel/instrument spatial registration.",
   "The model's saved temperatures are coarse END-OF-VIRTUAL-SLAB snapshots. Linear interpolation between them misses actual laser transients, melting/cooling peaks and thermographic sampling rates.",
   "Clock alignment is asserted by the engineer, not independently verified. No time offset is fitted or optimized.",
   "Source filename/reference, stated experimental status and uncertainties are user-provided and have not been independently authenticated.",
   "Measured uncertainty is not combined with solver uncertainty; an uncertainty-band count does not imply validation success.",
   "NIST AMB2022-01 TAM/SCR challenge observables are location-dependent threshold-crossing and cooling-rate quantities. This comparison does NOT reproduce their definitions or establish agreement with those benchmark measurements."
  ]
 };
}
