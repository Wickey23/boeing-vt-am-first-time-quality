/** M11 bounded 3D elastic thermal eigenstrain benchmark.
 * Six conforming linear tetrahedra per occupied rectangular cell, matching
 * the service solver's subdivision. Independent from the production load path.
 */
import * as THREE from "three";
type V=[number,number,number];
type Cell={x:number;y:number;layer:number;temperatureC:number;referenceTemperatureC:number};
export type ThermalMeshInput={cells:Cell[];pitchMm:number;layerHeightMm:number;youngsModulusMPa:number;poissonRatio:number;thermalExpansionPerK:number;yieldStressMPa:number;sourceLabel:string;constraint:"clamped-base"|"rigid-motion-pins"};
const pattern=[[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]];
const dot=(a:Float64Array,b:Float64Array)=>a.reduce((s,v,i)=>s+v*b[i],0);
export function solveThermalMeshResearch(input:ThermalMeshInput){
 const {cells,pitchMm:h,layerHeightMm:dz,youngsModulusMPa:E,poissonRatio:nu,thermalExpansionPerK:alpha,yieldStressMPa:yieldMPa}=input;
 if(!Array.isArray(cells)||cells.length<1||cells.length>200||
 ![h,dz].every(v=>Number.isFinite(v)&&v>=.01&&v<=5)||!Number.isFinite(E)||E<100||E>1e6||
 !Number.isFinite(nu)||nu<=-.9||nu>=.49||!Number.isFinite(alpha)||alpha<0||alpha>1e-3||
 !Number.isFinite(yieldMPa)||yieldMPa<=0||yieldMPa>=E*.05||!input.sourceLabel.trim())
  throw Error("Invalid bounded 3D elastic thermal research inputs.");
 const index=new Map<string,number>(),eigen:number[]=[];
 for(const [i,c] of cells.entries()){
  if(![c.x,c.y,c.layer].every(v=>Number.isInteger(v)&&v>=0&&v<=150)||
   ![c.temperatureC,c.referenceTemperatureC].every(t=>Number.isFinite(t)&&t> -273.15&&t<=3000))
   throw Error("Invalid registered cell or temperature.");
  const key=[c.x,c.y,c.layer].join(",");
  if(index.has(key))throw Error("Duplicate thermal mesh cell.");
  index.set(key,i);
  const strain=alpha*(c.temperatureC-c.referenceTemperatureC);
  if(Math.abs(strain)>.02)throw Error("Thermal small-strain bound exceeded.");
  eigen.push(strain);
 }
 const seen=new Set([0]),queue=[0];
 while(queue.length){const c=cells[queue.pop()!];
  for(let a=0;a<3;a++)for(const s of [-1,1]){const v=[c.x,c.y,c.layer];v[a]+=s;const j=index.get(v.join(","));
   if(j!==undefined&&!seen.has(j)){seen.add(j);queue.push(j);}
  }
 }
 if(seen.size!==cells.length)throw Error("Thermal mesh requires full-face connectivity.");
 const nodes:V[]=[],nodeMap=new Map<string,number>();
 const hex=cells.map(c=>Array.from({length:8},(_,i)=>{
  const v:V=[c.x+(i&1),c.y+((i>>1)&1),c.layer+((i>>2)&1)],key=v.join(",");
  if(!nodeMap.has(key)){nodeMap.set(key,nodes.length);nodes.push([v[0]*h,v[1]*h,v[2]*dz]);}
  return nodeMap.get(key)!;
 }));
 const fixed=new Uint8Array(nodes.length*3),base=Math.min(...cells.map(c=>c.layer));
 if(input.constraint==="clamped-base"){
  nodes.forEach((n,i)=>{if(Math.abs(n[2]-base*dz)<1e-10)fixed.fill(1,3*i,3*i+3);});
 }else if(input.constraint==="rigid-motion-pins"){
  // Three corner nodes of one bottom cell: 3+2+1 constraints remove
  // only rigid-body modes. No fictitious all-face restraint.
  const a=hex[cells.findIndex(c=>c.layer===base)];
  fixed.fill(1,3*a[0],3*a[0]+3);
  fixed[3*a[1]+1]=1;fixed[3*a[1]+2]=1;fixed[3*a[2]+2]=1;
 }else throw Error("Unsupported thermal mesh constraint.");
 const free=new Int32Array(fixed.length).fill(-1);let count=0;
 for(let i=0;i<fixed.length;i++)if(!fixed[i])free[i]=count++;
 const rows=Array.from({length:count},()=>new Map<number,number>()),rhs=new Float64Array(count);
 const lambda=E*nu/((1+nu)*(1-2*nu)),mu=E/(2*(1+nu)),bulkFactor=3*lambda+2*mu;
 const elements:{ids:number[];grads:number[][];volume:number;cell:number}[]=[];
 for(let ci=0;ci<hex.length;ci++)for(const pat of pattern){
  const ids=pat.map(i=>hex[ci][i]),p=ids.map(i=>nodes[i]);
  const m=new THREE.Matrix3().set(p[1][0]-p[0][0],p[2][0]-p[0][0],p[3][0]-p[0][0],p[1][1]-p[0][1],p[2][1]-p[0][1],p[3][1]-p[0][1],p[1][2]-p[0][2],p[2][2]-p[0][2],p[3][2]-p[0][2]);
  const volume=Math.abs(m.determinant())/6;m.invert();const a=m.elements;
  const grads=[[0,0,0],[a[0],a[3],a[6]],[a[1],a[4],a[7]],[a[2],a[5],a[8]]];
  for(let d=0;d<3;d++)grads[0][d]=-grads[1][d]-grads[2][d]-grads[3][d];
  elements.push({ids,grads,volume,cell:ci});
  for(let na=0;na<4;na++)for(let i=0;i<3;i++){
   const r=free[3*ids[na]+i];if(r<0)continue;
   rhs[r]+=volume*bulkFactor*eigen[ci]*grads[na][i];
   for(let nb=0;nb<4;nb++)for(let j=0;j<3;j++){
    const c=free[3*ids[nb]+j];if(c<0)continue;
    const ga=grads[na],gb=grads[nb],d=ga.reduce((s,v,k)=>s+v*gb[k],0);
    const value=volume*(lambda*ga[i]*gb[j]+mu*ga[j]*gb[i]+(i===j?mu*d:0));
    rows[r].set(c,(rows[r].get(c)??0)+value);
   }
  }
 }
 const sparse=rows.map(r=>({indices:Int32Array.from(r.keys()),values:Float64Array.from(r.values())}));
 const diag=Float64Array.from(rows,(r,i)=>r.get(i)??0);
 if(diag.some(v=>!(v>0)))throw Error("Unconstrained thermal stiffness.");
 const apply=(v:Float64Array)=>Float64Array.from(sparse,row=>row.indices.reduce((s,j,k)=>s+row.values[k]*v[j],0));
 const u=new Float64Array(count),r=rhs.slice(),z=Float64Array.from(r,(v,i)=>v/diag[i]),p=z.slice();
 const norm=Math.sqrt(dot(rhs,rhs));let residual=norm===0?0:1,rz=dot(r,z),iterations=0;
 for(;iterations<4000&&residual>1e-10;iterations++){
  const ap=apply(p),den=dot(p,ap);if(!(den>0))throw Error("Singular thermal mechanical stiffness.");
  const a=rz/den;for(let i=0;i<count;i++){u[i]+=a*p[i];r[i]-=a*ap[i];}
  residual=Math.sqrt(dot(r,r))/norm;if(residual<=1e-10)break;
  for(let i=0;i<count;i++)z[i]=r[i]/diag[i];
  const next=dot(r,z),b=next/rz;for(let i=0;i<count;i++)p[i]=z[i]+b*p[i];rz=next;
 }
 if(!Number.isFinite(residual)||residual>1e-10)throw Error("Thermal mechanical solve did not converge.");
 const displacement=nodes.map((_,n)=>[0,1,2].map(d=>fixed[3*n+d]?0:u[free[3*n+d]]) as V);
 const nodalInternal=new Float64Array(fixed.length),stressSum=new Float64Array(cells.length);
 let maxVonMisesMPa=0,elasticEnergyNmm=0,forceScale=0;
 for(const {ids,grads,volume,cell} of elements){
  const g=Array.from({length:3},()=>[0,0,0]);
  for(let a=0;a<4;a++)for(let i=0;i<3;i++)for(let j=0;j<3;j++)g[i][j]+=displacement[ids[a]][i]*grads[a][j];
  const strain=g.map((v,i)=>v.map((q,j)=>(q+g[j][i])/2-(i===j?eigen[cell]:0)));
  if(strain.flat().some(v=>Math.abs(v)>.02)||g.flat().some(v=>Math.abs(v)>.02))throw Error("Mechanical small-strain bound exceeded.");
  const trace=strain[0][0]+strain[1][1]+strain[2][2];
  const s=strain.map((v,i)=>v.map((q,j)=>2*mu*q+(i===j?lambda*trace:0)));
  const vm=Math.sqrt(((s[0][0]-s[1][1])**2+(s[1][1]-s[2][2])**2+(s[2][2]-s[0][0])**2)/2+3*(s[0][1]**2+s[1][2]**2+s[0][2]**2));
  if(!Number.isFinite(vm)||vm>yieldMPa*(1+1e-9))throw Error("Elastic thermal mesh would yield; nonlinear 3D solution required.");
  maxVonMisesMPa=Math.max(maxVonMisesMPa,vm);stressSum[cell]+=vm/6;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)elasticEnergyNmm+=.5*volume*s[i][j]*strain[i][j];
  for(let a=0;a<4;a++)for(let d=0;d<3;d++){
   const f=volume*s[d].reduce((sum,v,j)=>sum+v*grads[a][j],0);
   nodalInternal[3*ids[a]+d]+=f;forceScale+=Math.abs(f);
  }
 }
 const reactions:V=[0,0,0],moments:V=[0,0,0];let maxFreeForceN=0;
 nodes.forEach((n,i)=>{
  const f=n.map((_,d)=>fixed[3*i+d]?nodalInternal[3*i+d]:0);
  for(let d=0;d<3;d++){reactions[d]+=f[d];if(!fixed[3*i+d])maxFreeForceN=Math.max(maxFreeForceN,Math.abs(nodalInternal[3*i+d]));}
  moments[0]+=n[1]*f[2]-n[2]*f[1];moments[1]+=n[2]*f[0]-n[0]*f[2];moments[2]+=n[0]*f[1]-n[1]*f[0];
 });
 const scale=Math.max(1,forceScale,norm),length=Math.max(1,...nodes.map(n=>Math.hypot(...n)));
 if(maxFreeForceN>1e-8*scale||Math.hypot(...reactions)>1e-8*scale||Math.hypot(...moments)>1e-8*scale*length)
  throw Error("Thermal mesh mechanical equilibrium failed.");
 return {scope:"UNVALIDATED_3D_ELASTIC_THERMAL_MESH" as const,productionActivationAuthorized:false as const,
  constraint:input.constraint,nodes,displacement,cellResults:cells.map((c,i)=>({...c,thermalStrain:eigen[i],meanVonMisesMPa:stressSum[i]})),
  tetrahedra:elements.length,maxVonMisesMPa,maxDisplacementMm:Math.max(...displacement.map(v=>Math.hypot(...v))),
  equilibrium:{reactionForceN:reactions,reactionMomentNmm:moments,maxFreeForceN,relativeResidual:residual,iterations},elasticEnergyNmm,
  limitations:["Rectangular full-cell mesh and small-strain isotropic elasticity, not conforming CAD geometry.",
   "Explicit reference temperatures; no deposition, plastic history, support geometry or phase-dependent mechanics.",
   "Rigid-motion pins are an idealized release calculation, not validated plate removal; any trial yielding is withheld."]};
}
