import * as THREE from "three";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";

export type OrientationRequest={machine:{x:number;y:number;z:number};overhangDeg:number;maxSupportProxyMm3?:number;weights:{support:number;height:number;contact:number}};
export type Candidate={id:string;rotation:{x:number;y:number;z:number};dimensions:{x:number;y:number;z:number};buildHeightMm:number;downFacingAreaMm2:number;supportProxyMm3:number;contactAreaMm2:number;overhangFraction:number;fitsEnvelope:boolean;feasible:boolean;score:number;rank:number;pareto:boolean};
const round=(n:number)=>Math.round(n*1000)/1000;
const verify=(x:number,min:number,max:number,name:string)=>{if(!Number.isFinite(x)||x<min||x>max)throw new Error("Invalid "+name);return x};
export function analyzeOrientations(buffer:ArrayBuffer,input:OrientationRequest){
 const machine={x:verify(input.machine.x,1,5000,"machine X"),y:verify(input.machine.y,1,5000,"machine Y"),z:verify(input.machine.z,1,5000,"machine Z")};
 const angle=verify(input.overhangDeg,0,89,"overhang angle");
 const weights={support:verify(input.weights.support,0,100,"support weight"),height:verify(input.weights.height,0,100,"height weight"),contact:verify(input.weights.contact,0,100,"contact weight")};
 const maxSupport=input.maxSupportProxyMm3===undefined?Infinity:verify(input.maxSupportProxyMm3,0,1e12,"support limit");
 const g=new STLLoader().parse(buffer),pos=g.getAttribute("position");
 if(!pos||pos.count<3||pos.count%3!==0||pos.count>900000)throw new Error("Invalid or excessively large STL mesh");
 const triangles:{a:THREE.Vector3;b:THREE.Vector3;c:THREE.Vector3;n:THREE.Vector3;area:number;center:THREE.Vector3}[]=[];
 for(let i=0;i<pos.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);
 const cross=b.clone().sub(a).cross(c.clone().sub(a));const area=cross.length()/2;if(area<1e-12)continue;
 triangles.push({a,b,c,n:cross.normalize(),area,center:a.clone().add(b).add(c).multiplyScalar(1/3)});}
 if(!triangles.length)throw new Error("STL has no nondegenerate triangles");
 const eulers:[[number,number,number],...Array<[number,number,number]>]=[[0,0,0]];
 // 24 orthogonal orientations are covered by rotations of 90 degrees and deduplicated by transformed axes.
 for(const x of [0,90,180,270])for(const y of [0,90,180,270])for(const z of [0,90,180,270]){
 const rot=new THREE.Euler(x*Math.PI/180,y*Math.PI/180,z*Math.PI/180,"XYZ");const ex=new THREE.Vector3(1,0,0).applyEuler(rot),ey=new THREE.Vector3(0,1,0).applyEuler(rot);
 const key=[ex,ey].flatMap(v=>[Math.round(v.x),Math.round(v.y),Math.round(v.z)]).join(",");
 if(!(globalKeys.has(key))){globalKeys.add(key);if(x||y||z)eulers.push([x,y,z]);}
 }
 const output:Candidate[]=[];
 for(const [rx,ry,rz] of eulers){const rotation=new THREE.Euler(rx*Math.PI/180,ry*Math.PI/180,rz*Math.PI/180,"XYZ");
 const bounds=new THREE.Box3();for(const t of triangles){bounds.expandByPoint(t.a.clone().applyEuler(rotation));bounds.expandByPoint(t.b.clone().applyEuler(rotation));bounds.expandByPoint(t.c.clone().applyEuler(rotation));}
 const dims=new THREE.Vector3();bounds.getSize(dims);if(!Number.isFinite(dims.x+dims.y+dims.z))throw new Error("Non-finite STL coordinates");
 let down=0,support=0,contact=0,total=0;const threshold=-Math.sin(angle*Math.PI/180);
 for(const t of triangles){const n=t.n.clone().applyEuler(rotation),center=t.center.clone().applyEuler(rotation);total+=t.area;
 if(n.z<threshold){down+=t.area;support+=t.area*Math.max(0,center.z-bounds.min.z);}
 if(Math.abs(center.z-bounds.min.z)<Math.max(.01,dims.z*.001)&&n.z<-.9)contact+=t.area;
 }
 const fits=dims.x<=machine.x+1e-6&&dims.y<=machine.y+1e-6&&dims.z<=machine.z+1e-6;
 output.push({id:"O"+String(output.length+1).padStart(2,"0"),rotation:{x:rx,y:ry,z:rz},dimensions:{x:round(dims.x),y:round(dims.y),z:round(dims.z)},buildHeightMm:round(dims.z),downFacingAreaMm2:round(down),supportProxyMm3:round(support),contactAreaMm2:round(contact),overhangFraction:round(down/Math.max(total,1e-12)),fitsEnvelope:fits,feasible:fits&&support<=maxSupport,score:0,rank:0,pareto:false});
 }
 const minima={support:Math.min(...output.map(c=>c.supportProxyMm3)),height:Math.min(...output.map(c=>c.buildHeightMm)),contact:Math.min(...output.map(c=>c.contactAreaMm2))};
 const maxima={support:Math.max(...output.map(c=>c.supportProxyMm3)),height:Math.max(...output.map(c=>c.buildHeightMm)),contact:Math.max(...output.map(c=>c.contactAreaMm2))};
 const normalize=(v:number,min:number,max:number)=>max-min<1e-8?0:(v-min)/(max-min);
 const weightSum=weights.support+weights.height+weights.contact||1;
 for(const c of output){const penalty=(weights.support*normalize(c.supportProxyMm3,minima.support,maxima.support)+weights.height*normalize(c.buildHeightMm,minima.height,maxima.height)+weights.contact*normalize(c.contactAreaMm2,minima.contact,maxima.contact))/weightSum;c.score=round(100*(1-penalty));}
 for(const c of output.filter(c=>c.feasible)){c.pareto=!output.some(d=>d!==c&&d.feasible&&d.supportProxyMm3<=c.supportProxyMm3&&d.buildHeightMm<=c.buildHeightMm&&d.contactAreaMm2<=c.contactAreaMm2&&(d.supportProxyMm3<c.supportProxyMm3||d.buildHeightMm<c.buildHeightMm||d.contactAreaMm2<c.contactAreaMm2));}
 output.sort((a,b)=>Number(b.feasible)-Number(a.feasible)||b.score-a.score||a.id.localeCompare(b.id));output.forEach((c,i)=>c.rank=i+1);
 return{candidates:output,mesh:{triangleCount:triangles.length},method:"24 orthogonal rotations; exact triangle-face overhang area with centroid-to-plate support-volume proxy",qualification:"RESEARCH_ONLY",limitations:["Only 90-degree rigid rotations are searched; arbitrary angles and nesting are not evaluated.","Support proxy is a geometric upper-bound-style heuristic, not generated support geometry or validated build volume.","Triangle normals and STL units are assumed correct; units interpreted as mm.","Down-facing classifications do not account for self-support, bridging, scan strategy, thermal physics or support accessibility.","Contact area is a face-proximity estimate; the algorithm does not verify bed adhesion.","Strength, anisotropy, dimensional accuracy and residual-stress predictions are NOT calculated.","Outputs cannot establish process qualification or part certification."]};
}
const globalKeys=new Set<string>(["1,0,0,0,1,0"]);
