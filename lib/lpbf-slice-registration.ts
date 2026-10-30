/**
 * M05: independent *geometric* registration of engineer-supplied physical scan
 * commands to sampled horizontal slices of the actual uploaded STL.
 *
 * Scan paths are NOT machine authenticated. This does not execute a thermal
 * solver, verify commanded beam motion, or model a beam spot/melt pool.
 */
import type {PhysicalSliceResult} from "./lpbf-physical-slicer";
import {PHYSICAL_SLICER_VERSION} from "./lpbf-physical-slicer";
import {PHYSICAL_SCAN_VERSION,type PhysicalScanPlan} from "./lpbf-physical-schedule";

export const SLICE_REGISTRATION_VERSION="orientai-scan-to-stl-slices-0.1";
export type RegisteredPhysicalScan={
 version:typeof SLICE_REGISTRATION_VERSION;
 partSha256:string;scanSourceSha256:string;geometryVersion:string;
 status:"GEOMETRY_REGISTERED_RESEARCH_ONLY"|"BLOCKED";
 geometry:{physicalLayers:number;sampledCells:number;relativeVolumeDifference:number;ambiguousBoundaryCells:number;pitchMm:number;layerHeightMm:number};
 commands:number;laserOnCommands:number;commandedLaserEnergyJ:number;
 beamSamples:number;beamSamplesOutsideMaterial:number;
 maxLayerZResidualMm:number;missingLayers:number[];
 blockers:string[];warnings:string[];
 partialLayerSolverReady:false;
};

