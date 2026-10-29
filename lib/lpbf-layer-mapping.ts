/**
 * Geometric layer-index correspondence only. It is NOT a machine scan
 * strategy, a physical layer-resolved heat input, or experimental registration.
 */
export const LAYER_MAP_VERSION="lpbf-geometry-layer-index-0.1";
export type NominalLayerMap={
 version:typeof LAYER_MAP_VERSION;
 physicalLayerThicknessMm:number;
 physicalLayerCount:number;
 virtualCellHeightMm:number;
 buildHeightMm:number;
 slabs:Array<{
  slab:number;voxelZIndex:number;bottomMm:number;topMm:number;
  nominalPhysicalLayerIndices:number[];
 }>;
 unmappedNominalIndices:number[];
 disclaimer:string;
};
export function nominalLayerMap(args:{
 buildHeightMm:number;physicalLayerThicknessMm:number;
 virtualCellHeightMm:number;occupiedZIndices:number[];
}):NominalLayerMap{
 const {buildHeightMm:H,physicalLayerThicknessMm:t,virtualCellHeightMm:h,occupiedZIndices:zs}=args;
 if(!Number.isFinite(H)||H<=0||H>5000||!Number.isFinite(t)||t<=0||t>1||
    !Number.isFinite(h)||h<=0||h>H||!Array.isArray(zs)||!zs.length||zs.length>100)
  throw Error("Invalid nominal layer geometry or thickness.");
 if(zs.some((z,i)=>!Number.isInteger(z)||z<0||z*h>=H+1e-8||(i>0&&z<=zs[i-1])))
  throw Error("Occupied thermal slab indices must be strictly increasing, in bounds.");
 const n=Math.ceil(H/t);
 if(n>100000)throw Error("Too many nominal physical layers to map safely.");
 const slabs=zs.map((z,i)=>({slab:i,voxelZIndex:z,bottomMm:z*h,topMm:Math.min(H,(z+1)*h),nominalPhysicalLayerIndices:[] as number[]}));
 const unmappedNominalIndices:number[]=[];
 for(let layer=0;layer<n;layer++){
  const bottom=layer*t,top=Math.min(H,(layer+1)*t),center=(bottom+top)/2;
  const voxel=Math.min(Math.floor((H-1e-12)/h),Math.floor(center/h));
  const slab=slabs.find(s=>s.voxelZIndex===voxel);
  if(slab)slab.nominalPhysicalLayerIndices.push(layer);
  else unmappedNominalIndices.push(layer);
 }
 return {
  version:LAYER_MAP_VERSION,physicalLayerThicknessMm:t,physicalLayerCount:n,
  virtualCellHeightMm:h,buildHeightMm:H,slabs,unmappedNominalIndices,
  disclaimer:"Nominal layer CENTER-to-voxel grouping based on STL height only. It neither reconstructs commanded machine layer trajectories nor merges their energy/time correctly. Never treat virtual slabs as physical layers or use this as an automatic real-scan importer."
 };
}
