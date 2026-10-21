'use client';
import {useEffect,useState} from 'react';
import type {MeshAudit} from '@/lib/stl-mesh-audit';
export type Inspection={audit:MeshAudit;dimensions:{x:number;y:number;z:number}};
export function usePartInspection(file:File|null,scale:number){
 const [state,setState]=useState<{file:File;scale:number;data?:Inspection;error?:string}|null>(null);
 useEffect(()=>{
  if(!file)return;
  let active=true;
  const worker=new Worker(new URL('../workers/inspection.worker.ts',import.meta.url));
  const timer=setTimeout(()=>{worker.terminate();if(active)setState({file,scale,error:'Inspection took too long. Try a smaller STL.'})},120000);
  worker.onmessage=e=>{clearTimeout(timer);worker.terminate();if(active)setState({file,scale,...(e.data.ok?{data:e.data}:{error:e.data.error})})};
  worker.onerror=()=>{clearTimeout(timer);worker.terminate();if(active)setState({file,scale,error:'Inspection failed. Try re-exporting your STL.'})};
  file.arrayBuffer().then(bytes=>{if(active)worker.postMessage({file:bytes,scale},[bytes])}).catch(()=>{if(active)setState({file,scale,error:'Could not read this file.'})});
  return()=>{active=false;clearTimeout(timer);worker.terminate()};
 },[file,scale]);
 return state?.file===file&&state?.scale===scale?state:{data:undefined,error:undefined};
}
export default function PartInspection({data}:{data:Inspection}){
 return <div className="geometryReview"><h3>Does this match your intended part?</h3><p className="partDimensions">{data.dimensions.x.toFixed(2)} × {data.dimensions.y.toFixed(2)} × {data.dimensions.z.toFixed(2)} <small>mm</small></p><p>Dimensions in the original file orientation. STL files do not store units.</p><h3>Mesh checks</h3><p>{data.audit.triangles.toLocaleString()} triangles · {data.audit.disconnectedShells} shell(s)</p>{data.audit.findings.map(f=><div className="guidedNotice" key={f.code}><strong>{f.level==='blocker'?'Repair before physical simulation':'Review geometry'} · {f.code}</strong><p>{f.message}</p></div>)}{!data.audit.findings.length&&<p>No edge-topology issues detected.</p>}<small>These checks do not verify self-intersections, wall thickness or suitability for printing.</small></div>
}
