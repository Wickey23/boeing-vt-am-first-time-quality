/** M11 registered one-way full sampled-domain elastic diagnostic.
 * This deliberately resets mechanical history at a declared post-deposition
 * frame. It does not infer solidification, permanent strain or actual release.
 */
import {runRegisteredLayerExperiment} from "./lpbf-registered-layer-experiment";
import {solveThermalMeshResearch,type ThermalMeshInput} from "./lpbf-thermal-mesh-research";
type ThermalArgs=Parameters<typeof runRegisteredLayerExperiment>[0];
export type MeshHistoryRequest={referenceFrame:number;releaseFrame:number;acknowledgeStressFreeReset:boolean;
 material:Pick<ThermalMeshInput,"youngsModulusMPa"|"poissonRatio"|"thermalExpansionPerK"|"yieldStressMPa"|"sourceLabel">};
export async function runRegisteredThermalMeshHistory(args:ThermalArgs,request:MeshHistoryRequest){
 if(!request.acknowledgeStressFreeReset)throw Error("Explicit stress-free reset assumption required.");
 const selection={...request,material:{...request.material}};
 const result=await runRegisteredLayerExperiment({...args,captureFrames:true});
 return prepareRegisteredThermalMeshHistory(result,selection);
}
/** For in-memory results produced by the same registered research worker, not imported JSON. */
export function prepareRegisteredThermalMeshHistory(result:Awaited<ReturnType<typeof runRegisteredLayerExperiment>>,request:MeshHistoryRequest){
 if(!request.acknowledgeStressFreeReset)throw Error("Explicit stress-free reset assumption required.");
 const selection={...request,material:{...request.material}};
 const {geometry,thermal}=result,frames=thermal.frames,g=geometry.grid;
 if(!frames?.length||thermal.partSha256!==geometry.partSha256||thermal.sourceSha256!==result.registration.sourceSha256||thermal.grid.cellCount!==g.representedCells||thermal.grid.layers!==g.physicalLayers||thermal.grid.pitchMm!==g.xyPitchMm||thermal.grid.layerHeightMm!==g.layerThicknessMm)throw Error("Registered thermal fields do not match geometry and scan identity.");
 const {referenceFrame,releaseFrame}=selection;
 if(!Number.isInteger(referenceFrame)||!Number.isInteger(releaseFrame)||referenceFrame<0||
 releaseFrame<=referenceFrame||releaseFrame>=frames.length)throw Error("Invalid reference or release frame.");
 if(frames[referenceFrame].layer!==g.physicalLayers-1)throw Error("Reference must follow activation of all material layers.");
 if(g.representedCells>200||frames.length-referenceFrame>30)throw Error("Mechanical history limited to 200 cells and 30 command frames.");
 const cells=geometry.layers.flatMap(l=>l.cells.map(c=>({x:c.x,y:c.y,layer:l.layer})));
 const key=(c:{x:number;y:number;layer:number})=>[c.x,c.y,c.layer].join(",");
 const keys=new Set(cells.map(key));
 if(keys.size!==cells.length||cells.length!==g.representedCells)throw Error("Ambiguous registered geometry.");
 function frameMap(i:number){
  const f=frames![i],map=new Map(f.cells.map(c=>[key(c),c]));
  if(map.size!==f.cells.length||map.size!==keys.size||[...map.keys()].some(k=>!keys.has(k))||
   f.cells.some(c=>!Number.isFinite(c.temperatureC)))throw Error("Incomplete or ambiguous registered thermal frame.");
  return map;
 }
 const initial=frameMap(referenceFrame);
 const steps=frames.slice(referenceFrame).map((frame,i)=>{
  const frameIndex=referenceFrame+i,map=frameMap(frameIndex);
  if(i>0&&frame.timeSeconds<=frames[frameIndex-1].timeSeconds)throw Error("Nonmonotonic thermal frame time.");
  const mesh=solveThermalMeshResearch({...selection.material,pitchMm:g.xyPitchMm,layerHeightMm:g.layerThicknessMm,
   constraint:frameIndex<releaseFrame?"clamped-base":"rigid-motion-pins",
   cells:cells.map(c=>({...c,temperatureC:map.get(key(c))!.temperatureC,referenceTemperatureC:initial.get(key(c))!.temperatureC}))});
  // At the release instant solve both constraints on exactly the same field.
  const restrainedComparison=frameIndex===releaseFrame?solveThermalMeshResearch({...selection.material,pitchMm:g.xyPitchMm,layerHeightMm:g.layerThicknessMm,constraint:"clamped-base",cells:mesh.cellResults.map(c=>({x:c.x,y:c.y,layer:c.layer,temperatureC:c.temperatureC,referenceTemperatureC:c.referenceTemperatureC}))}):undefined;
  return {frameIndex,commandIndex:frame.commandIndex,timeSeconds:frame.timeSeconds,mesh,restrainedComparison};
 });
 return {scope:"UNVALIDATED_REGISTERED_ELASTIC_MESH_HISTORY" as const,productionActivationAuthorized:false as const,
  partSha256:thermal.partSha256,scanSha256:thermal.sourceSha256,selection,
  coordinateFrame:{kind:"registered-build-grid" as const,originMm:{...g.originMm},pitchMm:g.xyPitchMm,layerHeightMm:g.layerThicknessMm,
   convention:"Add originMm to mesh-local node coordinates; displacement vectors remain unchanged."},
  geometry,registration:result.registration,steps,
  limitations:["All occupied cells are assumed mechanically bonded and stress-free at the chosen post-deposition reference frame; prior history is discarded.",
   "Command-end temperatures only. Elastic mechanical response does not feed back to thermal simulation.",
   "Clamped-base and rigid-motion-only states are idealized; no plasticity, physical support removal or permanent distortion prediction. Yielding is rejected."]};
}
