"use client";
import {useMemo} from "react";
import {AlertTriangle,CheckCircle2,ChevronDown,SlidersHorizontal} from "lucide-react";
import {
 PROCESS_PARAMETERS,assessLpbfProcessWindow,
 type ProcessParameter,type ProcessQualityInput
} from "@/lib/lpbf-process-quality";

/** Controlled, part-specific LPBF process window input. Numeric entries are NEVER qualified presets. */
export default function ProfessionalProcessPanel({input,onChange,confirmed,disabled=false}:{
 input:ProcessQualityInput;onChange:(next:ProcessQualityInput)=>void;confirmed:boolean;disabled?:boolean;
}){
 const assessment=useMemo(()=>assessLpbfProcessWindow(input),[input]);
 const update=(field:"machine"|"material"|"parameterSet"|"reference",value:string)=>
  onChange({...input,[field]:value.slice(0,160),referenceReviewed:false});
 const numberOrNull=(raw:string)=>raw.trim()===""?null:Number(raw);
 const updateNumber=(name:ProcessParameter,slot:"value"|"min"|"max",value:string)=>{
  const n=numberOrNull(value);
  onChange({...input,referenceReviewed:false,
   values:slot==="value"?{...input.values,[name]:n}:input.values,
   windows:slot==="value"?input.windows:{
    ...input.windows,[name]:{...input.windows[name],[slot]:n}
   }});
 };
 const status=assessment.decision==="invalid-configuration"?"Invalid entered range or value":
  assessment.decision==="outside-declared-range"?"Outside supplied boundaries":
  assessment.decision==="inside-declared-ranges"?"Inside reviewed individual limits · not qualified":
  "Source-backed process setup incomplete";
 const reviewed=!!input.referenceReviewed;
 const title="LPBF machine and process-window review";
 return <article className="psPanel psProcessContext" aria-label="LPBF process-window review">
  <details>
   <summary className="psPanelHeading">
    <strong><SlidersHorizontal size={17}/>{title}</strong>
    <span>{assessment.outsideCount>0?<AlertTriangle size={14}/>:reviewed?<CheckCircle2 size={14}/>:null}{status}<ChevronDown size={14}/></span>
   </summary>
   <p className="psCaveat">Compare planned settings against the actual machine/alloy-specific source. No generic laser power, scan-speed, porosity or fatigue prediction is implied.</p>
   <div className="psProcessIdentity">
    {([
     ["machine","Machine / build system","Actual machine or configuration ID"],
     ["material","Alloy and condition","Material specification and condition"],
     ["parameterSet","Parameter set ID","Controlled build parameter revision"],
     ["reference","Source and revision","Qualified source document identifier"]
    ] as const).map(([key,label,placeholder])=><label key={key}>{label}
     <input value={input[key]} onChange={e=>update(key,e.target.value)} placeholder={placeholder} disabled={disabled}/>
    </label>)}
   </div>
   <div className="psProcessTableWrap">
    <table><thead><tr><th>Parameter</th><th>Planned</th><th>Min</th><th>Max</th></tr></thead>
     <tbody>{PROCESS_PARAMETERS.map(spec=><tr key={spec.id}>
      <th>{spec.label}<small>{spec.unit}</small></th>
      <td><input type="number" step="any" min="0" disabled={disabled} aria-label={"Planned "+spec.label}
       value={input.values[spec.id]??""} onChange={e=>updateNumber(spec.id,"value",e.target.value)}/></td>
      <td><input type="number" step="any" min="0" disabled={disabled} aria-label={spec.label+" minimum"}
       value={input.windows[spec.id].min??""} onChange={e=>updateNumber(spec.id,"min",e.target.value)}/></td>
      <td><input type="number" step="any" min="0" disabled={disabled} aria-label={spec.label+" maximum"}
       value={input.windows[spec.id].max??""} onChange={e=>updateNumber(spec.id,"max",e.target.value)}/></td>
     </tr>)}</tbody></table>
   </div>
   <label className="psProcessApproval">
    <input type="checkbox" checked={reviewed} disabled={disabled||!confirmed||
     !input.machine.trim()||!input.material.trim()||!input.parameterSet.trim()||!input.reference.trim()}
     onChange={e=>onChange({...input,referenceReviewed:e.target.checked})}/>
    I reviewed this machine/material/source combination for applicability. This does not constitute process qualification.
   </label>
   <div className="psProcessOutcome">
    <span>{assessment.checksCompleted}/4 values compared</span>
    <span>{assessment.outsideCount} outside entered boundaries</span>
    <span>VED: {assessment.indicators.volumeEnergyJMm3?.toFixed(2)??"unknown"} J/mm³ (diagnostic only)</span>
   </div>
   {assessment.findings.filter(x=>x.severity==="blocker").map(x=>
    <p className="psProcessFlag" key={x.code} role="status">{x.title}: {x.observation} {x.action}</p>)}
  </details>
 </article>;
}
