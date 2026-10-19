"use client";
import {useMemo,useState,useEffect} from "react";
import {Canvas,useLoader} from "@react-three/fiber";
import {Bounds,Grid,OrbitControls} from "@react-three/drei";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";
import {RotateCcw} from "lucide-react";
import {sampleVerticalSupports} from "@/lib/support-preview";
type Rotation={x:number;y:number;z:number};
function Part({url,rotation,showOverhangs,showSupports,overhangDeg,unitScale,field}:{url:string;rotation?:Rotation;showOverhangs:boolean;showSupports:boolean;overhangDeg:number;unitScale:number;field?:{values:number[];min:number;max:number;units?:string}}){
 const mesh=useLoader(STLLoader,url);
 const {geometry,dimensions,posts}=useMemo(()=>{
 const e=new THREE.Euler((rotation?.x||0)*Math.PI/180,(rotation?.y||0)*Math.PI/180,(rotation?.z||0)*Math.PI/180,"XYZ");
 const prepared=mesh.clone();prepared.scale(unitScale,unitScale,unitScale);
 prepared.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));
 prepared.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2));
 prepared.computeBoundingBox();const b=prepared.boundingBox!,v=new THREE.Vector3();b.getSize(v);
 prepared.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);
 prepared.computeVertexNormals();
 const count=prepared.getAttribute("position").count,colors=new Float32Array(count*3);
 const threshold=-Math.sin(Math.max(0,Math.min(89,overhangDeg))*Math.PI/180);
 const p=prepared.getAttribute("position");
 for(let i=0;i<count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
 const n=b.sub(a).cross(c.sub(a)).normalize();const flag=n.y<threshold;for(let j=0;j<3;j++){const k=(i+j)*3;colors[k]=flag?1:.72;colors[k+1]=flag?.38:.82;colors[k+2]=flag?.2:.9;}}
 if(field&&field.values.length===count){const color=new THREE.Color();for(let i=0;i<count;i++){const t=(field.values[i]-field.min)/Math.max(field.max-field.min,1e-12);color.setHSL((1-t)*.67,1,.5);colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;}}
 prepared.setAttribute("color",new THREE.BufferAttribute(colors,3));
 return {geometry:prepared,dimensions:v,posts:sampleVerticalSupports(prepared,overhangDeg)};
 },[mesh,rotation?.x,rotation?.y,rotation?.z,overhangDeg,unitScale,field]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <Bounds fit clip observe margin={1.35}><group><mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={showOverhangs||field?"white":"#b7cbdd"} vertexColors={showOverhangs||!!field} side={THREE.DoubleSide} metalness={.2} roughness={.62} flatShading={showOverhangs}/></mesh>{showSupports&&posts.map((post,i)=><mesh key={i} position={[post.x,(post.topY+post.bottomY)/2,post.z]}><cylinderGeometry args={[post.radius,post.radius,(post.topY-post.bottomY),6]}/><meshStandardMaterial color="#35c7ce" transparent opacity={.7}/></mesh>)}<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.03,0]}><planeGeometry args={[Math.max(1,dimensions.x*1.45),Math.max(1,dimensions.z*1.45)]}/><meshStandardMaterial color="#173550" transparent opacity={.45} side={THREE.DoubleSide}/></mesh></group></Bounds>;
}
export default function ModelViewer({url,rotation,showOverhangs=false,showSupports=false,overhangDeg=45,unitScale=1,field}:{url?:string;rotation?:Rotation;showOverhangs?:boolean;showSupports?:boolean;overhangDeg?:number;unitScale?:number;field?:{values:number[];min:number;max:number;units?:string}}){
 const[reset,setReset]=useState(0);
 return <div className="viewer" style={{position:"relative",height:"100%",minHeight:320}}>
 <Canvas frameloop="demand" dpr={[1,1.5]} key={(url||"none")+reset} shadows camera={{position:[4,3,5],fov:42}}>
 <color attach="background" args={["#071625"]}/><ambientLight intensity={1.1}/><directionalLight position={[4,8,5]} intensity={2} castShadow/>
 {url?<Part url={url} rotation={rotation} showOverhangs={showOverhangs} showSupports={showSupports} overhangDeg={overhangDeg} unitScale={unitScale} field={field}/>:<mesh><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="#263348" wireframe/></mesh>}
 <Grid infiniteGrid fadeDistance={30} fadeStrength={3} sectionSize={1}/>
 <OrbitControls makeDefault enableDamping dampingFactor={.08}/>
 </Canvas><button type="button" aria-label="Reset camera" onClick={()=>setReset(x=>x+1)} style={{position:"absolute",top:12,right:12,zIndex:3,background:"#163955",border:"1px solid #4f8db4",color:"white",borderRadius:7,padding:"8px 10px",display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:12}}><RotateCcw size={14}/> Reset camera</button><div className="viewerHint">{field?`Calculated field: ${field.min.toPrecision(4)} to ${field.max.toPrecision(4)} ${field.units??"degC"} · Blue → red · Nearest voxel projection`:"Drag to orbit · Scroll to zoom · Orange = down-facing · Cyan = conceptual support posts"}</div></div>;
}
