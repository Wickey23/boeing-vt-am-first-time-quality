import * as THREE from "three";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";

export type OrientationRequest={machine:{x:number;y:number;z:number};overhangDeg:number;maxSupportProxyMm3?:number;searchSamples?:number;unitScale?:number;layerHeightMm?:number;recoatSeconds?:number;scanSecondsPerLayer?:number;machineHourlyRate?:number;criticalFaces?:number[];weights:{support:number;height:number;contact:number}};
export type Candidate={id:string;rotation:{x:number;y:number;z:number};dimensions:{x:number;y:number;z:number};buildHeightMm:number;downFacingAreaMm2:number;supportProxyMm3:number;contactAreaMm2:number;overhangFraction:number;fitsEnvelope:boolean;feasible:boolean;score:number;rank:number;pareto:boolean;estimatedLayers:number;estimatedBuildHours:number;estimatedMachineCost:number;criticalDownFacingAreaMm2:number};
const round=(n:number)=>Math.round(n*1000)/1000;
const verify=(x:number,min:number,max:number,name:string)=>{if(!Number.isFinite(x)||x<min||x>max)throw new Error("Invalid "+name);return x};
export function analyzeOrientations(buffer:ArrayBuffer,input:OrientationRequest,onProgress?:(done:number,total:number)=>void){
 const samples=verify(input.searchSamples??72,0,360,"search samples");if(!Number.isInteger(samples))throw new Error("Search samples must be an integer");
 const scale=verify(input.unitScale??1,.001,1000,"STL unit scale");
 const layer=verify(input.layerHeightMm??.04,.01,1,"layer height");
 const recoat=verify(input.recoatSeconds??8,0,3600,"recoat seconds");
 const scan=verify(input.scanSecondsPerLayer??20,0,86400,"assumed scan seconds per layer");
 const rate=verify(input.machineHourlyRate??100,0,100000,"machine hourly rate");
 const machine={x:verify(input.machine.x,1,5000,"machine X"),y:verify(input.machine.y,1,5000,"machine Y"),z:verify(input.machine.z,1,5000,"machine Z")};
 const angle=verify(input.overhangDeg,0,89,"overhang angle");
 const weights={support:verify(input.weights.support,0,100,"support weight"),height:verify(input.weights.height,0,100,"height weight"),contact:verify(input.weights.contact,0,100,"contact weight")};
 const maxSupport=input.maxSupportProxyMm3===undefined?Infinity:verify(input.maxSupportProxyMm3,0,1e12,"support limit");
 if(buffer.byteLength>20*1024*1024)throw new Error("STL limit is 20 MB");
 const g=new STLLoader().parse(buffer);g.scale(scale,scale,scale);const pos=g.getAttribute("position");
 if(!pos||pos.count<3||pos.count%3!==0||pos.count>900000)throw new Error("Invalid or excessively large STL mesh");
 const critical=new Set(input.criticalFaces??[]);for(const i of critical)if(!Number.isInteger(i)||i<0||i>=pos.count/3)throw new Error("Invalid critical triangle index");
 const triangles:{index:number;a:THREE.Vector3;b:THREE.Vector3;c:THREE.Vector3;n:THREE.Vector3;area:number;center:THREE.Vector3}[]=[];
 for(let i=0;i<pos.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);
 if(![a,b,c].every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z)))throw new Error("Non-finite STL coordinates");
 const cross=b.clone().sub(a).cross(c.clone().sub(a));const area=cross.length()/2;if(area<1e-12)continue;
 triangles.push({index:i/3,a,b,c,n:cross.normalize(),area,center:a.clone().add(b).add(c).multiplyScalar(1/3)});}
 if(!triangles.length)throw new Error("STL has no nondegenerate triangles");
 const eulers:Array<[number,number,number]>=[[0,0,0]];const globalKeys=new Set<string>(["1,0,0,0,1,0"]);
 // 24 orthogonal orientations are covered by rotations of 90 degrees and deduplicated by transformed axes.
 for(const x of [0,90,180,270])for(const y of [0,90,180,270])for(const z of [0,90,180,270]){
 const rot=new THREE.Euler(x*Math.PI/180,y*Math.PI/180,z*Math.PI/180,"XYZ");const ex=new THREE.Vector3(1,0,0).applyEuler(rot),ey=new THREE.Vector3(0,1,0).applyEuler(rot);
 const key=[ex,ey].flatMap(v=>[Math.round(v.x),Math.round(v.y),Math.round(v.z)]).join(",");
 if(!(globalKeys.has(key))){globalKeys.add(key);if(x||y||z)eulers.push([x,y,z]);}
 }
 // Deterministic low-discrepancy quaternion samples cover all three rotation axes.
 // Retain all 24 orthogonal candidates; this is a finite search, not a global optimum.
 const radical=(i:number,base:number)=>{let f=1/base,r=0;while(i>0){r+=f*(i%base);i=Math.floor(i/base);f/=base;}return r;};
 for(let i=1;i<=samples;i++){const u=radical(i,2),v=radical(i,3),w=radical(i,5);const q=new THREE.Quaternion(Math.sqrt(1-u)*Math.sin(2*Math.PI*v),Math.sqrt(1-u)*Math.cos(2*Math.PI*v),Math.sqrt(u)*Math.sin(2*Math.PI*w),Math.sqrt(u)*Math.cos(2*Math.PI*w));const e=new THREE.Euler().setFromQuaternion(q,"XYZ");eulers.push([e.x*180/Math.PI,e.y*180/Math.PI,e.z*180/Math.PI]);}
 const output:Candidate[]=[];
 for(const [rx,ry,rz] of eulers){const rotation=new THREE.Euler(rx*Math.PI/180,ry*Math.PI/180,rz*Math.PI/180,"XYZ");
 const bounds=new THREE.Box3();for(const t of triangles){bounds.expandByPoint(t.a.clone().applyEuler(rotation));bounds.expandByPoint(t.b.clone().applyEuler(rotation));bounds.expandByPoint(t.c.clone().applyEuler(rotation));}
 const dims=new THREE.Vector3();bounds.getSize(dims);if(!Number.isFinite(dims.x+dims.y+dims.z))throw new Error("Non-finite STL coordinates");
 let down=0,support=0,contact=0,total=0,criticalDown=0;const threshold=-Math.sin(angle*Math.PI/180);
 for(const t of triangles){const n=t.n.clone().applyEuler(rotation),center=t.center.clone().applyEuler(rotation);total+=t.area;
 if(n.z<threshold){down+=t.area;if(critical.has(t.index))criticalDown+=t.area;support+=t.area*Math.abs(n.z)*Math.max(0,center.z-bounds.min.z);}
 if(Math.abs(center.z-bounds.min.z)<Math.max(.01,dims.z*.001)&&n.z<-.9)contact+=t.area;
 }
 const fits=dims.x<=machine.x+1e-6&&dims.y<=machine.y+1e-6&&dims.z<=machine.z+1e-6;
 output.push({id:"O"+String(output.length+1).padStart(2,"0"),rotation:{x:rx,y:ry,z:rz},dimensions:{x:round(dims.x),y:round(dims.y),z:round(dims.z)},buildHeightMm:round(dims.z),downFacingAreaMm2:round(down),supportProxyMm3:round(support),contactAreaMm2:round(contact),overhangFraction:round(down/Math.max(total,1e-12)),fitsEnvelope:fits,feasible:fits&&support<=maxSupport,score:0,rank:0,pareto:false,estimatedLayers:Math.ceil(dims.z/layer),estimatedBuildHours:Math.ceil(dims.z/layer)*(recoat+scan)/3600,estimatedMachineCost:Math.ceil(dims.z/layer)*(recoat+scan)/3600*rate,criticalDownFacingAreaMm2:round(criticalDown)});
 onProgress?.(output.length,eulers.length);
 }
 const minima={support:Math.min(...output.map(c=>c.supportProxyMm3)),height:Math.min(...output.map(c=>c.buildHeightMm)),contact:Math.min(...output.map(c=>c.contactAreaMm2))};
 const maxima={support:Math.max(...output.map(c=>c.supportProxyMm3)),height:Math.max(...output.map(c=>c.buildHeightMm)),contact:Math.max(...output.map(c=>c.contactAreaMm2))};
 const normalize=(v:number,min:number,max:number)=>max-min<1e-8?0:(v-min)/(max-min);
 const weightSum=weights.support+weights.height+weights.contact||1;
 for(const c of output){const penalty=(weights.support*normalize(c.supportProxyMm3,minima.support,maxima.support)+weights.height*normalize(c.buildHeightMm,minima.height,maxima.height)+weights.contact*(maxima.contact-minima.contact<1e-8?0:1-normalize(c.contactAreaMm2,minima.contact,maxima.contact)))/weightSum;c.score=round(100*(1-penalty));}
 for(const c of output.filter(c=>c.feasible)){c.pareto=!output.some(d=>d!==c&&d.feasible&&d.supportProxyMm3<=c.supportProxyMm3&&d.buildHeightMm<=c.buildHeightMm&&d.contactAreaMm2>=c.contactAreaMm2&&(d.supportProxyMm3<c.supportProxyMm3||d.buildHeightMm<c.buildHeightMm||d.contactAreaMm2>c.contactAreaMm2));}
 output.sort((a,b)=>Number(b.feasible)-Number(a.feasible)||b.score-a.score||a.id.localeCompare(b.id));output.forEach((c,i)=>c.rank=i+1);
 g.dispose();
 return{candidates:output,mesh:{triangleCount:triangles.length},method:`24 orthogonal + ${samples} deterministic arbitrary-angle samples; projected triangle area × centroid-to-plate height support proxy`,assumptions:{unitScale:scale,layerHeightMm:layer,recoatSeconds:recoat,scanSecondsPerLayer:scan,machineHourlyRate:rate,contactObjective:"maximize plate contact",costScope:"Machine occupancy only; constant user-assumed scan time per layer, excludes setup, material, supports, postprocessing and downtime"},qualification:"RESEARCH_ONLY",limitations:["Finite deterministic orientation sampling; global optimality and nesting are not evaluated.","Projected-area support proxy may double-count overlapping faces and ignores occlusion; not generated support geometry or validated build volume.","Triangle normals and STL units are assumed correct; coordinates scaled by the selected unit conversion to mm.","Down-facing classifications do not account for self-support, bridging, scan strategy, thermal physics or support accessibility.","More plate contact is favored; removal tradeoffs require engineering review. Contact area is a face-proximity estimate; the algorithm does not verify bed adhesion.","Strength, anisotropy, dimensional accuracy and residual-stress predictions are NOT calculated.","Outputs cannot establish process qualification or part certification."]};
}
