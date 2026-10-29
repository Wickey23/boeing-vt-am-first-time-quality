/**
 * Physical-layer scan *chronology audit* for a user-reviewed CSV interchange.
 *
 * This is deliberately independent of the coarse virtual-slab thermal solver:
 * energy and time are audited from explicit commands, NEVER silently injected
 * into a voxel slab (which would change melt, cooling and activation physics).
 * Not a native NIST HDF5, machine G-code, or machine-verified scan importer.
 */
export const PHYSICAL_SCAN_HEADER="layer,z_mm,t0_s,t1_s,x0_mm,y0_mm,x1_mm,y1_mm,power_w";
export const PHYSICAL_SCAN_VERSION="orientai-physical-layer-timeline-0.1";
export type PhysicalScanCommand={
 layer:number;zMm:number;t0Seconds:number;t1Seconds:number;
 x0Mm:number;y0Mm:number;x1Mm:number;y1Mm:number;powerW:number;
};
export type PhysicalScanPlan={
 version:typeof PHYSICAL_SCAN_VERSION;sourceName:string;commands:PhysicalScanCommand[];
};
export type ScanGeometry={
 minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number;
};
export type PhysicalLayerSummary={
 layer:number;zMm:number;startSeconds:number;endSeconds:number;
 commands:number;laserOnCommands:number;laserOffCommands:number;
 commandedLaserEnergyJ:number;poweredDistanceMm:number;laserOffSeconds:number;
 virtualSlab:number|null;
};
export type PhysicalScanAudit={
 version:typeof PHYSICAL_SCAN_VERSION;
 sourceName:string;sourceSha256:string;partSha256:string;
 suppliedLayerCount:number;firstLayer:number;lastLayer:number;
 missingIntermediateLayerIndices:number[];
 commandedTimeSeconds:number;laserOnSeconds:number;laserOffSeconds:number;
 totalCommandedLaserEnergyJ:number;maxCommandedSpeedMmS:number;
 nominalThicknessMm:number;physicalLayerCountFromGeometry:number;
 virtualSlabCount:number;unrepresentedLayers:number[];
 layers:PhysicalLayerSummary[];
 warnings:string[];
 simulationCompatibility:"NOT_APPLIED_TO_COARSE_THERMAL_SOLVER";
 qualification:"RESEARCH_ONLY_NOT_MACHINE_VERIFIED";
};
const numberToken=/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][-+]?\d+)?$/;
export function parsePhysicalScanCsv(text:string,sourceName="physical-layers.csv"):PhysicalScanPlan{
 if(text.length>256*1024)throw Error("Physical scan CSV exceeds 256 KB.");
 const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith("#"));
 if(lines[0]!==PHYSICAL_SCAN_HEADER)
  throw Error("Physical scan CSV requires exact header: "+PHYSICAL_SCAN_HEADER);
 if(lines.length<2||lines.length>3001)
  throw Error("Physical scan CSV needs 1–3,000 command rows.");
 const commands:PhysicalScanCommand[]=lines.slice(1).map((row,index)=>{
  const values=row.split(",");
  if(values.length!==9||values.some(v=>!numberToken.test(v.trim())))
   throw Error("Physical scan row "+(index+2)+" must contain nine finite numeric columns.");
  const [layer,zMm,t0Seconds,t1Seconds,x0Mm,y0Mm,x1Mm,y1Mm,powerW]=values.map(Number);
  if(![layer,zMm,t0Seconds,t1Seconds,x0Mm,y0Mm,x1Mm,y1Mm,powerW].every(Number.isFinite))
   throw Error("Nonfinite physical scan command at row "+(index+2));
  if(!Number.isInteger(layer)||layer<0||layer>100000)
   throw Error("Physical scan row "+(index+2)+": invalid nonnegative integer layer index.");
  if(Math.abs(zMm)>100000||[x0Mm,y0Mm,x1Mm,y1Mm].some(v=>Math.abs(v)>100000))
   throw Error("Physical scan row "+(index+2)+": coordinates exceed 100,000 mm.");
  if(t0Seconds<0||t1Seconds<=t0Seconds||t1Seconds>14400)
   throw Error("Physical scan row "+(index+2)+": invalid positive absolute time interval.");
  if(powerW<0||powerW>1000)
   throw Error("Physical scan row "+(index+2)+": commanded power must be 0–1,000 W.");
  const speed=Math.hypot(x1Mm-x0Mm,y1Mm-y0Mm)/(t1Seconds-t0Seconds);
  if(speed>5000+1e-5)
   throw Error("Physical scan row "+(index+2)+": commanded speed exceeds 5,000 mm/s.");
  return {layer,zMm,t0Seconds,t1Seconds,x0Mm,y0Mm,x1Mm,y1Mm,powerW};
 });
 return {version:PHYSICAL_SCAN_VERSION,sourceName:sourceName.replace(/[\r\n<>]/g,"").slice(0,100),commands};
}
function near(a:number,b:number,tolerance:number){return Math.abs(a-b)<=tolerance;}
export function auditPhysicalScanPlan(
 plan:PhysicalScanPlan,args:{
  sourceSha256:string;partSha256:string;
  geometry:ScanGeometry;physicalLayerThicknessMm:number;
  thermalVoxelWidthMm:number;occupiedVoxelZIndices:number[];
 }
):PhysicalScanAudit{
 const {sourceSha256,partSha256,geometry,physicalLayerThicknessMm:t,
  thermalVoxelWidthMm:h,occupiedVoxelZIndices:occupied}=args;
 if(plan.version!==PHYSICAL_SCAN_VERSION||!plan.commands.length||plan.commands.length>3000)
  throw Error("Unsupported or empty physical scan plan.");
 if(!/^[a-f0-9]{64}$/.test(sourceSha256)||!/^[a-f0-9]{64}$/.test(partSha256))
  throw Error("Physical scan and uploaded part require their SHA-256 identities.");
 const {minX,maxX,minY,maxY,minZ,maxZ}=geometry;
 if(![minX,maxX,minY,maxY,minZ,maxZ,t,h].every(Number.isFinite)||
    minX>=maxX||minY>=maxY||minZ>=maxZ||!(t>=.01&&t<=1)||!(h>0))
  throw Error("Invalid STL bounds, nominal layer thickness or voxel resolution.");
 if(!Array.isArray(occupied)||!occupied.length||occupied.some((v,i)=>!Number.isInteger(v)||v<0||(i>0&&v<=occupied[i-1])))
  throw Error("Virtual thermal slab indices must be ordered and nonempty.");
 const records=new Map<number,PhysicalLayerSummary>();
 const tolerance=1e-6;
 let totalLaserOn=0,totalLaserOff=0,totalEnergy=0,maxSpeed=0;
 for(let i=0;i<plan.commands.length;i++){
  const c=plan.commands[i],prior=plan.commands[i-1];
  if(c.layer<0||!Number.isInteger(c.layer)||!Number.isFinite(c.zMm)||!Number.isFinite(c.powerW)||
   c.powerW<0||c.powerW>1000||!Number.isFinite(c.t0Seconds)||!Number.isFinite(c.t1Seconds)||
   c.t1Seconds<=c.t0Seconds||c.t1Seconds>14400)
   throw Error("Invalid physical scan command "+(i+1)+".");
  if(c.layer>0&&records.size===0&&i===0){
   // A partial source plan may intentionally begin after the first physical layer.
  }
  if(i===0&&!near(c.t0Seconds,0,tolerance))
   throw Error("Physical scan timeline must begin at 0 seconds relative to the declared file origin.");
  if(prior){
   if(c.layer<prior.layer)throw Error("Physical scan rows must use nondecreasing layer indices.");
   if(!near(c.t0Seconds,prior.t1Seconds,tolerance))
    throw Error("Physical scan commands must have continuous, nonoverlapping times, including explicit zero-power dwell/travel.");
   if(!near(c.x0Mm,prior.x1Mm,1e-4)||!near(c.y0Mm,prior.y1Mm,1e-4))
    throw Error("Physical scan position jumps without explicit zero-power travel.");
   if(c.layer===prior.layer){
    if(!near(c.zMm,prior.zMm,1e-4))
     throw Error("Z height changed within one physical layer.");
   }else{
    if(c.zMm<=prior.zMm+1e-6)
     throw Error("Physical-layer Z heights must increase with layer index.");
    if(c.powerW>0)
     throw Error("Physical-layer transition must begin with an explicit zero-power command.");
   }
  }
  if(c.powerW>0&&(c.x0Mm<minX-tolerance||c.x0Mm>maxX+tolerance||
   c.x1Mm<minX-tolerance||c.x1Mm>maxX+tolerance||
   c.y0Mm<minY-tolerance||c.y0Mm>maxY+tolerance||
   c.y1Mm<minY-tolerance||c.y1Mm>maxY+tolerance))
   throw Error("Powered physical scan lies outside the part's XY bounding rectangle.");
  if(c.zMm<minZ-t||c.zMm>maxZ+t)
   throw Error("Physical-layer Z command is outside the uploaded STL build height.");
  const duration=c.t1Seconds-c.t0Seconds;
  const length=Math.hypot(c.x1Mm-c.x0Mm,c.y1Mm-c.y0Mm);
  const speed=length/duration;
  if(!Number.isFinite(speed)||speed>5000+1e-5)throw Error("Invalid commanded speed.");
  maxSpeed=Math.max(maxSpeed,speed);
  const on=c.powerW>0,energy=duration*c.powerW;
  totalEnergy+=energy;
  if(on)totalLaserOn+=duration;else totalLaserOff+=duration;
  let row=records.get(c.layer);
  if(!row){
   const heightFromBottom=c.zMm-minZ;
   const centerFromBottom=heightFromBottom-t/2;
   const voxelZ=Math.max(0,Math.floor((centerFromBottom+1e-9)/h));
   const slab=occupied.indexOf(voxelZ);
   row={layer:c.layer,zMm:c.zMm,startSeconds:c.t0Seconds,endSeconds:c.t1Seconds,
    commands:0,laserOnCommands:0,laserOffCommands:0,commandedLaserEnergyJ:0,
    poweredDistanceMm:0,laserOffSeconds:0,virtualSlab:slab>=0?slab:null};
   records.set(c.layer,row);
  }
  row.endSeconds=c.t1Seconds;row.commands++;
  row.commandedLaserEnergyJ+=energy;
  if(on){row.laserOnCommands++;row.poweredDistanceMm+=length;}
  else{row.laserOffCommands++;row.laserOffSeconds+=duration;}
 }
 const layers=[...records.values()];
 const missingIntermediateLayerIndices:number[]=[];
 for(let k=layers[0].layer;k<=layers[layers.length-1].layer;k++)
  if(!records.has(k))missingIntermediateLayerIndices.push(k);
 const unrepresentedLayers=layers.filter(l=>l.virtualSlab===null).map(l=>l.layer);
 const physicalLayerCountFromGeometry=Math.ceil((maxZ-minZ)/t);
 const warnings=[
  "Physical layer commands are audit-only: NO thermal calculation uses these data. The current LPBF solver accepts coarse virtual slabs, not actual executed physical layers.",
  "Coordinates/timestamps are user-supplied machine commands; neither actual galvo motion, laser modulation, scan execution nor their calibration is authenticated.",
  "Part XY bounding-box validation does not prove that a powered beam falls on solid material. Unsupported powder heat transfer, melting, partial-volume deposition and surface exposure are not modeled.",
  "The layer-to-voxel relationship assigns each physical layer's nominal center to one coarse voxel; no accurate thermal-layer remapping, energy coupling or within-layer physical simulation follows."
 ];
 if(layers[0].layer!==0)warnings.push("The provided physical timeline begins after layer 0 and omits earlier machine history.");
 if(missingIntermediateLayerIndices.length)warnings.push("Some intermediate physical layer indices are missing; do not infer their power or cooling history.");
 if(unrepresentedLayers.length)warnings.push("Some supplied layers do not map to occupied STL thermal voxels; they cannot be simulated using the current coarse geometry.");
 if(Math.abs((layers.at(-1)!.zMm-layers[0].zMm)-
    (layers.at(-1)!.layer-layers[0].layer)*t)>Math.max(.02,t*.1))
  warnings.push("Reported Z change differs from layer-index spacing times nominal thickness. Confirm coordinate origin and actual machine layer height.");
 return {
  version:PHYSICAL_SCAN_VERSION,sourceName:plan.sourceName,
  sourceSha256,partSha256,suppliedLayerCount:layers.length,
  firstLayer:layers[0].layer,lastLayer:layers.at(-1)!.layer,
  missingIntermediateLayerIndices,commandedTimeSeconds:plan.commands.at(-1)!.t1Seconds,
  laserOnSeconds:totalLaserOn,laserOffSeconds:totalLaserOff,
  totalCommandedLaserEnergyJ:totalEnergy,maxCommandedSpeedMmS:maxSpeed,
  nominalThicknessMm:t,physicalLayerCountFromGeometry,virtualSlabCount:occupied.length,
  unrepresentedLayers,layers,warnings,
  simulationCompatibility:"NOT_APPLIED_TO_COARSE_THERMAL_SOLVER",
  qualification:"RESEARCH_ONLY_NOT_MACHINE_VERIFIED"
 };
}
