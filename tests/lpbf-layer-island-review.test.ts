import {test} from "node:test";
import assert from "node:assert/strict";
import {reviewPhysicalLayerIslands} from "../lib/lpbf-layer-island-review";
import type {PhysicalSliceResult,PhysicalSliceCell} from "../lib/lpbf-physical-slicer";

const make=(layers:PhysicalSliceCell[][],columns=5,rows=5)=>
 ({partSha256:"d".repeat(64),
  grid:{columns,rows,xyPitchMm:1,physicalLayers:layers.length},
  layers:layers.map((cells,i)=>({layer:i,cells}))} as unknown as PhysicalSliceResult);
const cell=(x:number,y:number,coverage=1)=>({x,y,coverage});
test("unchanged cube footprint on successive layers has no new island candidates",()=>{
 const slices=make([[cell(1,1),cell(1,2)],[cell(1,1),cell(1,2)],[cell(1,1),cell(1,2)]]);
 const r=reviewPhysicalLayerIslands(slices);
 assert.equal(r.candidateCount,0);
 assert.equal(r.inspectedComponents,2);
});
test("new disconnected XY component with no previous cell overlap is located by layer",()=>{
 const slices=make([[cell(1,1)],[cell(1,1),cell(4,4)],[cell(1,1),cell(4,4)]]);
 const r=reviewPhysicalLayerIslands(slices);
 assert.equal(r.candidateCount,1);
 assert.equal(r.islands[0].layer,1);
 assert.equal(r.islands[0].sampledCellCount,1);
 assert.deepEqual(r.islands[0].cells,[{x:4,y:4}]);
 assert.equal(r.islands[0].areaMm2,1);
 assert.match(r.notes[1],/misclassified/);
});
test("partial sampled-cell fractions contribute fractional area, not full cells",()=>{
 const r=reviewPhysicalLayerIslands(make([[cell(0,0)],[cell(0,0),cell(3,3,.25)]]));
 assert.equal(r.islands[0].areaMm2,.25);
});
test("diagonal-only adjacent regions are review candidates with four-neighbor connectivity",()=>{
 const r=reviewPhysicalLayerIslands(make([[cell(0,0)],[cell(1,1)]]));
 assert.equal(r.candidateCount,1);
});
test("corrupt hashes and oversized raster grids reject before iterating",()=>{
 const r=make([[cell(0,0)]]);
 r.partSha256="bad";
 assert.throws(()=>reviewPhysicalLayerIslands(r),/Invalid or oversized/);
 const tooLarge=make([[cell(0,0)]],500000,500000);
 assert.throws(()=>reviewPhysicalLayerIslands(tooLarge),/Invalid or oversized/);
});
