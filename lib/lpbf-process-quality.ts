/**
 * Deterministic comparison with an engineer-entered LPBF process window.
 * No generic safe VED band, material preset, probability, or defect claim.
 * Each boundary remains unverified until reviewed against its cited source.
 */
export const PROCESS_QUALITY_VERSION="orientai-lpbf-process-window-v1" as const;
export const PROCESS_PARAMETERS=[
 {id:"powerW",label:"Laser power",unit:"W"},
 {id:"speedMmS",label:"Scan speed",unit:"mm/s"},
 {id:"hatchMm",label:"Hatch spacing",unit:"mm"},
 {id:"layerMm",label:"Layer thickness",unit:"mm"}
] as const;
export type ProcessParameter=typeof PROCESS_PARAMETERS[number]["id"];
export type QualityRange={min:number|null;max:number|null};
export type ProcessQualityInput={
 machine:string;material:string;parameterSet:string;reference:string;
 referenceReviewed:boolean;
 values:Record<ProcessParameter,number|null>;
 windows:Record<ProcessParameter,QualityRange>;
};
export type QualitySeverity="blocker"|"review"|"unassessed";
export type QualityFinding={
 code:string;severity:QualitySeverity;parameter?:ProcessParameter;
 title:string;observation:string;basis:string;action:string;
};
export type ProcessWindowAssessment={
 version:typeof PROCESS_QUALITY_VERSION;basis:"engineer-entered-unverified";
 decision:"outside-declared-range"|"invalid-configuration"|"inside-declared-ranges"|"insufficient-evidence";
 reviewedReference:boolean;checksCompleted:number;outsideCount:number;
 indicators:{lineEnergyJMm:number|null;areaEnergyJMm2:number|null;volumeEnergyJMm3:number|null};
 findings:QualityFinding[];
};
export function emptyProcessQualityInput():ProcessQualityInput{
 return {machine:"",material:"",parameterSet:"",reference:"",referenceReviewed:false,
  values:{powerW:null,speedMmS:null,hatchMm:null,layerMm:null},
  windows:{powerW:{min:null,max:null},speedMmS:{min:null,max:null},
   hatchMm:{min:null,max:null},layerMm:{min:null,max:null}}};
}
const positive=(n:number|null):n is number=>n!==null&&Number.isFinite(n)&&n>0;
const fmt=(n:number)=>Number(n.toPrecision(6)).toString();
export function assessLpbfProcessWindow(input:ProcessQualityInput):ProcessWindowAssessment{
 const findings:QualityFinding[]=[];
 const add=(code:string,severity:QualitySeverity,title:string,observation:string,basis:string,action:string,parameter?:ProcessParameter)=>{
  findings.push({code,severity,title,observation,basis,action,parameter});
 };
 const identified=Boolean(input.machine.trim()&&input.material.trim()&&input.parameterSet.trim());
 const sourced=Boolean(input.reference.trim());
 const reviewed=sourced&&identified&&input.referenceReviewed;
 if(!identified)add("SETUP_IDENTITY","unassessed","Machine, material or parameter-set identity missing",
  "The process setup cannot yet be associated with a particular machine, alloy condition and parameter set.",
  "Process windows cannot be transferred blindly across machines or alloys.",
  "Record the actual machine, material specification/condition, and parameter-set ID.");
 if(!sourced)add("WINDOW_PROVENANCE","unassessed","No documented process-window source",
  "The supplied limits have no reference ID or controlled revision.",
  "Numerical bounds are entered by an engineer, not verified by ORIENTAI.",
  "Provide the qualified parameter sheet, build-test report or controlled source revision.");
 else if(!reviewed)add("WINDOW_REVIEW","review","Process window applicability not reviewed",
  "The entered reference has not been approved as applicable to this machine/material/parameter set.",
  "A cited reference alone is not evidence of a qualified combination.",
  "Review the source, then explicitly confirm applicability.");
 let checksCompleted=0,outsideCount=0,invalid=false;
 for(const spec of PROCESS_PARAMETERS){
  const {id,label,unit}=spec;
  const value=input.values[id],r=input.windows[id];
  if(value!==null&&!positive(value)){
   invalid=true;
   add("INVALID_"+id,"blocker",label+" invalid",fmt(value)+" "+unit+" is not a positive finite value.",
    "Machine parameter must be positive and finite.","Correct the input.",id);
  }else if(value===null)add("MISSING_"+id,"unassessed",label+" not entered",
   "Planned "+label.toLowerCase()+" is missing.","No machine-parameter comparison is possible.","Enter the planned value.",id);
  if(r.min!==null&&!positive(r.min)||r.max!==null&&!positive(r.max)||r.min!==null&&r.max!==null&&r.min>r.max){
   invalid=true;
   add("INVALID_WINDOW_"+id,"blocker",label+" limits invalid",
    "The entered lower and/or upper bound is not a valid positive ordered interval.",
    "Invalid process limits cannot be used to screen a build.","Correct the source-derived range.",id);
   continue;
  }
  if(r.min===null&&r.max===null){
   add("NO_WINDOW_"+id,"unassessed",label+" process limits not supplied",
    "There is no declared approved range for "+label.toLowerCase()+".",
    "Without source-derived bounds the build cannot be assessed for this parameter.",
    "Enter at least one reference-supported boundary.",id);continue;
  }
  if(!positive(value))continue;
  checksCompleted++;
  const outside=(r.min!==null&&value<r.min)||(r.max!==null&&value>r.max);
  if(outside){
   outsideCount++;
   add("OUTSIDE_"+id,"blocker",label+" is outside the declared window",
    fmt(value)+" "+unit+" is outside "+(r.min===null?"unspecified":fmt(r.min))+"–"+
    (r.max===null?"unspecified":fmt(r.max))+" "+unit+".",
    "Direct numerical comparison to engineer-supplied parameter bounds, not a simulated defect.",
    "Stop process approval; verify the source and select a supported parameter set.",id);
  }
 }
 const p=input.values.powerW,v=input.values.speedMmS,h=input.values.hatchMm,t=input.values.layerMm;
 const line=positive(p)&&positive(v)?p/v:null;
 const area=line!==null&&positive(h)?line/h:null;
 const volume=area!==null&&positive(t)?area/t:null;
 if(volume!==null)add("ENERGY_DENSITY_INFO","review","Volumetric energy density is only a diagnostic",
  "P/(v × hatch × layer) = "+fmt(volume)+" J/mm³.",
  "This scalar cannot by itself establish lack-of-fusion, keyholing, porosity or acceptable quality; scan strategy and material physics matter.",
  "Compare actual combinations to qualified experiments and validated melt-pool evidence.");
 if(checksCompleted>0&&!reviewed)add("UNVERIFIED_BOUNDS","unassessed","Process comparison remains provisional",
  checksCompleted+" parameter(s) were checked against entered limits, but applicability was not reviewed.",
  "Input provenance is not sufficient for a qualified go/no-go determination.",
  "Review and approve the cited window before using its limits in a pre-build decision.");
 if(reviewed)add("COMBINATION_NOT_VALIDATED","unassessed","Joint process window still unverified by the application",
  "Individual parameter bounds do not demonstrate that the combined scan strategy achieves acceptable part quality.",
  "Correlated power/speed/hatch settings, scan scheduling, machine state and measured density require joint validation.",
  "Compare the actual planned parameter combination with approved build/inspection results.");
 add("PHYSICAL_DEFECTS_UNASSESSED","unassessed","Print defects and first-time quality not predicted",
  "No calibrated porosity, lack-of-fusion, keyhole, crack, distortion or recoater-collision model was run.",
  "Process-window checks and energy-density arithmetic are not experimental defect predictors.",
  "Collect validated process monitoring, material qualification and inspection outcomes.");
 const missing=PROCESS_PARAMETERS.some(p=>input.values[p.id]===null||
  input.windows[p.id].min===null&&input.windows[p.id].max===null);
 const decision=invalid?"invalid-configuration":outsideCount>0?"outside-declared-range":
  reviewed&&!missing&&checksCompleted===PROCESS_PARAMETERS.length?"inside-declared-ranges":"insufficient-evidence";
 return {version:PROCESS_QUALITY_VERSION,basis:"engineer-entered-unverified",decision,
  reviewedReference:reviewed,checksCompleted,outsideCount,
  indicators:{lineEnergyJMm:line,areaEnergyJMm2:area,volumeEnergyJMm3:volume},findings};
}