const hex=/^[0-9a-f]{64}$/;
export function registerPhysicalScanToSlices(args:{
 slices:PhysicalSliceResult;scan:PhysicalScanPlan;scanSourceSha256:string;
}):RegisteredPhysicalScan{
 const {slices,scan,scanSourceSha256}=args;
 if(slices.version!==PHYSICAL_SLICER_VERSION||scan.version!==PHYSICAL_SCAN_VERSION)
  throw Error("Unsupported physical slice/scan revision; rerun source preflight.");
 if(!hex.test(slices.partSha256)||!hex.test(scanSourceSha256))
  throw Error("Both source SHA-256 hashes are mandatory for scan-to-part registration.");
 if(!Array.isArray(scan.commands)||scan.commands.length<1||scan.commands.length>3000)
  throw Error("Bounded nonempty physical scan commands are required.");
 const {originMm:o,xyPitchMm:p,layerThicknessMm:d,physicalLayers:n,columns,rows}=slices.grid;
 const blockers:string[]=[];
 const warnings:string[]=[];
 const add=(message:string)=>{if(!blockers.includes(message))blockers.push(message);};
 const layersSeen=new Set<number>();
 let previous:PhysicalScanPlan["commands"][number]|null=null;
 let maxZResidual=0,beamSamples=0,outside=0,energy=0,onCount=0;
 const cellMaps=slices.layers.map(layer=>new Map(layer.cells.map(c=>[c.y*columns+c.x,c.coverage])));
 if(n!==slices.layers.length||!n)throw Error("Corrupt slice layer count.");
 const sampleOccupancy=(layer:number,x:number,y:number)=>{
  const col=Math.floor((x-o.x)/p),row=Math.floor((y-o.y)/p);
  if(col<0||row<0||col>=columns||row>=rows)return 0;
  return cellMaps[layer].get(row*columns+col)??0;
 };
 for(const [i,c] of scan.commands.entries()){
  if(![c.layer,c.zMm,c.t0Seconds,c.t1Seconds,c.x0Mm,c.y0Mm,c.x1Mm,c.y1Mm,c.powerW].every(Number.isFinite)||
     !Number.isInteger(c.layer)||c.t0Seconds<0||c.t1Seconds<=c.t0Seconds||c.t1Seconds>14400||c.powerW<0||c.powerW>1000)
   throw Error("Physical scan contains an invalid command at row "+(i+2)+".");
  if(c.layer<0||c.layer>=n){add("Scan command references a physical layer outside the sampled STL stack.");previous=c;continue;}
  layersSeen.add(c.layer);
  const residual=Math.abs(c.zMm-(o.z+(c.layer+1)*d));
  maxZResidual=Math.max(maxZResidual,residual);
  if(residual>Math.max(1e-5,d*.02))add("Scan layer Z differs from the model build-origin plus physical layer thickness.");
  if(i===0&&(c.layer!==0||Math.abs(c.t0Seconds)>1e-6))
   add("Scan chronology must start at layer 0 and absolute time zero.");
  if(previous){
   if(c.layer<previous.layer||c.layer>previous.layer+1)
    add("Nonsequential physical layer indices or skipped layer transitions.");
   if(Math.abs(c.t0Seconds-previous.t1Seconds)>1e-6)
    add("Command chronology has overlapping intervals or missing explicit dwell time.");
   if(Math.hypot(c.x0Mm-previous.x1Mm,c.y0Mm-previous.y1Mm)>1e-4)
    add("Position discontinuity: explicit zero-power travel is required.");
   if(c.layer!==previous.layer&&c.powerW>0)
    add("Each layer transition must begin with an explicit laser-off command.");
  }
  const time=c.t1Seconds-c.t0Seconds;
  const distance=Math.hypot(c.x1Mm-c.x0Mm,c.y1Mm-c.y0Mm);
  if(distance/time>5000+1e-6)add("Powered or idle path exceeds 5,000 mm/s interchange bound.");
  if(c.powerW>0){
   onCount++;energy+=c.powerW*time;
   const count=Math.min(400,Math.max(2,Math.ceil(distance/(p*.4))+1));
   if(Math.ceil(distance/(p*.4))+1>400)add("A scan segment needs more than 400 geometric samples; split it.");
   for(let s=0;s<count;s++){
    const t=s/(count-1),x=c.x0Mm+t*(c.x1Mm-c.x0Mm),y=c.y0Mm+t*(c.y1Mm-c.y0Mm);
    beamSamples++;
    if(sampleOccupancy(c.layer,x,y)===0)outside++;
   }
  }
  previous=c;
 }
 const missingLayers=Array.from({length:n},(_,i)=>i).filter(i=>!layersSeen.has(i));
 if(missingLayers.length)add("Missing physical layer commands: "+missingLayers.slice(0,12).join(", ")+(missingLayers.length>12?" …":""));
 if(outside)add("Powered scan samples intersect unrepresented STL void or outside the material raster.");
 if(slices.layers.some(l=>l.cells.length===0))add("At least one physical layer is lost at the requested raster resolution.");
 if(slices.geometry.relativeVolumeDifference>.08)
  add("Sampled geometry deviates from the enclosed STL volume by more than 8%; refine raster before physical solver use.");
 if(slices.grid.boundaryCells)
  warnings.push("Part boundary cells have fractional sampled coverage; the full-cell partial-layer thermal solver cannot safely reuse them.");
 if(slices.geometry.meshAudit.disconnectedShells>1)
  add("Disconnected STL components require independently confirmed manufacturing connectivity.");
 if(!onCount)warnings.push("No powered scan commands were supplied; no laser energy was identified.");
 warnings.push("Registration uses sampled XY point occupancy, not Gaussian beam diameter, scan width, support powders or path-averaged absorbed energy.");
 warnings.push("User-supplied CSV is not a verified machine file; chronological consistency cannot establish executed machine motion.");
 warnings.push("Partial-layer 3D research solver remains separate until boundary-cell mass/area fidelity and numerical tests pass.");
 return {
  version:SLICE_REGISTRATION_VERSION,partSha256:slices.partSha256,scanSourceSha256,
  geometryVersion:slices.version,status:blockers.length?"BLOCKED":"GEOMETRY_REGISTERED_RESEARCH_ONLY",
  geometry:{physicalLayers:n,sampledCells:slices.grid.representedCells,
   relativeVolumeDifference:slices.geometry.relativeVolumeDifference,
   ambiguousBoundaryCells:slices.grid.boundaryCells,pitchMm:p,layerHeightMm:d},
  commands:scan.commands.length,laserOnCommands:onCount,commandedLaserEnergyJ:energy,
  beamSamples,beamSamplesOutsideMaterial:outside,maxLayerZResidualMm:maxZResidual,
  missingLayers,blockers,warnings,partialLayerSolverReady:false
 };
}
