"use client";
import {useState} from "react";
import {Canvas,useLoader} from "@react-three/fiber";
import {Bounds,Grid,OrbitControls} from "@react-three/drei";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";
import {RotateCcw} from "lucide-react";
function STLModel({url}:{url:string}){
 const geometry=useLoader(STLLoader,url);
 geometry.computeVertexNormals();
 return <Bounds fit clip observe margin={1.4}><mesh geometry={geometry} rotation={[-Math.PI/2,0,0]} castShadow receiveShadow>
  <meshStandardMaterial color="#d8e8f3" metalness={0.45} roughness={0.4} side={2}/>
 </mesh></Bounds>;
}
export default function ModelViewer({url}:{url?:string}){
 const[resetVersion,setResetVersion]=useState(0);
 return <div className="viewer" style={{position:"relative",height:"100%",minHeight:320}}>
  <Canvas key={String(resetVersion)+"-"+(url||"none")} shadows camera={{position:[4,3,5],fov:42}}>
   <color attach="background" args={["#071625"]}/>
   <ambientLight intensity={0.9}/>
   <directionalLight position={[4,8,5]} intensity={2.0} castShadow/>
   {url?<STLModel url={url}/>:<mesh><boxGeometry args={[1.7,1.2,1.7]}/><meshStandardMaterial color="#263348" wireframe/></mesh>}
   <Grid infiniteGrid fadeDistance={30} fadeStrength={3} sectionSize={1}/>
   <OrbitControls makeDefault enableDamping dampingFactor={0.1}/>
  </Canvas>
  <button type="button" className="viewerReset" aria-label="Fit and reset camera view" onClick={()=>setResetVersion(x=>x+1)} style={{position:"absolute",right:12,top:12,zIndex:3,background:"#183f5b",border:"1px solid #4f8db4",color:"#e9f6ff",borderRadius:6,padding:"9px 11px",display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:12}}>
   <RotateCcw size={14}/> Reset view
  </button>
  <div className="viewerHint">Drag to orbit · Scroll to zoom · Right-drag to pan</div>
 </div>;
}
