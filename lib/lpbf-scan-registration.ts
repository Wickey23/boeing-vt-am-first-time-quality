/** M05 research-only registration of user CSV commands to M04 sampled STL layers.
 * No scan execution, beam footprint, thermal activation or material qualification.
 */
import {parsePhysicalScanCsv,type PhysicalScanCommand} from "./lpbf-physical-schedule";
import type {PhysicalSliceResult} from "./lpbf-physical-slicer";
export const SCAN_REGISTRATION_VERSION="orientai-sampled-layer-registration-0.1";
type Coverage="full-sampled"|"partial-sampled"|"empty-or-outside"|"ambiguous-boundary";
type SegmentRecord={row:number;layer:number;zResidualMm:number|null;lengthMm:number;energyJ:number;coverage:Coverage|null;reasons:string[]};
const EPS=1e-8;
function classify(c:PhysicalScanCommand,slice:PhysicalSliceResult,lookup:Map<string,number>):Coverage{
 const {originMm:o,xyPitchMm:p,columns,rows}=slice.grid;
 const x=(c.x0Mm-o.x)/p,y=(c.y0Mm-o.y)/p,dx=(c.x1Mm-c.x0Mm)/p,dy=(c.y1Mm-c.y0Mm)/p;
 if(![x,y,dx,dy].every(Number.isFinite))return "empty-or-outside";
 const bound=(v:number)=>Math.abs(v-Math.round(v))<=EPS;
 // Do not pretend that a line exactly on a cell edge belongs to one material cell.
 if((Math.abs(dx)<=EPS&&bound(x))||(Math.abs(dy)<=EPS&&bound(y)))return "ambiguous-boundary";
 const cuts=[0,1];
 for(const [v,d,n] of [[x,dx,columns],[y,dy,rows]]){
  if(Math.abs(d)<=EPS)continue;
  for(let k=0;k<=n;k++){const t=(k-v)/d;if(t>EPS&&t<1-EPS)cuts.push(t);}
 }
 cuts.sort((a,b)=>a-b);
 let partial=false;
 const sample=(t:number)=>{
  const ix=Math.floor(x+dx*t),iy=Math.floor(y+dy*t);
  if(ix<0||iy<0||ix>=columns||iy>=rows)return 0;
  return lookup.get(ix+","+iy)??0;
 };
 for(let i=1;i<cuts.length;i++){
  if(cuts[i]-cuts[i-1]<=EPS)continue;
  const fraction=sample((cuts[i]+cuts[i-1])/2);
  if(!fraction)return "empty-or-outside";
  if(fraction!==1)partial=true;
 }
 return partial?"partial-sampled":"full-sampled";
}
export async function registerPhysicalScan(csv:ArrayBuffer,slice:PhysicalSliceResult,expectedPartSha256:string,sourceName="physical-layers.csv"){
 if(!/^[a-f0-9]{64}$/.test(expectedPartSha256)||slice.partSha256!==expectedPartSha256)throw Error("Scan registration part identity mismatch.");
 if(!csv.byteLength||csv.byteLength>256*1024)throw Error("Invalid bounded scan source size.");
 const sourceSha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",csv)),n=>n.toString(16).padStart(2,"0")).join("");
 const plan=parsePhysicalScanCsv(new TextDecoder("utf-8",{fatal:true}).decode(csv),sourceName);
 const {grid,layers}=slice;
 if(layers.length!==grid.physicalLayers||!Number.isFinite(grid.xyPitchMm)||grid.xyPitchMm<=0||grid.columns<1||grid.rows<1||grid.columns>150||grid.rows>150||layers.length>600)throw Error("Invalid bounded slice registration grid.");
 const blockers:string[]=[];
 if(slice.geometry.meshAudit.disconnectedShells!==1)blockers.push("Multiple shells require separate geometry review.");
 if(slice.geometry.relativeVolumeDifference>.08)blockers.push("Raster volume discrepancy exceeds research review threshold.");
 if(layers.some((l,i)=>l.layer!==i||!l.cells.length||l.sectionCheck?.relativeDifference==null||l.sectionCheck.relativeDifference>.08))blockers.push("Missing, ambiguous, or discrepant layer section geometry.");
 if(layers.some(l=>Math.abs(l.topZMm-l.bottomZMm-grid.layerThicknessMm)>1e-6))blockers.push("Partial-height layer requires explicit support before uniform-layer thermal activation.");
 const lookups=layers.map(l=>new Map(l.cells.map(c=>[c.x+","+c.y,c.coverage])));
 const records:SegmentRecord[]=[];
 const seen=new Set<number>();
 for(const [i,c] of plan.commands.entries()){
  const prior=plan.commands[i-1],reasons:string[]=[];
  if(i===0&&(c.layer!==0||Math.abs(c.t0Seconds)>1e-6))reasons.push("Timeline must begin at layer zero and time zero.");
  if(prior&&(c.layer<prior.layer||c.layer>prior.layer+1||Math.abs(c.t0Seconds-prior.t1Seconds)>1e-6||Math.hypot(c.x0Mm-prior.x1Mm,c.y0Mm-prior.y1Mm)>1e-4))reasons.push("Discontinuous scan chronology, position or layer order.");
  if(prior&&c.layer!==prior.layer&&c.powerW>0)reasons.push("New layer must begin with zero-power command.");
  const l=layers[c.layer];
  const zResidualMm=l?c.zMm-l.topZMm:null;
  if(!l||zResidualMm===null||Math.abs(zResidualMm)>Math.max(1e-5,grid.layerThicknessMm*.02))reasons.push("Z is not registered to the actual slice top.");
  const coverage=c.powerW>0&&l?classify(c,slice,lookups[c.layer]):null;
  if(c.powerW>0){
   if(coverage!=="full-sampled")reasons.push("Powered segment is not wholly inside full-sampled layer cells.");
   else seen.add(c.layer);
  }
  records.push({row:i+1,layer:c.layer,zResidualMm,lengthMm:Math.hypot(c.x1Mm-c.x0Mm,c.y1Mm-c.y0Mm),energyJ:c.powerW*(c.t1Seconds-c.t0Seconds),coverage,reasons});
 }
 const missingPoweredLayers=layers.filter(l=>!seen.has(l.layer)).map(l=>l.layer);
 if(missingPoweredLayers.length)blockers.push("One or more layers have no fully represented powered command.");
 if(records.some(r=>r.reasons.length))blockers.push("One or more commands have registration or chronology conflicts.");
 return {version:SCAN_REGISTRATION_VERSION,sourceSha256,partSha256:expectedPartSha256,sourceName:plan.sourceName,
  sliceVersion:slice.version,unitScaleToMm:slice.unitScaleToMm,rotationDeg:slice.geometry.rotationDeg,translationMm:slice.geometry.translationMm,grid:{...grid},
  zConvention:"actual-slice-top",records,missingPoweredLayers,blockers,
  status:blockers.length?"BLOCKED_RESEARCH_REGISTRATION":"SAMPLED_REGISTRATION_REVIEW_REQUIRED",
  thermalActivationAuthorized:false as const,
  limitations:["Cell coverage is four-ray sampling, not exact material containment or beam-footprint verification.","The CSV must already use the explicit oriented STL/build coordinate frame; no automatic machine transform or native machine verification.","Passing sampled registration does not establish scan execution, thermal accuracy, process qualification or permission to activate a solver."]};
}
