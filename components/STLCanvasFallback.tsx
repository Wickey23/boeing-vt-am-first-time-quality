"use client";
import {useEffect,useRef,useState} from "react";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";

type Rotation={x:number;y:number;z:number};
type Props={
 url?:string;unitScale:number;rotation?:Rotation;showOverhangs?:boolean;showSupports?:boolean;
 overhangDeg?:number;buildFraction?:number;highlightTriangles?:number[];
};
type Point={x:number;y:number;z:number};
type Face={points:[Point,Point,Point];normal:Point;index:number};
type Projected={points:{x:number;y:number}[];depth:number;shade:number;overhang:boolean;highlight:boolean};
const clamp=(x:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,x));
/** Canvas 2D fallback for devices where WebGL is unavailable.
 * Projects the user's actual STL triangles (never a fabricated illustrative part).
 * No simulated stress, thermal data or qualified process supports are rendered here.
 */
export default function STLCanvasFallback({
 url,unitScale,rotation,showOverhangs=false,showSupports=false,overhangDeg=45,buildFraction=1,highlightTriangles
}:Props){
 const canvas=useRef<HTMLCanvasElement>(null);
 const [faces,setFaces]=useState<Face[]>([]);
 const [error,setError]=useState("");
 const [yaw,setYaw]=useState(Math.PI/4);
 const [zoom,setZoom]=useState(1);
 const drag=useRef<{x:number;yaw:number}|null>(null);
 const [size,setSize]=useState({w:600,h:420});
 useEffect(()=>{
  const target=canvas.current?.parentElement;
  if(!target)return;
  const update=()=>setSize({w:Math.max(200,target.clientWidth),h:Math.max(190,target.clientHeight)});
  update();
  const obs=new ResizeObserver(update);obs.observe(target);
  return()=>obs.disconnect();
 },[]);
 useEffect(()=>{
  if(!url){setFaces([]);return;}
  let cancelled=false;setFaces([]);setError("");
  void (async()=>{
   try{
    const response=await fetch(url);
    if(!response.ok)throw Error("STL data unavailable");
    const data=await response.arrayBuffer();
    const geometry=new STLLoader().parse(data);
    const attr=geometry.getAttribute("position");
    const result:Face[]=[];
    // Convert STL coordinate units, rotate build orientation, and make the build axis Y-up.
    const matrix=new THREE.Matrix4()
     .makeRotationX(-Math.PI/2)
     .multiply(new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler((rotation?.x??0)*Math.PI/180,(rotation?.y??0)*Math.PI/180,(rotation?.z??0)*Math.PI/180,"XYZ")));
    const points:Point[]=[];
    for(let i=0;i<attr.count;i++){
     const p=new THREE.Vector3(attr.getX(i)*unitScale,attr.getY(i)*unitScale,attr.getZ(i)*unitScale).applyMatrix4(matrix);
     points.push({x:p.x,y:p.y,z:p.z});
    }
    const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
    for(const p of points){for(const axis of ["x","y","z"] as const){min[axis]=Math.min(min[axis],p[axis]);max[axis]=Math.max(max[axis],p[axis]);}}
    const cx=(min.x+max.x)/2,cz=(min.z+max.z)/2;
    for(let i=0;i+2<points.length;i+=3){
     const tri=[points[i],points[i+1],points[i+2]].map(p=>({x:p.x-cx,y:p.y-min.y,z:p.z-cz})) as [Point,Point,Point];
     const [a,b,c]=tri;
     const ab=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z);
     const ac=new THREE.Vector3(c.x-a.x,c.y-a.y,c.z-a.z);
     const n=ab.cross(ac).normalize();
     result.push({points:tri,normal:{x:n.x,y:n.y,z:n.z},index:i/3});
    }
    geometry.dispose();
    if(!cancelled)setFaces(result);
   }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Could not read STL");}
  })();
  return()=>{cancelled=true;};
 },[url,unitScale,rotation?.x,rotation?.y,rotation?.z]);
 useEffect(()=>{
  const el=canvas.current;if(!el)return;
  const ctx=el.getContext("2d");if(!ctx)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  el.width=Math.round(size.w*dpr);el.height=Math.round(size.h*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,size.w,size.h);
  const bg=ctx.createLinearGradient(0,0,size.w,size.h);
  bg.addColorStop(0,"#182535");bg.addColorStop(1,"#0b1320");
  ctx.fillStyle=bg;ctx.fillRect(0,0,size.w,size.h);
  if(!faces.length)return;
  const maxY=Math.max(0.001,...faces.map(f=>Math.max(...f.points.map(p=>p.y))));
  const ceiling=maxY*clamp(buildFraction,0,1);
  // The same world-space clipping plane used by the WebGL build preview.
  function clip(poly:Point[]):Point[]{
   const result:Point[]=[];
   for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ina=a.y<=ceiling,inb=b.y<=ceiling;
    if(ina)result.push(a);
    if(ina!==inb){
     const t=clamp((ceiling-a.y)/(b.y-a.y),0,1);
     result.push({x:a.x+(b.x-a.x)*t,y:ceiling,z:a.z+(b.z-a.z)*t});
    }
   }return result;
  }
  const pitch=.52,cos=Math.cos(yaw),sin=Math.sin(yaw);
  function project(p:Point){const x=p.x*cos-p.z*sin,depth=p.x*sin+p.z*cos;
   return {x,y:p.y*Math.sin(pitch)-depth*Math.cos(pitch),depth:p.y*Math.cos(pitch)+depth*Math.sin(pitch)};
  }
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxYp=-Infinity;
  const sample=faces.flatMap((f,i)=>i%Math.max(1,Math.floor(faces.length/2000))===0?f.points:[]);
  for(const p of sample){const t=project(p);minX=Math.min(minX,t.x);maxX=Math.max(maxX,t.x);minY=Math.min(minY,t.y);maxYp=Math.max(maxYp,t.y);}
  const spanX=Math.max(.001,maxX-minX),spanY=Math.max(.001,maxYp-minY);
  const scale=Math.min((size.w-48)/spanX,(size.h-54)/spanY)*clamp(zoom,.4,3);
  const centerX=(minX+maxX)/2,centerY=(minY+maxYp)/2;
  const projected:Projected[]=[];
  const highlighted=new Set(highlightTriangles??[]);
  for(const f of faces){
   const poly=clip(f.points);if(poly.length<3)continue;
   const points=poly.map(p=>project(p));
   const colorLight=clamp(.42+(.25*f.normal.y)+(.13*f.normal.x)+(.17*f.normal.z),.16,.92);
   projected.push({points:points.map(p=>({x:size.w/2+(p.x-centerX)*scale,y:size.h/2-(p.y-centerY)*scale})),
    depth:points.reduce((sum,p)=>sum+p.depth,0)/points.length,shade:colorLight,
    overhang:f.normal.y<-Math.sin(clamp(overhangDeg,0,89)*Math.PI/180),highlight:highlighted.has(f.index)});
  }
  projected.sort((a,b)=>a.depth-b.depth);
  for(const face of projected){
   const path=new Path2D();
   face.points.forEach((p,i)=>i?path.lineTo(p.x,p.y):path.moveTo(p.x,p.y));
   path.closePath();
   const lit=Math.round(145+face.shade*98);
   ctx.fillStyle=highlighted.size?(face.highlight?"#f59e56":"#43576e"):
    showOverhangs&&face.overhang?"#ef8a52":`rgb(${lit-14},${lit-3},${lit+6})`;
   ctx.fill(path);
  }
  ctx.strokeStyle="rgba(171,201,225,.15)";ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(22,size.h-26);ctx.lineTo(size.w-22,size.h-26);ctx.stroke();
 },[faces,size,yaw,zoom,buildFraction,overhangDeg,showOverhangs,highlightTriangles]);
 return <div className="oaCanvasFallback" aria-label="STL geometric preview without WebGL">
  <canvas ref={canvas} role="img" aria-label="Orthographic projection of the uploaded STL geometry"
   onPointerDown={e=>{drag.current={x:e.clientX,yaw};e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{if(drag.current)setYaw(drag.current.yaw+(e.clientX-drag.current.x)*.008);}}
   onPointerUp={()=>{drag.current=null;}}
   onPointerCancel={()=>{drag.current=null;}}
   onWheel={e=>{e.preventDefault();setZoom(z=>clamp(z*(e.deltaY<0?1.08:.92),.4,3));}}/>
  <div className="oaFallbackLabel"><strong>STL geometry · 2D renderer</strong><span>WebGL unavailable · drag to rotate · scroll to zoom</span></div>
  {!faces.length&&<p className="oaFallbackLoading">{error||"Preparing geometric preview…"}</p>}
  {showSupports&&<p className="oaFallbackCaveat">Support posts require the 3D renderer; no supports are inferred in this fallback.</p>}
 </div>;
}
