import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";
export type MeshFinding={code:string;level:"blocker"|"review";message:string};
export type MeshAudit={triangles:number;openEdges:number;nonManifoldEdges:number;disconnectedShells:number;smallestEdgeMm:number;surfaceAreaMm2?:number;solidVolumeMm3?:number|null;findings:MeshFinding[]};
export function auditSTL(data:ArrayBuffer,unitScale=1):MeshAudit{
 if(!Number.isFinite(unitScale)||unitScale<=0)throw Error("Invalid STL unit scale");
 const geo=new STLLoader().parse(data),pos=geo.getAttribute("position");
 if(!pos||pos.count%3!==0)throw Error("Invalid STL triangles");
 const parent:number[]=[],rank:number[]=[],keys=new Map<string,number>(),edges=new Map<string,{count:number;balance:number}>();
 const find=(a:number):number=>parent[a]===a?a:(parent[a]=find(parent[a]));
 const unite=(a:number,b:number)=>{a=find(a);b=find(b);if(a!==b){if(rank[a]<rank[b])[a,b]=[b,a];parent[b]=a;if(rank[a]===rank[b])rank[a]++;}};
 const key=(x:number,y:number,z:number)=>[x,y,z].map(v=>Math.round(v*unitScale*1e5)).join(",");
 let min=Infinity,surfaceArea=0,signedVolume=0;
 for(let i=0;i<pos.count;i+=3){
  const ids:number[]=[];const p:Array<[number,number,number]>=[];
  for(let j=0;j<3;j++){const x=pos.getX(i+j),y=pos.getY(i+j),z=pos.getZ(i+j);if(![x,y,z].every(Number.isFinite))throw Error("STL contains nonfinite coordinates");const k=key(x,y,z);let n=keys.get(k);if(n===undefined){n=parent.length;keys.set(k,n);parent.push(n);rank.push(0);}ids.push(n);p.push([x*unitScale,y*unitScale,z*unitScale]);}
  const [a0,b0,c0]=p;
  const u=[b0[0]-a0[0],b0[1]-a0[1],b0[2]-a0[2]];
  const v=[c0[0]-a0[0],c0[1]-a0[1],c0[2]-a0[2]];
  const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  surfaceArea+=Math.hypot(...cross)/2;
  signedVolume+=(
   a0[0]*(b0[1]*c0[2]-b0[2]*c0[1])+
   a0[1]*(b0[2]*c0[0]-b0[0]*c0[2])+
   a0[2]*(b0[0]*c0[1]-b0[1]*c0[0])
  )/6;
  for(let a=0;a<3;a++){const b=(a+1)%3;unite(ids[a],ids[b]);const d=Math.hypot(p[a][0]-p[b][0],p[a][1]-p[b][1],p[a][2]-p[b][2]);if(d>1e-8)min=Math.min(min,d);const one=ids[a],two=ids[b];const ek=one<two?one+":"+two:two+":"+one;const old=edges.get(ek)||{count:0,balance:0};old.count++;old.balance+=one<two?1:-1;edges.set(ek,old);}
 }
 const components=new Set(parent.map((_,i)=>find(i))).size;
 let open=0,nonManifold=0;for(const e of edges.values()){if(e.count===1)open++;if(e.count!==2||e.balance!==0)nonManifold++;}
 const findings:MeshFinding[]=[];
 if(open)findings.push({code:"OPEN_SURFACE",level:"blocker",message:`${open} boundary edges detected; watertight voxel thermal/structural analysis may fail. Repair the STL.`});
 if(nonManifold)findings.push({code:"TOPOLOGY",level:"blocker",message:`${nonManifold} edges do not form consistently oriented two-face manifold pairs. Physical solver results must be withheld if meshing fails.`});
 if(components>1)findings.push({code:"DISCONNECTED",level:"review",message:`${components} disconnected shells identified. Confirm separate bodies are intentional and structurally connected.`});
 if(Number.isFinite(min)&&min<0.2)findings.push({code:"SMALL_FEATURE",level:"review",message:`Smallest mesh edge ${min.toFixed(3)} mm. Check whether the physical voxel mesh resolves thin features; edge length is not wall thickness.`});
 // Signed tetrahedra provide an orientation-independent physical solid volume
 // only for a single closed, consistently oriented shell. An arbitrary STL
 // assembly or open/nonmanifold mesh must NOT be assigned a reliable solid volume.
 const closed=open===0&&nonManifold===0&&components===1;
 const volume=closed&&Number.isFinite(signedVolume)&&Math.abs(signedVolume)>1e-12?
  Math.abs(signedVolume):null;
 return {triangles:pos.count/3,openEdges:open,nonManifoldEdges:nonManifold,
  disconnectedShells:components,smallestEdgeMm:Number.isFinite(min)?min:0,
  surfaceAreaMm2:Number.isFinite(surfaceArea)?surfaceArea:undefined,solidVolumeMm3:volume,findings};
}
