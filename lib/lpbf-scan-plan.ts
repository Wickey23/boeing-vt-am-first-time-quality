/**
 * Interchange format for explicitly supplied LPBF virtual-slab scan tracks.
 *
 * NOT a native machine job or NIST AM Bench HDF5 parser. Coordinate positions
 * are in mm in the STL's centered/original model frame and must align with
 * the voxelized part. Each slab index represents a coarse thermal voxel slab,
 * not one actual printed physical layer.
 */
export const SCAN_PLAN_VERSION="orientai-lpbf-scan-csv-v1";
export type ScanSegment={
 slab:number;x0Mm:number;y0Mm:number;x1Mm:number;y1Mm:number;
 powerW:number;speedMmS:number;
};
export type ScanPlan={
 version:typeof SCAN_PLAN_VERSION;
 segments:ScanSegment[];
 sourceName:string;
 sha256:string;
};
const HEADER="slab,x0_mm,y0_mm,x1_mm,y1_mm,power_w,speed_mm_s";
export const SCAN_CSV_HEADER=HEADER;
const safeLabel=(label:string)=>label.replace(/[\r\n<>]/g,"").slice(0,120)||"user-supplied.csv";
export function parseScanCsv(text:string,sourceName="user-supplied.csv"):Omit<ScanPlan,"sha256">{
 if(text.length>256*1024)throw Error("Scan CSV exceeds 256 KB input limit.");
 const rows=text.replace(/^\uFEFF/,"").split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith("#"));
 if(rows.length<2)throw Error("Scan CSV must include a header and at least one segment.");
 if(rows[0]!==HEADER)throw Error("Scan CSV header must be exactly: "+HEADER);
 if(rows.length-1>2000)throw Error("Scan CSV exceeds 2,000-segment research limit.");
 const segments:ScanSegment[]=rows.slice(1).map((row,index)=>{
  const raw=row.split(",");
  if(raw.length!==7||raw.some(s=>!s.trim()||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(s.trim())))
   throw Error("Scan CSV row "+(index+2)+": expected exactly seven finite numeric columns.");
  const n=raw.map(Number);
  if(n.some(v=>!Number.isFinite(v)))throw Error("Non-finite scan number at row "+(index+2));
  const [slab,x0Mm,y0Mm,x1Mm,y1Mm,powerW,speedMmS]=n;
  if(!Number.isInteger(slab)||slab<0||slab>100)
   throw Error("Scan CSV row "+(index+2)+": slab must be a nonnegative integer at most 100.");
  if(Math.hypot(x1Mm-x0Mm,y1Mm-y0Mm)<=1e-9)
   throw Error("Scan CSV row "+(index+2)+": zero-length segment.");
  if(powerW<0||powerW>1000||speedMmS<10||speedMmS>5000)
   throw Error("Scan CSV row "+(index+2)+": power must be 0–1000 W and speed 10–5000 mm/s.");
  return {slab,x0Mm,y0Mm,x1Mm,y1Mm,powerW,speedMmS};
 });
 if(segments.some((s,i)=>i>0&&s.slab<segments[i-1].slab))
  throw Error("Scan CSV segments must appear in nondecreasing slab order.");
 return {version:SCAN_PLAN_VERSION,segments,sourceName:safeLabel(sourceName)};
}
export type ScanPlanBounds={minX:number;maxX:number;minY:number;maxY:number};
export function validateScanPlan(
 plan:Pick<ScanPlan,"version"|"segments">,slabs:number,bounds:ScanPlanBounds
){
 if(plan.version!==SCAN_PLAN_VERSION)throw Error("Unknown scan plan schema.");
 if(!Number.isInteger(slabs)||slabs<2||slabs>100)throw Error("Invalid virtual-slab count.");
 if(!Array.isArray(plan.segments)||plan.segments.length===0||plan.segments.length>2000)
  throw Error("Scan plan must contain 1–2,000 segments.");
 const bySlab:Array<ScanSegment[]>=Array.from({length:slabs},()=>[]);
 let time=0,energy=0,lastSlab=-1;
 for(const [index,s] of plan.segments.entries()){
  if(!Number.isInteger(s.slab)||s.slab<0||s.slab>=slabs||s.slab<lastSlab)
   throw Error("Scan segment "+(index+1)+": invalid or unordered virtual slab.");
  for(const key of ["x0Mm","y0Mm","x1Mm","y1Mm","powerW","speedMmS"] as const)
   if(!Number.isFinite(s[key]))throw Error("Scan segment "+(index+1)+": invalid "+key+".");
  for(const [x,y] of [[s.x0Mm,s.y0Mm],[s.x1Mm,s.y1Mm]])
   if(x<bounds.minX-1e-6||x>bounds.maxX+1e-6||y<bounds.minY-1e-6||y>bounds.maxY+1e-6)
    throw Error("Scan segment "+(index+1)+" extends outside uploaded STL X/Y bounds in mm. Check coordinate frame and units.");
  const length=Math.hypot(s.x1Mm-s.x0Mm,s.y1Mm-s.y0Mm);
  if(length<=1e-9||s.powerW<0||s.powerW>1000||s.speedMmS<10||s.speedMmS>5000)
   throw Error("Scan segment "+(index+1)+": invalid laser power, speed or length.");
  const dt=length/s.speedMmS;
  time+=dt;energy+=dt*s.powerW;
  const earlier=bySlab[s.slab].at(-1);
  if(earlier&&Math.hypot(earlier.x1Mm-s.x0Mm,earlier.y1Mm-s.y0Mm)>1e-4)
   throw Error("Scan segment "+(index+1)+": discontinuous travel. Supply an explicit laser-off segment connecting the prior endpoint to this start.");
  bySlab[s.slab].push(s);lastSlab=s.slab;
 }
 if(bySlab.some(g=>g.length===0))
  throw Error("Scan plan must specify every virtual voxel slab, including any laser-off traversal. It does not accept physical-layer indices.");
 if(!bySlab.some(g=>g.some(s=>s.powerW>0)))
  throw Error("Scan plan has no laser-on segments; use the zero-source verification harness instead.");
 return {bySlab,totalSeconds:time,laserCommandEnergyJ:energy,segmentCount:plan.segments.length};
}
export function positionOnScanSegment(seg:ScanSegment,fraction:number){
 const t=Math.max(0,Math.min(1,fraction));
 return {x:seg.x0Mm+(seg.x1Mm-seg.x0Mm)*t,y:seg.y0Mm+(seg.y1Mm-seg.y0Mm)*t};
}
