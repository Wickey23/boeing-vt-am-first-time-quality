/**
 * M06 research bridge: turn a sufficiently resolved, sampled *real STL* raster
 * into the existing 3D physical-layer finite-volume solver inputs.
 *
 * This deliberately refuses fractional/partially represented cells, invalid
 * source IDs, scan misregistration, and oversized work. Mass, face area and
 * heat transfer in the current solver assume full rectangular cells; using
 * fractionally occupied boundary cells as full mass is physically misleading.
 * This bridge is NOT a CAD-fidelity mesher or an aerospace process validator.
 */
import {PHYSICAL_SLICER_VERSION,type PhysicalSliceResult} from "./lpbf-physical-slicer";
import {SLICE_REGISTRATION_VERSION,type RegisteredPhysicalScan} from "./lpbf-slice-registration";
import {PHYSICAL_SCAN_VERSION,type PhysicalScanPlan} from "./lpbf-physical-schedule";
import type {PartialLayerInputs,Cell3} from "./lpbf-partial-layer";

export const STL_PARTIAL_LAYER_BRIDGE_VERSION="orientai-stl-grid-bridge-v0.1";
export type ResearchMaterial={
 powerCouplingFraction:number;beamRadiusMm:number;
 densityKgM3:number;specificHeatJKgK:number;
 powderConductivityWmK:number;solidConductivityWmK:number;
 convectionWm2K:number;ambientTemperatureC:number;plateTemperatureC:number;
};
export function buildStlPartialLayerInputs(args:{
 slices:PhysicalSliceResult;registration:RegisteredPhysicalScan;
 scan:PhysicalScanPlan;material:ResearchMaterial;
}):PartialLayerInputs{
 const {slices,registration,scan,material}=args;
 if(slices.version!==PHYSICAL_SLICER_VERSION||
    registration.version!==SLICE_REGISTRATION_VERSION||
    scan.version!==PHYSICAL_SCAN_VERSION)
  throw Error("Slicer/scan/registration versions differ; preflight must be repeated.");
 if(registration.partSha256!==slices.partSha256||
    registration.geometryVersion!==slices.version||
    !/^[a-f0-9]{64}$/.test(registration.scanSourceSha256))
  throw Error("Physical scan or geometry identity is stale.");
 if(registration.status!=="GEOMETRY_REGISTERED_RESEARCH_ONLY"||
    registration.blockers.length||registration.beamSamplesOutsideMaterial)
  throw Error("Scan-to-STL preflight is blocked. Correct all geometry/chronology errors first.");
 const {grid,geometry,layers}=slices;
 if(grid.physicalLayers<2||grid.physicalLayers>40)
  throw Error("Existing partial-layer solver is limited to 2–40 sampled physical layers.");
 if(grid.representedCells<2||grid.representedCells>1500)
  throw Error("Existing partial-layer solver is limited to 2–1,500 full rectangular cells.");
 if(grid.boundaryCells!==0||layers.some(l=>l.partialCells!==0||l.cells.some(c=>c.coverage!==1)))
  throw Error("Fractional boundary cells cannot enter the constant-volume research solver; exact cell boundary/partial-volume mass and heat transfer are not implemented.");
 if(geometry.relativeVolumeDifference>.02)
  throw Error("Sampled STL volume differs from enclosed triangle volume by >2%; improve representation before solving.");
 if(layers.length!==grid.physicalLayers||layers.some((l,i)=>l.layer!==i||l.cells.length===0))
  throw Error("A physical STL layer is missing or misindexed.");
 if(registration.geometry.pitchMm!==grid.xyPitchMm||
    registration.geometry.layerHeightMm!==grid.layerThicknessMm||
    registration.geometry.physicalLayers!==grid.physicalLayers||
    registration.geometry.sampledCells!==grid.representedCells)
  throw Error("Physical grid changed since scan preflight.");
 const cells:Cell3[]=layers.flatMap(l=>l.cells.map(c=>[c.x,c.y,l.layer] as Cell3));
 return {
  pitchMm:grid.xyPitchMm,layerHeightMm:grid.layerThicknessMm,
  originMm:{...grid.originMm},cells,
  partSha256:slices.partSha256,sourceSha256:registration.scanSourceSha256,
  scan, ...material
 };
}
