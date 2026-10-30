/**
 * ORIENTAI metal LPBF model-preparation geometry (independent implementation).
 *
 * Non-destructive rotation / build-frame translation of an uploaded STL.
 * The source stays immutable. Export bakes the rigid transform and confirmed
 * source unit scale into a separate millimeter STL; edits are NOT CAD Booleans.
 * Axis-aligned build-envelope checks are geometry-only screening, not proof
 * of recoater, support, thermal or service-load feasibility.
 */
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";
import {Euler,Vector3} from "three";
import type {Vec3} from "./lpbf-physical-slicer";
import {auditSTL,type MeshAudit} from "./stl-mesh-audit";

export const METAL_EDIT_VERSION="orientai-metal-build-rigid-edit-v0.1";
export type BuildEdit={rotationDeg:Vec3;translationMm:Vec3};
export type BuildEnvelope={x:number;y:number;z:number};
export type EditBounds={min:Vec3;max:Vec3;dimensions:Vec3};
export type BuildEditAssessment={
 version:typeof METAL_EDIT_VERSION;sourceSha256:string;originalFileUnitsToMm:number;
 recipe:BuildEdit;envelopeMm:BuildEnvelope;boundsMm:EditBounds;
 insideConfiguredEnvelope:boolean;constraintIssues:string[];
 estimatedVolumeMm3:number;triangleCount:number;sourceAudit:MeshAudit;
 warnings:string[];
};
export type BuildEditSuggestion={
 id:"repair"|"center"|"rotate-x"|"rotate-y"|"rotate-z"|"review";
 title:string;explanation:string;
 proposal:BuildEdit|null;kind:"blocker"|"screening"|"review";
 estimatedBuildHeightMm?:number;
};
const zero=():Vec3=>({x:0,y:0,z:0});
export const emptyBuildEdit=():BuildEdit=>({rotationDeg:zero(),translationMm:zero()});
function validVector(v:Vec3,label:string,max:number){
 if(!v||![v.x,v.y,v.z].every(x=>Number.isFinite(x)&&Math.abs(x)<=max))throw Error("Invalid "+label+".");
}
function validate(input:ArrayBuffer,unitScale:number,recipe:BuildEdit,envelope:BuildEnvelope){
 if(!(input instanceof ArrayBuffer)||input.byteLength<84||input.byteLength>8*1024*1024)
  throw Error("This model editor supports STL input of at most 8 MB; simplify mesh before editing.");
 if(!Number.isFinite(unitScale)||unitScale<=0||unitScale>10000)throw Error("Confirmed STL unit-to-mm scale is required.");
 validVector(recipe.rotationDeg,"build rotation",360);
 validVector(recipe.translationMm,"build position",100000);
 if(![envelope.x,envelope.y,envelope.z].every(v=>Number.isFinite(v)&&v>0&&v<=20000))
  throw Error("Configured build envelope must have positive finite dimensions.");
}
type Geometry={vertices:Vec3[];signedVolume:number;bounds:EditBounds;sourceAudit:MeshAudit};
function transformGeometry(input:ArrayBuffer,unitScale:number,recipe:BuildEdit):Geometry{
 const parsed=new STLLoader().parse(input);
 const pos=parsed.getAttribute("position");
 if(!pos||!pos.count||pos.count%3!==0||pos.count/3>40000)
  throw Error("Model editing requires 1–40,000 STL triangles.");
 const sourceAudit=auditSTL(input,unitScale);
 let min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);
 for(let i=0;i<pos.count;i++){
  const p=new Vector3(pos.getX(i)*unitScale,pos.getY(i)*unitScale,pos.getZ(i)*unitScale);
  if(![p.x,p.y,p.z].every(Number.isFinite))throw Error("STL contains nonfinite triangle vertices.");
  min.min(p);max.max(p);
 }
 const pivot=min.clone().add(max).multiplyScalar(.5);
 const r=recipe.rotationDeg;
 const e=new Euler(r.x*Math.PI/180,r.y*Math.PI/180,r.z*Math.PI/180,"XYZ");
 const t=recipe.translationMm;
 const vertices:Vec3[]=[];
 min=new Vector3(Infinity,Infinity,Infinity);max=new Vector3(-Infinity,-Infinity,-Infinity);
 for(let i=0;i<pos.count;i++){
  const p=new Vector3(pos.getX(i)*unitScale,pos.getY(i)*unitScale,pos.getZ(i)*unitScale)
   .sub(pivot).applyEuler(e).add(pivot).add(new Vector3(t.x,t.y,t.z));
  min.min(p);max.max(p);vertices.push({x:p.x,y:p.y,z:p.z});
 }
 const dims=max.clone().sub(min);
 const pivotOut=min.clone().add(max).multiplyScalar(.5);
 // Translation-invariant signed volume reduces large-coordinate cancellation.
 let signedVolume=0;
 for(let i=0;i<vertices.length;i+=3){
  const [a,b,c]=vertices.slice(i,i+3).map(v=>new Vector3(v.x,v.y,v.z).sub(pivotOut));
  signedVolume+=a.dot(b.clone().cross(c))/6;
 }
 return {vertices,signedVolume,
  bounds:{min:{x:min.x,y:min.y,z:min.z},max:{x:max.x,y:max.y,z:max.z},
   dimensions:{x:dims.x,y:dims.y,z:dims.z}},sourceAudit};
}
const sha256=async(input:ArrayBuffer):Promise<string>=>{
 const hex=await crypto.subtle.digest("SHA-256",input);
 return Array.from(new Uint8Array(hex),x=>x.toString(16).padStart(2,"0")).join("");
};
const envelopeProblems=(bounds:EditBounds,envelope:BuildEnvelope):string[]=>{
 const problems:string[]=[];
 for(const key of ["x","y","z"] as const){
  if(bounds.min[key]<-1e-6)problems.push("Part extends below configured "+key.toUpperCase()+" build-frame origin (0 mm).");
  if(bounds.max[key]>envelope[key]+1e-6)
   problems.push("Part exceeds "+key.toUpperCase()+" configured build-envelope maximum of "+envelope[key]+" mm.");
 }
 return problems;
};
export async function assessMetalBuildEdit(input:ArrayBuffer,scale:number,recipe:BuildEdit,envelope:BuildEnvelope):Promise<BuildEditAssessment>{
 validate(input,scale,recipe,envelope);
 const geometry=transformGeometry(input,scale,recipe);
 return {version:METAL_EDIT_VERSION,sourceSha256:await sha256(input),originalFileUnitsToMm:scale,
  recipe:{rotationDeg:{...recipe.rotationDeg},translationMm:{...recipe.translationMm}},
  envelopeMm:{...envelope},boundsMm:geometry.bounds,
  insideConfiguredEnvelope:envelopeProblems(geometry.bounds,envelope).length===0,
  constraintIssues:envelopeProblems(geometry.bounds,envelope),
  estimatedVolumeMm3:Math.abs(geometry.signedVolume),triangleCount:geometry.vertices.length/3,
  sourceAudit:geometry.sourceAudit,
  warnings:[
   "Build-frame AABB only. Inside the envelope does not establish support attachment, recoater clearance, process compatibility, build success, print strength or qualification.",
   "Non-destructive rigid transformations only. No holes, cuts, lattice infill, offsets, topology repair, Boolean operations or generated metal supports are performed.",
   "This export transforms the geometric coordinate frame; uploaded drawings, service loads, fixture selections, numerical fields and scan paths are not transformed or revalidated automatically."
  ]};
}
export function placeOnPlate(bounds:EditBounds,recipe:BuildEdit,envelope:BuildEnvelope):BuildEdit{
 const centerX=(bounds.min.x+bounds.max.x)/2,centerY=(bounds.min.y+bounds.max.y)/2;
 return {rotationDeg:{...recipe.rotationDeg},translationMm:{
  x:recipe.translationMm.x+envelope.x/2-centerX,
  y:recipe.translationMm.y+envelope.y/2-centerY,
  z:recipe.translationMm.z-bounds.min.z
 }};
}
export async function suggestMetalBuildEdits(input:ArrayBuffer,scale:number,
 recipe:BuildEdit,envelope:BuildEnvelope,base?:BuildEditAssessment):Promise<BuildEditSuggestion[]>{
 const current=base??await assessMetalBuildEdit(input,scale,recipe,envelope);
 const suggestions:BuildEditSuggestion[]=[];
 if(current.sourceAudit.openEdges||current.sourceAudit.nonManifoldEdges)
  suggestions.push({id:"repair",title:"Repair source mesh before metal slicing",
   explanation:current.sourceAudit.openEdges+" open edges and "+current.sourceAudit.nonManifoldEdges+
    " nonmanifold/orientation edges. Cutting, support assignment and thermal simulation require an independently verified closed manifold.",
   proposal:null,kind:"blocker"});
 const centered=placeOnPlate(current.boundsMm,recipe,envelope);
 if(!current.insideConfiguredEnvelope||Math.abs(current.boundsMm.min.z)>.001)
  suggestions.push({id:"center",title:"Place part on configured build plate",
   explanation:"Center XY bounding box and set its lowest geometric point to Z=0. This removes avoidable origin offsets but does not establish printable metal supports.",
   proposal:centered,kind:"screening"});
 const alternatives:[BuildEditSuggestion["id"],"x"|"y"|"z"][]=[
  ["rotate-x","x"],["rotate-y","y"],["rotate-z","z"]];
 for(const [id,axis] of alternatives){
  const candidate:BuildEdit={rotationDeg:{...recipe.rotationDeg,[axis]:recipe.rotationDeg[axis]+90},
   translationMm:{x:0,y:0,z:0}};
  // Restrict within the editor's declared rotation input bounds.
  candidate.rotationDeg[axis]=((candidate.rotationDeg[axis]+180)%360+360)%360-180;
  const first=await assessMetalBuildEdit(input,scale,candidate,envelope);
  const placed=placeOnPlate(first.boundsMm,candidate,envelope);
  const candidateAssessment=await assessMetalBuildEdit(input,scale,placed,envelope);
  const improvesHeight=candidateAssessment.boundsMm.dimensions.z<current.boundsMm.dimensions.z-1e-6;
  if((improvesHeight||(!current.insideConfiguredEnvelope&&candidateAssessment.insideConfiguredEnvelope))&&
     candidateAssessment.insideConfiguredEnvelope)
   suggestions.push({id,title:"Compare +90° about "+axis.toUpperCase()+" (build-height proxy)",
    explanation:"Estimated build height "+candidateAssessment.boundsMm.dimensions.z.toFixed(2)+
     " mm versus "+current.boundsMm.dimensions.z.toFixed(2)+" mm. May shorten build height, but supports, thermal distortion, recoater and strength may worsen. Review before applying.",
    proposal:placed,kind:"screening",estimatedBuildHeightMm:candidateAssessment.boundsMm.dimensions.z});
 }
 if(!suggestions.length)suggestions.push({id:"review",title:"Compare supports and engineered load directions",
  explanation:"No automatically screened rigid edit lowers build height within the configured envelope. Inspect supports, heat extraction, recoater interference and service-load orientation with separate approved tools.",
  proposal:null,kind:"review"});
 return suggestions;
}
export async function exportMetalBuildStl(input:ArrayBuffer,scale:number,recipe:BuildEdit,
 envelope:BuildEnvelope,opts?:{requireEnvelopeFit?:boolean}):Promise<{stl:string;sourceSha256:string;outputSha256:string;assessment:BuildEditAssessment}>{
 const assessment=await assessMetalBuildEdit(input,scale,recipe,envelope);
 if(opts?.requireEnvelopeFit!==false&&!assessment.insideConfiguredEnvelope)
  throw Error("Cannot export for build preparation while the edited mesh exceeds the configured build volume.");
 if(assessment.sourceAudit.openEdges||assessment.sourceAudit.nonManifoldEdges)
  throw Error("Repair open/nonmanifold source mesh before exporting for metal process planning.");
 const {vertices}=transformGeometry(input,scale,recipe);
 const body=["solid ORIENTAI_nonqualified_edited_mm"];
 for(let i=0;i<vertices.length;i+=3){
  const a=vertices[i],b=vertices[i+1],c=vertices[i+2];
  const va=new Vector3(a.x,a.y,a.z),vb=new Vector3(b.x,b.y,b.z),vc=new Vector3(c.x,c.y,c.z);
  const normal=vb.sub(va).cross(vc.sub(va)).normalize();
  body.push(" facet normal "+normal.x+" "+normal.y+" "+normal.z,"  outer loop");
  for(const v of [a,b,c])body.push("   vertex "+v.x+" "+v.y+" "+v.z);
  body.push("  endloop"," endfacet");
 }
 body.push("endsolid ORIENTAI_nonqualified_edited_mm");
 const stl=body.join("\n")+"\n";
 const bytes=new TextEncoder().encode(stl);
 return {stl,sourceSha256:assessment.sourceSha256,
  outputSha256:await sha256(bytes.buffer as ArrayBuffer),assessment};
}
