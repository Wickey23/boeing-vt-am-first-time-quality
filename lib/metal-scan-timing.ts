/**
 * Research-only time/laser-on/energy accounting from a physically registered,
 * engineer-supplied CSV chronology. NOT a machine print-time predictor.
 *
 * A scan-file duration can include user-supplied travel/dwell/recoat already.
 * No additional machine overhead is assumed unless the engineer explicitly
 * marks it absent from the supplied command timestamps.
 */
import {PHYSICAL_SCAN_VERSION,type PhysicalScanPlan} from "./lpbf-physical-schedule";
import type {PhysicalSliceResult} from "./lpbf-physical-slicer";
import {SLICE_REGISTRATION_VERSION,type RegisteredPhysicalScan} from "./lpbf-slice-registration";

export const SCAN_TIMING_VERSION="orientai-physical-scan-timing-v0.1";
export type TimeAssumptions={
 outsideCsvConfirmed:boolean;
 recoatSecondsPerLayer:number;
 preparationMinutes:number;
 cooldownMinutes:number;
};
export type LayerTimeRecord={
 layer:number;sampleZMm:number;scanCommandSeconds:number;
 laserOnSeconds:number;laserOffSeconds:number;commandedLaserJ:number;
 laserOnMm:number;laserOffMm:number;commands:number;
};
export type PhysicalScanTimeReport={
 version:typeof SCAN_TIMING_VERSION;
 partSha256:string;sourceSha256:string;
 confidence:"SUPPLIED_UNVERIFIED_COMMANDS";
 elapsedCommandSeconds:number;
 laserOnSeconds:number;laserOffSeconds:number;commandedLaserJ:number;
 totalPathMm:number;poweredPathMm:number;
 scannedLayers:number;physicalGeometryLayers:number;
 layers:LayerTimeRecord[];
 extraOverheadSeconds:number|null;
 illustrativeTotalSeconds:number|null;
 blocked:boolean;warnings:string[];
};
const range=(value:number,max:number,label:string)=>{
 if(!Number.isFinite(value)||value<0||value>max)throw Error("Invalid "+label+".");
};
export function calculatePhysicalScanTiming(
 scan:PhysicalScanPlan,slices:PhysicalSliceResult,registration:RegisteredPhysicalScan,
 assumptions:TimeAssumptions
):PhysicalScanTimeReport{
 if(scan.version!==PHYSICAL_SCAN_VERSION||registration.version!==SLICE_REGISTRATION_VERSION||
    registration.partSha256!==slices.partSha256||
    !/^[a-f0-9]{64}$/.test(registration.scanSourceSha256))
  throw Error("Source-identified physical scan registration required before time accounting.");
 if(!scan.commands.length||scan.commands.length>3000)throw Error("Physical scan command count is not bounded.");
 range(assumptions.recoatSecondsPerLayer,600,"recoat seconds per layer");
 range(assumptions.preparationMinutes,1440,"preparation minutes");
 range(assumptions.cooldownMinutes,1440,"cooldown minutes");
 const byLayer=new Map<number,LayerTimeRecord>();
 let on=0,off=0,laserJ=0,path=0,powered=0;
 for(const command of scan.commands){
  const {layer,zMm,t0Seconds,t1Seconds,powerW,x0Mm,y0Mm,x1Mm,y1Mm}=command;
  if(![layer,zMm,t0Seconds,t1Seconds,powerW,x0Mm,y0Mm,x1Mm,y1Mm].every(Number.isFinite)
     ||!Number.isInteger(layer)||layer<0||layer>=slices.grid.physicalLayers||
     t0Seconds<0||t1Seconds<=t0Seconds||t1Seconds>14400||powerW<0||powerW>1000)
   throw Error("Invalid or out-of-geometry physical scan command.");
  const dt=t1Seconds-t0Seconds,len=Math.hypot(x1Mm-x0Mm,y1Mm-y0Mm);
  if(len/dt>5000+1e-6)throw Error("Physical scan speed exceeds interchange limit.");
  const active=powerW>0,energy=dt*powerW;
  let record=byLayer.get(layer);
  if(!record){
   record={layer,sampleZMm:slices.layers[layer].sampleZMm,scanCommandSeconds:0,
    laserOnSeconds:0,laserOffSeconds:0,commandedLaserJ:0,
    laserOnMm:0,laserOffMm:0,commands:0};
   byLayer.set(layer,record);
  }
  record.commands++;record.scanCommandSeconds+=dt;record.commandedLaserJ+=energy;
  path+=len;laserJ+=energy;
  if(active){record.laserOnSeconds+=dt;record.laserOnMm+=len;on+=dt;powered+=len;}
  else{record.laserOffSeconds+=dt;record.laserOffMm+=len;off+=dt;}
 }
 const first=scan.commands[0],last=scan.commands.at(-1)!;
 const elapsed=last.t1Seconds-first.t0Seconds;
 const missingChronology=Math.abs(elapsed-(on+off))>Math.max(1e-6,elapsed*1e-6);
 const blocked=registration.status==="BLOCKED"||registration.blockers.length>0||missingChronology;
 // An additive overhead estimate is impossible unless the operator confirms
 // the CSV explicitly omits those phases; never silently double-count.
 const overhead=assumptions.outsideCsvConfirmed&&!blocked?
  slices.grid.physicalLayers*assumptions.recoatSecondsPerLayer+
  60*(assumptions.preparationMinutes+assumptions.cooldownMinutes):null;
 const warnings=[
  "Command timing is read from engineer-supplied, unverified CSV timestamps. It is not measured elapsed machine printing time.",
  "CSV laser-on and laser-off timestamps may already include travel, dwell or recoating. Never add recoat/preparation/cooldown time unless those phases are known to be absent.",
  "Machine acceleration, galvo dynamics, gas flow, powder handling, recoater recovery, heat treatment, build-plate exchange and interruptions are not modeled or verified.",
  "A source-hashed path linked to the part does not establish support adequacy, metal quality, actual job execution or build acceptance."
 ];
 if(!assumptions.outsideCsvConfirmed)warnings.unshift("Total print-time estimate withheld: no confirmation that recoating/preparation/cooldown are absent from the supplied timestamps.");
 else if(!blocked)warnings.unshift("Illustrative total adds operator-specified non-overlapping overhead to the unverified commanded duration. Treat as a scenario, not a printer quotation.");
 if(blocked)warnings.unshift("Scan-to-part geometry or chronology is blocked; reported commanded times are descriptive data only, not a build estimate.");
 return {version:SCAN_TIMING_VERSION,partSha256:slices.partSha256,
  sourceSha256:registration.scanSourceSha256,confidence:"SUPPLIED_UNVERIFIED_COMMANDS",
  elapsedCommandSeconds:elapsed,laserOnSeconds:on,laserOffSeconds:off,commandedLaserJ:laserJ,
  totalPathMm:path,poweredPathMm:powered,
  scannedLayers:byLayer.size,physicalGeometryLayers:slices.grid.physicalLayers,
  layers:[...byLayer.values()].sort((a,b)=>a.layer-b.layer),
  extraOverheadSeconds:overhead,illustrativeTotalSeconds:overhead===null?null:elapsed+overhead,
  blocked,warnings};
}
