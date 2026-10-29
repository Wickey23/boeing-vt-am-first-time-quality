/**
 * Unvalidated LPBF moving-source / phase-change research prototype.
 *
 * Raster paths are generated across the bounding rectangle of each coarse
 * activated voxel slab, not imported machine G-code or true sliced tracks.
 * An enthalpy method with a constant mushy-zone latent heat models a
 * simplified equilibrium phase transition. No powder or melt-pool fluid flow.
 */
import {voxelizePart,projectVoxelValues} from "./voxel-thermal";
import {nominalLayerMap} from "./lpbf-layer-mapping";
import {validateScanPlan,positionOnScanSegment,type ScanPlan,type ScanSegment} from "./lpbf-scan-plan";
import {
 LPBF_DEMO_INPUTS,validateLpbfInputs,type LpbfInputs,type LpbfResult,type LpbfFrame,type LpbfProbePoint,type LpbfProbeSample
} from "./lpbf-transient";
export const MOVING_SOURCE_VERSION="lpbf-raster-enthalpy-0.1";
export type MovingInputs=LpbfInputs&{
 beamRadiusMm:number;liquidusC:number;latentHeatJKg:number;
};
export const MOVING_DEMO_INPUTS:MovingInputs={
 ...LPBF_DEMO_INPUTS,hatchSpacingMm:.5,layerThicknessMm:.2,recoatSecondsPerLayer:0,resolution:6,beamRadiusMm:.08,liquidusC:1660,latentHeatJKg:290000
};
const dirs:[[number,number,number],[number,number,number],[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[
 [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export function validateMovingInputs(input:MovingInputs){
 validateLpbfInputs(input);
 if(!Number.isFinite(input.beamRadiusMm)||input.beamRadiusMm<.02||input.beamRadiusMm>3)
  throw Error("Beam radius must be between 0.02 and 3 mm.");
 if(!Number.isFinite(input.liquidusC)||input.liquidusC<=input.solidusC||input.liquidusC>3500)
  throw Error("Liquidus must exceed solidus and be at most 3500 °C.");
 if(!Number.isFinite(input.latentHeatJKg)||input.latentHeatJKg<0||input.latentHeatJKg>1.5e6)
  throw Error("Latent heat must be 0–1,500,000 J/kg.");
}
export function specificEnthalpy(t:number,input:MovingInputs){
 const cp=input.specificHeatJKgK,base=input.ambientTemperatureC;
 const phase=Math.max(0,Math.min(1,(t-input.solidusC)/(input.liquidusC-input.solidusC)));
 return cp*(t-base)+phase*input.latentHeatJKg;
}
export function temperatureFromEnthalpy(energy:number,input:MovingInputs){
 const cp=input.specificHeatJKgK;
 const solid=cp*(input.solidusC-input.ambientTemperatureC);
 const liquid=cp*(input.liquidusC-input.ambientTemperatureC)+input.latentHeatJKg;
 if(energy<=solid)return input.ambientTemperatureC+energy/cp;
 if(energy<liquid)return input.solidusC+(energy-solid)/
  (cp+input.latentHeatJKg/(input.liquidusC-input.solidusC));
 return input.liquidusC+(energy-liquid)/cp;
}
/** A demonstrative serpentine source, repeating the bounding-box raster.
 * The path does not discriminate between part and empty powder travel. */
export function rasterPosition(distanceMm:number,ext:{minX:number;maxX:number;minY:number;maxY:number},hatchMm:number){
 const width=ext.maxX-ext.minX,height=ext.maxY-ext.minY;
 if(!(width>0&&height>0&&hatchMm>0))throw Error("Invalid raster bounds.");
 const n=Math.max(1,Math.ceil(height/hatchMm)),length=n*width;
 const offset=((distanceMm%length)+length)%length;
 const row=Math.min(n-1,Math.floor(offset/width)),fraction=(offset-row*width)/width;
 return {x:ext.minX+(row%2===0?fraction:1-fraction)*width,
  y:ext.minY+(row+.5)/n*height,row};
}
export function gaussianWeights(
 positions:Array<{x:number;y:number}>,x:number,y:number,radiusMm:number
){
 if(!(radiusMm>0))throw Error("Invalid Gaussian radius.");
 const raw=positions.map(p=>Math.exp(-2*((p.x-x)**2+(p.y-y)**2)/(radiusMm**2)));
 const sum=raw.reduce((a,b)=>a+b,0);
 return sum>1e-16?raw.map(w=>w/sum):raw.map(()=>0);
}
type Voxel=[number,number,number];
/** Explicit finite-volume step in J/cell, including reversible latent heat.
 * heatJ is already spatially distributed and energy-normalized. */
export function movingEnthalpyStep(args:{
 cells:Voxel[];neighbors:Int32Array[];active:Uint8Array;
 energy:Float64Array;heatJ:Float64Array;zBase:number;hM:number;dt:number;input:MovingInputs;
}){
 const {cells,neighbors,active,energy,heatJ,zBase,hM,dt,input}=args;
 const capacity=input.densityKgM3*hM**3;
 const temp=Float64Array.from(energy,e=>temperatureFromEnthalpy(e/capacity,input));
 const changes=new Float64Array(energy.length);
 let convection=0,plate=0,laser=0;
 const conductance=input.conductivityWmK*hM;
 const convCoeff=input.convectionWm2K*hM*hM;
 for(let i=0;i<energy.length;i++)if(active[i]){
  let q=0;
  for(let d=0;d<6;d++){
   const j=neighbors[i][d];
   if(j>=0&&active[j])q+=conductance*(temp[j]-temp[i]);
   else{
    const lost=convCoeff*(temp[i]-input.ambientTemperatureC);
    convection+=lost*dt;q-=lost;
   }
  }
  if(cells[i][2]===zBase){
   const lost=2*conductance*(temp[i]-input.plateTemperatureC);
   plate+=lost*dt;q-=lost;
  }
  changes[i]=q*dt+heatJ[i];
  laser+=heatJ[i];
 }
 for(let i=0;i<energy.length;i++)if(active[i]){
  energy[i]+=changes[i];
  if(!Number.isFinite(energy[i]))throw Error("Non-finite enthalpy; result withheld.");
 }
 return {absorbedEnergyJ:laser,plateEnergyJ:plate,convectiveEnergyJ:convection};
}
/** Moving Gaussian laser raster with a simplified enthalpy response.
 * Exposed in UI as a bounded, unvalidated engineering-research calculation. */
export function simulateMovingSource(
 buffer:ArrayBuffer,unitScale:number,input:MovingInputs,
 onProgress?:(done:number,total:number)=>void,scanPlan?:ScanPlan,stepScale=1,probePoint?:LpbfProbePoint
):LpbfResult{
 validateMovingInputs(input);
 if(!Number.isFinite(stepScale)||stepScale<.25||stepScale>1)throw Error("Numerical time-step scaling must be 0.25–1.");
 if(!Number.isFinite(unitScale)||unitScale<.001||unitScale>1000)
  throw Error("Invalid STL physical unit scale.");
 if(buffer.byteLength>2*1024*1024)
  throw Error("Moving-source research model limited to 2 MB STL files.");
 const mesh=voxelizePart(buffer,{x:0,y:0,z:0},unitScale,input.resolution);
 const {cells,h,box}=mesh;
 if(mesh.vertices.length/3>6000||cells.length>5000)
  throw Error("Moving-source research mesh too large. Simplify the manifold STL.");
 const zBase=Math.min(...cells.map(c=>c[2]));
 const layers=[...new Set(cells.map(c=>c[2]))].sort((a,b)=>a-b);
 if(layers.length<2)throw Error("At least two active voxel-height layers required.");
 const lookup=new Map(cells.map((c,i)=>[c.join(","),i]));
 const neighbors=cells.map(([x,y,z])=>Int32Array.from(dirs.map(([dx,dy,dz])=>
  lookup.get([x+dx,y+dy,z+dz].join(","))??-1)));
 const reached=new Set<number>(),queue:number[]=[];
 cells.forEach((c,i)=>{if(c[2]===zBase){reached.add(i);queue.push(i);}});
 while(queue.length){for(const j of neighbors[queue.pop()!])if(j>=0&&!reached.has(j)){reached.add(j);queue.push(j);}}
 if(reached.size!==cells.length)throw Error("Disconnected solid region: unsupported cells cannot be thermally modeled.");
 const byZ=new Map<number,number[]>();
 cells.forEach((c,i)=>{const list=byZ.get(c[2])??[];list.push(i);byZ.set(c[2],list);});
 const extent={minX:box.min.x,maxX:box.max.x,minY:box.min.y,maxY:box.max.y};
 const zSpan=box.max.z-box.min.z;
 const mapping=nominalLayerMap({buildHeightMm:zSpan,physicalLayerThicknessMm:input.layerThicknessMm,virtualCellHeightMm:h,occupiedZIndices:layers});
 const checkedScan=scanPlan?validateScanPlan(scanPlan,layers.length,extent):null;
 if(scanPlan&&!/^[a-f0-9]{64}$/.test(scanPlan.sha256))throw Error("Imported scan CSV requires a valid content SHA-256.");
 const nominalLayers=Math.ceil(zSpan/input.layerThicknessMm);
 const cellM=h/1000,volMm3=h**3;
 const capacity=input.densityKgM3*cellM**3;
 // Conservative combined conduction and convection explicit stability cap.
 const thermalDiff=input.conductivityWmK/(input.densityKgM3*input.specificHeatJKgK);
 const dtThermal=.35/(6*thermalDiff/cellM**2+
  6*input.convectionWm2K/(input.densityKgM3*input.specificHeatJKgK*cellM));
 const fastest=scanPlan?Math.max(...scanPlan.segments.map(seg=>seg.speedMmS)):input.scanSpeedMmS;
 const dtMotion=(h/2)/fastest; // source moves < half a voxel per step
 const maxDt=Math.min(dtThermal,dtMotion)*stepScale;
 if(!(maxDt>0&&Number.isFinite(maxDt)))throw Error("Invalid explicit time step.");
 const scanTime=checkedScan?checkedScan.totalSeconds:
  cells.length*volMm3/(input.hatchSpacingMm*input.layerThicknessMm*input.scanSpeedMmS);
 const totalRecoating=nominalLayers*input.recoatSecondsPerLayer;
 const estimatedSteps=Math.ceil((scanTime+totalRecoating)/maxDt)+2*layers.length;
 if(estimatedSteps>130000||scanTime+totalRecoating>14400)
  throw Error("Scan-path research calculation exceeds 130,000 time steps / four hours. Reduce part size, increase hatch/layer thickness, lower resolution or use external compute.");
 const active=new Uint8Array(cells.length),energy=new Float64Array(cells.length);
 const heatJ=new Float64Array(cells.length);
 const frames:LpbfFrame[]=[];
 let absorbed=0,plate=0,conv=0,elapsed=0,steps=0,peak=-Infinity,maxLiquid=0;
 let accumulatedRecoating=0;
 const effectiveRadius=Math.max(input.beamRadiusMm,h/2);
 const probeCell=(()=>{
  if(!probePoint)return -1;
  if(Object.values(probePoint).some(v=>!Number.isFinite(v)||Math.abs(v)>100000))
   throw Error("Thermal probe point must have finite STL-aligned millimeter coordinates.");
  let chosen=-1,nearest=Infinity;
  for(let i=0;i<cells.length;i++){
   const c=cells[i];
   const distance=Math.hypot(
    box.min.x+(c[0]+.5)*h-probePoint.xMm,
    box.min.y+(c[1]+.5)*h-probePoint.yMm,
    box.min.z+(c[2]+.5)*h-probePoint.zMm
   );
   if(distance<nearest){chosen=i;nearest=distance;}
  }
  if(chosen<0||nearest>h*.9)
   throw Error("Requested temperature probe is not within 0.9 voxel widths of modeled solid. Review STL millimeters and internal voxel resolution.");
  return chosen;
 })();
 const probeCenter=probeCell<0?undefined:{
  xMm:box.min.x+(cells[probeCell][0]+.5)*h,
  yMm:box.min.y+(cells[probeCell][1]+.5)*h,
  zMm:box.min.z+(cells[probeCell][2]+.5)*h
 };
 const probeSamples:LpbfProbeSample[]=[];
 const probeStride=Math.max(1,Math.ceil(estimatedSteps/1600));
 let probeActivation=-1,observedProbePeak=-Infinity,probeSteps=0;
 let laserPowerAtStep=0,laserWasOn=false;
 const readProbe=(slab:number,forced=false)=>{
  if(probeCell<0||!active[probeCell])return;
  const pointTemp=temperatureFromEnthalpy(energy[probeCell]/capacity,input);
  if(!Number.isFinite(pointTemp))throw Error("Nonfinite thermal probe reading.");
  observedProbePeak=Math.max(observedProbePeak,pointTemp);
  probeSteps++;
  if(!forced&&steps%probeStride!==0)return;
  const sample:LpbfProbeSample={timeSeconds:elapsed,temperatureC:pointTemp,
   virtualSlab:slab,laserPowerW:laserPowerAtStep,laserActive:laserWasOn};
  const previous=probeSamples.at(-1);
  if(previous&&Math.abs(previous.timeSeconds-elapsed)<1e-11)probeSamples[probeSamples.length-1]=sample;
  else probeSamples.push(sample);
  if(probeSamples.length>2050)throw Error("Thermal probe exceeded sampling cap; no history published.");
 };
 const notes=[
  scanPlan?"Imported, content-hashed numerical CSV coordinates; the actual machine file, scan calibration, layer mapping and measured timing are not verified.":"Unvalidated raster research model: invented serpentine bounding-box tracks, not a real slicer, measured laser path or qualified scan strategy.",
  "Gaussian beam is discretized at voxel scale; effective numerical radius is the larger of beam radius and half a voxel. Typical physical LPBF beam spots are not resolved by this coarse browser grid.",
  "Latent heat is represented by a linear equilibrium solidus–liquidus enthalpy interval, with constant solid properties. No powder conduction, evaporation, fluid convection, fluid flow, recoil pressure or keyhole physics.",
  "A computed liquid fraction is a mathematical equilibrium indicator, not a validated melt-pool size, porosity mechanism or printability decision.",
  scanPlan?"Imported tracks are mapped to coarse virtual slabs, not validated physical printed layers; machine delays, laser-off timing other than explicit zero-power segments, recoater interference and inactive powder are not represented.":"Raster repeats on each activated virtual slab to approximate aggregated physical layers; turnaround timing, scan islands, recoater interference and inactive powder are not represented.",
  "Plate is a fixed-temperature idealized reservoir. Radiation and thermal expansion/residual-stress coupling are omitted.",
  "Numerical energy conservation does not equal mesh convergence or validation against AM Bench measurements.",
  "Does not predict part failure, cracking, residual stress, distortion, porosity, fatigue performance or first-time acceptance."
 ];
 for(let k=0;k<layers.length;k++){
  const z=layers[k],newCells=byZ.get(z)!;
  for(const i of newCells)active[i]=1; // initial cell energy=0 at ambient
  if(probeCell>=0&&active[probeCell]&&probeActivation<0){probeActivation=elapsed;laserPowerAtStep=0;laserWasOn=false;readProbe(k,true);}
  const currentZ=Math.min(box.max.z,box.min.z+(z+1)*h);
  const previousZ=k?Math.min(box.max.z,box.min.z+(layers[k-1]+1)*h):box.min.z;
  const span=Math.max(0,currentZ-previousZ);
  const recoatedTotal=k===layers.length-1?totalRecoating:
   Math.round((currentZ-box.min.z)/zSpan*nominalLayers)*input.recoatSecondsPerLayer;
  const dwell=Math.max(0,recoatedTotal-accumulatedRecoating);accumulatedRecoating+=dwell;
  const explicitSegments=checkedScan?.bySlab[k];
  const durations=explicitSegments?.map(seg=>Math.hypot(seg.x1Mm-seg.x0Mm,seg.y1Mm-seg.y0Mm)/seg.speedMmS);
  const duration=durations?durations.reduce((sum,dt)=>sum+dt,0):
   newCells.length*volMm3/(input.hatchSpacingMm*input.layerThicknessMm*input.scanSpeedMmS);
  const positions=newCells.map(i=>({x:box.min.x+(cells[i][0]+.5)*h,
   y:box.min.y+(cells[i][1]+.5)*h}));
  let inScan=0,remainingDwell=dwell,scanIndex=0,segmentElapsed=0;
  while(inScan<duration-1e-12||remainingDwell>1e-12){
   const laserOn=inScan<duration-1e-12;
   const dt=Math.min(maxDt,laserOn?(durations?Math.min(duration-inScan,durations[scanIndex]-segmentElapsed):duration-inScan):remainingDwell);
   if(!(dt>0))break;
   heatJ.fill(0);
   laserPowerAtStep=0;laserWasOn=false;
   if(laserOn){
    const segment=explicitSegments?.[scanIndex];
    const point=segment&&durations?positionOnScanSegment(segment,
     (segmentElapsed+dt/2)/durations[scanIndex]):
     rasterPosition((inScan+dt/2)*input.scanSpeedMmS,extent,input.hatchSpacingMm);
    const powerW=segment?segment.powerW:input.laserPowerW;
    laserPowerAtStep=powerW;laserWasOn=powerW>0;
    if(powerW>0){
     // Reject a powered beam over unmodeled powder/empty space rather than
     // silently renormalizing its energy into distant solid voxels.
     const distanceToSolid=Math.min(...positions.map(p=>Math.hypot(p.x-point.x,p.y-point.y)));
     if(distanceToSolid>Math.max(h*1.5,input.beamRadiusMm*2))
      throw Error("Laser-on scan path does not intersect active solid geometry. No powder-bed energy model is available.");
     const weights=gaussianWeights(positions,point.x,point.y,effectiveRadius);
     for(let p=0;p<newCells.length;p++)heatJ[newCells[p]]=weights[p]*powerW*input.absorbedFraction*dt;
    }
   }
   const exchange=movingEnthalpyStep({
    cells,neighbors,active,energy,heatJ,zBase,hM:cellM,dt,input
   });
   absorbed+=exchange.absorbedEnergyJ;
   plate+=exchange.plateEnergyJ;conv+=exchange.convectiveEnergyJ;
   elapsed+=dt;steps++;
   readProbe(k);
   if(steps>130100)throw Error("Moving-source worker iteration cap exceeded.");
   if(laserOn){
    inScan+=dt;
    if(durations){
     segmentElapsed+=dt;
     if(segmentElapsed>=durations[scanIndex]-1e-12){scanIndex++;segmentElapsed=0;}
    }
   }else remainingDwell=Math.max(0,remainingDwell-dt);
   // Track within-slab temperature peaks (snapshots alone miss laser pulses).
   for(const i of newCells){
    const H=energy[i]/capacity,T=temperatureFromEnthalpy(H,input);
    peak=Math.max(peak,T);
    maxLiquid=Math.max(maxLiquid,Math.max(0,Math.min(1,
     (T-input.solidusC)/(input.liquidusC-input.solidusC))));
   }
  }
  let min=Infinity,max=-Infinity,sum=0,count=0;
  const temps=Array.from(energy,(e,i)=>active[i]?temperatureFromEnthalpy(e/capacity,input):input.ambientTemperatureC);
  for(let i=0;i<energy.length;i++)if(active[i]){
   const t=temps[i];
   if(!Number.isFinite(t))throw Error("Non-finite thermal temperature; output discarded.");
   min=Math.min(min,t);max=Math.max(max,t);sum+=t;count++;
  }
  peak=Math.max(peak,max);
  readProbe(k,true);
  const projected=projectVoxelValues(mesh,temps);
  frames.push({fraction:Math.min(1,(currentZ-box.min.z)/zSpan),
   zMm:currentZ-box.min.z,timeSeconds:elapsed,
   minC:min,maxC:max,meanC:sum/count,
   aboveSolidus:peak>=input.solidusC,
   field:{values:projected,min,max,units:"degC"}});
  onProgress?.(k+1,layers.length);
 }
 const stored=energy.reduce((sum,e,i)=>sum+(active[i]?e:0),0);
 const relative=Math.abs(absorbed-plate-conv-stored)/
  Math.max(1e-9,Math.abs(absorbed)+Math.abs(plate));
 if(!Number.isFinite(relative)||relative>1e-4)
  throw Error("Enthalpy energy accounting failed: no result published.");
 const summary: LpbfResult["summary"]={
  elapsedSeconds:elapsed,absorbedEnergyJ:absorbed,storedEnergyJ:stored,
  plateEnergyJ:plate,convectiveEnergyJ:conv,
  relativeEnergyImbalance:relative,peakSolidTemperatureC:peak,
  exceedsSolidus:peak>=input.solidusC,timeSteps:steps
 };
 return {engine:scanPlan?"lpbf-imported-enthalpy-0.1":MOVING_SOURCE_VERSION,inputs:{...input},
  layerMapping:mapping,
  probe:probePoint&&probeCenter?{
   model:"INTERNAL_THERMAL_VOXEL_PROBE_UNVALIDATED",requestedMm:{...probePoint},sampledVoxelCenterMm:probeCenter,
   registrationOffsetMm:Math.hypot(probePoint.xMm-probeCenter.xMm,probePoint.yMm-probeCenter.yMm,probePoint.zMm-probeCenter.zMm),
   voxelWidthMm:h,voxelActivationTimeSeconds:probeActivation,
   samplingStrideSteps:probeStride,actualStepsObserved:probeSteps,sampledPoints:probeSamples,
   observedStepPeakC:observedProbePeak,
   sampledPeakC:Math.max(...probeSamples.map(x=>x.temperatureC)),
   maximumSampleGapSeconds:Math.max(0,...probeSamples.slice(1).map((x,i)=>x.timeSeconds-probeSamples[i].timeSeconds)),
   limitations:[
    "The probe is the *nearest active volume voxel center*, not a surface thermography pixel or physical thermocouple.",
    "Samples are decimated from explicit solver timesteps; even exact per-step peak is limited by unresolved beam spot and virtual-slab deposition.",
    "The physical-layer count is geometric only; an aggregated virtual slab is not an executed machine layer or measured scan trajectory.",
    "No native NIST TAM/SCR benchmark comparison, clock calibration, measured uncertainty, or validated defect prediction."
   ]
  }:undefined,
  scanPlan:scanPlan?{sourceName:scanPlan.sourceName,sha256:scanPlan.sha256,segmentCount:scanPlan.segments.length,version:scanPlan.version}:undefined,
  numerics:{stepScale,maxDtSeconds:maxDt},
  mesh:{cells:cells.length,cellSizeMm:h,virtualSlabs:layers.length,
   nominalLayers,voxelVolumeMm3:cells.length*volMm3},
  frames,summary,
  limitations:[
   ...notes,
   "Computed maximum equilibrium liquid fraction (unvalidated, not a measured melt fraction): "+maxLiquid.toFixed(3),
   "Beam radius / voxel width: "+(input.beamRadiusMm/h).toFixed(4)+
    " — underresolved if below 1; the numerical Gaussian is broadened to half a voxel."
  ]
 };
}
