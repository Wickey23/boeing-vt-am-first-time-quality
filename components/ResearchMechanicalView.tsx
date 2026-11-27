"use client";
import {useMemo,useState} from "react";
import type {prepareRegisteredThermalMeshHistory} from "@/lib/lpbf-registered-thermal-mesh-history";
import {prepareMechanicalSurface} from "@/lib/lpbf-mechanical-surface";
type History=ReturnType<typeof prepareRegisteredThermalMeshHistory>;
export default function ResearchMechanicalView({history}:{history:History}){
 const [field,setField]=useState<"stress"|"displacement">("stress"),[constraint,setConstraint]=useState("released"),[scale,setScale]=useState(0),[angle,setAngle]=useState(35);
 const step=history.steps.find(s=>s.frameIndex===history.selection.releaseFrame)!;
 const mesh=constraint==="restrained"?step.restrainedComparison!:step.mesh;
 const g=history.coordinateFrame;
 const max=field==="stress"?Math.max(...[step.mesh,step.restrainedComparison!].flatMap(m=>m.cellResults.map(c=>c.meanVonMisesMPa))):Math.max(step.mesh.maxDisplacementMm,step.restrainedComparison!.maxDisplacementMm);
 const faces=useMemo(()=>prepareMechanicalSurface(mesh,g.pitchMm,g.layerHeightMm,scale,field),[mesh,g,scale,field]);
 const rad=angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
 const project=(v:number[])=>[c*v[0]-s*v[1],.45*(s*v[0]+c*v[1])-.89*v[2],.89*(s*v[0]+c*v[1])+.45*v[2]];
 const polygons=faces.map(f=>({...f,p:f.vertices.map(project),o:f.original.map(project)})).sort((a,b)=>a.p.reduce((n,p)=>n+p[2],0)-b.p.reduce((n,p)=>n+p[2],0));
 const pts=polygons.flatMap(f=>[...f.p,...f.o]),minX=Math.min(...pts.map(p=>p[0])),maxX=Math.max(...pts.map(p=>p[0])),minY=Math.min(...pts.map(p=>p[1])),maxY=Math.max(...pts.map(p=>p[1]));
 const factor=300/Math.max(maxX-minX,maxY-minY,1e-6);
 const xy=(p:number[])=>[200+(p[0]-(minX+maxX)/2)*factor,190+(p[1]-(minY+maxY)/2)*factor].join(",");
 const color=(v:number)=>"hsl("+(240*(1-(max>0?Math.min(1,v/max):0)))+" 80% 48%)";
 return <section aria-label="Research mechanical contours" style={{display:"grid",gap:12}}>
  <h2>3D elastic mechanical result</h2>
  <p>Same thermal release frame, two idealized constraints. Sampled mesh only, not the original CAD surface. No permanent distortion prediction.</p>
  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
   <label>Mechanical field <select value={field} onChange={e=>setField(e.target.value as typeof field)}><option value="stress">Mean cell von Mises stress</option><option value="displacement">Displacement magnitude</option></select></label>
   <label>Mechanical constraint <select value={constraint} onChange={e=>setConstraint(e.target.value)}><option value="released">Released (rigid-motion pins)</option><option value="restrained">Restrained (clamped base)</option></select></label>
   <label>Deformation scale <select value={scale} onChange={e=>setScale(Number(e.target.value))}>{[0,1,100,1000,10000].map(n=><option key={n} value={n}>{n===0?"Undeformed":n+"×"}</option>)}</select></label>
   <label>View azimuth <input type="range" min={0} max={360} value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label>
  </div>
  <p role="status">Command {step.commandIndex+1} · {constraint} · maximum element stress {mesh.maxVonMisesMPa.toPrecision(4)} MPa · maximum nodal displacement {mesh.maxDisplacementMm.toExponential(4)} mm · deformation {scale}×</p>
  <svg role="img" aria-label="Projected 3D mechanical mesh contour" viewBox="0 0 400 380" style={{width:"100%",maxWidth:580,background:"#f3f4f6",border:"1px solid #94a3b8"}}>
   {polygons.map(f=><polygon key={f.id} points={f.p.map(xy).join(" ")} fill={color(f.values.reduce((n,v)=>n+v,0)/4)} stroke="#334155" strokeWidth=".8"><title>{f.cellKey}: {(f.values.reduce((n,v)=>n+v,0)/4).toExponential(4)} {field==="stress"?"MPa":"mm"}</title></polygon>)}
   {scale>0&&polygons.map(f=><polygon key={"ref"+f.id} points={f.o.map(xy).join(" ")} fill="none" stroke="#475569" strokeDasharray="3 4" opacity=".5"/>)}
  </svg>
  <div style={{height:12,maxWidth:580,background:"linear-gradient(to right,blue,cyan,lime,yellow,red)"}}/>
  <p>Fixed comparison range: 0–{max.toExponential(4)} {field==="stress"?"MPa":"mm"}. Displacement face colors are mean corner magnitudes; dashed lines show undeformed mesh. Scale affects geometry only.</p>
  <details><summary>Text alternative: mechanical cell results</summary><table><thead><tr><th>Cell (X,Y,layer)</th><th>Temperature (°C)</th><th>Mean von Mises (MPa)</th></tr></thead><tbody>{mesh.cellResults.map(v=><tr key={[v.x,v.y,v.layer].join(",")}><td>{v.x}, {v.y}, {v.layer}</td><td>{v.temperatureC.toFixed(4)}</td><td>{v.meanVonMisesMPa.toExponential(4)}</td></tr>)}</tbody></table></details>
 </section>;
}
