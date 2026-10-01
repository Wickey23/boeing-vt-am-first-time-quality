"use client";
import { Canvas, useLoader } from "@react-three/fiber";
import { Bounds, Environment, Grid, OrbitControls } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";

function STLModel({url}:{url:string}){const geometry=useLoader(STLLoader,url); geometry.computeVertexNormals(); return <Bounds fit clip observe margin={1.35}><mesh geometry={geometry} castShadow receiveShadow rotation={[-Math.PI/2,0,0]}><meshStandardMaterial color="#d8dee9" metalness={0.72} roughness={0.28}/></mesh></Bounds>}
export default function ModelViewer({url}:{url?:string}){return <div className="viewer"><Canvas shadows camera={{position:[4,3,5],fov:42}}><ambientLight intensity={0.6}/><directionalLight position={[4,8,5]} intensity={2.2} castShadow/>{url?<STLModel url={url}/>:<mesh><boxGeometry args={[1.7,1.2,1.7]}/><meshStandardMaterial color="#263348" wireframe/></mesh>}<Grid infiniteGrid fadeDistance={18} fadeStrength={3} sectionSize={1}/><OrbitControls makeDefault/><Environment preset="warehouse"/></Canvas><div className="viewerHint">Drag to rotate · Scroll to zoom · Right-drag to pan</div></div>}