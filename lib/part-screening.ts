// Geometry-only failure-risk screening: no claims of thermal, stress, porosity or cracking prediction.
export type ScreenCandidate={
 id:string;feasible:boolean;fitsEnvelope:boolean;buildHeightMm:number;
 downFacingAreaMm2:number;supportProxyMm3:number;overhangFraction:number;
 contactAreaMm2:number;dimensions:{x:number;y:number;z:number};score:number;rank:number
};
export type Finding={code:string;severity:"blocker"|"review";message:string;basis:string};
export function screenCandidate(c:ScreenCandidate,all:ScreenCandidate[]):Finding[]{
 const findings:Finding[]=[];
 if(!c.fitsEnvelope)findings.push({code:"BUILD_ENVELOPE",severity:"blocker",message:"Part does not satisfy configured geometric build constraints.",basis:"Rotated bounding box vs machine envelope"});
 if(c.fitsEnvelope&&!c.feasible)findings.push({code:"SUPPORT_LIMIT",severity:"blocker",message:"Support proxy exceeds the configured limit.",basis:"Geometric proxy vs user limit; not a machine-envelope violation"});
 if(c.downFacingAreaMm2>0&&c.overhangFraction>0.25) findings.push({code:"DOWN_FACING",severity:"review",message:"High fraction of down-facing surface; inspect and verify support strategy.",basis:"Geometric area fraction >25%; screening threshold, not a defect probability"});
 if(c.contactAreaMm2===0) findings.push({code:"PLATE_CONTACT",severity:"review",message:"No downward-oriented near-bed triangle area detected; check plate contact and fixation.",basis:"Triangle proximity/contact heuristic; does not calculate adhesion"});
 const feasible=all.filter(x=>x.feasible);
 if(feasible.length>1){
 const minSupport=Math.min(...feasible.map(x=>x.supportProxyMm3));
 if(c.supportProxyMm3>Math.max(1,minSupport)*2&&c.supportProxyMm3>100) findings.push({code:"SUPPORT_COMPARISON",severity:"review",message:"Support-volume proxy is more than twice the minimum feasible candidate; verify accessibility and removal.",basis:"Relative geometric proxy; not slicer output"});
 }
 return findings;
}
export const UNAVAILABLE_PHYSICS=[
 {label:"Part-specific thermal field",state:"Not calculated",detail:"Run the reviewed steady-conduction case below. Transient laser heating and layer deposition are not implemented."},
 {label:"Residual stress and distortion",state:"Not calculated",detail:"Requires transient thermomechanical analysis, appropriate constraints and calibration."},
 {label:"Service-load stress and displacement",state:"Not calculated",detail:"Run the reviewed linear-elastic case below. Bottom clamp and top-face loads are idealized; no residual stress is computed."},
 {label:"Porosity, cracking and first-time failure",state:"Not calculated",detail:"Requires verified process and defect models plus physical validation."}
] as const;
