/**
 * Deterministic LPBF geometric preflight. No physics, reliability percentages,
 * inferred crack/porosity likelihoods, or universal machine limits.
 * A flagged triangle is a location to review, never a predicted defect.
 */
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";
import {Euler,Vector3} from "three";
import {auditSTL,type MeshAudit} from "./stl-mesh-audit";

export const LPBF_PREFLIGHT_VERSION="orientai-lpbf-geometric-preflight-v1";
export type Axis3={x:number;y:number;z:number};
export type PreflightSeverity="blocker"|"attention"|"unassessed";
export type PreflightFinding={
 code:string;severity:PreflightSeverity;title:string;observation:string;
 evidence:string;nextAction:string;triangleIds:number[];
};
export type LpbfPreflight={
 version:typeof LPBF_PREFLIGHT_VERSION;sourceSha256:string;unitScaleToMm:number;
 rotationDeg:Axis3;assumedEnvelopeMm:Axis3;overhangThresholdDeg:number;
 geometry:{triangles:number;boundsMm:Axis3;totalAreaMm2:number;bedFacingAreaMm2:number;
  elevatedDownFacingAreaMm2:number;elevatedDownFacingFraction:number;
  downFacingTriangleCount:number;bedContactAreaProxyMm2:number;
  elevatedSupportProxyMm3:number;lowestVertexOffsetMm:number};
 audit:MeshAudit;findings:PreflightFinding[];
};
const finite=(n:number,lo:number,hi:number)=>Number.isFinite(n)&&n>=lo&&n<=hi;
const fmt=(n:number)=>n.toFixed(n<10?3:1);
export function screenLpbfPreflight(data:ArrayBuffer,scale:number,
 rotationDeg:Axis3,envelopeMm:Axis3,overhangThresholdDeg:number,
 sourceSha256:string):LpbfPreflight{
 if(!/^[a-f0-9]{64}$/.test(sourceSha256))throw Error("A verified STL hash is required.");
 if(!(data instanceof ArrayBuffer)||!data.byteLength||data.byteLength>20*1024*1024)throw Error("The STL must be 1–20 MB.");
 if(!finite(scale,.001,10000))throw Error("Confirm a valid STL unit-to-mm scale.");
 if(!finite(overhangThresholdDeg,0,89))throw Error("Invalid down-facing screening angle.");
 for(const k of ["x","y","z"] as const){
  if(!finite(rotationDeg[k],-360,360))throw Error("Invalid build rotation "+k+".");
  if(!finite(envelopeMm[k],1,20000))throw Error("Invalid configured build envelope "+k+".");
 }
 const audit=auditSTL(data,scale);
 const mesh=new STLLoader().parse(data),position=mesh.getAttribute("position");
 if(!position||!position.count||position.count%3!==0||position.count>900000)
  throw Error("Invalid or excessively large STL triangles.");
 const initialMin=new Vector3(Infinity,Infinity,Infinity);
 const initialMax=new Vector3(-Infinity,-Infinity,-Infinity);
 for(let i=0;i<position.count;i++){
  const p=new Vector3(position.getX(i)*scale,position.getY(i)*scale,position.getZ(i)*scale);
  if(![p.x,p.y,p.z].every(Number.isFinite))throw Error("Nonfinite STL coordinates.");
  initialMin.min(p);initialMax.max(p);
 }
 const pivot=initialMin.clone().add(initialMax).multiplyScalar(.5);
 const e=new Euler(rotationDeg.x*Math.PI/180,rotationDeg.y*Math.PI/180,
  rotationDeg.z*Math.PI/180,"XYZ");
 const bottom=new Vector3(Infinity,Infinity,Infinity),top=new Vector3(-Infinity,-Infinity,-Infinity);
 const rotated:Vector3[]=[];
 for(let i=0;i<position.count;i++){
  const p=new Vector3(position.getX(i)*scale,position.getY(i)*scale,position.getZ(i)*scale)
   .sub(pivot).applyEuler(e).add(pivot);
  rotated.push(p);bottom.min(p);top.max(p);
 }
 const height=top.z-bottom.z,tol=Math.max(.02,Math.min(.2,height*.0005));
 const limit=-Math.sin(overhangThresholdDeg*Math.PI/180);
 let total=0,down=0,elevated=0,nearBed=0,contact=0,support=0,flagCount=0;
 const highlighted:number[]=[];
 for(let i=0;i<rotated.length;i+=3){
  const a=rotated[i],b=rotated[i+1],c=rotated[i+2];
  const normal=b.clone().sub(a).cross(c.clone().sub(a));
  const magnitude=normal.length(),area=magnitude/2;
  if(!Number.isFinite(area)||area<1e-12)continue;
  normal.divideScalar(magnitude);total+=area;
  const centroidZ=(a.z+b.z+c.z)/3;
  if(normal.z<limit){
   down+=area;
   if(centroidZ-bottom.z>tol){
    elevated+=area;flagCount++;
    support+=area*Math.abs(normal.z)*(centroidZ-bottom.z);
    if(highlighted.length<25000)highlighted.push(i/3);
   }else nearBed+=area;
  }
  if(normal.z<-.9&&Math.max(a.z,b.z,c.z)-bottom.z<=tol)contact+=area;
 }
 const bounds={x:top.x-bottom.x,y:top.y-bottom.y,z:height};
 const findings:PreflightFinding[]=[];
 const add=(code:string,severity:PreflightSeverity,title:string,observation:string,evidence:string,nextAction:string,triangleIds:number[]=[])=>
  findings.push({code,severity,title,observation,evidence,nextAction,triangleIds});
 if(audit.openEdges||audit.nonManifoldEdges)
  add("MESH_NOT_MANIFOLD","blocker","Repair STL topology before solid-mesh calculations",
   audit.openEdges+" open edges and "+audit.nonManifoldEdges+" non-manifold/inconsistently oriented edges detected.",
   "Measured edge incidences from the supplied STL; this can invalidate watertight slicing.",
   "Repair, re-export and re-upload the mesh. Re-run the topology audit.");
 if(audit.disconnectedShells>1)
  add("MULTI_SHELL","attention","Review disconnected mesh shells",
   audit.disconnectedShells+" disconnected mesh shells are present.",
   "Vertex-connected shells from uploaded STL (may represent intentional multi-body geometry).",
   "Confirm whether separate shells require fusion, supports or deliberate multi-part processing.");
 const overflow=(["x","y","z"] as const).filter(k=>bounds[k]>envelopeMm[k]+1e-6);
 if(overflow.length) add("ENVELOPE_FIT","blocker","Part exceeds configured build envelope",
  overflow.map(k=>k.toUpperCase()+" "+fmt(bounds[k])+" mm > "+fmt(envelopeMm[k])+" mm").join("; ")+".",
  "Axis-aligned rotated STL bounding dimensions versus user-configured envelope.",
  "Verify the real machine envelope, change orientation or select a larger machine.");
 if(elevated>Math.max(.05,total*1e-6))
  add("ELEVATED_DOWNFACES","attention","Elevated down-facing surfaces require support/process review",
   fmt(elevated)+" mm² of down-facing triangles lie above the lowest part vertex ("+
   (100*elevated/Math.max(total,1e-12)).toFixed(1)+"% of nondegenerate surface area).",
   "Triangle normals at the selected build orientation. Screening angle "+
    overhangThresholdDeg+"°; bottom-contact triangles excluded. "+
    flagCount+" triangles identified. Area is geometric, not unsupported-span verification.",
   "Inspect highlighted regions, choose support/anchoring and heat-extraction strategy, and compare orientations.",
   highlighted);
 if(contact<=Math.max(.01,total*1e-8))
  add("PLATE_CONTACT_PROXY","attention","No flat downward-facing plate contact detected",
   "No triangles satisfy the near-horizontal down-facing and lowest-Z proximity test.",
   "Only direct model-to-plate geometric contact is screened; an intentionally supported part may have none.",
   "Determine the actual build-plate/support connection, anchoring and heat-transfer path.");
 if(audit.smallestEdgeMm>0&&audit.smallestEdgeMm<.2)
  add("SMALL_MESH_EDGES","attention","Small triangle edges need resolution review",
   "Minimum triangle edge "+fmt(audit.smallestEdgeMm)+" mm.",
   "Edge size is not wall thickness or feature size; meshing resolution may be insufficient.",
   "Inspect thin walls, passages and details against the selected machine and layer/slice resolution.");
 add("PHYSICS_NOT_CALIBRATED","unassessed","Porosity, cracking and distortion cannot yet be predicted",
  "No measured process thermal history, validated defect model or distortion solver was applied.",
  "STL triangle geometry and a support proxy cannot estimate defect probability.",
  "Provide machine/material/parameter evidence and benchmarked model data before assessing these failure mechanisms.");
 add("MACHINE_PROCESS_DATA","unassessed","Actual machine, material and support setup require confirmation",
  "Envelope and overhang angle are configuration inputs, not qualified machine limits.",
  "No approved machine parameter envelope, supports, powder lot, atmosphere or inspection acceptance was checked.",
  "Confirm machine/build platform, alloy/condition, layer height, power/speed/hatch, supports and acceptance criteria.");
 return {
  version:LPBF_PREFLIGHT_VERSION,sourceSha256,unitScaleToMm:scale,
  rotationDeg:{...rotationDeg},assumedEnvelopeMm:{...envelopeMm},overhangThresholdDeg,
  geometry:{triangles:position.count/3,boundsMm:bounds,totalAreaMm2:total,
   bedFacingAreaMm2:nearBed,elevatedDownFacingAreaMm2:elevated,
   elevatedDownFacingFraction:elevated/Math.max(total,1e-12),
   downFacingTriangleCount:flagCount,bedContactAreaProxyMm2:contact,
   elevatedSupportProxyMm3:support,lowestVertexOffsetMm:bottom.z},
  audit,findings};
}
