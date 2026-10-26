import test from "node:test";
import assert from "node:assert/strict";
import {DED_WALL_EXAMPLE,planDedWall,simulateReferenceFlow,createSimioExchange,validateDedWall} from "../lib/ded-planning";
import {zipTextFiles} from "../lib/zip-store";

test("single bead example path is reproducible and has correct mm, s, mm3 units",()=>{
 const a=planDedWall(DED_WALL_EXAMPLE),b=planDedWall(DED_WALL_EXAMPLE);
 assert.deepEqual(a,b);
 assert.equal(a.layers,8);
 assert.equal(a.tracks.length,8);
 assert.equal(a.depositionLengthMm,480);
 assert.equal(a.repositionLengthMm,7);
 assert.equal(a.depositionSeconds,96);
 assert.equal(a.repositionSeconds,7/20);
 assert.equal(a.interpassSeconds,70);
 assert.ok(Math.abs(a.commandedSubtotalSeconds - 166.35)<1e-9);
 assert.equal(a.nominalVolumeMm3,960);
 assert.equal(a.envelopeCheck,"NOT_CONFIGURED");
 assert.equal(a.linearEnergyJMm,null);
 assert.equal(a.tracks[0].from[0],-30);
 assert.equal(a.tracks[1].from[0],30);
 assert.equal(a.tracks[0].to[0],30);
 assert.equal(a.tracks[1].to[0],-30);
});
test("one-way return strategy adds reposition length and duration",()=>{
 const a=planDedWall(DED_WALL_EXAMPLE);
 const b=planDedWall({...DED_WALL_EXAMPLE,strategy:"one-way"});
 assert.ok(b.repositionLengthMm>a.repositionLengthMm);
 assert.ok(b.commandedSubtotalSeconds>a.commandedSubtotalSeconds);
 assert.notEqual(a.scenarioId,b.scenarioId);
});
test("partial layer overshoot is warned and volume uses actual height",()=>{
 const p=planDedWall({...DED_WALL_EXAMPLE,wallHeightMm:8.4});
 assert.equal(p.layers,9);
 assert.equal(p.actualWallHeightMm,9);
 assert.equal(p.nominalVolumeMm3,1080);
 assert.ok(p.warnings.some(w=>w.includes("overshoots")));
});
test("machine fit is a box only, never a reach assertion",()=>{
 const fits=planDedWall({...DED_WALL_EXAMPLE,machineEnvelopeMm:{x:120,y:60,z:50}});
 const exceeds=planDedWall({...DED_WALL_EXAMPLE,machineEnvelopeMm:{x:90,y:60,z:50}});
 assert.equal(fits.envelopeCheck,"BOX_FITS");
 assert.ok(fits.warnings.some(w=>w.includes("not machine reach")));
 assert.equal(exceeds.envelopeCheck,"BOX_EXCEEDS");
 assert.ok(exceeds.warnings.some(w=>w.includes("exceeds")));
});
test("validation blocks nonexistent processes, bad dimensions, machine gaps and inconsistent wall",()=>{
 const modify=(patch:object)=>planDedWall({...DED_WALL_EXAMPLE,...patch});
 assert.throws(()=>modify({process:"DED_ARC_WIRE"}),/supported laser/);
 assert.throws(()=>modify({depositionSpeedMmS:0}),/speed/);
 assert.throws(()=>modify({beadWidthMm:0}),/Bead width/);
 assert.throws(()=>modify({beadHeightMm:0}),/Bead height/);
 assert.throws(()=>modify({substrateWidthMm:1}),/fit the substrate/);
 assert.throws(()=>modify({wallHeightMm:220}),/at most 200/);
 assert.throws(()=>modify({wallHeightMm:Infinity}),/Wall height/);
 assert.throws(()=>modify({powerW:-100}),/power/);
 assert.throws(()=>modify({batchSize:1.25}),/integer/);
 assert.throws(()=>modify({machineEnvelopeMm:{x:10,y:0,z:100}}),/Machine envelope y/);
 assert.doesNotThrow(()=>validateDedWall({...DED_WALL_EXAMPLE,process:"DED_LB_POWDER"}));
});
test("linear energy is a ratio in J/mm and cannot become a quality estimate",()=>{
 const p=planDedWall({...DED_WALL_EXAMPLE,powerW:300});
 assert.equal(p.linearEnergyJMm,60);
 assert.ok(p.limitations.some(w=>w.includes("no")||w.includes("No")));
});
test("single server reference flow matches hand-calculated FIFO arrival case",()=>{
 const p=planDedWall({...DED_WALL_EXAMPLE,wallHeightMm:1,wallLengthMm:60,interpassDwellS:0,
  depositionSpeedMmS:1,setupMin:0,cooldownMin:0,machiningMin:0,inspectionMin:0,batchSize:3,releaseIntervalMin:0});
 const f=simulateReferenceFlow(p);
 // 60 seconds per part = one minute; machine processes identical batch in 3 min.
 assert.deepEqual(f.completionsMin,[1,2,3]);
 assert.equal(f.completed,3);
 assert.equal(f.meanLeadTimeMin,2);
 assert.equal(f.meanQueueTimeMin,1);
 assert.equal(f.totalElapsedMin,3);
 assert.equal(f.throughputPerHour,60);
 assert.equal(f.utilization.ded_cell,1);
 assert.equal(f.utilization.technician,0);
});
test("flow does not invent scrap, failures or any Simio execution",()=>{
 const p=planDedWall(DED_WALL_EXAMPLE);
 const f=simulateReferenceFlow(p);
 assert.equal(f.completed,DED_WALL_EXAMPLE.batchSize);
 assert.ok(f.meanQueueTimeMin>=0);
 assert.ok(Object.values(f.utilization).every(n=>n>=0&&n<=1+1e-12));
 assert.ok(f.assumptions.some(s=>s.includes("no Simio")));
 assert.ok(!("firstPassYield" in f));
});
test("Simio exchange has complete deterministic CSV tables and explicit research labels",()=>{
 const p=planDedWall(DED_WALL_EXAMPLE), f=simulateReferenceFlow(p);
 const files=createSimioExchange(p,f);
 assert.deepEqual(Object.keys(files),["scenario.json","operations.csv","resources.csv","jobs.csv","tracks.csv","reference-results.csv"]);
 const manifest=JSON.parse(files["scenario.json"]);
 assert.equal(manifest.executableSimioModelIncluded,false);
 assert.equal(manifest.physicalQualificationEstablished,false);
 assert.equal(manifest.machineFeasibilityEstablished,false);
 assert.equal(manifest.engine,"orientai_reference_deterministic_des");
 assert.ok(files["operations.csv"].includes('"ideal_commanded_motion_plus_dwell"'));
 assert.equal(files["jobs.csv"].trim().split(/\r?\n/).length,6);
 assert.equal(files["tracks.csv"].trim().split(/\r?\n/).length,9);
 assert.deepEqual(files,createSimioExchange(p,f));
});
test("ZIP archive includes all CSV and manifest members with sane central directory",()=>{
 const p=planDedWall(DED_WALL_EXAMPLE), f=simulateReferenceFlow(p);
 const files=createSimioExchange(p,f),zip=zipTextFiles(files);
 assert.equal(new DataView(zip.buffer).getUint32(0,true),0x04034b50);
 assert.equal(new DataView(zip.buffer).getUint32(zip.length-22,true),0x06054b50);
 assert.equal(new DataView(zip.buffer).getUint16(zip.length-12,true),6);
 assert.ok(zip.length>Object.values(files).join("").length);
 assert.throws(()=>zipTextFiles({"../bad.csv":"x"}),/Invalid archive/);
});
