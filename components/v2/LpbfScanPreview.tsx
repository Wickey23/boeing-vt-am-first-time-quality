"use client";
import {useEffect,useMemo,useState} from "react";
import type {ScanPlan} from "@/lib/lpbf-scan-plan";

/** Source-coordinate audit view, not a calibrated part/laser simulation. */
export default function LpbfScanPreview({plan}:{plan:ScanPlan}){
 const slabs=useMemo(()=>[...new Set(plan.segments.map(s=>s.slab))].sort((a,b)=>a-b),[plan]);
 const [slab,setSlab]=useState(slabs[0]??0);
 useEffect(()=>{setSlab(slabs[0]??0)},[plan.sha256,slabs]);
 const tracks=plan.segments.filter(s=>s.slab===slab);
 const visible=tracks.slice(0,250);
 const xs=tracks.flatMap(s=>[s.x0Mm,s.x1Mm]),ys=tracks.flatMap(s=>[s.y0Mm,s.y1Mm]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const spreadX=Math.max(.01,maxX-minX),spreadY=Math.max(.01,maxY-minY);
 const x=(v:number)=>20+(v-minX)/spreadX*300;
 const y=(v:number)=>200-(v-minY)/spreadY*180;
 const on=tracks.filter(s=>s.powerW>0).length,off=tracks.length-on;
 const duration=tracks.reduce((t,s)=>t+Math.hypot(s.x1Mm-s.x0Mm,s.y1Mm-s.y0Mm)/s.speedMmS,0);
 return <div className="oaScanPreview" aria-label="Imported scan path preview">
  <div className="oaBuildTitle"><strong>Laser path review</strong>
   <label>Virtual slab <select aria-label="Preview scan slab" value={slab} onChange={e=>setSlab(Number(e.target.value))}>
    {slabs.map(n=><option key={n} value={n}>{n}</option>)}
   </select></label></div>
  <svg viewBox="0 0 340 220" role="img" aria-label={"2D laser scan segment paths for virtual slab "+slab}>
   <rect x="0" y="0" width="340" height="220" rx="8" fill="#091827"/>
   {visible.map((s,i)=><line key={i}
    x1={x(s.x0Mm)} y1={y(s.y0Mm)} x2={x(s.x1Mm)} y2={y(s.y1Mm)}
    stroke={s.powerW>0?"#ffb454":"#8cabb9"} strokeWidth={s.powerW>0?2.8:1.7}
    strokeDasharray={s.powerW>0?undefined:"5 5"} opacity={.9}/>)}
   {visible.map((s,i)=><circle key={"point-"+i} cx={x(s.x1Mm)} cy={y(s.y1Mm)} r="2.5" fill={s.powerW>0?"#ffd39a":"#8cabb9"}/>)}
   <text x="14" y="214" fill="#bdd0db" fontSize="10">X: {minX.toFixed(2)} to {maxX.toFixed(2)} mm</text>
  </svg>
  <div className="oaScanLegend"><span><b className="oaOnMark"/>Laser on: {on}</span><span><b className="oaOffMark"/>Laser off: {off}</span><span>{duration.toFixed(3)} s commanded travel</span></div>
  <p className="oaSubtle">Shows segment order in the supplied X/Y coordinates, rescaled to fit the diagram. It is not overlaid on the STL or proof that the machine executed these tracks. {tracks.length>visible.length?"Only the first 250 of "+tracks.length+" tracks are drawn.":""}</p>
 </div>;
}
