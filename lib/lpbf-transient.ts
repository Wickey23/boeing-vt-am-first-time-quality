/**
 * LPBF research transient heat-flow prototype (unvalidated).
 *
 * Solves the *solid-state* heat equation on a stair-stepped voxel domain using an
 * explicit finite-volume time integration. Solid cells are activated as a
 * coarse virtual deposition slab and receive absorbed laser energy uniformly
 * during that slab's total assumed scan time.
 *
 * This is NOT a melt-pool, scan-path, phase-change, residual-stress, porosity,
 * or calibrated manufacturing-defect model. If the calculation crosses the
 * material solidus, its solid-state physics is outside validity.
 */
import * as THREE from "three";
import type {NominalLayerMap} from "./lpbf-layer-mapping";
import {voxelizePart,projectVoxelValues} from "./voxel-thermal";

export const LPBF_MODEL_VERSION="lpbf-solid-transient-0.1";
export type LpbfInputs={
 laserPowerW:number;scanSpeedMmS:number;hatchSpacingMm:number;
 layerThicknessMm:number;absorbedFraction:number;recoatSecondsPerLayer:number;
 densityKgM3:number;specificHeatJKgK:number;conductivityWmK:number;
 solidusC:number;ambientTemperatureC:number;plateTemperatureC:number;
 convectionWm2K:number;resolution:number;
};
export const LPBF_DEMO_INPUTS:LpbfInputs={
 laserPowerW:180,scanSpeedMmS:900,hatchSpacingMm:0.12,
 layerThicknessMm:0.05,absorbedFraction:0.25,recoatSecondsPerLayer:8,
 densityKgM3:4430,specificHeatJKgK:600,conductivityWmK:7,
 solidusC:1600,ambientTemperatureC:25,plateTemperatureC:200,
 convectionWm2K:15,resolution:8
};
export type LpbfFrame={
 fraction:number;zMm:number;timeSeconds:number;minC:number;maxC:number;meanC:number;
 aboveSolidus:boolean;field:{values:number[];min:number;max:number;units:"degC"};
};
export type LpbfProbePoint={xMm:number;yMm:number;zMm:number};
export type LpbfProbeSample={timeSeconds:number;temperatureC:number;virtualSlab:number;laserPowerW:number;laserActive:boolean;};
export type LpbfProbeHistory={
 model:"INTERNAL_THERMAL_VOXEL_PROBE_UNVALIDATED";
 requestedMm:LpbfProbePoint;sampledVoxelCenterMm:LpbfProbePoint;
 registrationOffsetMm:number;voxelWidthMm:number;
 voxelActivationTimeSeconds:number;samplingStrideSteps:number;
 actualStepsObserved:number;sampledPoints:LpbfProbeSample[];
 observedStepPeakC:number;sampledPeakC:number;maximumSampleGapSeconds:number;
 limitations:string[];
};
export type LpbfResult={
 layerMapping?:NominalLayerMap;
 probe?:LpbfProbeHistory;
 engine:string;inputs:LpbfInputs;scanPlan?:{sourceName:string;sha256:string;segmentCount:number;version:string};numerics?:{stepScale:number;maxDtSeconds:number};mesh:{cells:number;cellSizeMm:number;virtualSlabs:number;nominalLayers:number;voxelVolumeMm3:number};
 frames:LpbfFrame[];summary:{
  elapsedSeconds:number;absorbedEnergyJ:number;storedEnergyJ:number;
  plateEnergyJ:number;convectiveEnergyJ:number;relativeEnergyImbalance:number;
  peakSolidTemperatureC:number;exceedsSolidus:boolean;timeSteps:number;
 };
 limitations:string[];
};
const limits:Record<keyof LpbfInputs,[number,number]>={
 laserPowerW:[0,1000],scanSpeedMmS:[50,3000],hatchSpacingMm:[.03,1],
 layerThicknessMm:[.02,.2],absorbedFraction:[0,1],recoatSecondsPerLayer:[0,60],
 densityKgM3:[1000,20000],specificHeatJKgK:[100,2000],conductivityWmK:[.5,500],
 solidusC:[400,3000],ambientTemperatureC:[-50,500],plateTemperatureC:[-50,800],
 convectionWm2K:[0,250],resolution:[6,16]
};
export function validateLpbfInputs(input:LpbfInputs){
 for(const [k,[min,max]] of Object.entries(limits) as [keyof LpbfInputs,[number,number]][]){
  const n=input[k];
  if(!Number.isFinite(n)||n<min||n>max)throw Error("Invalid "+k+": expected "+min+"–"+max);
 }
 if(!Number.isInteger(input.resolution))throw Error("Thermal voxel resolution must be an integer.");
 if(input.plateTemperatureC>=input.solidusC||input.ambientTemperatureC>=input.solidusC)throw Error("Solid-state model requires plate and environment below the material solidus.");
}
export function transientHeatStep(args:{
 cells:Array<[number,number,number]>;temp:Float64Array;active:Uint8Array;
 neighbors:Int32Array[];zBase:number;cellSizeM:number;dt:number;
 input:LpbfInputs
}){
 const {cells,temp,active,neighbors,zBase,cellSizeM:h,dt,input}=args;
 const face=h*h,C=input.densityKgM3*input.specificHeatJKgK*h*h*h;
 const kFace=input.conductivityWmK*h,hConv=input.convectionWm2K*face;
 const delta=new Float64Array(temp.length);let powerConv=0,powerBase=0,activeCells=0;
 for(let i=0;i<temp.length;i++)if(active[i]){
  activeCells++;
  const t=temp[i];let flow=0;
  for(let dir=0;dir<6;dir++){
   const j=neighbors[i][dir];
   if(j>=0&&active[j]){
    flow+=kFace*(temp[j]-t);
   }else{
    const external=hConv*(input.ambientTemperatureC-t);
    flow+=external;
    powerConv-=external;
   }
  }
  if(cells[i][2]===zBase){
   const plate=kFace*2*(input.plateTemperatureC-t);
   flow+=plate;powerBase-=plate;
  }
  delta[i]=flow;
 }
 let baseJ=powerBase*dt,convJ=powerConv*dt;
 for(let i=0;i<temp.length;i++)if(active[i])temp[i]+=delta[i]*dt/C;
 return {plateEnergyJ:baseJ,convectiveEnergyJ:convJ};
}
/** Compute coarse geometry-dependent scan time and temperature fields.
 * All input properties are explicitly engineer-supplied assumptions, not
 * certified machine presets. */
