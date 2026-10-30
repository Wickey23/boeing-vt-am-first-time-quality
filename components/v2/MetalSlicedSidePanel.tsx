"use client";
import {useEffect,useMemo,useState} from "react";
import type {SlicePreview} from "./PhysicalSliceWorkspace";
import {calculatePhysicalScanTiming} from "@/lib/metal-scan-timing";
import {estimateLayerBuildTime,previewIllustrativeLayerHatches,type LayerPlanAssumptions} from "@/lib/metal-layer-planning";

type Mode="layers"|"paths"|"warnings";
const pretty=(n:number)=>Number.isFinite(n)?n.toFixed(n<10?3:1):"—";
export default function MetalSlicedSidePanel({preview}:{preview:SlicePreview}){
 const {slices,registration,scanPlan}=preview;
 const [mode,setMode]=useState<Mode>("layers");
 const [layerIndex,setLayerIndex]=useState(preview.selectedLayer);
 const [showTravel,setShowTravel]=useState(true);
 const [showConceptHatches,setShowConceptHatches]=useState(false);
 const [assumptions,setAssumptions]=useState<LayerPlanAssumptions>({
  hatchSpacingMm:.12,hatchSpeedMmS:800,contourSpeedMmS:450,
  secondsPerRecoat:8,setupSeconds:1200,cooldownSeconds:3600
 });
 const scenario=useMemo(()=>estimateLayerBuildTime(slices,assumptions),[slices,assumptions]);
 useEffect(()=>setLayerIndex(preview.selectedLayer),[preview.selectedLayer,preview.partHash]);
 const index=Math.min(layerIndex,slices.layers.length-1);
 const active=slices.layers[index];
 const cellLookup=useMemo(()=>new Set(active.cells.map(c=>c.y*slices.grid.columns+c.x)),[active,slices.grid.columns]);
 const outline=useMemo(()=>{
  if(active.cells.length>4500)return [];
  const path:{x1:number;y1:number;x2:number;y2:number}[]=[];
  const occupied=(x:number,y:number)=>cellLookup.has(y*slices.grid.columns+x);
  for(const cell of active.cells){
   const {x,y}=cell;
   const bottom=slices.grid.rows-1-y,top=bottom+1;
   if(!occupied(x-1,y))path.push({x1:x,y1:bottom,x2:x,y2:top});
   if(!occupied(x+1,y))path.push({x1:x+1,y1:bottom,x2:x+1,y2:top});
   if(!occupied(x,y-1))path.push({x1:x,y1:top,x2:x+1,y2:top});
   if(!occupied(x,y+1))path.push({x1:x,y1:bottom,x2:x+1,y2:bottom});
  }
  return path;
 },[active,cellLookup,slices.grid.columns,slices.grid.rows]);
 const commands=scanPlan?.commands.filter(c=>c.layer===index)??[];
 const conceptualHatches=useMemo(()=>showConceptHatches&&active.cells.length<=4500?
  previewIllustrativeLayerHatches(slices,index,assumptions.hatchSpacingMm):[],
  [showConceptHatches,slices,index,active.cells.length,assumptions.hatchSpacingMm]);
 const time=useMemo(()=>scanPlan&&registration?
   calculatePhysicalScanTiming(scanPlan,slices,registration,{
    outsideCsvConfirmed:false,recoatSecondsPerLayer:0,preparationMinutes:0,cooldownMinutes:0
   }):null,[scanPlan,slices,registration]);
 const x=(mm:number)=>(mm-slices.grid.originMm.x)/slices.grid.xyPitchMm;
 const y=(mm:number)=>slices.grid.rows-(mm-slices.grid.originMm.y)/slices.grid.xyPitchMm;
 const limited=commands.slice(0,350);
 const warningCount=(registration?.blockers.length??0)+slices.diagnostics.length;
 const formatTime=(seconds:number)=>seconds>=3600?(seconds/3600).toFixed(2)+" h":seconds>=60?(seconds/60).toFixed(2)+" min":seconds.toFixed(2)+" s";
 return <div className="oaSlicedSide" role="region" aria-label="Post-slice layer inspection">
  <div className="oaSlicedTabs" role="group" aria-label="Post-slice display mode">
   {(["layers","paths","warnings"] as const).map(name=><button key={name} type="button"
    aria-pressed={mode===name} className={mode===name?"oaSelected":""} onClick={()=>setMode(name)}>
    {name==="layers"?"Layer lines":name==="paths"?"Toolpath":"Warnings"}{name==="warnings"?" ("+warningCount+")":""}
   </button>)}
  </div>
  {mode!=="warnings"?<>
   <div className="oaSlicedSummary">
    <span><strong>{slices.grid.physicalLayers}</strong> physical layers</span>
    <span><strong>{pretty(slices.grid.layerThicknessMm)}</strong> mm layer height</span>
    <span><strong>{pretty(slices.grid.xyPitchMm)}</strong> mm sampled XY pitch</span>
   </div>
   <label className="oaSlicedLayerControl">Layer {index+1} of {slices.grid.physicalLayers} · sampled Z {pretty(active.sampleZMm)} mm
    <input type="range" aria-label="Side view physical layer lines" min={0} max={slices.grid.physicalLayers-1}
     value={index} onChange={e=>setLayerIndex(Number(e.target.value))}/>
   </label>
   <div className="oaSlicedLayerCanvas">
    {active.cells.length<=4500?<svg role="img" aria-label={mode==="layers"?
       "Approximate outline lines for STL physical layer "+(index+1):
       "User-supplied scan path over STL physical layer "+(index+1)}
      viewBox={`0 0 ${slices.grid.columns} ${slices.grid.rows}`} preserveAspectRatio="xMidYMid meet">
      {active.cells.map(c=><rect key={"cell-"+c.x+"-"+c.y} x={c.x} y={slices.grid.rows-1-c.y}
       width={1} height={1} fill={mode==="layers"?"#285771":"#204252"} opacity={Math.max(.2,c.coverage)}/>)}
      {outline.map((e,i)=><line key={"edge-"+i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
       stroke={mode==="layers"?"#9de5f9":"#729dae"} strokeWidth=".065"
       vectorEffect="non-scaling-stroke"/>)}
      {mode==="layers"&&conceptualHatches.map((line,i)=>
       <line key={"concept-"+i} x1={x(line.x0Mm)} y1={y(line.y0Mm)}
        x2={x(line.x1Mm)} y2={y(line.y1Mm)} stroke="#e4b65d" opacity=".7"
        strokeWidth=".09" vectorEffect="non-scaling-stroke" strokeDasharray=".2 .14"/>)}
      {mode==="paths"&&limited.filter(c=>c.powerW>0||showTravel).map((c,i)=>{
       const ax=x(c.x0Mm),ay=y(c.y0Mm),bx=x(c.x1Mm),by=y(c.y1Mm);
       const on=c.powerW>0;
       if(Math.abs(ax-bx)+Math.abs(ay-by)<1e-8)return <circle key={"point-"+i}
        cx={ax} cy={ay} r=".14" fill={on?"#ffad4f":"#aebfe9"}/>;
       return <line key={"path-"+i} x1={ax} y1={ay} x2={bx} y2={by}
        stroke={on?"#ffad4f":"#aebfe9"} strokeWidth=".12" vectorEffect="non-scaling-stroke"
        strokeDasharray={on?undefined:".15 .14"}/>;
      })}
     </svg>:<p>Too many occupied cells to display layer-line edges. Export the audited raster for inspection.</p>}
   </div>
   {mode==="layers"?<>
    <p className="oaSubtle"><strong>Sampled cross-section:</strong> {pretty(active.areaMm2)} mm² represented area; {active.partialCells} partial XY cells; {outline.length} displayed boundary segments.</p>
    <label className="oaSlicedTravel"><input type="checkbox" aria-label="Show conceptual hatch lines" checked={showConceptHatches}
      onChange={e=>setShowConceptHatches(e.target.checked)}/> Show conceptual hatches (not executable machine paths)</label>
    <p className="oaSubtle">These are <strong>raster-derived layer edges</strong>, not exact CAD contours or printable laser hatch paths. Dashed gold lines, when enabled, illustrate a coverage concept only. Thin features below sampling resolution may be lost.</p>
   </>:<>
    {scanPlan?<><p className="oaSubtle">{commands.length} supplied commands on this layer; {commands.filter(c=>c.powerW>0).length} powered. {commands.length>350?"Only the first 350 commands are shown.":""}</p>
     <label className="oaSlicedTravel"><input type="checkbox" checked={showTravel} onChange={e=>setShowTravel(e.target.checked)}/> Display laser-off travel (dashed)</label>
     <p className="oaSubtle"><strong>Orange:</strong> laser-on line. <strong>Blue:</strong> zero-power travel. These paths come from an uploaded CSV, not autogenerated machine instructions.</p>
    </>:<p className="oaSubtle">No verified or engineer-supplied physical scan path is attached. To see laser lines, upload an applicable physical scan CSV and rerun the local preflight.</p>}
   </>}
   <div className="oaSlicedSummary">
    <span><strong>{time?pretty(time.elapsedCommandSeconds)+" s":"Unavailable"}</strong> supplied scan duration</span>
    <span><strong>{time?pretty(time.laserOnSeconds)+" s":"Unavailable"}</strong> laser-on</span>
   </div>
   <details className="oaSlicedTimeScenario" aria-label="Geometry-only printing time scenario">
    <summary><strong>Illustrative LPBF build-time scenario: {formatTime(scenario.totalSeconds)}</strong></summary>
    <p className="oaSubtle">This is a <strong>planning scenario, not printer time</strong>. Uses sampled material area ÷ assumed hatch spacing ÷ assumed scan speed, estimated raster-edge contour length, recoating per layer, setup and cooldown. No real machine scan pattern has been generated.</p>
    <div className="oaSlicedScenarioInputs">
     {([
       ["hatchSpacingMm","Hatch spacing (mm)",.04,5],
       ["hatchSpeedMmS","Hatch speed (mm/s)",1,5000],
       ["contourSpeedMmS","Contour speed (mm/s)",1,5000],
       ["secondsPerRecoat","Recoating (s/layer)",0,600],
       ["setupSeconds","Setup (s)",0,86400],
       ["cooldownSeconds","Cooldown (s)",0,86400]
      ] as const).map(([key,label,min,max])=><label key={key}>{label}
       <input type="number" min={min} max={max} step="any" aria-label={label}
        value={assumptions[key]} onChange={e=>{
         const v=Number(e.target.value);if(Number.isFinite(v))setAssumptions(old=>({...old,[key]:Math.max(min,Math.min(max,v))}));
        }}/></label>)}
    </div>
    <p className="oaSubtle">Estimated exposure + grid-edge contour time: {formatTime(scenario.laserTravelProxySeconds)}. Recoating: {formatTime(scenario.recoatSeconds)}. Assumed setup and cooldown: {formatTime(scenario.overheadSeconds)}. This excludes actual scan jumps, machine acceleration, auxiliary motions and metal process qualifications.</p>
   </details>
   <p className="oaSubtle">If a CSV is supplied, its <strong>commanded time</strong> is shown separately above. Never treat the two estimates as equivalent or add them together.</p>
  </>:<>
   <div className="oaSlicedWarnings">
    <p><strong>Geometry-vs-volume difference:</strong> {(100*slices.geometry.relativeVolumeDifference).toFixed(2)}%</p>
    <p><strong>Fractional sampled boundary cells:</strong> {slices.grid.boundaryCells}</p>
    {registration?.status==="BLOCKED"&&<strong role="alert">Scan registration blocked; do not treat this as a valid metal build plan.</strong>}
    {registration?.blockers.map((w,i)=><p className="oaStudyError" key={"b"+i}>{w}</p>)}
    {slices.diagnostics.map((w,i)=><p className="oaSubtle" key={"d"+i}>{w}</p>)}
   </div>
  </>}
 </div>;
}
