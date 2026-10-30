"use client";
import {useMemo,useState} from "react";
import type {PhysicalScanPlan} from "@/lib/lpbf-physical-schedule";
import type {PhysicalSliceResult} from "@/lib/lpbf-physical-slicer";
import type {RegisteredPhysicalScan} from "@/lib/lpbf-slice-registration";
import {calculatePhysicalScanTiming,type TimeAssumptions} from "@/lib/metal-scan-timing";

/**
 * Chat-first physical-layer scan preview. This visualizes only the imported
 * engineer-provided *commanded* path and measured STL sampling, not
 * generated toolpaths or authenticated machine execution.
 */
export default function MetalScanPathPanel({
 slices,scan,registration,selectedLayer,onSelectLayer
}:{slices:PhysicalSliceResult;scan:PhysicalScanPlan;registration:RegisteredPhysicalScan;
 selectedLayer:number;onSelectLayer:(layer:number)=>void;}){
 const [showTravel,setShowTravel]=useState(true);
 const [showCells,setShowCells]=useState(true);
 const [overhead,setOverhead]=useState<TimeAssumptions>({
  outsideCsvConfirmed:false,recoatSecondsPerLayer:8,preparationMinutes:0,cooldownMinutes:0
 });
 const report=useMemo(()=>calculatePhysicalScanTiming(scan,slices,registration,overhead),[scan,slices,registration,overhead]);
 const layer=slices.layers[selectedLayer];
 const commands=scan.commands.filter(c=>c.layer===selectedLayer);
 const visible=commands.slice(0,350);
 const x=(v:number)=>(v-slices.grid.originMm.x)/slices.grid.xyPitchMm;
 const y=(v:number)=>(slices.grid.rows-(v-slices.grid.originMm.y)/slices.grid.xyPitchMm);
 const duration=(seconds:number)=>{
  if(seconds<60)return seconds.toFixed(seconds<10?3:1)+" s";
  if(seconds<3600)return (seconds/60).toFixed(2)+" min";
  return (seconds/3600).toFixed(2)+" h";
 };
 const activeLayer=report.layers.find(l=>l.layer===selectedLayer);
 const update=(key:keyof TimeAssumptions,value:number|boolean)=>{
  setOverhead(p=>({...p,[key]:value}));
 };
 return <section className="oaScanToolpath" role="region" aria-label="Physical scan toolpath and print timing">
  <div className="oaScanToolpathTitle">
   <strong>Layer toolpath & build-time planning</strong>
   <small>Supplied CSV · not generated G-code or machine telemetry</small>
  </div>
  <p className="oaSubtle">Laser-on commands are shown in orange, laser-off repositioning in dashed blue. Geometry beneath is a sampled representation of the actual STL. A verified native LPBF slicer and actual machine toolpath generation are not implemented.</p>
  <div className="oaScanToolpathControls">
   <label><input aria-label="Show toolpath travel" type="checkbox" checked={showTravel} onChange={e=>setShowTravel(e.target.checked)}/> Show laser-off travel</label>
   <label><input aria-label="Show sampled material layer" type="checkbox" checked={showCells} onChange={e=>setShowCells(e.target.checked)}/> Show STL layer geometry</label>
  </div>
  <div className="oaScanToolpathLayout">
   <div className="oaScanToolpathCanvas">
    <svg role="img" aria-label={"Supplied physical scan paths on sampled STL layer "+(selectedLayer+1)}
     viewBox={`0 0 ${slices.grid.columns} ${slices.grid.rows}`} preserveAspectRatio="xMidYMid meet">
     {showCells&&layer.cells.length<=4500&&layer.cells.map(c=><rect key={c.x+"-"+c.y} x={c.x} y={slices.grid.rows-1-c.y}
      width={1} height={1} fill="#39718b" opacity={Math.max(.18,c.coverage*.85)}/>)}
     {visible.filter(c=>c.powerW>0||showTravel).map((c,i)=>{
      const on=c.powerW>0;
      const x0=x(c.x0Mm),y0=y(c.y0Mm),x1=x(c.x1Mm),y1=y(c.y1Mm);
      const common={stroke:on?"#ffaf48":"#82aee9",strokeWidth:on?.12:.08,
       vectorEffect:"non-scaling-stroke" as const,opacity:on?1:.8};
      return Math.abs(x1-x0)+Math.abs(y1-y0)<1e-9?
       <circle key={i} cx={x0} cy={y0} r=".11" fill={on?"#ffaf48":"#82aee9"}/>:
       <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} {...common}
        strokeDasharray={on?undefined:".18 .18"}/>;
     })}
    </svg>
   </div>
   <div className="oaPhysicalSliceLabels">
    <p><strong>Physical layer:</strong> {selectedLayer+1} / {slices.grid.physicalLayers}</p>
    <p><strong>Z range:</strong> {layer.bottomZMm.toFixed(3)}–{layer.topZMm.toFixed(3)} mm</p>
    <p><strong>CSV commands:</strong> {activeLayer?.commands??0}</p>
    <p><strong>Laser-on:</strong> {duration(activeLayer?.laserOnSeconds??0)}</p>
    <p><strong>Laser-off:</strong> {duration(activeLayer?.laserOffSeconds??0)}</p>
    <p><strong>Laser energy:</strong> {(activeLayer?.commandedLaserJ??0).toFixed(3)} J</p>
    {commands.length>350&&<p role="status">Showing first 350 / {commands.length} commands. Inspect original CSV before use.</p>}
    <div className="oaScanLegend"><span><i className="oaLegendLaser"/> Laser-on</span><span><i className="oaLegendTravel"/> Laser-off</span><span><i className="oaLegendPart"/> Sampled STL material</span></div>
   </div>
  </div>
  <div className="oaPhysicalSliceStats">
   <div><small>CSV commanded duration</small><strong>{duration(report.elapsedCommandSeconds)}</strong></div>
   <div><small>Laser-on time</small><strong>{duration(report.laserOnSeconds)}</strong></div>
   <div><small>Laser-off / travel time</small><strong>{duration(report.laserOffSeconds)}</strong></div>
   <div><small>Supplied powered travel</small><strong>{report.poweredPathMm.toFixed(1)} mm</strong></div>
   <div><small>Physical layers represented</small><strong>{report.scannedLayers} / {report.physicalGeometryLayers}</strong></div>
  </div>
  <details className="oaPhysicalSliceAdvanced" aria-label="Optional metal print-time scenario">
   <summary>Estimate total with confirmed machine overhead</summary>
   <p className="oaSubtle">The CSV may already include recoating, preparation or cooldown. Do not double-count. Select the checkbox only if you have verified the source CSV explicitly excludes these additional phases.</p>
   <label className="oaLpbfApproval"><input type="checkbox" aria-label="Confirm overhead absent from physical scan CSV"
    checked={overhead.outsideCsvConfirmed} onChange={e=>update("outsideCsvConfirmed",e.target.checked)}/>
    I confirm the entered recoat, preparation and cooldown durations are not included in the CSV timestamps.</label>
   <div className="oaPhysicalSliceParams">
    <label>Recoating overhead per physical layer (s)
     <input aria-label="Estimated recoating seconds per physical layer" type="number" min="0" max="600" step="any" value={overhead.recoatSecondsPerLayer}
      onChange={e=>update("recoatSecondsPerLayer",Number(e.target.value))}/></label>
    <label>Preparation (min)
     <input aria-label="Estimated preparation minutes" type="number" min="0" max="1440" step="any" value={overhead.preparationMinutes}
      onChange={e=>update("preparationMinutes",Number(e.target.value))}/></label>
    <label>Cooldown (min)
     <input aria-label="Estimated cooldown minutes" type="number" min="0" max="1440" step="any" value={overhead.cooldownMinutes}
      onChange={e=>update("cooldownMinutes",Number(e.target.value))}/></label>
   </div>
   <p className="oaScanEstimate"><strong>{report.illustrativeTotalSeconds!==null?"Illustrative planning total: "+duration(report.illustrativeTotalSeconds):"Total build time not estimated."}</strong> {report.illustrativeTotalSeconds===null?"First confirm that the added phases are absent from the supplied command timeline.":"Includes unverified CSV commanded time plus your assumed additional phases; not a production quote or verified printer time."}</p>
  </details>
  <details className="oaPhysicalSliceAdvanced"><summary>Metal process warnings and timing assumptions</summary>
   {report.warnings.map((warning,i)=><p key={i} className={i===0&&report.blocked?"oaStudyError":"oaSubtle"}>{warning}</p>)}
   {registration.blockers.map((warning,i)=><p key={i} className="oaStudyError">{warning}</p>)}
  </details>
  <button type="button" className="oaSecondaryRun" onClick={()=>{
   const record={schema:"orientai.scan-timing-research.v1",createdAt:new Date().toISOString(),
    partSha256:slices.partSha256,scanSha256:registration.scanSourceSha256,
    sourceName:scan.sourceName,report,assumptions:overhead,
    caution:"User-supplied unverified commanded chronology, not actual metal build time."};
   const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:"application/json"}));
   const link=document.createElement("a");link.href=url;link.download="orientai-supplied-scan-time-"+slices.partSha256.slice(0,12)+".json";
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }}>Export scan-time assumptions JSON</button>
 </section>;
}
