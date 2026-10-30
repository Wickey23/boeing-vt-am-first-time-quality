import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {slicePhysicalStl} from "../lib/lpbf-physical-slicer";

const fixture=async(name:string)=>{const b=await readFile("public/verification/"+name+".stl");return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
const sha=(b:ArrayBuffer)=>createHash("sha256").update(Buffer.from(b)).digest("hex");

test("M04 cube has ten actual, one-mm physical layers and conservative volume accounting",async()=>{
 const input=await fixture("cube-10mm");
 const result=await slicePhysicalStl(input,{unitScaleToMm:1,xyPitchMm:1,layerThicknessMm:1});
 assert.equal(result.partSha256,sha(input));
 assert.equal(result.grid.physicalLayers,10);
 assert.equal(result.grid.columns,10);
 assert.equal(result.grid.rows,10);
 assert.equal(result.grid.originMm.z,-5);
 assert.ok(Math.abs(result.geometry.analyticalMeshVolumeMm3-1000)<1e-8);
 assert.ok(Math.abs(result.geometry.sampledVolumeMm3-1000)<1e-7);
 assert.ok(result.geometry.relativeVolumeDifference<1e-9);
 assert.equal(result.grid.boundaryCells,0);
 for(let i=0;i<10;i++){
  const layer=result.layers[i];
  assert.equal(layer.layer,i);
  assert.equal(layer.bottomZMm,-5+i);
  assert.equal(layer.topZMm,-4+i);
  assert.equal(layer.cells.length,100);
  assert.equal(layer.areaMm2,100);
  assert.ok(layer.cells.every(c=>c.coverage===1));
 }
 assert.equal(result.status,"SAMPLED_GEOMETRY_REVIEW_REQUIRED");
 assert.match(result.diagnostics.join(" "),/not exact polygon|Not exact polygon/i);
});

test("M04 units, placement and build rotation are part of physical coordinate identity",async()=>{
 const input=await fixture("cube-10mm");
 const rotated=await slicePhysicalStl(input,{unitScaleToMm:1,xyPitchMm:1,layerThicknessMm:1,
  rotationDeg:{x:0,y:0,z:90},translationMm:{x:20,y:0,z:10}});
 assert.equal(rotated.grid.originMm.x,15);
 assert.equal(rotated.grid.originMm.z,5);
 assert.equal(rotated.layers[0].sampleZMm,5.5);
 assert.equal(rotated.partSha256,sha(input));
 assert.ok(Math.abs(rotated.geometry.sampledVolumeMm3-1000)<1e-6);
 const scaled=await slicePhysicalStl(input,{unitScaleToMm:10,xyPitchMm:5,layerThicknessMm:1});
 assert.ok(Math.abs(scaled.geometry.analyticalMeshVolumeMm3-1000*10**3)<1e-5);
 assert.equal(scaled.grid.physicalLayers,100);
 assert.ok(scaled.grid.originMm.z<=-50);
});

test("M04 sleeve retains an actual material hole, unlike a bounding-box fill",async()=>{
 const input=await fixture("aerospace-nozzle-sleeve");
 const result=await slicePhysicalStl(input,{unitScaleToMm:1,xyPitchMm:1,layerThicknessMm:1});
 assert.equal(result.grid.physicalLayers,36);
 const layer=result.layers[10];
 assert.ok(layer.cells.length>0);
 assert.ok(layer.areaMm2<Math.PI*13**2);
 assert.ok(layer.areaMm2>100);
 const centerX=Math.floor((0-result.grid.originMm.x)/result.grid.xyPitchMm);
 const centerY=Math.floor((0-result.grid.originMm.y)/result.grid.xyPitchMm);
 assert.ok(!layer.cells.some(c=>c.x===centerX&&c.y===centerY),"hollow center must not be filled");
 assert.equal(result.status,"SAMPLED_GEOMETRY_REVIEW_REQUIRED");
});

test("M04 thin-feature and angled bracket fixtures are measured, never qualified",async()=>{
 const thin=await slicePhysicalStl(await fixture("aerospace-thin-wall-channel"),
  {unitScaleToMm:1,xyPitchMm:2,layerThicknessMm:1});
 const bracket=await slicePhysicalStl(await fixture("aerospace-overhang-bracket"),
  {unitScaleToMm:1,xyPitchMm:2,layerThicknessMm:1,rotationDeg:{x:0,y:0,z:22}});
 assert.ok(thin.layers.length>1);
 assert.ok(bracket.layers.length>1);
 assert.ok(thin.geometry.sampledVolumeMm3>0&&Number.isFinite(thin.geometry.relativeVolumeDifference));
 assert.ok(bracket.geometry.sampledVolumeMm3>0&&Number.isFinite(bracket.geometry.relativeVolumeDifference));
 assert.ok(bracket.grid.maxGeometryDeviationMm>0);
 assert.ok(thin.diagnostics.some(d=>/thin|resolution|partial/i.test(d)));
 assert.equal(bracket.status,"SAMPLED_GEOMETRY_REVIEW_REQUIRED");
});

test("M04 fails closed on open STL, oversized grid and invalid units",async()=>{
 await assert.rejects(slicePhysicalStl(await fixture("invalid-open-surface"),
  {unitScaleToMm:1,xyPitchMm:1,layerThicknessMm:1}),/mesh topology blocks|open edges/);
 const cube=await fixture("cube-10mm");
 await assert.rejects(slicePhysicalStl(cube,{unitScaleToMm:0,xyPitchMm:1,layerThicknessMm:1}),/Confirm STL coordinate units/);
 await assert.rejects(slicePhysicalStl(cube,{unitScaleToMm:1,xyPitchMm:.04,layerThicknessMm:.01}),/exceeds/);
 await assert.rejects(slicePhysicalStl(cube,{unitScaleToMm:1,xyPitchMm:1,layerThicknessMm:1,translationMm:{x:Infinity,y:0,z:0}}),/Invalid build placement/);
});
