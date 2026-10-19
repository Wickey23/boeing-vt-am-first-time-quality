import * as THREE from 'three';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
export type ThermalInput={conductivityWmK:number;baseTemperatureC:number;topFluxWm2:number;resolution:number};
export type ThermalField={values:number[];units:'degC';min:number;max:number;input:ThermalInput;mesh:{cells:number;cellSizeMm:number;resolution:number};solver:{version:string;model:string;iterations:number;relativeResidual:number;heatInputW:number;reactionHeatW:number;relativeEnergyImbalance:number};limitations:string[]};
export function solveVoxelSystem(cells:Array<[number,number,number]>,hMm:number,input:ThermalInput,onProgress?:(n:number)=>void){
 if(!cells.length)throw new Error('No interior voxels. Refine the mesh or inspect STL closure.');
 const h=hMm/1000,k=input.conductivityWmK;
 if(!Number.isFinite(k)||k<=0||k>10000||!Number.isFinite(input.baseTemperatureC)||input.baseTemperatureC< -273.15||!Number.isFinite(input.topFluxWm2)||input.topFluxWm2<0||input.topFluxWm2>1e8)throw new Error('Invalid thermal properties or boundary conditions.');
 const key=(x:number,y:number,z:number)=>`${x},${y},${z}`;const index=new Map(cells.map((c,i)=>[key(...c),i]));
 const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 const neighbors=cells.map(([x,y,z])=>dirs.map(([dx,dy,dz])=>index.get(key(x+dx,y+dy,z+dz))??-1));
 const bottom=Math.min(...cells.map(c=>c[2])),top=Math.max(...cells.map(c=>c[2]));
 // Only global bottom plane is fixed; only global top plane receives flux. All other faces insulated.
 const diag=new Float64Array(cells.length),rhs=new Float64Array(cells.length),fixed=cells.map(c=>c[2]===bottom);
 const reached=new Set<number>(),stack:number[]=[];fixed.forEach((f,i)=>{if(f){reached.add(i);stack.push(i);}});while(stack.length){for(const j of neighbors[stack.pop()!])if(j>=0&&!reached.has(j)){reached.add(j);stack.push(j);}}
 if(reached.size!==cells.length)throw new Error('Voxel components disconnected from the fixed base. Increase resolution or revise geometry; no field was calculated.');
 let heat=0;for(let i=0;i<cells.length;i++){diag[i]=neighbors[i].filter(j=>j>=0).length*k*h+(fixed[i]?2*k*h:0);if(cells[i][2]===top){rhs[i]=input.topFluxWm2*h*h;heat+=rhs[i];}}
 const apply=(v:Float64Array)=>{const out=new Float64Array(v.length);for(let i=0;i<v.length;i++){out[i]=diag[i]*v[i];for(const j of neighbors[i])if(j>=0)out[i]-=k*h*v[j];}return out;};
 const dot=(a:Float64Array,b:Float64Array)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const x=new Float64Array(cells.length),r=rhs.slice(),z=Float64Array.from(r,(v,i)=>v/diag[i]),p=z.slice();let rz=dot(r,z),norm=Math.sqrt(dot(rhs,rhs)),residual=norm===0?0:1,iterations=0;
 for(;iterations<3000&&residual>1e-8;iterations++){const ap=apply(p),den=dot(p,ap);if(!(den>0))throw new Error('Thermal system lost positive definiteness.');const alpha=rz/den;for(let i=0;i<x.length;i++){x[i]+=alpha*p[i];r[i]-=alpha*ap[i];}residual=Math.sqrt(dot(r,r))/norm;if(residual<=1e-8)break;for(let i=0;i<x.length;i++)z[i]=r[i]/diag[i];const next=dot(r,z),beta=next/rz;for(let i=0;i<x.length;i++)p[i]=z[i]+beta*p[i];rz=next;if(iterations%10===0)onProgress?.(iterations);}
 if(!Number.isFinite(residual)||residual>1e-8)throw new Error('Thermal solver did not converge; result withheld.');
 const reaction=x.reduce((sum,v,i)=>sum+(fixed[i]?2*k*h*v:0),0);
 return {temperature:Array.from(x,v=>v+input.baseTemperatureC),iterations:iterations+1,relativeResidual:residual,heatInputW:heat,reactionHeatW:reaction,relativeEnergyImbalance:Math.abs(reaction-heat)/Math.max(Math.abs(heat),1e-20),index};
}
export function voxelizePart(buffer:ArrayBuffer,rotation:{x:number;y:number;z:number},unitScale:number,resolution:number){
 const input={resolution};
 if(!Number.isInteger(input.resolution)||input.resolution<6||input.resolution>24)throw new Error('Voxel resolution must be an integer from 6 to 24.');
 const g=new STLLoader().parse(buffer);g.scale(unitScale,unitScale,unitScale);g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotation.x*Math.PI/180,rotation.y*Math.PI/180,rotation.z*Math.PI/180,'XYZ')));g.computeBoundingBox();const box=g.boundingBox!,size=new THREE.Vector3();box.getSize(size);const h=Math.max(size.x,size.y,size.z)/input.resolution;if(!(h>0))throw new Error('Invalid mesh extent.');
 const p=g.getAttribute('position'),vertices=Array.from({length:p.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,i));
 // Enforce a closed, consistently oriented two-manifold triangle boundary before parity voxelization.
 const edge=new Map<string,{count:number;balance:number}>();const vk=(v:THREE.Vector3)=>[v.x,v.y,v.z].map(x=>Math.round(x/Math.max(h*1e-7,1e-10))).join(',');
 for(let i=0;i<vertices.length;i+=3)for(const [a,b] of [[i,i+1],[i+1,i+2],[i+2,i]]){const ka=vk(vertices[a]),kb=vk(vertices[b]);if(ka===kb)throw new Error('Degenerate thermal boundary triangle.');const k=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`,e=edge.get(k)??{count:0,balance:0};e.count++;e.balance+=ka<kb?1:-1;edge.set(k,e);}
 if([...edge.values()].some(e=>e.count!==2||e.balance!==0))throw new Error('Thermal meshing requires a closed, consistently oriented manifold STL. Repair the mesh first.');
 const nx=Math.ceil(size.x/h),ny=Math.ceil(size.y/h),nz=Math.ceil(size.z/h),cells:Array<[number,number,number]>=[];
 const ray=new THREE.Ray(),hit=new THREE.Vector3();
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){const intersections:number[]=[];ray.set(new THREE.Vector3(box.min.x+(x+.5)*h,box.min.y+(y+.5)*h,box.min.z-h),new THREE.Vector3(0,0,1));for(let i=0;i<vertices.length;i+=3){if(ray.intersectTriangle(vertices[i],vertices[i+1],vertices[i+2],false,hit))intersections.push(hit.z);}intersections.sort((a,b)=>a-b);const zs=intersections.filter((z,i)=>i===0||z-intersections[i-1]>h*1e-7);if(zs.length%2)throw new Error('Ambiguous voxel ray intersection. Change resolution or repair mesh.');for(let z=0;z<nz;z++){const center=box.min.z+(z+.5)*h;if(zs.some((a,i)=>i%2===0&&center>a&&center<zs[i+1]))cells.push([x,y,z]);}}
 g.dispose();return {cells,h,box,nx,ny,nz,vertices};
}
export function projectVoxelValues(mesh:ReturnType<typeof voxelizePart>,temperature:number[]){
 const {cells,h,box,nx,ny,nz,vertices}=mesh;const index=new Map(cells.map((c,i)=>[c.join(','),i]));const centers=cells.map(c=>new THREE.Vector3(box.min.x+(c[0]+.5)*h,box.min.y+(c[1]+.5)*h,box.min.z+(c[2]+.5)*h));
 // Nearest occupied voxel projection, not surface finite-element interpolation.
 const values=vertices.map(v=>{const gx=Math.max(0,Math.min(nx-1,Math.floor((v.x-box.min.x)/h))),gy=Math.max(0,Math.min(ny-1,Math.floor((v.y-box.min.y)/h))),gz=Math.max(0,Math.min(nz-1,Math.floor((v.z-box.min.z)/h)));let best=-1,distance=Infinity;for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(let dz=-2;dz<=2;dz++){const j=index.get(`${gx+dx},${gy+dy},${gz+dz}`);if(j!==undefined){const d=v.distanceToSquared(centers[j]);if(d<distance){distance=d;best=j;}}}if(best<0||distance>9*h*h)throw new Error('Surface features unresolved by thermal voxels. Increase resolution; no heatmap produced.');return temperature[best];});return values;
}
export function solvePartThermal(buffer:ArrayBuffer,rotation:{x:number;y:number;z:number},unitScale:number,input:ThermalInput):ThermalField{
 const mesh=voxelizePart(buffer,rotation,unitScale,input.resolution),{cells,h}=mesh;const solved=solveVoxelSystem(cells,h,input),values=projectVoxelValues(mesh,solved.temperature);
 return {values,units:'degC',min:Math.min(...solved.temperature),max:Math.max(...solved.temperature),input,mesh:{cells:cells.length,cellSizeMm:h,resolution:input.resolution},solver:{version:'voxel-conduction-0.1',model:'Steady isotropic conduction, cell-centered finite volume; bottom plane prescribed temperature, top plane uniform inward flux, other faces insulated',iterations:solved.iterations,relativeResidual:solved.relativeResidual,heatInputW:solved.heatInputW,reactionHeatW:solved.reactionHeatW,relativeEnergyImbalance:solved.relativeEnergyImbalance},limitations:['Not LPBF process simulation: no laser, layer activation, transient history, radiation, convection, phase change or temperature-dependent properties.','Stair-step voxel boundary; thin walls and cavities may be lost. Mesh refinement is required; numerical residual is not mesh convergence.','Surface colors use nearest occupied voxel temperatures, not FEM nodal temperatures.','Boundary planes are aligned with the selected orientation. Bottom fixation and top flux require engineering review.','Solver verification uses a 1D slab exact solution and energy balance; no experimental validation.']};
}
