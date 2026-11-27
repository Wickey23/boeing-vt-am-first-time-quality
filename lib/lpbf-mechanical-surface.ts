/** Exterior faces of the exact sampled mechanical mesh, not the original CAD surface. */
import type {solveThermalMeshResearch} from "./lpbf-thermal-mesh-research";
type Mesh=ReturnType<typeof solveThermalMeshResearch>;
type V=[number,number,number];
const sides=[{d:[-1,0,0],v:[0,4,6,2]},{d:[1,0,0],v:[1,3,7,5]},{d:[0,-1,0],v:[0,1,5,4]},{d:[0,1,0],v:[2,6,7,3]},{d:[0,0,-1],v:[0,2,3,1]},{d:[0,0,1],v:[4,5,7,6]}];
export function prepareMechanicalSurface(mesh:Mesh,pitch:number,height:number,scale:number,field:"stress"|"displacement"){
 if(!Number.isFinite(scale)||scale<0||scale>10000||!Number.isFinite(pitch)||pitch<=0||!Number.isFinite(height)||height<=0)
  throw Error("Invalid mechanical display scale or grid.");
 if(mesh.nodes.length!==mesh.displacement.length||mesh.nodes.some((n,i)=>[...n,...mesh.displacement[i]].some(v=>!Number.isFinite(v))))throw Error("Invalid mechanical nodal field.");
 const nodes=new Map(mesh.nodes.map((n,i)=>[[Math.round(n[0]/pitch),Math.round(n[1]/pitch),Math.round(n[2]/height)].join(","),i]));
 const cells=new Set(mesh.cellResults.map(c=>[c.x,c.y,c.layer].join(",")));
 const faces:{id:string;vertices:V[];original:V[];values:number[];cellKey:string}[]=[];
 for(const c of mesh.cellResults)for(const [side,s] of sides.entries()){
  if(cells.has([c.x+s.d[0],c.y+s.d[1],c.layer+s.d[2]].join(",")))continue;
  const ids=s.v.map(v=>nodes.get([c.x+(v&1),c.y+((v>>1)&1),c.layer+((v>>2)&1)].join(",")));
  if(ids.some(i=>i===undefined))throw Error("Mechanical surface node missing.");
  const indices=ids as number[],original=indices.map(i=>mesh.nodes[i]),vertices=indices.map(i=>mesh.nodes[i].map((n,d)=>n+scale*mesh.displacement[i][d]) as V);
  const values=indices.map(i=>field==="stress"?c.meanVonMisesMPa:Math.hypot(...mesh.displacement[i]));
  if(values.some(v=>!Number.isFinite(v)||v<0))throw Error("Invalid mechanical contour.");
  faces.push({id:[c.x,c.y,c.layer,side].join(","),vertices,original,values,cellKey:[c.x,c.y,c.layer].join(",")});
 }
 return faces;
}
