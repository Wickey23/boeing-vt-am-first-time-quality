import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {slicePhysicalStl} from "../lib/lpbf-physical-slicer";
import {estimateLayerBuildTime,previewIllustrativeLayerHatches} from "../lib/metal-layer-planning";

const fixture=async()=>{const b=await readFile("public/verification/cube-10mm.stl");return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
test("sampled 10 mm cube has numerical, engineer-defined per-layer timing, not machine time",async()=>{
 const slices=await slicePhysicalStl(await fixture(),{unitScaleToMm:1,xyPitchMm:1,layerThicknessMm:1});
 const plan=estimateLayerBuildTime(slices,{
  hatchSpacingMm:1,hatchSpeedMmS:100,contourSpeedMmS:50,
  secondsPerRecoat:4,setupSeconds:120,cooldownSeconds:300
 });
 assert.equal(plan.type,"UNVALIDATED_GEOMETRY_ONLY_SCENARIO");
 assert.equal(plan.layerDetails.length,10);
 assert.equal(plan.layerDetails[0].sampledEdgeLengthMm,40);
 assert.equal(plan.layerDetails[0].estimatedHatchLengthMm,100);
 assert.ok(Math.abs(plan.layerDetails[0].estimatedLayerSeconds-5.8)<1e-9);
 assert.ok(Math.abs(plan.totalSeconds-478)<1e-9);
 assert.match(plan.warnings[0],/not a sliced LPBF machine time/i);
 assert.equal(plan.partSha256,slices.partSha256);
});
test("bounded hatch preview returns real occupied grid rows, not printer commands",async()=>{
 const slices=await slicePhysicalStl(await fixture(),{unitScaleToMm:1,xyPitchMm:1,layerThicknessMm:1});
 const hatch=previewIllustrativeLayerHatches(slices,0,1);
 assert.equal(hatch.length,10);
 assert.ok(hatch.every(x=>Math.abs(x.x1Mm-x.x0Mm-10)<1e-9));
 assert.ok(hatch.every(x=>Math.abs(x.y0Mm-x.y1Mm)<1e-9));
 assert.throws(()=>previewIllustrativeLayerHatches(slices,11,1),/Select/);
});
test("time scenarios reject invalid unsupported input instead of claiming a print quote",async()=>{
 const slices=await slicePhysicalStl(await fixture(),{unitScaleToMm:1,xyPitchMm:1,layerThicknessMm:1});
 const plan={hatchSpacingMm:1,hatchSpeedMmS:100,contourSpeedMmS:50,secondsPerRecoat:5,setupSeconds:0,cooldownSeconds:0};
 assert.throws(()=>estimateLayerBuildTime(slices,{...plan,hatchSpacingMm:0}),/Hatch spacing/);
 assert.throws(()=>estimateLayerBuildTime(slices,{...plan,hatchSpeedMmS:Infinity}),/Hatch scan speed/);
 assert.throws(()=>estimateLayerBuildTime(slices,{...plan,secondsPerRecoat:-2}),/Recoat time/);
});