export function simulateLpbfTransient(
 buffer:ArrayBuffer,unitScale:number,input:LpbfInputs,
 onProgress?:(done:number,total:number)=>void
):LpbfResult{
 validateLpbfInputs(input);
 if(!Number.isFinite(unitScale)||unitScale<.001||unitScale>1000)throw Error("Invalid STL unit scale.");
 if(buffer.byteLength>2*1024*1024)throw Error("Transient research worker limited to 2 MB STL meshes; simplify the research mesh first.");
 const mesh=voxelizePart(buffer,{x:0,y:0,z:0},unitScale,input.resolution);
 const {cells,h,box}=mesh;
 if(mesh.vertices.length/3>6000)throw Error("Transient research worker limited to 6,000 STL triangles. Use a simplified, verified manifold mesh.");
 if(cells.length>5000)throw Error("Voxel mesh too large for the bounded browser solver.");
 const zBase=Math.min(...cells.map(c=>c[2]));
 const layers=[...new Set(cells.map(c=>c[2]))].sort((a,b)=>a-b);
 if(layers[0]!==zBase||layers.length<2)throw Error("At least two occupied thermal slabs are required.");
 // A disconnected island has no physical build attachment. The simplified
 // thermal model does not simulate unsupported powder or support conduction.
 const lookup=new Map(cells.map((c,i)=>[c.join(","),i]));
 const faceDirs:[[number,number,number],[number,number,number],[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[
  [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 const neighbors=cells.map(([x,y,z])=>Int32Array.from(faceDirs.map(([dx,dy,dz])=>lookup.get([x+dx,y+dy,z+dz].join(","))??-1)));
 const connected=new Set<number>(),queue:number[]=[];
 for(let i=0;i<cells.length;i++)if(cells[i][2]===zBase){connected.add(i);queue.push(i);}
 while(queue.length){for(const n of neighbors[queue.pop()!])if(n>=0&&!connected.has(n)){connected.add(n);queue.push(n);}}
 if(connected.size!==cells.length)throw Error("Thermal voxels are not connected to the build-plate footprint. Add/verify supports before any process heat-flow study.");
 const byZ=new Map<number,number[]>();
 cells.forEach((c,i)=>{const group=byZ.get(c[2])??[];group.push(i);byZ.set(c[2],group);});
 const size=new THREE.Vector3();box.getSize(size);
 const nominalLayers=Math.ceil(size.z/input.layerThicknessMm);
 const hM=h/1000,capJ=input.densityKgM3*input.specificHeatJKgK*hM**3;
 const alpha=input.conductivityWmK/(input.densityKgM3*input.specificHeatJKgK);
 const maxDt=0.38/(6*alpha/(hM*hM)+6*input.convectionWm2K/(input.densityKgM3*input.specificHeatJKgK*hM));
 if(!(maxDt>0&&Number.isFinite(maxDt)))throw Error("Invalid thermal stability limit.");
 const gridVol=h*h*h;
 const representedVolume=cells.length*gridVol;
 const scanTimeTotal=representedVolume/(input.hatchSpacingMm*input.layerThicknessMm*input.scanSpeedMmS);
 const estimatedTime=scanTimeTotal+nominalLayers*input.recoatSecondsPerLayer;
 if(estimatedTime>14400)throw Error("Research run limited to 4 hours modeled build time.");
 if(Math.ceil(estimatedTime/maxDt)>120000)throw Error("Thermal discretization requires too many stable steps. Reduce the resolution or use a compute worker.");
 const active=new Uint8Array(cells.length),t=new Float64Array(cells.length);
 t.fill(input.ambientTemperatureC);
 const frames:LpbfFrame[]=[];let absorbed=0,convLoss=0,plateLoss=0,elapsed=0,maxSeen=-Infinity,timeSteps=0;
 for(let li=0;li<layers.length;li++){
  const z=layers[li],incoming=byZ.get(z)!;
  for(const i of incoming)active[i]=1;
  const volumeMm3=incoming.length*gridVol;
  const scanSeconds=volumeMm3/(input.hatchSpacingMm*input.layerThicknessMm*input.scanSpeedMmS);
  // Assign nominal recoating dwell to each coarse slab in proportion to its
  // represented geometry height; this is not a slicer or scan path.
  const previousZ=li===0?box.min.z:box.min.z+(layers[li-1]+1)*h;
  const currentZ=Math.min(box.max.z,box.min.z+(z+1)*h);
  const layerSpan=Math.max(0,currentZ-previousZ);
  const recoating=li===layers.length-1?
   nominalLayers*input.recoatSecondsPerLayer-
    Math.round((previousZ-box.min.z)/Math.max(size.z,1e-9)*nominalLayers)*input.recoatSecondsPerLayer:
   Math.round(layerSpan/Math.max(size.z,1e-9)*nominalLayers)*input.recoatSecondsPerLayer;
  const depositedPower=input.absorbedFraction*input.laserPowerW;
  let remainingScan=scanSeconds,remainingDwell=Math.max(0,recoating),peakThisSlab=-Infinity;
  while(remainingScan>1e-10||remainingDwell>1e-10){
   const scanning=remainingScan>1e-10;
   const dt=Math.min(maxDt,scanning?remainingScan:remainingDwell);
   if(!(dt>0))break;
   if(scanning){
    const heat=depositedPower*dt;
    for(const i of incoming)t[i]+=heat/(capJ*incoming.length);
    absorbed+=heat;
   }
   const losses=transientHeatStep({
    cells,temp:t,active,neighbors,zBase,cellSizeM:hM,dt,input
   });
   plateLoss+=losses.plateEnergyJ;convLoss+=losses.convectiveEnergyJ;
   for(const i of incoming)peakThisSlab=Math.max(peakThisSlab,t[i]);
   elapsed+=dt;timeSteps++;
   if(timeSteps>120500)throw Error("Transient worker exceeded safe iteration count.");
   if(scanning)remainingScan=Math.max(0,remainingScan-dt);
   else remainingDwell=Math.max(0,remainingDwell-dt);
  }
  let min=Infinity,max=-Infinity,sum=0,number=0;
  for(let i=0;i<t.length;i++)if(active[i]){
   number++;const v=t[i];if(!Number.isFinite(v))throw Error("Non-finite computed temperature: no output published.");
   min=Math.min(min,v);max=Math.max(max,v);sum+=v;
  }
  maxSeen=Math.max(maxSeen,max,peakThisSlab);
  // Each thermal slab is a *new geometry layer*, not an individual melt-pool
  // time step; every snapshot is a completed coarse virtual slab.
  const fullValues=projectVoxelValues(mesh,Array.from(t));
  frames.push({fraction:Math.min(1,(currentZ-box.min.z)/size.z),zMm:currentZ-box.min.z,timeSeconds:elapsed,
   minC:min,maxC:max,meanC:sum/number,aboveSolidus:peakThisSlab>=input.solidusC||max>=input.solidusC,
   field:{values:fullValues,min,max,units:"degC"}});
  onProgress?.(li+1,layers.length);
 }
 const stored=Array.from(t,(v,i)=>active[i]?(v-input.ambientTemperatureC)*capJ:0).reduce((a,b)=>a+b,0);
 // The plate reservoir supplies or removes energy; negative "loss" is valid
 // and indicates preheating of the model by the plate.
 const imbalance=Math.abs(absorbed-plateLoss-convLoss-stored)/Math.max(absorbed+Math.abs(plateLoss),1e-9);
 if(imbalance>1e-4)throw Error("Thermal energy accounting failed; calculation withheld.");
 return {engine:LPBF_MODEL_VERSION,inputs:{...input},
  mesh:{cells:cells.length,cellSizeMm:h,virtualSlabs:layers.length,nominalLayers,voxelVolumeMm3:representedVolume},
  frames,summary:{elapsedSeconds:elapsed,absorbedEnergyJ:absorbed,storedEnergyJ:stored,
   plateEnergyJ:plateLoss,convectiveEnergyJ:convLoss,relativeEnergyImbalance:imbalance,
   peakSolidTemperatureC:maxSeen,exceedsSolidus:maxSeen>=input.solidusC,timeSteps},
  limitations:[
   "Unvalidated solid-state heat diffusion prototype. No phase change, powder-bed conduction, melt-pool hydrodynamics or temperature-dependent material properties.",
   "Laser energy is spatially distributed uniformly over each occupied coarse voxel slab, not a moving beam or actual scan strategy.",
   "Thermal voxels aggregate many physical printed layers. Time evolution is approximate; nominal layer count and hatch spacing only determine assumed scanning/recoating duration.",
   "A temperature at or above the supplied solidus is OUTSIDE this solver's solid-state validity and must not be reported as a calibrated melt-pool prediction.",
   "Straight fixed-conductivity conduction, idealized plate contact, ambient convection and simplified closed-manifold geometry; supports, radiation and physical powder are not represented.",
   "Energy balance and stability limit are numerical verification checks only; no AM Bench or physical print validation has been performed.",
   "Does not predict porosity, cracking, residual stress, distortion, build certification or first-time yield."
  ]};
}
