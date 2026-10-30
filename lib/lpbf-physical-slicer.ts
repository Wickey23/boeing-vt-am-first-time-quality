/**
 * M04: bounded real STL->physical horizontal layer occupancy screening.
 *
 * This computes a deterministic sampled cross-sectional raster of the *actual*
 * oriented STL, not the six virtual thermal slabs.  The fraction in each XY
 * cell is a 4-ray, center-of-layer estimate, NOT an exact polygon overlap.
 * It cannot provide laser paths, a melt pool, guaranteed topology, or
 * trustworthy thin-wall representation without independent resolution checks.
 */
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";
import {Euler,Vector3} from "three";
import {auditSTL,type MeshAudit} from "./stl-mesh-audit";

export const PHYSICAL_SLICER_VERSION="orientai-stl-physical-raster-v0.1";
export type Vec3={x:number;y:number;z:number};
export type PhysicalSliceCell={x:number;y:number;coverage:number};
export type PhysicalSliceLayer={
 layer:number;bottomZMm:number;topZMm:number;sampleZMm:number;
 areaMm2:number;estimatedVolumeMm3:number;partialCells:number;
 cells:PhysicalSliceCell[];
};
export type PhysicalSliceResult={
 version:typeof PHYSICAL_SLICER_VERSION;
 partSha256:string;unitScaleToMm:number;
 geometry:{sourceTriangles:number;analyticalMeshVolumeMm3:number;sampledVolumeMm3:number;
  relativeVolumeDifference:number;bounds:{min:Vec3;max:Vec3};meshAudit:MeshAudit;
  rotationDeg:Vec3;translationMm:Vec3};
 grid:{originMm:Vec3;xyPitchMm:number;layerThicknessMm:number;columns:number;rows:number;physicalLayers:number;
  samplesPerCell:4;sampledXYColumns:number;representedCells:number;boundaryCells:number;maxGeometryDeviationMm:number};
 layers:PhysicalSliceLayer[];
 diagnostics:string[];
 status:"SAMPLED_GEOMETRY_REVIEW_REQUIRED";
};
export type SliceOptions={
 unitScaleToMm:number;xyPitchMm:number;layerThicknessMm:number;
 rotationDeg?:Vec3;translationMm?:Vec3;
};

