import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
const names=['aerospace-mounting-lug','aerospace-overhang-bracket','aerospace-thin-wall-channel','aerospace-nozzle-sleeve','cube-10mm'];
mkdirSync('public/verification/previews',{recursive:true});
for(const name of names){
 const b=readFileSync(`public/verification/${name}.stl`);const g=new STLLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));const p=g.getAttribute('position');
 const vertices=Array.from({length:p.count},(_,i)=>{const x=p.getX(i),y=p.getY(i),z=p.getZ(i);return {x:(x-y)*.866,y:(x+y)*.5-z,depth:x+y+z}});
 const minX=Math.min(...vertices.map(v=>v.x)),maxX=Math.max(...vertices.map(v=>v.x)),minY=Math.min(...vertices.map(v=>v.y)),maxY=Math.max(...vertices.map(v=>v.y));const scale=Math.min(200/(maxX-minX||1),115/(maxY-minY||1));
 const triangles=[];for(let i=0;i<vertices.length;i+=3){const v=vertices.slice(i,i+3);const ux=p.getX(i+1)-p.getX(i),uy=p.getY(i+1)-p.getY(i),uz=p.getZ(i+1)-p.getZ(i),vx=p.getX(i+2)-p.getX(i),vy=p.getY(i+2)-p.getY(i),vz=p.getZ(i+2)-p.getZ(i);const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const shade=Math.round(155+65*Math.abs((nx*.3+ny*.5+nz*.8)/Math.max(1e-9,Math.hypot(nx,ny,nz))));triangles.push({depth:v.reduce((s,a)=>s+a.depth,0),svg:`<polygon points="${v.map(a=>`${(120+(a.x-(minX+maxX)/2)*scale).toFixed(2)},${(75+(a.y-(minY+maxY)/2)*scale).toFixed(2)}`).join(' ')}" fill="rgb(${shade-22},${shade},${Math.min(255,shade+16)})" stroke="#557b95" stroke-width=".25"/>`})}
 triangles.sort((a,b)=>a.depth-b.depth);writeFileSync(`public/verification/previews/${name}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150"><rect width="240" height="150" rx="12" fill="#edf4fa"/>${triangles.map(t=>t.svg).join('')}</svg>`);g.dispose();
}
