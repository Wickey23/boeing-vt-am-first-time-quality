/**
 * Separate physical-layer chronology-driven 1-D enthalpy column.
 * An educational, layer-AVERAGED through-height model, not an LPBF melt-pool
 * solver. It does not resolve XY beam motion, powder, laser spot, defects or
 * mechanical stress. Never overlay its stack temperatures on an STL as a
 * 3-D field. No change to preexisting voxel heat-flow models.
 */
import {voxelizePart} from "./voxel-thermal";
import {auditPhysicalScanPlan,type PhysicalScanPlan,type PhysicalScanAudit} from "./lpbf-physical-schedule";
import {validateMovingInputs,specificEnthalpy,temperatureFromEnthalpy,type MovingInputs} from "./lpbf-moving-source";
export const PHYSICAL_STACK_VERSION="lpbf-physical-stack-1d-enthalpy-0.1";
export type PhysicalStackRecord={
 layer:number;zMm:number;timeSeconds:number;
 averageLayerTemperatureC:number;surfaceTemperatureC:number;
 maximumActiveTemperatureC:number;commandedPowerW:number;laserOn:boolean;
};
export type PhysicalStackResult={
 engine:typeof PHYSICAL_STACK_VERSION;
 validationStatus:"UNVALIDATED_LAYER_AVERAGED_1D";
 partSha256:string;sourceSha256:string;
 inputs:MovingInputs;
 geometry:{physicalLayers:number;layerThicknessMm:number;voxelResolution:number;crossSectionAreaMm2:number;crossSectionSpreadFraction:number;areaModel:string};
 time:{elapsedSeconds:number;integrationSteps:number;maxDtSeconds:number};
 energy:{commandedLaserJ:number;absorbedJ:number;plateExchangeJ:number;convectionExchangeJ:number;storedJ:number;relativeImbalance:number};
 temperature:{peakC:number;finalTopC:number;finalMeanC:number};
 records:PhysicalStackRecord[];
 layerPeaksC:number[];
 audit:Pick<PhysicalScanAudit,"suppliedLayerCount"|"maxAbsoluteLayerZResidualMm"|"totalCommandedLaserEnergyJ"|"sourceSha256">;
 limitations:string[];
};
export function simulatePhysicalLayerStack(args:{
 part:ArrayBuffer;partSha256:string;unitScale:number;
 plan:PhysicalScanPlan;sourceSha256:string;
 inputs:MovingInputs;onProgress?:(done:number,total:number)=>void;
}):PhysicalStackResult{
 const {part,partSha256,unitScale,plan,sourceSha256,inputs,onProgress}=args;
 validateMovingInputs(inputs);
 if(!Number.isFinite(unitScale)||unitScale<.001||unitScale>1000||
    part.byteLength>2*1024*1024||!/^[a-f0-9]{64}$/.test(partSha256)||
    !/^[a-f0-9]{64}$/.test(sourceSha256))throw Error("Invalid part scale, size or source SHA-256.");
 const grid=voxelizePart(part,{x:0,y:0,z:0},unitScale,inputs.resolution);
 if(grid.cells.length>5000||grid.vertices.length>6000)
  throw Error("Physical stack study exceeds the bounded STL geometry size.");
 const {box,h,cells}=grid,height=box.max.z-box.min.z;
 const layersZ=[...new Set(cells.map(x=>x[2]))].sort((a,b)=>a-b);
 const audit=auditPhysicalScanPlan(plan,{
  sourceSha256,partSha256,physicalLayerThicknessMm:inputs.layerThicknessMm,
  thermalVoxelWidthMm:h,occupiedVoxelZIndices:layersZ,
  geometry:{minX:box.min.x,maxX:box.max.x,minY:box.min.y,maxY:box.max.y,minZ:box.min.z,maxZ:box.max.z}
 });
 const n=audit.physicalLayerCountFromGeometry,t=inputs.layerThicknessMm;
 if(n<2||n>200)throw Error("1-D stack solver supports 2–200 physical layers, not this part/layer setting.");
 if(audit.firstLayer!==0||audit.lastLayer!==n-1||
  audit.suppliedLayerCount!==n||audit.missingIntermediateLayerIndices.length||
  audit.unrepresentedLayers.length)
  throw Error("1-D stack solver requires all physical layers 0 through final, with no missing or unmapped layers.");
 if(audit.maxAbsoluteLayerZResidualMm>Math.max(.02,t*.1))
  throw Error("Physical layer Z positions are not registered to the STL bottom; no temperature calculation performed.");
 if(plan.commands.length>3000)throw Error("Too many physical scan commands.");
 const areaByVoxel=new Map<number,number>();
 for(const c of cells)areaByVoxel.set(c[2],(areaByVoxel.get(c[2])??0)+h*h);
 const areas=Array.from({length:n},(_,i)=>{
  const center=Math.min(height-1e-9,(i+.5)*t);
  const z=Math.floor(center/h);
  const area=areaByVoxel.get(z)??0;
  if(!(area>0))throw Error("Nominal physical layer has no represented cross section.");
  return area*1e-6;
 });
 const minArea=Math.min(...areas),maxArea=Math.max(...areas),meanArea=areas.reduce((x,y)=>x+y,0)/n;
 const spread=(maxArea-minArea)/meanArea;
 // 1-D assumption: an approximately uniform cross section, no powder-side heat.
 if(spread>.2)
  throw Error("Layer cross-section changes by >20%; the 1-D prismatic-column model is not appropriate for this STL.");
 const dz=t/1000,cp=inputs.specificHeatJKgK,rho=inputs.densityKgM3,k=inputs.conductivityWmK;
 const capacity=areas.map(a=>rho*a*dz);
 const dtConduction=.2*rho*cp*dz*dz/(2*k);
 const dtBoundary=.2*(rho*cp*dz)/(2*k/dz+inputs.convectionWm2K);
 const maxDt=Math.min(dtConduction,dtBoundary);
 if(!(maxDt>0&&Number.isFinite(maxDt)))throw Error("Invalid stable layer time-step.");
 const totalSteps=plan.commands.reduce((sum,c)=>sum+Math.ceil((c.t1Seconds-c.t0Seconds)/maxDt),0);
 if(totalSteps>160000)
  throw Error("Physical scan timeline would exceed 160,000 integration steps; external/optimized compute required.");
 const energy=new Float64Array(n),active=new Uint8Array(n);
 const peaks=new Float64Array(n).fill(inputs.ambientTemperatureC);
 const records:PhysicalStackRecord[]=[];
 let laserEnergy=0,plateExchange=0,convExchange=0,elapsed=0,peak=inputs.ambientTemperatureC,steps=0,currentLayer=-1;
 for(let ix=0;ix<plan.commands.length;ix++){
  const c=plan.commands[ix];
  if(c.layer!==currentLayer){
   if(c.layer!==currentLayer+1)throw Error("Nonsequential physical-layer activation blocked.");
   currentLayer=c.layer;active[currentLayer]=1; // whole layer at ambient, no powder/partial-volume model
  }
  const duration=c.t1Seconds-c.t0Seconds,substeps=Math.ceil(duration/maxDt),dt=duration/substeps;
  for(let step=0;step<substeps;step++){
   const temperature=Float64Array.from(energy,(e,i)=>active[i]?
    temperatureFromEnthalpy(e/capacity[i],inputs):inputs.ambientTemperatureC);
   const changes=new Float64Array(n);
   for(let i=0;i<=currentLayer;i++){
    if(i>0){
     const flow=k*Math.min(areas[i],areas[i-1])/dz*(temperature[i-1]-temperature[i])*dt;
     changes[i]+=flow;changes[i-1]-=flow;
    }
   }
   // The substrate is an ideal fixed-T heat reservoir, coupled through half a layer.
   const baseJ=2*k*areas[0]/dz*(temperature[0]-inputs.plateTemperatureC)*dt;
   changes[0]-=baseJ;plateExchange+=baseJ;
   // Only top exposure; XY lateral walls are insulated in this 1-D model.
   const topJ=inputs.convectionWm2K*areas[currentLayer]*
    (temperature[currentLayer]-inputs.ambientTemperatureC)*dt;
   changes[currentLayer]-=topJ;convExchange+=topJ;
   const sourceJ=c.powerW*inputs.absorbedFraction*dt;
   changes[currentLayer]+=sourceJ;laserEnergy+=sourceJ;
   for(let i=0;i<=currentLayer;i++){
    energy[i]+=changes[i];
    if(!Number.isFinite(energy[i]))throw Error("Nonfinite 1-D layer enthalpy; result withheld.");
    const T=temperatureFromEnthalpy(energy[i]/capacity[i],inputs);
    if(!Number.isFinite(T))throw Error("Nonfinite layer temperature.");
    peaks[i]=Math.max(peaks[i],T);peak=Math.max(peak,T);
   }
   elapsed+=dt;steps++;
  }
  const temps=Array.from({length:currentLayer+1},(_,i)=>temperatureFromEnthalpy(energy[i]/capacity[i],inputs));
  records.push({
   layer:c.layer,zMm:c.zMm,timeSeconds:elapsed,
   averageLayerTemperatureC:temps[currentLayer],
   surfaceTemperatureC:temps[currentLayer],
   maximumActiveTemperatureC:Math.max(...temps),
   commandedPowerW:c.powerW,laserOn:c.powerW>0
  });
  onProgress?.(ix+1,plan.commands.length);
 }
 const stored=energy.reduce((a,b)=>a+b,0);
 const residual=Math.abs(laserEnergy-plateExchange-convExchange-stored);
 const relativeImbalance=residual/Math.max(1,Math.abs(laserEnergy)+Math.abs(plateExchange));
 if(!Number.isFinite(relativeImbalance)||relativeImbalance>1e-6)
  throw Error("1-D physical-layer energy conservation failed.");
 if(Math.abs(laserEnergy-audit.totalCommandedLaserEnergyJ*inputs.absorbedFraction)>
  1e-7*Math.max(1,laserEnergy))
  throw Error("Commanded source energy does not reconcile with audit.");
 const finalTemps=Array.from({length:n},(_,i)=>temperatureFromEnthalpy(energy[i]/capacity[i],inputs));
 return {
  engine:PHYSICAL_STACK_VERSION,validationStatus:"UNVALIDATED_LAYER_AVERAGED_1D",
  partSha256,sourceSha256,inputs:{...inputs},
  geometry:{physicalLayers:n,layerThicknessMm:t,voxelResolution:inputs.resolution,
   crossSectionAreaMm2:meanArea*1e6,crossSectionSpreadFraction:spread,
   areaModel:"Approximated from coarse occupied STL voxel slices; constant area assumed within each physical layer"},
  time:{elapsedSeconds:elapsed,integrationSteps:steps,maxDtSeconds:maxDt},
  energy:{commandedLaserJ:audit.totalCommandedLaserEnergyJ,absorbedJ:laserEnergy,
   plateExchangeJ:plateExchange,convectionExchangeJ:convExchange,storedJ:stored,
   relativeImbalance},
  temperature:{peakC:peak,finalTopC:finalTemps[n-1],
   finalMeanC:finalTemps.reduce((a,b)=>a+b,0)/n},
  records,layerPeaksC:Array.from(peaks),
  audit:{suppliedLayerCount:audit.suppliedLayerCount,
   maxAbsoluteLayerZResidualMm:audit.maxAbsoluteLayerZResidualMm,
   totalCommandedLaserEnergyJ:audit.totalCommandedLaserEnergyJ,sourceSha256},
  limitations:[
   "1-D through-height, cross-section-averaged research model. Commanded XY motion only determines when the laser is on; its XY position and beam radius DO NOT drive local heating.",
   "Each physical layer activates in full at the start of its first command, initially at ambient temperature. No powder layer, powder thermal conductivity, actual localized solidification, partial-volume deposition, surface scanning physics or lateral conduction is represented.",
   "Constant Cp, density, conductivity and equilibrium latent-heat interval. No temperature-dependent properties, radiation, convection through sidewalls, fluid flow, vaporization or thermomechanical stress.",
   "Laser energy is uniformly placed into the entire current physical layer at an engineer-supplied effective solid coupling fraction; even correct energy conservation cannot prove the resulting temperature is realistic.",
   "Fixed-temperature ideal plate, convection only at the current top surface, and stair-step voxel-derived cross-section. Approximate prismatic geometry only.",
   "This result cannot produce NIST local TAM/SCR or predict porosity, cracks, residual stress, melt-pool dimensions, fatigue performance, first-time quality or part acceptance.",
   "The original 3-D coarse voxel thermal result remains independent; no comparison of peak temperatures can establish model accuracy."
  ]
 };
}