type Tri={a:Vec3;b:Vec3;c:Vec3;denom:number;minX:number;maxX:number;minY:number;maxY:number};
const ZERO:Vec3={x:0,y:0,z:0};
const offX=[0.23,0.77],offY=[0.31,0.69];
const finite=(n:number)=>Number.isFinite(n);
function validateVector(v:Vec3,label:string,bound:number){
 if(![v.x,v.y,v.z].every(x=>finite(x)&&Math.abs(x)<=bound))throw Error("Invalid "+label+".");
}
function hashHex(data:ArrayBuffer):Promise<string>{
 return crypto.subtle.digest("SHA-256",data).then(bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join(""));
}
function insideAt(crossings:number[],z:number):boolean{
 let below=0;
 for(const c of crossings){if(c<z-1e-8)below++;else break;}
 return (below&1)===1;
}
function intersectionsAtXY(tris:Tri[],x:number,y:number):number[]{
 const hits:number[]=[];
 for(const t of tris){
  if(x<t.minX||x>t.maxX||y<t.minY||y>t.maxY)continue;
  const u=((x-t.c.x)*(t.b.y-t.c.y)-(t.b.x-t.c.x)*(y-t.c.y))/t.denom;
  const v=((t.a.x-t.c.x)*(y-t.c.y)-(x-t.c.x)*(t.a.y-t.c.y))/t.denom;
  const w=1-u-v;
  if(u>=-1e-11&&v>=-1e-11&&w>=-1e-11)hits.push(u*t.a.z+v*t.b.z+w*t.c.z);
 }
 hits.sort((a,b)=>a-b);
 const distinct:number[]=[];
 for(const z of hits)if(!distinct.length||Math.abs(z-distinct[distinct.length-1])>1e-6)distinct.push(z);
 if(distinct.length%2!==0)
  throw Error("Ambiguous vertical STL ray at X="+x.toPrecision(5)+", Y="+y.toPrecision(5)+". Repair overlapping/self-intersecting geometry or adjust raster pitch.");
 return distinct;
}
export async function slicePhysicalStl(stl:ArrayBuffer,opts:SliceOptions):Promise<PhysicalSliceResult>{
 if(!(stl instanceof ArrayBuffer)||stl.byteLength<84||stl.byteLength>8*1024*1024)
  throw Error("Physical slicer supports a nonempty STL up to 8 MB; simplify approved geometry locally first.");
 const {unitScaleToMm:scale,xyPitchMm:p,layerThicknessMm:d}=opts;
 if(!finite(scale)||scale<=0||scale>10000)throw Error("Confirm STL coordinate units before physical slicing.");
 if(!finite(p)||p<0.04||p>5||!finite(d)||d<0.01||d>1)
  throw Error("XY raster pitch must be 0.04–5 mm and physical layer thickness 0.01–1 mm.");
 const rotation=opts.rotationDeg??ZERO,translation=opts.translationMm??ZERO;
 validateVector(rotation,"build rotation",360);
 validateVector(translation,"build placement",100000);
 const sha=await hashHex(stl);
 const audit=auditSTL(stl,scale);
 if(audit.openEdges||audit.nonManifoldEdges)
  throw Error("STL mesh topology blocks physical slicing: "+audit.openEdges+" open edges, "+audit.nonManifoldEdges+" nonmanifold/orientation edges. Repair geometry first.");
 if(audit.triangles>40000)throw Error("Research physical slicer limits meshes to 40,000 triangles.");
 const geometry=new STLLoader().parse(stl);
 const pos=geometry.getAttribute("position");
 if(!pos||pos.count%3||!pos.count)throw Error("Invalid STL triangle positions.");
 let rawMin=new Vector3(Infinity,Infinity,Infinity),rawMax=new Vector3(-Infinity,-Infinity,-Infinity);
 for(let i=0;i<pos.count;i++){
  const v=new Vector3(pos.getX(i)*scale,pos.getY(i)*scale,pos.getZ(i)*scale);
  if(![v.x,v.y,v.z].every(finite))throw Error("Nonfinite STL coordinates.");
  rawMin.min(v);rawMax.max(v);
 }
 const pivot=rawMin.clone().add(rawMax).multiplyScalar(.5);
 const rot=new Euler(rotation.x*Math.PI/180,rotation.y*Math.PI/180,rotation.z*Math.PI/180,"XYZ");
 const map=(i:number):Vec3=>{
  const v=new Vector3(pos.getX(i)*scale,pos.getY(i)*scale,pos.getZ(i)*scale)
   .sub(pivot).applyEuler(rot).add(pivot).add(new Vector3(translation.x,translation.y,translation.z));
  return {x:v.x,y:v.y,z:v.z};
 };
 const tris:Tri[]=[];
 let min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity},signedVolume=0;
 for(let i=0;i<pos.count;i+=3){
  const a=map(i),b=map(i+1),c=map(i+2);
  for(const v of [a,b,c])for(const k of ["x","y","z"] as const){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}
  const ax=a.x-pivot.x,bx=b.x-pivot.x,cx=c.x-pivot.x;
  const ay=a.y-pivot.y,by=b.y-pivot.y,cy=c.y-pivot.y;
  const az=a.z-pivot.z,bz=b.z-pivot.z,cz=c.z-pivot.z;
  signedVolume+=(ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
  const denom=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(denom)>1e-16)
   tris.push({a,b,c,denom,minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),
    minY:Math.min(a.y,b.y,c.y),maxY:Math.max(a.y,b.y,c.y)});
 }
 const analytic=Math.abs(signedVolume);
 if(!(analytic>1e-10)||max.z-min.z<=1e-9)throw Error("STL has zero enclosed volume or no physical build height.");
 const gridOriginX=Math.floor(min.x/p+1e-9)*p,gridOriginY=Math.floor(min.y/p+1e-9)*p;
 const columns=Math.ceil((max.x-gridOriginX)/p-1e-9),rows=Math.ceil((max.y-gridOriginY)/p-1e-9);
 const numLayers=Math.ceil((max.z-min.z)/d-1e-9);
 if(!(columns>0&&rows>0&&numLayers>0))throw Error("No physical layer cells intersect the placed STL.");
 if(columns>150||rows>150||numLayers>600||columns*rows*numLayers>180000)
  throw Error("Physical slice resolution exceeds 180,000 bounded layer cells. Increase XY pitch or layer thickness.");
 // Every XY ray sees all physical layers; refuse high-cost meshes before processing.
 if(columns*rows*4*pos.count/3>20000000)
  throw Error("Physical slice exceeds 20 million triangle/ray tests. Simplify the STL or increase XY pitch.");
 const layerMaps=Array.from({length:numLayers},()=>new Map<number,number>());
 for(let iy=0;iy<rows;iy++)for(let ix=0;ix<columns;ix++){
  const rays:number[][]=[];
  for(const ox of offX)for(const oy of offY){
   const x=gridOriginX+(ix+ox)*p,y=gridOriginY+(iy+oy)*p;
   rays.push(intersectionsAtXY(tris,x,y));
  }
  if(rays.every(r=>r.length===0))continue;
  for(let layer=0;layer<numLayers;layer++){
   const z=min.z+(layer+.5)*d;
   if(z>=max.z)break;
   const count=rays.reduce((n,cross)=>n+(insideAt(cross,z)?1:0),0);
   if(count)layerMaps[layer].set(iy*columns+ix,count/4);
  }
 }
 const layers:PhysicalSliceLayer[]=layerMaps.map((m,i)=>{
  const cells:PhysicalSliceCell[]=[...m].map(([index,coverage])=>({x:index%columns,y:Math.floor(index/columns),coverage}));
  const area=cells.reduce((sum,c)=>sum+c.coverage*p*p,0);
  return {layer:i,bottomZMm:min.z+i*d,topZMm:Math.min(max.z,min.z+(i+1)*d),
   sampleZMm:min.z+(i+.5)*d,areaMm2:area,
   estimatedVolumeMm3:area*Math.max(0,Math.min(d,max.z-(min.z+i*d))),
   partialCells:cells.filter(c=>c.coverage!==1).length,cells};
 });
 const sampled=layers.reduce((sum,l)=>sum+l.estimatedVolumeMm3,0);
 const relative=Math.abs(sampled-analytic)/analytic;
 const represented=layers.reduce((n,l)=>n+l.cells.length,0);
 const boundary=layers.reduce((n,l)=>n+l.partialCells,0);
 const diagnostics=[
  "Physical Z layers are sampled at each layer midpoint on the uploaded, rotated STL; 4 sub-XY rays estimate occupied area. Not exact polygon slicing or anti-aliased thermal voxels.",
  "Partial cell fractions and feature scales below the XY pitch or physical layer height are uncertain. Thin walls, disconnected regions, self-intersections and sharp slopes require independent inspection.",
  "Neither this geometry raster nor imported user CSV supplies a verified native machine scan path, print thermophysics, porosity, melt behavior, certification or first-time quality."
 ];
 if(audit.disconnectedShells>1)diagnostics.unshift("Multiple disconnected STL shells: confirm intentional part connectivity before any numerical simulation.");
 if(relative>0.08)diagnostics.unshift("Raster-volume deviation exceeds 8% of signed STL mesh volume. Do not use this resolution for physical analysis; refine grid and inspect thin features.");
 if(boundary)diagnostics.unshift(boundary+" boundary layer-cells have sampled, nonbinary occupancy; they cannot be treated as full-density cubes by the existing partial-layer solver.");
 if(layers.some(l=>l.cells.length===0))diagnostics.unshift("At least one physical layer has no sampled occupied cells; this resolution loses geometry.");
 const maxDeviation=Math.hypot(p/2,p/2,d/2);
 return {version:PHYSICAL_SLICER_VERSION,partSha256:sha,unitScaleToMm:scale,
  geometry:{sourceTriangles:audit.triangles,analyticalMeshVolumeMm3:analytic,sampledVolumeMm3:sampled,
   relativeVolumeDifference:relative,bounds:{min,max},meshAudit:audit,rotationDeg:{...rotation},translationMm:{...translation}},
  grid:{originMm:{x:gridOriginX,y:gridOriginY,z:min.z},xyPitchMm:p,layerThicknessMm:d,
   columns,rows,physicalLayers:numLayers,samplesPerCell:4,sampledXYColumns:columns*rows,
   representedCells:represented,boundaryCells:boundary,maxGeometryDeviationMm:maxDeviation},
  layers,diagnostics,status:"SAMPLED_GEOMETRY_REVIEW_REQUIRED"};
}
