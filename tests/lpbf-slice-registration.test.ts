import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {slicePhysicalStl} from "../lib/lpbf-physical-slicer";
import {parsePhysicalScanCsv} from "../lib/lpbf-physical-schedule";
import {registerPhysicalScanToSlices} from "../lib/lpbf-slice-registration";

const file=async(name:string)=>{
 const b=await readFile("public/verification/"+name);
 return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
};
const sha=(a:ArrayBuffer)=>createHash("sha256").update(Buffer.from(a)).digest("hex");
test("M05 synthetic 50-layer cube path registers to the *actual* sampled STL, with bounded uncertainty",async()=>{
 const stl=await file("cube-10mm.stl"),csv=await file("cube-10mm-physical-scan.csv");
 const slices=await slicePhysicalStl(stl,{unitScaleToMm:1,xyPitchMm:1,layerThicknessMm:.2});
 const scan=parsePhysicalScanCsv(new TextDecoder().decode(csv),"cube-10mm-physical-scan.csv");
 const report=registerPhysicalScanToSlices({slices,scan,scanSourceSha256:sha(csv)});
 assert.equal(report.status,"GEOMETRY_REGISTERED_RESEARCH_ONLY");
 assert.equal(report.geometry.physicalLayers,50);
 assert.equal(report.laserOnCommands,50);
 assert.equal(report.beamSamplesOutsideMaterial,0);
 assert.ok(report.maxLayerZResidualMm<1e-10);
 assert.equal(report.partSha256,sha(stl));
 assert.equal(report.scanSourceSha256,sha(csv));
 assert.equal(report.partialLayerSolverReady,false);
 assert.ok(report.commandedLaserEnergyJ>0);
 assert.match(report.warnings.join(" "),/not a verified machine file/i);
});
test("M05 rejects laser-on passes across the hollow sleeve even within the outer XY rectangle",async()=>{
 const stl=await file("aerospace-nozzle-sleeve.stl");
 const slices=await slicePhysicalStl(stl,{unitScaleToMm:1,xyPitchMm:2,layerThicknessMm:1});
 const commands=Array.from({length:36},(_,layer)=>{
  const z=layer+1,t=layer*.02;
  return [{layer,zMm:z,t0Seconds:t,t1Seconds:t+.004,x0Mm:-10,y0Mm:0,x1Mm:-10,y1Mm:0,powerW:0},
   {layer,zMm:z,t0Seconds:t+.004,t1Seconds:t+.01,x0Mm:-10,y0Mm:0,x1Mm:10,y1Mm:0,powerW:70},
   {layer,zMm:z,t0Seconds:t+.01,t1Seconds:t+.02,x0Mm:10,y0Mm:0,x1Mm:-10,y1Mm:0,powerW:0}];
 }).flat();
 // JavaScript binary floating point timestamps have <= 1e-6 audit tolerance.
 const scan={...parsePhysicalScanCsv("layer,z_mm,t0_s,t1_s,x0_mm,y0_mm,x1_mm,y1_mm,power_w\n"+commands.map(c=>[
  c.layer,c.zMm,c.t0Seconds,c.t1Seconds,c.x0Mm,c.y0Mm,c.x1Mm,c.y1Mm,c.powerW].join(",")).join("\n"))};
 const r=registerPhysicalScanToSlices({slices,scan,scanSourceSha256:"b".repeat(64)});
 assert.equal(r.status,"BLOCKED");
 assert.ok(r.beamSamplesOutsideMaterial>0);
 assert.match(r.blockers.join(" "),/unrepresented STL void/);
});
test("M05 blocks origin mismatches, skipped layers, powered build transitions",async()=>{
 const stl=await file("cube-10mm.stl");
 const slices=await slicePhysicalStl(stl,{unitScaleToMm:1,xyPitchMm:1,layerThicknessMm:1});
 const rows=Array.from({length:10},(_,i)=>[
 {layer:i,zMm:-4+i,t0Seconds:i*.01,t1Seconds:i*.01+.002,x0Mm:0,y0Mm:0,x1Mm:0,y1Mm:0,powerW:0},
 {layer:i,zMm:-4+i,t0Seconds:i*.01+.002,t1Seconds:(i+1)*.01,x0Mm:0,y0Mm:0,x1Mm:0,y1Mm:0,powerW:100}
 ]).flat();
 const baseline={version:"orientai-physical-layer-timeline-0.1" as const,sourceName:"synthetic",commands:rows};
 const input={slices,scan:baseline,scanSourceSha256:"a".repeat(64)};
 assert.equal(registerPhysicalScanToSlices(input).status,"GEOMETRY_REGISTERED_RESEARCH_ONLY");
 const z={...baseline,commands:rows.map(c=>({...c,zMm:c.zMm+2}))};
 assert.match(registerPhysicalScanToSlices({...input,scan:z}).blockers.join(" "),/layer Z/);
 const skipped={...baseline,commands:rows.filter(c=>c.layer!==4)};
 assert.match(registerPhysicalScanToSlices({...input,scan:skipped}).blockers.join(" "),/Missing physical|Nonsequential/);
 const powered={...baseline,commands:rows.map((c,i)=>i===2?{...c,powerW:100}:c)};
 assert.match(registerPhysicalScanToSlices({...input,scan:powered}).blockers.join(" "),/layer transition/i);
 assert.throws(()=>registerPhysicalScanToSlices({...input,scanSourceSha256:"unsigned"}),/SHA-256/);
});
