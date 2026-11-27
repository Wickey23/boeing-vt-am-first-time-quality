/** M11 one-way thermal-to-elastic section diagnostic.
 * Recompute original geometry and scan bytes; use only post-deposition frames.
 * Explicit stress-free reset is a modeling assumption, never inferred from melt.
 */
import {runRegisteredLayerExperiment} from "./lpbf-registered-layer-experiment";
import {solveThermalSectionResearch,type SectionFiber} from "./lpbf-thermal-section-research";
import type {AxialThermoplasticMaterial} from "./lpbf-axial-thermoplastic-research";
type ThermalArgs=Parameters<typeof runRegisteredLayerExperiment>[0];
export type SectionHistoryRequest={x:number;y:number;referenceFrame:number;releaseFrame:number;
 acknowledgeStressFreeReset:boolean;material:Omit<AxialThermoplasticMaterial,"referenceTemperatureC">};
export async function runRegisteredThermalSectionHistory(args:ThermalArgs,request:SectionHistoryRequest){
 if(!request.acknowledgeStressFreeReset)throw Error("Explicit stress-free reset assumption required.");
 const selection={...request,material:{...request.material}};
 const result=await runRegisteredLayerExperiment({...args,captureFrames:true});
 const {geometry,thermal}=result,frames=thermal.frames!,{x,y,referenceFrame,releaseFrame}=selection;
 const g=geometry.grid;
 if(![x,y,referenceFrame,releaseFrame].every(Number.isInteger)||x<0||y<0||x>=g.columns||y>=g.rows||
  referenceFrame<0||releaseFrame<=referenceFrame||releaseFrame>=frames.length)
  throw Error("Invalid column selection or reference/release frame.");
 const layers=geometry.layers;
 if(layers.length<2||layers.some(l=>!l.cells.some(c=>c.x===x&&c.y===y&&c.coverage===1)))
  throw Error("Section requires a fully occupied contiguous through-height column.");
 if(frames[referenceFrame].layer!==layers.length-1)
  throw Error("Reference must follow activation of all selected material layers.");
 const selected=(frameIndex:number)=>layers.map(l=>{
  const matching=frames[frameIndex].cells.filter(c=>c.x===x&&c.y===y&&c.layer===l.layer);
  if(matching.length!==1||!Number.isFinite(matching[0].temperatureC))throw Error("Missing or ambiguous registered cell history.");
  return matching[0];
 });
 const initial=selected(referenceFrame);
 const steps=frames.slice(referenceFrame).map((frame,i)=>{
  const frameIndex=referenceFrame+i,values=selected(frameIndex);
  if(i>0&&frame.timeSeconds<=frames[frameIndex-1].timeSeconds)throw Error("Nonmonotonic thermal frame time.");
  const fibers:SectionFiber[]=layers.map((l,j)=>({id:[x,y,l.layer].join(","),zMm:l.sampleZMm,
   areaMm2:g.xyPitchMm*(l.topZMm-l.bottomZMm),temperatureC:values[j].temperatureC,
   material:{...selection.material,referenceTemperatureC:initial[j].temperatureC},prescribedInelasticStrain:0}));
  const section=solveThermalSectionResearch(fibers,frameIndex<releaseFrame?{kind:"fixed",axialStrainAtOrigin:0,curvaturePerMm:0}:{kind:"free"});
  return {frameIndex,commandIndex:frame.commandIndex,timeSeconds:frame.timeSeconds,section};
 });
 return {scope:"UNVALIDATED_REGISTERED_ELASTIC_SECTION_HISTORY" as const,productionActivationAuthorized:false as const,
  partSha256:thermal.partSha256,scanSha256:thermal.sourceSha256,
  column:{x,y,centerMm:{x:g.originMm.x+(x+.5)*g.xyPitchMm,y:g.originMm.y+(y+.5)*g.xyPitchMm},pitchMm:g.xyPitchMm},
  selection,referenceTemperaturesC:initial.map(c=>c.temperatureC),steps,
  limitations:["All selected cells are assumed mechanically bonded and stress-free at the explicitly selected post-deposition frame; earlier stress/plastic history is discarded.",
   "Only command-end temperatures are transferred; extrema between frames and actual solidification stress-free temperatures are not resolved.",
   "Elastic plane-section diagnostic only; no plastic evolution, support removal, feedback to thermal model, or full-part distortion. Trial yielding is rejected."]};
}
