"use client";
import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {endFace,type ServiceSetup} from '@/lib/service-load';
/** Schematic uses the exact same original-STL → viewer transform as the rendered part. */
export default function ServiceBoundary({source,transform,input}:{source:THREE.BufferGeometry;transform:THREE.Matrix4;input:ServiceSetup}) {
 const objects=useMemo(()=>{
  source.computeBoundingBox();const box=source.boundingBox!;
  const {axis,maximum}=endFace(input.fixedFace??'z-min');const others=[0,1,2].filter(i=>i!==axis);
  const low=box.min.toArray(),high=box.max.toArray();
  const planes=[maximum,!maximum].map((max,index)=>{
   const points=[[0,0],[1,0],[1,1],[0,1]].map(([a,b])=>{const p=[...low];p[axis]=max?high[axis]:low[axis];p[others[0]]=a?high[others[0]]:low[others[0]];p[others[1]]=b?high[others[1]]:low[others[1]];return new THREE.Vector3(...p).applyMatrix4(transform);});
   const geometry=new THREE.BufferGeometry().setFromPoints([points[0],points[1],points[2],points[0],points[2],points[3]]);
   return {geometry,color:index===0?'#27d2df':'#ffb454',center:points.reduce((v,p)=>v.add(p),new THREE.Vector3()).multiplyScalar(.25)};
  });
  const force=new THREE.Vector3(input.forceXN,input.forceYN??0,input.forceZN);
  const arrow=force.length()>0?new THREE.ArrowHelper(force.transformDirection(transform),planes[1].center,Math.max(.1,box.getSize(new THREE.Vector3()).applyMatrix3(new THREE.Matrix3().setFromMatrix4(transform)).length()*.35),0xffb454):null;
  return {planes,arrow};
 },[source,transform,input.fixedFace,input.forceXN,input.forceYN,input.forceZN]);
 useEffect(()=>()=>{objects.planes.forEach(p=>p.geometry.dispose());objects.arrow?.dispose();},[objects]);
 return <group>{objects.planes.map((p,i)=><mesh key={i} geometry={p.geometry}><meshBasicMaterial color={p.color} side={THREE.DoubleSide} transparent opacity={.3} depthWrite={false}/></mesh>)}{objects.arrow&&<primitive object={objects.arrow}/>}</group>;
}
