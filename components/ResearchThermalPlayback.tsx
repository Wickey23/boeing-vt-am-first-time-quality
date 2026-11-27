"use client";
import {useEffect,useMemo,useState} from "react";
import {prepareLayerTemperatureView} from "@/lib/lpbf-layer-temperature-view";
import type {PartialLayerResult} from "@/lib/lpbf-partial-layer";
import type {PhysicalSliceResult} from "@/lib/lpbf-physical-slicer";
export default function ResearchThermalPlayback({thermal,geometry}:{thermal:PartialLayerResult;geometry:PhysicalSliceResult}){
 const view=useMemo(()=>prepareLayerTemperatureView(thermal,geometry),[thermal,geometry]);
 const [frame,setFrame]=useState(0),[layer,setLayer]=useState(0),[playing,setPlaying]=useState(false),[picked,setPicked]=useState<number|null>(null);
 const safeFrame=Math.min(frame,view.frameCount-1),safeLayer=Math.min(layer,view.layerCount-1);
 const data=view.layerFrame(safeFrame,safeLayer);
 useEffect(()=>{setFrame(0);setLayer(0);setPlaying(false);setPicked(null);},[view]);
 useEffect(()=>{
  if(!playing)return;
  if(safeFrame>=view.frameCount-1){setPlaying(false);return;}
  const id=window.setTimeout(()=>setFrame(safeFrame+1),650);
  return()=>window.clearTimeout(id);
 },[playing,safeFrame,view.frameCount]);
 const range=data.colorRangeC;
 const color=(v:number|null)=>v===null?"#e5e7eb":"hsl("+(240-240*(range.max===range.min?.5:Math.max(0,Math.min(1,(v-range.min)/(range.max-range.min)))))+" 80% 48%)";
 const value=picked===null?null:data.values[picked];
 const cellX=picked===null?null:picked%data.columns,cellY=picked===null?null:Math.floor(picked/data.columns);
 return <section aria-label="Research thermal playback" style={{display:"grid",gap:12}}>
  <h2>Physical-layer temperature playback</h2>
  <p>Unvalidated research calculations at scan-command boundaries. Playback is not real time; no interpolated temperatures or verified process predictions.</p>
  <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
   <button type="button" onClick={()=>{if(safeFrame===view.frameCount-1)setFrame(0);setPlaying(v=>!v);}} disabled={view.frameCount<2}>{playing?"Pause":"Play command frames"}</button>
   <label>Command frame <input type="range" aria-label="Command frame" min={0} max={view.frameCount-1} value={safeFrame} onChange={e=>{setPlaying(false);setFrame(Number(e.target.value));}}/></label>
   <label>Physical layer <select aria-label="Physical layer" value={safeLayer} onChange={e=>{setLayer(Number(e.target.value));setPicked(null);}}>{Array.from({length:view.layerCount},(_,i)=><option key={i} value={i}>Layer {i}</option>)}</select></label>
  </div>
  <p role="status">Command {data.commandIndex+1} of {view.frameCount} · t = {data.timeSeconds.toFixed(6)} s · Layer {safeLayer} · section Z = {data.sampleZMm.toFixed(4)} mm · {data.active?"Deposited":"Not yet deposited"}</p>
  <div style={{display:"grid",gridTemplateColumns:"minmax(0, 1fr)",gap:8,maxWidth:480}}>
   <svg role="img" aria-label="Calculated layer temperature map, Y increases upward" viewBox={`0 0 ${data.columns} ${data.rows}`} style={{width:"100%",maxHeight:380,background:"#e5e7eb",border:"1px solid #8795a1"}} preserveAspectRatio="xMidYMid meet">
    {data.values.map((v,i)=><rect key={i} x={i%data.columns} y={data.rows-1-Math.floor(i/data.columns)} width={1} height={1} fill={color(v)} stroke={picked===i?"#111827":"#ffffff"} strokeWidth={picked===i?.08:.025} onClick={()=>setPicked(i)}><title>{v===null?"No active material":v.toFixed(3)+" °C"}</title></rect>)}
   </svg>
   <div style={{height:12,background:"linear-gradient(to right,hsl(240 80% 48%),hsl(180 80% 48%),hsl(120 80% 48%),hsl(60 80% 48%),hsl(0 80% 48%))"}}/>
   <div style={{display:"flex",justifyContent:"space-between"}}><span>{range.min.toFixed(3)} °C</span><span>{range.max.toFixed(3)} °C</span></div>
   <small>Fixed range across captured frames. Gray = empty or not yet active; not a temperature reading.</small>
  </div>
  <label>Inspect cell <select aria-label="Inspect cell" value={picked??""} onChange={e=>setPicked(e.target.value===""?null:Number(e.target.value))}><option value="">Select cell</option>{data.values.map((v,i)=>v!==null?<option key={i} value={i}>X {i%data.columns}, Y {Math.floor(i/data.columns)}</option>:null)}</select></label>
  {picked!==null&&cellX!==null&&cellY!==null&&<output aria-label="Selected cell temperature">Cell center X {(data.originMm.x+(cellX+.5)*data.pitchMm).toFixed(4)} mm, Y {(data.originMm.y+(cellY+.5)*data.pitchMm).toFixed(4)} mm: {value==null?"No active material":value.toFixed(3)+" °C"}</output>}
  <details><summary>Text alternative: active cell temperatures</summary><table><thead><tr><th>Cell X</th><th>Cell Y</th><th>Temperature (°C)</th></tr></thead><tbody>{data.values.map((v,i)=>v===null?null:<tr key={i}><td>{i%data.columns}</td><td>{Math.floor(i/data.columns)}</td><td>{v.toFixed(3)}</td></tr>)}</tbody></table></details>
 </section>;
}
