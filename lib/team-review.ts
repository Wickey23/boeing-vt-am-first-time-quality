/** Research-only geometry calculations. No printer qualification is implied. */
export type RawMetrics = {
 dimensions:{x:number;y:number;z:number};
 surfaceAreaMm2:number;volumeMm3:number;triangleCount:number;
 watertightEstimate:"LIKELY"|"REVIEW";aspectRatio:number;
};
export type AxisFit={name:string;dimensionsMm:[number,number,number];fits:boolean;clearanceMm:[number,number,number]};
export function isUsableMetrics(v:unknown):v is RawMetrics {
 if(!v||typeof v!=="object")return false;
 const m=v as Partial<RawMetrics>;
 const d=m.dimensions;
 return !!d&&[d.x,d.y,d.z,m.surfaceAreaMm2,m.volumeMm3,m.triangleCount,m.aspectRatio].every(n=>typeof n==="number"&&Number.isFinite(n)&&n>=0)
 &&(m.triangleCount||0)>0 && (m.watertightEstimate==="LIKELY"||m.watertightEstimate==="REVIEW");
}
export function normalizeToMm(m:RawMetrics,units:"mm"|"in"):RawMetrics {
 const k=units==="in"?25.4:1;
 return {...m,dimensions:{x:m.dimensions.x*k,y:m.dimensions.y*k,z:m.dimensions.z*k},
 surfaceAreaMm2:m.surfaceAreaMm2*k*k,volumeMm3:m.volumeMm3*k*k*k};
}
export function evaluateAxisFits(m:RawMetrics,envelope:{x:number;y:number;z:number}):AxisFit[]{
 const x=m.dimensions.x,y=m.dimensions.y,z=m.dimensions.z;
 const options:[string,[number,number,number]][]=[
 ["As uploaded (XYZ)",[x,y,z]],["Rotate X 90° (XZY)",[x,z,y]],
 ["Rotate Y 90° (ZYX)",[z,y,x]],["Rotate Z 90° (YXZ)",[y,x,z]],
 ["Alternate (YZX)",[y,z,x]],["Alternate (ZXY)",[z,x,y]]];
 return options.map(([name,dimensionsMm])=>{
  const clearanceMm:[number,number,number]=[envelope.x-dimensionsMm[0],envelope.y-dimensionsMm[1],envelope.z-dimensionsMm[2]];
  return {name,dimensionsMm,fits:clearanceMm.every(v=>v>=0)};
 });
}
export const researchNotice="Screening only. This is not structural FEA, overhang/support analysis, a qualified printer build, or flight-part approval.";
