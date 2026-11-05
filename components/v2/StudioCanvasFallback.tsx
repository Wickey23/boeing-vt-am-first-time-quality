"use client";
import {useEffect,useRef,useState} from "react";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";
type P={x:number;y:number;z:number};
type Props={url?:string;buildFraction?:number};
const cap=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
/** Fallback renders actual STL triangles on a 2D canvas; no physical field is implied. */
export default function StudioCanvasFallback({url,buildFraction=1}:Props){
 const canvas=useRef<HTMLCanvasElement>(null);
 const [triangles,setTriangles]=useState<P[][]>([]);
 const [error,setError]=useState("");
 const [size,setSize]=useState({w:600,h:400});
 const [yaw,setYaw]=useState(.7);
 const [zoom,setZoom]=useState(1);
 const drag=useRef<{x:number;yaw:number}|null>(null);
 useEffect(()=>{
  const parent=canvas.current?.parentElement;
  if(!parent)return;
  const update=()=>setSize({w:Math.max(240,parent.clientWidth),h:Math.max(230,parent.clientHeight)});
  update();
  const obs=new ResizeObserver(update);obs.observe(parent);return()=>obs.disconnect();
 },[]);
 useEffect(()=>{
  let cancelled=false;
  setTriangles([]);setError("");
  if(!url)return;
  void(async()=>{
   try{
    const response=await fetch(url);if(!response.ok)throw Error("Unable to read STL");
    const bytes=await response.arrayBuffer();
    const mesh=new STLLoader().parse(bytes);
    const a=mesh.getAttribute("position");
    const stride=Math.max(1,Math.ceil(a.count/3/15000));
    const out:P[][]=[];
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(let i=0;i+2<a.count;i+=3*stride){
     const tri=[i,i+1,i+2].map(k=>({x:a.getX(k),y:a.getZ(k),z:-a.getY(k)}));
     for(const p of tri){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}
     out.push(tri);
    }
    mesh.dispose();
    const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
    if(!cancelled)setTriangles(out.map(tri=>tri.map(p=>({x:p.x-cx,y:p.y-minY,z:p.z-cz}))));
   }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"STL projection failed");}
  })();
  return()=>{cancelled=true;};
 },[url]);
 useEffect(()=>{
  const node=canvas.current,ctx=node?.getContext("2d");
  if(!node||!ctx)return;
  const ratio=Math.min(2,window.devicePixelRatio||1);
  node.width=Math.ceil(size.w*ratio);node.height=Math.ceil(size.h*ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);
  const grad=ctx.createLinearGradient(0,0,size.w,size.h);
  grad.addColorStop(0,"#17263a");grad.addColorStop(1,"#091322");
  ctx.fillStyle=grad;ctx.fillRect(0,0,size.w,size.h);
  if(!triangles.length)return;
  let high=.001,radius=.001;
  for(const tri of triangles)for(const p of tri){high=Math.max(high,p.y);radius=Math.max(radius,Math.hypot(p.x,p.z),p.y);}
  const cutoff=high*cap(buildFraction,0,1);
  const span=Math.min(size.w,size.h)*.38/radius*zoom;
  const cy=Math.cos(yaw),sy=Math.sin(yaw);
  const pitch=.52,sp=Math.sin(pitch),cp=Math.cos(pitch);
  const projected:{poly:P[];depth:number;brightness:number}[]=[];
  for(const tri of triangles){
   const clipped:P[]=[];
   for(let i=0;i<tri.length;i++){
    const p=tri[i],q=tri[(i+1)%tri.length],inside=p.y<=cutoff,next=q.y<=cutoff;
    if(inside)clipped.push(p);
    if(inside!==next){
     const t=(cutoff-p.y)/(q.y-p.y);
     clipped.push({x:p.x+(q.x-p.x)*t,y:cutoff,z:p.z+(q.z-p.z)*t});
    }
   }
   if(clipped.length<3)continue;
   const poly=clipped.map(p=>{
    const rx=p.x*cy-p.z*sy,rz=p.x*sy+p.z*cy;
    return {x:size.w/2+rx*span,y:size.h*.57-(p.y*cp-rz*sp-high*.35)*span,z:rz*cp+p.y*sp};
   });
   const u=poly[1],v=poly[0],w=poly[2];
   const brightness=cap(.52+((u.x-v.x)*(w.y-v.y)-(u.y-v.y)*(w.x-v.x))/(radius*radius*span*span)*12,.23,.88);
   projected.push({poly,depth:poly.reduce((a,p)=>a+p.z,0)/poly.length,brightness});
  }
  projected.sort((a,b)=>a.depth-b.depth);
  for(const face of projected){
   ctx.beginPath();face.poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
   const intensity=Math.round(157+face.brightness*75);
   ctx.fillStyle=`rgb(${intensity-13},${intensity-3},${intensity+4})`;ctx.fill();
  }
 },[size,triangles,yaw,zoom,buildFraction]);
 return <div className="psFallback" aria-label="STL viewer without WebGL">
  <canvas ref={canvas} role="img" aria-label="Canvas projection of uploaded STL geometry"
   onPointerDown={e=>{drag.current={x:e.clientX,yaw};e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{if(drag.current)setYaw(drag.current.yaw+(e.clientX-drag.current.x)*.008);}}
   onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
   onWheel={e=>{e.preventDefault();setZoom(z=>cap(z*(e.deltaY<0?1.08:.92),.4,2.7));}}/>
  <div className="psFallbackInfo">2D STL geometry preview <small>WebGL unavailable · drag to rotate</small></div>
  {!triangles.length&&<p className="psFallbackError">{error||"Preparing geometric projection…"}</p>}
 </div>;
}
