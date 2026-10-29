/**
 * Experimental physical-layer XY/height finite-volume thermal model.
 *
 * This is an independent numerical research model, NOT an LPBF melt pool or
 * porosity predictor. Cells represent an engineer-provided, uniformly pitched
 * layer-aligned grid; do not interpret them as a validated STL slice.
 * Powder is laid down at each layer boundary; illuminated powder cells change
 * to "consolidated" numerically. That label is NOT evidence of melting.
 * Effective mass and specific heat remain constant across transitions.
 */
import {PHYSICAL_SCAN_VERSION,type PhysicalScanPlan} from "./lpbf-physical-schedule";

export const PARTIAL_LAYER_VERSION="lpbf-partial-layer-fv-research-0.1";
export type Cell3=[number,number,number];
export type PartialLayerInputs={
 pitchMm:number; layerHeightMm:number;
 originMm:{x:number;y:number;z:number};
 cells:Cell3[];
 partSha256:string;sourceSha256:string;
 scan:PhysicalScanPlan;
 powerCouplingFraction:number;beamRadiusMm:number;
 densityKgM3:number;specificHeatJKgK:number;
 powderConductivityWmK:number;solidConductivityWmK:number;
 convectionWm2K:number;
 ambientTemperatureC:number;plateTemperatureC:number;
};
export type PartialLayerCell={
 x:number;y:number;layer:number;state:"powder"|"consolidated";
 temperatureC:number;peakTemperatureC:number;
};
export type PartialLayerResult={
 engine:typeof PARTIAL_LAYER_VERSION;
 validationStatus:"UNVALIDATED_GRID_RESEARCH";
 partSha256:string;sourceSha256:string;
 grid:{cellCount:number;layers:number;pitchMm:number;layerHeightMm:number};
 chronology:{commands:number;elapsedSeconds:number;timeSteps:number;maxTimeStepSeconds:number};
 energy:{commandedJ:number;absorbedJ:number;plateExchangeJ:number;convectionExchangeJ:number;storedJ:number;relativeImbalance:number};
 layers:Array<{layer:number;timeSeconds:number;activeCells:number;consolidatedCells:number;maximumTemperatureC:number}>;
 finalCells:PartialLayerCell[];
 limitations:string[];
};
const DIRECTIONS:Cell3[]=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
function assertRange(v:number,lo:number,hi:number,label:string){
 if(!Number.isFinite(v)||v<lo||v>hi)throw Error("Invalid "+label+".");
}
function harmonic(a:number,b:number){return 2*a*b/(a+b);}
export function runPartialLayerResearch(input:PartialLayerInputs):PartialLayerResult{
 const {cells,scan,pitchMm:p,layerHeightMm:d,originMm:o}=input;
 if(scan.version!==PHYSICAL_SCAN_VERSION||!Array.isArray(scan.commands)||!scan.commands.length||scan.commands.length>3000)
  throw Error("A nonempty, bounded physical scan chronology is required.");
 if(!/^[a-f0-9]{64}$/.test(input.partSha256)||!/^[a-f0-9]{64}$/.test(input.sourceSha256))
  throw Error("Part and scan source SHA-256 are required.");
 assertRange(p,.04,5,"XY cell pitch");assertRange(d,.01,1,"physical layer height");
 for(const v of [o.x,o.y,o.z])assertRange(v,-100000,100000,"grid origin");
 if(!Array.isArray(cells)||cells.length<2||cells.length>1500)
  throw Error("Research grid requires 2–1,500 cells.");
 assertRange(input.powerCouplingFraction,0,1,"energy coupling");
 assertRange(input.beamRadiusMm,p/2,10,"beam radius relative to grid pitch");
 assertRange(input.densityKgM3,100,30000,"effective density");
 assertRange(input.specificHeatJKgK,50,5000,"heat capacity");
 assertRange(input.powderConductivityWmK,.01,1000,"powder conductivity");
 assertRange(input.solidConductivityWmK,.01,1000,"solid conductivity");
 if(input.powderConductivityWmK>input.solidConductivityWmK)
  throw Error("Powder conductivity cannot exceed consolidated conductivity in this simplified model.");
 assertRange(input.convectionWm2K,0,1000,"convection");
 assertRange(input.ambientTemperatureC,-200,2500,"ambient temperature");
 assertRange(input.plateTemperatureC,-200,2500,"plate temperature");
 const index=new Map<string,number>();
 let maxLayer=0;
 for(let i=0;i<cells.length;i++){
  const c=cells[i];
  if(!Array.isArray(c)||c.length!==3||c.some(v=>!Number.isInteger(v)||v<0||v>150))
   throw Error("Grid cells require bounded nonnegative integer coordinates.");
  const key=c.join(",");
  if(index.has(key))throw Error("Duplicate research grid cell.");
  index.set(key,i);maxLayer=Math.max(maxLayer,c[2]);
 }
 const nLayers=maxLayer+1;
 if(nLayers<2||nLayers>40)throw Error("Research grid supports 2–40 physical layers.");
 const byLayer=Array.from({length:nLayers},()=>[] as number[]);
 cells.forEach((c,i)=>byLayer[c[2]].push(i));
 if(byLayer.some(a=>!a.length))throw Error("Every intermediate physical layer must contain cells.");
 const neighbors=cells.map(c=>DIRECTIONS.map(dir=>index.get([c[0]+dir[0],c[1]+dir[1],c[2]+dir[2]].join(","))??-1));
 const active=new Uint8Array(cells.length),solid=new Uint8Array(cells.length);
 const enthalpy=new Float64Array(cells.length),peak=new Float64Array(cells.length).fill(input.ambientTemperatureC);
 const mass=input.densityKgM3*(p/1000)**2*(d/1000);
 const cp=input.specificHeatJKgK,capacity=mass*cp;
 const xyArea=p*d*1e-6,zArea=p*p*1e-6;
 const hxy=p/1000,hz=d/1000;
 const kMax=input.solidConductivityWmK;
 const maximalG=4*kMax*xyArea/hxy+2*kMax*zArea/hz+
  2*kMax*zArea/(hz/2)+input.convectionWm2K*(4*xyArea+2*zArea);
 const stableDt=.15*capacity/maximalG;
 const motionDt=(p/3)/5000; // tightened below using each commanded speed
 if(!(stableDt>0&&Number.isFinite(stableDt)&&motionDt>0))
  throw Error("Unstable research discretization.");
 let commanded=0,absorbed=0,plate=0,conv=0,steps=0,elapsed=0,previousLayer=-1;
 let expectedNext=0,totalSteps=0;
 const tolerance=1e-6;
 for(const [i,c] of scan.commands.entries()){
  if(![c.layer,c.zMm,c.t0Seconds,c.t1Seconds,c.x0Mm,c.y0Mm,c.x1Mm,c.y1Mm,c.powerW].every(Number.isFinite))
   throw Error("Nonfinite physical scan row.");
  if(!Number.isInteger(c.layer)||c.layer<0||c.layer>=nLayers||c.t0Seconds<0||c.t1Seconds<=c.t0Seconds||
     c.t1Seconds>14400||c.powerW<0||c.powerW>1000)
   throw Error("Invalid physical scan command bounds.");
  if(Math.abs(c.zMm-(o.z+(c.layer+1)*d))>Math.max(1e-5,d*.02))
   throw Error("Physical scan Z is not registered to the layer-aligned grid.");
  if(i===0&&(c.layer!==0||Math.abs(c.t0Seconds)>tolerance))
   throw Error("Physical chronology must start at layer 0 and time zero.");
  const prior=scan.commands[i-1];
  if(prior&&(Math.abs(c.t0Seconds-prior.t1Seconds)>tolerance||
     c.layer<prior.layer||c.layer>prior.layer+1||
     Math.hypot(c.x0Mm-prior.x1Mm,c.y0Mm-prior.y1Mm)>1e-4))
   throw Error("Commands must have continuous times, positions and sequential layers.");
  if(prior&&c.layer!==prior.layer&&c.powerW>0)
   throw Error("Layer transition requires an explicit laser-off command.");
  const duration=c.t1Seconds-c.t0Seconds;
  const speed=Math.hypot(c.x1Mm-c.x0Mm,c.y1Mm-c.y0Mm)/duration;
  if(speed>5000+1e-6)throw Error("Excessive scan speed.");
  const dtLimit=Math.min(stableDt,speed>0?p/(3*speed):stableDt);
  totalSteps+=Math.ceil(duration/dtLimit);
  commanded+=c.powerW*duration;
  if(totalSteps>120000)throw Error("Partial-layer model exceeds 120,000 integration steps.");
  expectedNext=c.layer+1;
 }
 if(expectedNext!==nLayers)throw Error("Scan chronology must reach the final modeled layer.");
 // A conservative connectivity requirement rejects isolated solids and cannot
 // substitute for a full STL topology or build-support assessment.
 const seen=new Set<number>(byLayer[0]),queue=[...byLayer[0]];
 while(queue.length){
  for(const j of neighbors[queue.pop()!])if(j>=0&&!seen.has(j)){seen.add(j);queue.push(j);}
 }
 if(seen.size!==cells.length)throw Error("Disconnected grid component: unsupported layer physics.");
 const snapshots:PartialLayerResult["layers"]=[];
 const conductivity=(i:number)=>solid[i]?input.solidConductivityWmK:input.powderConductivityWmK;
 const temp=(i:number)=>input.ambientTemperatureC+enthalpy[i]/capacity;
 for(const command of scan.commands){
  if(command.layer!==previousLayer){
   previousLayer=command.layer;
   for(const i of byLayer[previousLayer])active[i]=1; // powder deposition, not solid activation
  }
  const duration=command.t1Seconds-command.t0Seconds;
  const speed=Math.hypot(command.x1Mm-command.x0Mm,command.y1Mm-command.y0Mm)/duration;
  const substeps=Math.ceil(duration/Math.min(stableDt,speed>0?p/(3*speed):stableDt));
  const dt=duration/substeps;
  for(let s=0;s<substeps;s++){
   const f=(s+.5)/substeps,x=command.x0Mm+f*(command.x1Mm-command.x0Mm);
   const y=command.y0Mm+f*(command.y1Mm-command.y0Mm);
   const energyStep=command.powerW*input.powerCouplingFraction*dt;
   const weights:number[]=[];
   let sumWeight=0;
   if(energyStep>0){
    for(const i of byLayer[command.layer]){
     const c=cells[i],dx=o.x+(c[0]+.5)*p-x,dy=o.y+(c[1]+.5)*p-y;
     const r2=dx*dx+dy*dy;
     const weight=r2<=(2*input.beamRadiusMm)**2?
      Math.exp(-2*r2/input.beamRadiusMm**2):0;
     weights[i]=weight;sumWeight+=weight;
    }
    if(sumWeight<1e-12)throw Error("Powered beam crosses unrepresented grid footprint; energy was not reassigned.");
    for(const i of byLayer[command.layer]){
     const c=cells[i],dx=o.x+(c[0]+.5)*p-x,dy=o.y+(c[1]+.5)*p-y;
     if(dx*dx+dy*dy<=input.beamRadiusMm**2)solid[i]=1; // heuristic beam core only, not Gaussian tails
    }
   }
   const changes=new Float64Array(cells.length);
   for(let i=0;i<cells.length;i++)if(active[i]){
    const Ti=temp(i),ki=conductivity(i);
    for(let face=0;face<6;face++){
     const j=neighbors[i][face];
     const area=face<4?xyArea:zArea,spacing=face<4?hxy:hz;
     if(j>=0&&active[j]){
      if(j<i)continue;
      const flow=harmonic(ki,conductivity(j))*area/spacing*(temp(j)-Ti)*dt;
      changes[i]+=flow;changes[j]-=flow;
     }else{
      // Air-facing boundaries, including surfaces above not-yet-deposited layers.
      // Powder-bed side exchange is approximated as convection.
      const loss=input.convectionWm2K*area*(Ti-input.ambientTemperatureC)*dt;
      changes[i]-=loss;conv+=loss;
     }
    }
    if(cells[i][2]===0){
     const loss=2*ki*zArea/hz*(Ti-input.plateTemperatureC)*dt;
     changes[i]-=loss;plate+=loss;
    }
   }
   if(energyStep>0){
    for(const i of byLayer[command.layer])if((weights[i]??0)>0)
     changes[i]+=energyStep*weights[i]/sumWeight;
    absorbed+=energyStep;
   }
   for(let i=0;i<cells.length;i++)if(active[i]){
    enthalpy[i]+=changes[i];
    if(!Number.isFinite(enthalpy[i]))throw Error("Nonfinite cell energy; results withheld.");
    peak[i]=Math.max(peak[i],temp(i));
   }
   steps++;elapsed+=dt;
  }
  const activeCount=active.reduce((a,b)=>a+b,0),consolidated=solid.reduce((a,b)=>a+b,0);
  let maxTemp=-Infinity;
  for(let i=0;i<cells.length;i++)if(active[i])maxTemp=Math.max(maxTemp,temp(i));
  snapshots.push({layer:command.layer,timeSeconds:elapsed,activeCells:activeCount,
   consolidatedCells:consolidated,maximumTemperatureC:maxTemp});
 }
 const stored=enthalpy.reduce((a,b)=>a+b,0);
 const imbalance=Math.abs(absorbed-plate-conv-stored)/
  Math.max(1,Math.abs(absorbed)+Math.abs(plate)+Math.abs(conv));
 if(!Number.isFinite(imbalance)||imbalance>1e-6)
  throw Error("Partial-layer energy conservation failed.");
 if(Math.abs(absorbed-commanded*input.powerCouplingFraction)>1e-8*Math.max(1,absorbed))
  throw Error("Absorbed scan energy does not match source chronology.");
 return {
  engine:PARTIAL_LAYER_VERSION,validationStatus:"UNVALIDATED_GRID_RESEARCH",
  partSha256:input.partSha256,sourceSha256:input.sourceSha256,
  grid:{cellCount:cells.length,layers:nLayers,pitchMm:p,layerHeightMm:d},
  chronology:{commands:scan.commands.length,elapsedSeconds:elapsed,timeSteps:steps,
   maxTimeStepSeconds:stableDt},
  energy:{commandedJ:commanded,absorbedJ:absorbed,plateExchangeJ:plate,
   convectionExchangeJ:conv,storedJ:stored,relativeImbalance:imbalance},
  layers:snapshots,
  finalCells:cells.map((c,i)=>({x:c[0],y:c[1],layer:c[2],
   state:solid[i]?"consolidated":"powder",temperatureC:temp(i),peakTemperatureC:peak[i]})),
  limitations:[
   "RESEARCH ONLY. This model uses an engineer-supplied, layer-aligned uniform grid, not an STL-accurate slicer or verified machine data.",
   "Each layer's powder footprint appears instantaneously at its first command. Laser-illuminated cells are labeled consolidated heuristically; no melting/solidification kinetics, consolidation threshold or melt-pool fluid flow are modeled.",
   "Powder and consolidated thermal conductivities differ; mass, density and heat capacity are held constant to preserve a simple cell energy balance. Powder packing, shrinkage and latent heat are absent.",
   "The Gaussian source is integrated over coarse cells and normalized within the represented footprint. Beam shape, absorption, powder-bed physics and local temperatures are not experimentally validated.",
   "Top/side faces use a simplified convection boundary rather than resolved powder-bed coupling; the plate is an ideal fixed-temperature reservoir. No radiation or mechanical coupling.",
   "Numerical energy conservation is not convergence, experimental accuracy, melt-pool validation or evidence of defect/first-time-quality prediction."
  ]
 };
}
