import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {ORIENTAI_BENCHMARKS,createOrientaiBenchmarkStl} from "../lib/orientai-benchmark-parts";
import {auditSTL} from "../lib/stl-mesh-audit";
import {slicePhysicalStl} from "../lib/lpbf-physical-slicer";
import {analyzeOrientations} from "../lib/orientation-engine";

const digest=(input:ArrayBuffer)=>createHash("sha256").update(Buffer.from(input)).digest("hex");
const options={unitScaleToMm:1,xyPitchMm:1,layerThicknessMm:1};

// Predeclared, SYNTHETIC geometry-only acceptance thresholds (not machine CTQs).
// Exact prismatic fixtures should close on the 1mm study grid; the 128-sided
// circular sleeve is raster-sampled and may differ by up to 2% in volume.
test("All public benchmark meshes are deterministic, closed, and consistently oriented",()=>{
  for(const benchmark of ORIENTAI_BENCHMARKS){
    const bytes=createOrientaiBenchmarkStl(benchmark.id);
    const repeat=createOrientaiBenchmarkStl(benchmark.id);
    assert.equal(digest(bytes),digest(repeat),benchmark.id);
    assert.equal(new DataView(bytes).getUint32(80,true),(bytes.byteLength-84)/50);
    const audit=auditSTL(bytes,1);
    assert.equal(audit.openEdges,0,benchmark.id);
    assert.equal(audit.nonManifoldEdges,0,benchmark.id);
    assert.equal(audit.disconnectedShells,1,benchmark.id);
    assert.ok(audit.solidVolumeMm3!==null,benchmark.id);
    assert.ok(Math.abs(audit.solidVolumeMm3!-benchmark.nominalVolumeMm3)/benchmark.nominalVolumeMm3<0.00001,benchmark.id);
  }
});

test("M04 actual-STL layers preserve prismatic study geometry and source SHA",async()=>{
  for(const id of ["calibration-cube","l-bracket","unsupported-bridge"] as const){
    const bytes=createOrientaiBenchmarkStl(id);
    const meta=ORIENTAI_BENCHMARKS.find(x=>x.id===id)!;
    const sliced=await slicePhysicalStl(bytes,options);
    assert.equal(sliced.partSha256,digest(bytes));
    assert.equal(sliced.grid.physicalLayers,meta.nominalHeightMm);
    assert.equal(sliced.layers.length,meta.nominalHeightMm);
    assert.ok(Math.abs(sliced.geometry.analyticalMeshVolumeMm3-meta.nominalVolumeMm3)<0.01,id);
    assert.ok(sliced.geometry.relativeVolumeDifference<=0.01,id);
    assert.ok(sliced.layers.every((layer,i)=>layer.layer===i&&Math.abs(layer.topZMm-layer.bottomZMm-1)<1e-7));
    assert.equal(sliced.status,"SAMPLED_GEOMETRY_REVIEW_REQUIRED");
  }
});

test("M04 annular sleeve preserves hollow center and remains inside declared 2% volume tolerance",async()=>{
  const bytes=createOrientaiBenchmarkStl("thin-walled-sleeve");
  const result=await slicePhysicalStl(bytes,options);
  assert.equal(result.grid.physicalLayers,32);
  assert.equal(result.grid.columns,24);
  assert.equal(result.grid.rows,24);
  assert.ok(result.geometry.relativeVolumeDifference<0.02,
    "Sleeve sampled volume error "+result.geometry.relativeVolumeDifference);
  const holeX=Math.floor((12-result.grid.originMm.x)/result.grid.xyPitchMm);
  const holeY=Math.floor((12-result.grid.originMm.y)/result.grid.xyPitchMm);
  assert.ok(result.layers.every(l=>!l.cells.some(c=>c.x===holeX&&c.y===holeY)),
    "Hollow center must not be fabricated as solid geometry");
});

test("Rotation changes physical layer count while retaining source identity",async()=>{
  for(const [id,baseline,rotated] of [
    ["thin-walled-sleeve",32,24],
    ["l-bracket",34,18],
    ["unsupported-bridge",24,15]
  ] as const){
    const bytes=createOrientaiBenchmarkStl(id);
    const first=await slicePhysicalStl(bytes,options);
    const alternative=await slicePhysicalStl(bytes,{...options,rotationDeg:{x:90,y:0,z:0}});
    assert.equal(first.grid.physicalLayers,baseline,id);
    assert.equal(alternative.grid.physicalLayers,rotated,id);
    assert.equal(alternative.partSha256,first.partSha256);
    assert.ok(Math.abs(first.geometry.analyticalMeshVolumeMm3-alternative.geometry.analyticalMeshVolumeMm3)<0.001,id);
    assert.equal(alternative.geometry.rotationDeg.x,90);
    assert.equal(alternative.status,"SAMPLED_GEOMETRY_REVIEW_REQUIRED");
  }
});

test("Orientation engine ingests the same STL fixtures; baseline bridge has 420mm² elevated downward roof",()=>{
  const bytes=createOrientaiBenchmarkStl("unsupported-bridge");
  const analyzed=analyzeOrientations(bytes,{
    machine:{x:150,y:150,z:150},searchSamples:0,unitScale:1,layerHeightMm:.05,
    overhangDeg:45,weights:{support:50,height:30,contact:20}
  });
  const baseline=analyzed.candidates.find(c=>c.rotation.x===0&&c.rotation.y===0&&c.rotation.z===0);
  assert.ok(baseline,"Original orientation must be represented");
  assert.equal(baseline!.buildHeightMm,24);
  assert.equal(baseline!.estimatedLayers,480);
  // The independent study excluded fully plate-contacting bottom triangles.
  // Current engine reports all downward-facing area, including plate contact.
  assert.ok(Math.abs((baseline!.downFacingAreaMm2-baseline!.contactAreaMm2)-420)<0.1);
  assert.ok(analyzed.candidates.some(c=>Math.abs(c.buildHeightMm-15)<1e-6));
  assert.equal(analyzed.qualification,"RESEARCH_ONLY");
});

test("Physical-slice outputs remain geometry-only and cannot bypass confirmed units",async()=>{
  const bytes=createOrientaiBenchmarkStl("calibration-cube");
  await assert.rejects(slicePhysicalStl(bytes,{...options,unitScaleToMm:0}),/Confirm STL coordinate units/);
  const sliced=await slicePhysicalStl(bytes,options);
  assert.ok(sliced.diagnostics.some(d=>/Not exact polygon/i.test(d)));
  assert.ok(!JSON.stringify(sliced).includes("predictedPrintSuccess"));
});
