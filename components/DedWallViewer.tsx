"use client";
import {Canvas} from "@react-three/fiber";
import {Grid,Line,OrbitControls} from "@react-three/drei";
import type {DedResult} from "@/lib/ded-planning";

/** Physical mm dimensions in local teaching coordinates: X along wall, Y is height, Z is wall thickness. */
export default function DedWallViewer({plan}:{plan:DedResult}) {
  const i=plan.input;
  const span=Math.max(i.substrateLengthMm,i.substrateWidthMm,i.substrateThicknessMm+plan.actualWallHeightMm);
  const centerY=i.substrateThicknessMm + plan.actualWallHeightMm/2;
  return <div style={{width:"100%",height:345,background:"#081c2d",borderRadius:10,overflow:"hidden",position:"relative"}} aria-label="Interactive 3D teaching wall, substrate and deposition path">
    <Canvas camera={{position:[span*1.05,span*.72,span*.88],fov:42,near:0.1,far:span*20}} dpr={[1,1.5]}>
      <color attach="background" args={["#081c2d"]}/>
      <ambientLight intensity={1.4}/>
      <directionalLight position={[50,100,70]} intensity={1.7}/>
      <mesh position={[0,i.substrateThicknessMm/2,0]}>
        <boxGeometry args={[i.substrateLengthMm,i.substrateThicknessMm,i.substrateWidthMm]}/>
        <meshStandardMaterial color="#456880" roughness={.6} metalness={.3}/>
      </mesh>
      <mesh position={[0,centerY,0]}>
        <boxGeometry args={[i.wallLengthMm,plan.actualWallHeightMm,i.beadWidthMm]}/>
        <meshStandardMaterial color="#9cbbd2" transparent opacity={.22} roughness={.4}/>
      </mesh>
      {plan.tracks.map((track,index)=><Line key={index} points={[[track.from[0],track.from[2],track.from[1]],[track.to[0],track.to[2],track.to[1]]]} color={index%2===0?"#f9ab55":"#4ddacb"} lineWidth={3}/>)}
      <Grid infiniteGrid fadeDistance={span*5} sectionSize={10} position={[0,-.05,0]} cellColor="#23475e" sectionColor="#316f91"/>
      <OrbitControls makeDefault target={[0,centerY,0]} enableDamping minDistance={span*.3} maxDistance={span*5}/>
    </Canvas>
    <div style={{position:"absolute",left:12,top:12,background:"#071625dd",borderRadius:6,padding:"8px 11px",fontSize:12,color:"#e6f6ff"}}>
      <strong>DED teaching geometry</strong><div>Blue-grey: substrate · Pale: nominal wall</div>
      <div>Orange/teal: alternating path layers</div>
      <small>Illustration, not a machine-verified toolpath</small>
    </div>
  </div>;
}
