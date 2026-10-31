/**
 * Source-derived candidate layer-island screening from sampled STL physical
 * slices. Does NOT verify metal support geometry, overhang bridges, machine
 * recoater clearance, support thermal anchoring, or print failure.
 */
import type {PhysicalSliceResult} from "./lpbf-physical-slicer";
export const LPBF_LAYER_ISLAND_VERSION="orientai-physical-layer-island-review-v1";
export type CandidateLayerIsland={
 layer:number;component:number;sampledCellCount:number;areaMm2:number;
 centroidGrid:{x:number;y:number};cells:{x:number;y:number}[];
};
export type LayerIslandReview={
 version:typeof LPBF_LAYER_ISLAND_VERSION;partSha256:string;xyPitchMm:number;
 physicalLayerCount:number;inspectedComponents:number;candidateCount:number;
 islands:CandidateLayerIsland[];
 notes:string[];
};
export function reviewPhysicalLayerIslands(slices:PhysicalSliceResult):LayerIslandReview{
 const {columns,rows,xyPitchMm}=slices.grid;
 if(!/^[a-f0-9]{64}$/.test(slices.partSha256)||!Number.isInteger(columns)||!Number.isInteger(rows)||
  columns<1||rows<1||columns*rows*slices.layers.length>180000)
  throw Error("Invalid or oversized source-derived layer raster.");
 if(!Number.isFinite(xyPitchMm)||xyPitchMm<=0||slices.layers.length!==slices.grid.physicalLayers)
  throw Error("Invalid physical layer grid geometry.");
 const islands:CandidateLayerIsland[]=[];let inspected=0;
 const occupied=(layer:number)=>new Map(slices.layers[layer].cells.map(c=>[c.y*columns+c.x,c]));
 for(let layer=1;layer<slices.layers.length;layer++){
  const cells=occupied(layer),previous=occupied(layer-1),visited=new Set<number>();
  for(const key of cells.keys()){
   if(visited.has(key))continue;
   const queue=[key],component:number[]=[];
   visited.add(key);
   for(let head=0;head<queue.length;head++){
    const now=queue[head],x=now%columns,y=Math.floor(now/columns);
    component.push(now);
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
     const xx=x+dx,yy=y+dy;
     if(xx<0||xx>=columns||yy<0||yy>=rows)continue;
     const next=yy*columns+xx;
     if(cells.has(next)&&!visited.has(next)){visited.add(next);queue.push(next);}
    }
   }
   inspected++;
   // Require only a raster overlap, not an assumed 3D structural bond.
   if(component.some(index=>previous.has(index)))continue;
   if(islands.length>=200)continue;
   let area=0,cx=0,cy=0;
   for(const index of component){
    const c=cells.get(index)!;
    const weight=Math.max(0,Math.min(1,c.coverage));
    area+=weight*xyPitchMm*xyPitchMm;cx+=(c.x+.5)*weight;cy+=(c.y+.5)*weight;
   }
   const weightSum=area/(xyPitchMm*xyPitchMm);
   islands.push({layer,component:inspected,sampledCellCount:component.length,areaMm2:area,
    centroidGrid:{x:weightSum>0?cx/weightSum:0,y:weightSum>0?cy/weightSum:0},
    cells:component.slice(0,1500).map(index=>({x:index%columns,y:Math.floor(index/columns)}) )});
  }
 }
 return {version:LPBF_LAYER_ISLAND_VERSION,partSha256:slices.partSha256,
  xyPitchMm,physicalLayerCount:slices.grid.physicalLayers,inspectedComponents:inspected,
  candidateCount:islands.length,islands,
  notes:[
   "A candidate island is a connected XY raster component with no exact occupied-cell overlap in the preceding sampled physical layer.",
   "The layer raster uses 4-ray occupancy samples; diagonal bridges, thin overhangs, intentional supports and sub-pitch structures can be misclassified.",
   "No metal support, thermal conduction, recoater or manufacturing failure is simulated. Review in CAD and the actual qualified build-preparation software."
  ]};
}
