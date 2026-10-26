"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import AppShell from "@/components/v2/AppShell";
import {useAnalysis} from "@/components/AnalysisProvider";
import PartInspection,{usePartInspection} from "@/components/PartInspection";
import ViewerErrorBoundary from "@/components/ViewerErrorBoundary";
import {END_FACES,type EndFace} from "@/lib/service-load";
import {activeServiceCase,serviceCaseSummary} from "@/lib/service-plan";
import {allowsGeometryRanking,completedPart,dedExample,STEPS,STEP_LABELS,type JourneyStep,type ProcessKind} from "@/lib/engineering-journey";
import {screenCandidate} from "@/lib/part-screening";
import {planDedWall,simulateReferenceFlow,createSimioExchange,type DedWallInput} from "@/lib/ded-planning";
import {zipTextFiles} from "@/lib/zip-store";
import {exportPortableProject,importPortableProject} from "@/lib/project-transfer";
import "./guided.css";

const ModelViewer=dynamic(()=>import("@/components/ModelViewer"),{ssr:false});
const DedWallViewer=dynamic(()=>import("@/components/DedWallViewer"),{ssr:false});
const Structural=dynamic(()=>import("@/components/PartStructuralPanel"),{ssr:false});
const Thermal=dynamic(()=>import("@/components/PartThermalPanel"),{ssr:false});

const samples=[["aerospace-mounting-lug","Mounting lug"],["aerospace-overhang-bracket","Overhang bracket"],["aerospace-thin-wall-channel","Thin-wall channel"],["aerospace-nozzle-sleeve","Nozzle sleeve"],["cube-10mm","Verification cube"]] as const;
const num=(n:number)=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:3}):"—";
function download(name:string,content:string|Uint8Array,type:string){
 const binary=typeof content==="string"?new TextEncoder().encode(content):content;
 const buffer=new ArrayBuffer(binary.byteLength);new Uint8Array(buffer).set(binary);
 const u=URL.createObjectURL(new Blob([buffer],{type}));
 const a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(u),2000);
}
function Status({kind,children}:{kind:"ok"|"missing"|"info";children:React.ReactNode}){return <span className={"journeyStatus "+kind}>{children}</span>;}
export default function UnifiedOrientationPage(){
 const a=useAnalysis(), j=a.journey;
 const initialized=useRef(false);
 const [viewerUrl,setViewerUrl]=useState<string>();
 const [message,setMessage]=useState("");
 const [exportBusy,setExportBusy]=useState(false);
 const [sampleBusy,setSampleBusy]=useState(false);
 const [showFields,setShowFields]=useState<"geometry"|"stress"|"displacement"|"thermal">("geometry");
 const inspection=usePartInspection(a.file,a.settings.unitScale);
 useEffect(()=>{
  if(!a.file){setViewerUrl(undefined);return;}
  const u=URL.createObjectURL(a.file);setViewerUrl(u);return()=>URL.revokeObjectURL(u);
 },[a.file]);
 // Links from home are explicit user actions. A query only initializes an example when asked.
 useEffect(()=>{
  if(!a.ready||initialized.current)return;
  initialized.current=true;
  const query=new URLSearchParams(window.location.search);
  if(query.get("example")==="ded"&&j.mode!=="ded-example")a.startDedExample();
  else if(query.get("step")&&STEPS.includes(query.get("step") as JourneyStep)&&completedPart(j,a.file,a.settings.unitScale))a.setJourneyStep(query.get("step") as JourneyStep);
 },[a.ready]);
 const isDed=dedExample(j);
 const isLPBF=allowsGeometryRanking(j);
 const verified=completedPart(j,a.file,a.settings.unitScale);
 const candidate=a.result?.candidates.find(x=>x.id===a.selected);
 const proposals=a.result?.candidates.filter(x=>x.feasible)??[];
 const ded=useMemo(()=>{
  if(!isDed)return {plan:null,flow:null,error:""};
  try{const plan=planDedWall(j.dedInput);return {plan,flow:simulateReferenceFlow(plan),error:""};}
  catch(e){return {plan:null,flow:null,error:e instanceof Error?e.message:"Invalid DED inputs"};}
 },[isDed,j.dedInput]);
 const setStage=(stage:JourneyStep)=>{
  if(stage!=="part"&&!verified){setMessage("Confirm your part before proceeding.");a.setJourneyStep("part");return;}
  setMessage("");a.setJourneyStep(stage);
 };
 const upload=(f:File|null)=>{if(!f)return;setMessage("");a.upload(f);a.setProjectName(f.name.replace(/\.stl$/i,""));};
 const loadSample=async(id:string)=>{setSampleBusy(true);setMessage("");try{
   const r=await fetch("/verification/"+id+".stl");
   if(!r.ok)throw Error("Example unavailable.");
   upload(new File([await r.arrayBuffer()],id+".stl",{type:"model/stl"}));
 }catch(e){setMessage(e instanceof Error?e.message:"Could not load example");}finally{setSampleBusy(false);}};
 const dedSet=(key:keyof DedWallInput,value:unknown)=>a.setDedInput({...j.dedInput,[key]:value});
 const dedNumber=(key:keyof DedWallInput,label:string)=> <label key={key}>{label}<input type="number" step={key==="batchSize"?1:"any"} value={Number.isFinite(j.dedInput[key] as number)?j.dedInput[key] as number:""} onChange={e=>dedSet(key,Number(e.target.value))}/></label>;
 const exportSimio=()=>{if(!ded.plan||!ded.flow)return;try{
  const files={...createSimioExchange(ded.plan,ded.flow),"README.txt":"ORIENTAI example DED wall. CSV scenario data for a separately authored Simio model; NOT a Simio execution. No machine feasibility, thermal distortion or physical qualification is established.\n"};
  download(ded.plan.scenarioId+"-simio-data.zip",zipTextFiles(files),"application/zip");setMessage("Simio data tables exported. A separately configured Simio model is required.");
 }catch(e){setMessage(e instanceof Error?e.message:"Export failed");}};
 const exportProject=async()=>{if(!a.file)return;setExportBusy(true);setMessage("");try{
   download((a.projectName||"orientai")+"-project.orientai.json",await exportPortableProject(a.projectName,a.file,a.settings,a.result,a.selected,a.servicePlan,j),"application/json");
 }catch(e){setMessage(e instanceof Error?e.message:"Export failed");}finally{setExportBusy(false);}};
 const importProject=async(f:File|null)=>{if(!f)return;setExportBusy(true);try{
  const p=await importPortableProject(await f.text());
  a.restoreProject({servicePlan:p.servicePlan,projectName:p.name,file:p.file,settings:p.settings,result:p.result,selected:p.selected,journey:p.journey});
  setMessage("Imported project. Check the original part units and confirmation.");
 }catch(e){setMessage(e instanceof Error?e.message:"Import failed");}finally{setExportBusy(false);}};
 const next=()=>{
  if(j.step==="part"&&!verified){setMessage("Confirm dimensions and units first.");return;}
  const index=STEPS.indexOf(j.step);if(index<STEPS.length-1)setStage(STEPS[index+1]);
 };
 const needsStructural=a.servicePlan.cases.some(c=>c.input.forceXN!==0||(c.input.forceYN??0)!==0||c.input.forceZN!==0);
 if(!a.ready)return <AppShell title="Engineering Workspace" focused><p role="status">Restoring your saved project…</p></AppShell>;
 const summaryName=isDed?"Synthetic DED teaching wall":a.file?.name??"No part selected";
 const preview=<div className="journeyPartPreview">
   <div className="journeyViewerHeader"><strong>{summaryName}</strong><Status kind={isDed?"info":a.file?"ok":"missing"}>{isDed?"Example geometry":a.file?"Your STL":"No part"}</Status></div>
   {isDed&&ded.plan?<DedWallViewer plan={ded.plan}/>:a.file&&viewerUrl?<div className="journeyViewerFrame"><ViewerErrorBoundary><ModelViewer url={viewerUrl} rotation={j.step==="options"||j.step==="studies"||j.step==="decision"?candidate?.rotation:undefined} unitScale={a.settings.unitScale} overhangDeg={a.settings.overhangDeg} showOverhangs={j.step==="options"||j.step==="decision"} field={isLPBF?(
      showFields==="stress"?a.result?.structural?.field.stress:
      showFields==="displacement"?a.result?.structural?.field.displacement:
      showFields==="thermal"&&a.result?.thermal?.candidateId===a.selected?a.result.thermal.field:undefined):undefined
     } fieldLabel={showFields==="stress"?"Service stress":showFields==="displacement"?"Service displacement":showFields==="thermal"?"Steady conduction temperature":undefined}/></ViewerErrorBoundary></div>:
     <div className="journeyEmptyViewer"><span aria-hidden="true">⬡</span><p>{isDed?ded.error:"Upload an STL or open a teaching example to see the part here."}</p></div>}
   <div className="journeyViewerNote">{isDed?"Synthetic wall with assumed bead dimensions — not your uploaded geometry":a.file?"Actual uploaded STL · model orientation and research contours only":"No geometry is being analyzed"}</div>
   {(j.step==="studies"||j.step==="decision")&&a.result&&isLPBF&&<label>Viewer result<select aria-label="Viewer result" value={showFields} onChange={e=>setShowFields(e.target.value as typeof showFields)}><option value="geometry">Geometry</option><option value="stress" disabled={!a.result.structural}>Service stress</option><option value="displacement" disabled={!a.result.structural}>Service displacement</option><option value="thermal" disabled={!a.result.thermal||a.result.thermal.candidateId!==a.selected}>Steady temperature</option></select></label>}
 </div>;
 const activeCase=activeServiceCase(a.servicePlan),load=activeCase.input;
 return <AppShell title="Engineering Workspace" focused>
  <div className="journeyWrap">
   <header className="journeyHead">
     <div><p className="guidedEyebrow">ORIENTAI · SINGLE PROJECT WORKFLOW</p><h1>{j.mode==="ded-example"?"DED research example":a.projectName==="Untitled part"?"New part analysis":a.projectName}</h1><p>From engineering requirements to a traceable manufacturing comparison.</p></div>
     <span className="journeySaved">{a.storageError?a.storageError:a.saving?"Saving locally…":"Locally saved"}</span>
   </header>
   <nav className="journeyStepper" aria-label="Project stages">{STEPS.map((s,index)=><button key={s} type="button" aria-current={j.step===s?"step":undefined} aria-label={"Step "+(index+1)+": "+STEP_LABELS[s]} disabled={s!=="part"&&!verified} className={j.step===s?"selected":""} onClick={()=>setStage(s)}><span>{index+1}</span>{STEP_LABELS[s]}</button>)}</nav>
   {(message||a.error)&&<div className="journeyNotice" role="status">{message||a.error}</div>}
   <div className="journeyBody">
    {preview}
    <section className="journeyStage" aria-label={STEP_LABELS[j.step]+" stage"}>
     {j.step==="part"&&<>
      <p className="guidedEyebrow">STEP 1 / PART INTAKE</p><h2>What component are we analyzing?</h2><p>Start with the real part when possible. Teaching examples are separate projects.</p>
      <label>Project name<input aria-label="Project name" value={a.projectName} maxLength={120} onChange={e=>a.setProjectName(e.target.value)}/></label>
      {isDed?<><div className="journeyNotice"><strong>DED teaching example</strong><p>A single-bead wall on a substrate. Calculations on this page belong only to this example, not an uploaded STL or qualified machine.</p></div><button onClick={a.startUploadedProject} className="studioAction secondary">Start with my own STL</button></>:
       <><label className="journeyUpload">Upload STL (up to 20 MB)<input aria-label="Upload STL" type="file" accept=".stl" onChange={e=>upload(e.target.files?.[0]??null)}/></label>
       <details><summary>Or select a teaching part</summary><div className="journeySampleGrid">{samples.map(([id,title])=><button key={id} disabled={sampleBusy} onClick={()=>void loadSample(id)}><img src={"/verification/previews/"+id+".svg"} alt="" width={124} height={78}/><span>{title}</span></button>)}</div></details>
       <div className="journeyDivider">DED RESEARCH EXAMPLE</div><button className="studioAction secondary" onClick={a.startDedExample}>Open DED teaching wall</button>
       {a.file&&<><label>STL units<select aria-label="STL units" value={a.settings.unitScale} onChange={e=>a.update("unitScale",Number(e.target.value))}><option value={1}>Millimeters</option><option value={25.4}>Inches</option><option value={1000}>Meters</option></select></label>
       {inspection.data?<PartInspection data={inspection.data}/>:<p role="status">{inspection.error||"Inspecting geometry…"}</p>}
       <button className="studioAction primary" disabled={!inspection.data||inspection.data.audit.findings.some(f=>f.level==="blocker")} onClick={()=>{a.confirmPart();a.setJourneyStep("requirements");}}>Confirm units and continue</button>
       {verified&&<Status kind="ok">Part units confirmed</Status>}</>}
       </>}
       <details><summary>Import saved project</summary><label>ORIENTAI JSON backup<input aria-label="Import ORIENTAI project" type="file" accept=".json" disabled={exportBusy} onChange={e=>void importProject(e.target.files?.[0]??null)}/></label></details>
     </>}
     {j.step==="requirements"&&<>
      <p className="guidedEyebrow">STEP 2 / ENGINEERING REQUIREMENTS</p><h2>What does this part need to withstand?</h2>
      {isDed?<><p>This wall is a manufacturing demonstration, not a flight-design mechanical component. No structural strength or service compliance claim is associated with it.</p><div className="journeyNotice">Mechanical properties, dimensional tolerances, fixture loads and acceptance criteria have not been established for this example.</div></>:<>
       <p>Define named service cases in the part's original axes. The current solver only supports a fully fixed extreme end face and total force on the opposite end; bores, bolts, pressures and realistic mounting surfaces are not yet modeled.</p>
       <div className="journeyFields"><label>Load case<select aria-label="Load case" value={activeCase.id} onChange={e=>a.selectServiceCase(e.target.value)}>{a.servicePlan.cases.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Case name<input aria-label="Case name" value={activeCase.name} onChange={e=>a.renameServiceCase(e.target.value)}/></label></div>
       <div className="journeyActions"><button onClick={a.addServiceCase} disabled={a.servicePlan.cases.length>=8}>Add load case</button><button onClick={a.removeServiceCase} disabled={a.servicePlan.cases.length===1}>Remove case</button></div>
       <label>Clamped original-part face<select aria-label="Clamped original-part face" value={load.fixedFace??"z-min"} onChange={e=>a.setServiceSetup({...load,fixedFace:e.target.value as EndFace})}>{END_FACES.map(f=><option key={f} value={f}>{f}</option>)}</select></label>
       <div className="journeyFields">{([["forceXN","Force X (N)"],["forceYN","Force Y (N)"],["forceZN","Force Z (N)"]] as const).map(([key,label])=><label key={key}>{label}<input type="number" aria-label={label} value={load[key]??0} onChange={e=>a.setServiceSetup({...load,[key]:Number(e.target.value)})}/></label>)}</div>
       <label>Maximum displacement requirement (mm; optional)<input type="number" aria-label="Maximum displacement requirement" min={0} step="any" value={load.displacementLimitMm??""} onChange={e=>a.setServiceSetup({...load,displacementLimitMm:e.target.value===""?undefined:Number(e.target.value)})}/></label>
       <details><summary>Numerical model assumptions</summary><div className="journeyFields">{([["youngModulusMPa","Young's modulus (MPa)"],["poissonRatio","Poisson ratio"],["resolution","Voxel resolution (6–12)"]] as const).map(([key,label])=><label key={key}>{label}<input type="number" aria-label={label} step="any" value={load[key]} onChange={e=>a.setServiceSetup({...load,[key]:Number(e.target.value)})}/></label>)}</div><p>These illustrative properties and end-face fixtures require engineering review; no yield or fatigue allowables are inferred.</p></details>
       <div className="journeyNotice">Unknown fatigue, yield and qualification criteria are not considered satisfied. Structural runs require a separate boundary-condition review in the Simulations step.</div>
      </>}
     </>}
     {j.step==="process"&&<>
      <p className="guidedEyebrow">STEP 3 / PRINT PROCESS</p><h2>How will this component be manufactured?</h2>
      <p>Process choice determines which analyses are applicable. We do not reuse powder-bed support estimates as DED feasibility results.</p>
      {isDed?<><label>DED variant<select aria-label="DED variant" value={j.process} onChange={e=>a.setJourneyProcess(e.target.value as ProcessKind)}><option value="DED_LB_WIRE">Laser wire-fed DED</option><option value="DED_LB_POWDER">Laser powder-fed DED</option></select></label>
       <label>Material identification<input aria-label="DED material" value={j.dedInput.materialLabel} onChange={e=>dedSet("materialLabel",e.target.value)}/></label>
       <Status kind="missing">Machine model / head kinematics not provided</Status>
       <p>Arc-wire and electron-beam variants remain unsupported. No qualified parameter window, wire angle, powder capture efficiency, shielding or motion reach is inferred.</p></>:
      <><label>Manufacturing process<select aria-label="Manufacturing process" value={j.process} onChange={e=>a.setJourneyProcess(e.target.value as ProcessKind)}><option value="PBF_LB_METAL">Laser powder-bed fusion (LPBF) · geometric screening</option><option value="DED_LB_WIRE">Laser wire DED · not available for arbitrary STL</option><option value="DED_LB_POWDER">Laser powder DED · not available for arbitrary STL</option></select></label>
      {isLPBF?<><label>Material name<input aria-label="Material name" value={a.settings.material} onChange={e=>a.update("material",e.target.value)}/></label>
       <h3>Usable build envelope (mm)</h3><div className="journeyFields">{(["x","y","z"] as const).map(k=><label key={k}>{k.toUpperCase()} (mm)<input type="number" aria-label={"Envelope "+k} value={a.settings[k]} onChange={e=>a.update(k,Number(e.target.value))}/></label>)}</div>
       <div className="journeyFields"><label>Layer thickness (mm)<input type="number" step="any" aria-label="Layer thickness" value={a.settings.layerHeightMm} onChange={e=>a.update("layerHeightMm",Number(e.target.value))}/></label><label>Overhang threshold (°)<input type="number" aria-label="Overhang threshold" value={a.settings.overhangDeg} onChange={e=>a.update("overhangDeg",Number(e.target.value))}/></label></div>
       <details><summary>Advanced screening assumptions</summary><div className="journeyFields">{([["support","Support preference"],["height","Lower height preference"],["contact","Contact preference"],["searchSamples","Additional orientation samples"],["recoatSeconds","Assumed recoating seconds/layer"],["scanSecondsPerLayer","Assumed scan seconds/layer"],["machineHourlyRate","Machine cost per hour"]] as const).map(([k,label])=><label key={k}>{label}<input type="number" aria-label={label} value={a.settings[k]} onChange={e=>a.update(k,Number(e.target.value))}/></label>)}</div></details>
       <div className="journeyNotice">Support and time are geometric/assumed estimates only. Material name does not assign approved mechanical properties.</div></>:
       <div className="journeyNotice"><strong>DED path generation is not supported for arbitrary STL files yet.</strong><p>Your STL remains attached to this project. To explore deposition paths and factory-flow simulation now, open the separate labeled DED teaching-wall project.</p><button onClick={a.startDedExample}>Switch to DED teaching example (replaces current active project)</button></div>}
      </>}
     </>}
     {j.step==="options"&&<>
       <p className="guidedEyebrow">STEP 4 / MANUFACTURING OPTIONS</p><h2>Which build strategies should we compare?</h2>
       {isLPBF?<><p>Compare sampled part orientations by height, down-facing surface and conceptual support burden. All inputs are visible in the Print process step.</p>
         {!a.result?<><button className="studioAction primary" onClick={a.retry} disabled={a.busy}>{a.busy?"Evaluating orientations…":"Generate orientation candidates"}</button>{a.busy&&<><progress value={a.progress} max={1} aria-label="Orientation progress"/><button onClick={a.cancel}>Cancel</button></>}</>:<>
          <Status kind="ok">{a.result.candidates.length} sampled orientations</Status>
          <div className="journeyChoiceGrid">{proposals.slice(0,5).map(c=><button key={c.id} className={a.selected===c.id?"selected":""} onClick={()=>a.select(c.id)}><strong>{c.id} · {c.buildHeightMm.toFixed(1)} mm tall</strong><span>{c.supportProxyMm3.toFixed(1)} mm³ geometric support proxy</span><small>{c.pareto?"Pareto candidate":"Geometrically eligible"}</small></button>)}</div>
          {!proposals.length&&<p role="alert">No candidate satisfies the entered geometric envelope. Review your machine configuration.</p>}
          <details><summary>All orientations and tradeoffs</summary><div className="journeyScroll"><table><thead><tr><th>Option</th><th>Height</th><th>Support proxy</th><th>Envelope</th></tr></thead><tbody>{a.result.candidates.map(c=><tr key={c.id}><td><button onClick={()=>a.select(c.id)}>{c.id}</button></td><td>{num(c.buildHeightMm)} mm</td><td>{num(c.supportProxyMm3)} mm³</td><td>{c.fitsEnvelope?"fits":"exceeds"}</td></tr>)}</tbody></table></div></details>
          <button className="studioAction secondary" onClick={a.retry}>Re-run geometry screening</button>
         </>}
       </>:isDed?<><p>Define a nominal single-bead wall and compare deposition strategies. This is example geometry; not slicing of a real uploaded STL.</p>
          <div className="journeyFields">{dedNumber("wallLengthMm","Wall length (mm)")}{dedNumber("wallHeightMm","Wall height (mm)")}{dedNumber("beadWidthMm","Assumed bead width (mm)")}{dedNumber("beadHeightMm","Assumed bead height (mm)")}{dedNumber("substrateLengthMm","Substrate length (mm)")}{dedNumber("substrateWidthMm","Substrate width (mm)")}{dedNumber("substrateThicknessMm","Substrate thickness (mm)")}</div>
          <label>Deposition strategy<select aria-label="Deposition strategy" value={j.dedInput.strategy} onChange={e=>dedSet("strategy",e.target.value)}><option value="alternating">Alternate direction each layer</option><option value="one-way">Deposit one direction; reposition each layer</option></select></label>
          <div className="journeyFields">{dedNumber("depositionSpeedMmS","Commanded deposition speed (mm/s)")}{dedNumber("traverseSpeedMmS","Commanded reposition speed (mm/s)")}{dedNumber("interpassDwellS","Interpass dwell (s)")}</div>
          {ded.plan?<><Status kind="info">Idealized motion estimate</Status><div className="journeyMetrics"><article><small>Tracks</small><b>{ded.plan.layers}</b></article><article><small>Deposited distance</small><b>{num(ded.plan.depositionLengthMm)} mm</b></article><article><small>Commanded time</small><b>{num(ded.plan.commandedSubtotalSeconds/60)} min</b></article></div><p>Machine reach and nozzle collision are unverified. No deposition thermal, dimensional distortion or first-pass quality calculation was performed.</p></>:<p role="alert">{ded.error}</p>}
         </>:<div className="journeyNotice">No validated toolpath engine for your uploaded STL and selected DED process. The system will not reuse LPBF orientation estimates as DED results.</div>}
     </>}
     {j.step==="studies"&&<>
      <p className="guidedEyebrow">STEP 5 / SIMULATION</p><h2>What have we actually calculated?</h2>
      {isLPBF?<>{a.result?<><div className="journeyStudy"><h3>Service-load response</h3><p>Idealized original-part fixture and force; run only after reviewing properties and constraints.</p><details><summary>Configure and run structural calculation</summary><Structural/></details></div>
       <div className="journeyStudy"><h3>Steady conduction</h3><p>Heat transfer through a solid under assumed boundary conditions, not laser or LPBF thermal history.</p><details><summary>Configure and run thermal calculation</summary><Thermal/></details></div>
       <div className="journeyStudy"><h3>Manufacturing distortion</h3><Status kind="missing">Not supported</Status><p>No validated residual-strain/thermal distortion estimate for this part.</p></div>
       <div className="journeyStudy"><h3>Factory-flow simulation</h3><Status kind="missing">Not configured</Status><p>Machine and shop-floor operation/resource data are not available for this LPBF project.</p></div>
      </>:<div className="journeyNotice">First generate orientations in the previous stage. Structural and steady thermal studies require an active analysis run.</div>}</>:
      isDed?<><div className="journeyStudy"><h3>Manufacturing-flow research scenario</h3><p>Assume one resource per operation, FIFO processing, no machine failures or scrap. These are user-entered teaching assumptions, not measured factory data.</p>
       <div className="journeyFields">{dedNumber("setupMin","Setup (min)")}{dedNumber("cooldownMin","Cooling (min)")}{dedNumber("machiningMin","Machining (min)")}{dedNumber("inspectionMin","Inspection (min)")}{dedNumber("batchSize","Number of jobs")}{dedNumber("releaseIntervalMin","Release interval (min)")}</div>
       {ded.flow?<><div className="journeyMetrics"><article><small>Jobs completed</small><b>{ded.flow.completed}</b></article><article><small>Mean lead time</small><b>{num(ded.flow.meanLeadTimeMin)} min</b></article><article><small>Mean queue time</small><b>{num(ded.flow.meanQueueTimeMin)} min</b></article></div><button className="studioAction secondary" onClick={exportSimio}>Export Simio CSV tables (ZIP)</button></>:<p role="alert">{ded.error}</p>}</div>
       <div className="journeyStudy"><h3>Structural, thermal and distortion studies</h3><Status kind="missing">Not evaluated</Status><p>No DED part-specific FEM, transient thermal, residual stress or manufacturing quality prediction is generated from this teaching geometry.</p></div>
      </>:<div className="journeyNotice">No DED simulation is available for this arbitrary uploaded STL. Please select an explicit teaching example or return to process setup.</div>}
     </>}
     {j.step==="decision"&&<>
      <p className="guidedEyebrow">STEP 6 / ENGINEERING DECISION</p><h2>What can we conclude?</h2>
      {isLPBF&&candidate&&a.result?<><div className="journeyMetrics"><article><small>Selected option</small><b>{candidate.id}</b></article><article><small>Build height</small><b>{num(candidate.buildHeightMm)} mm</b></article><article><small>Support proxy</small><b>{num(candidate.supportProxyMm3)} mm³</b></article></div>
       <Status kind={candidate.feasible?"ok":"missing"}>{candidate.feasible?"Within configured geometric bounds":"Fails entered geometric constraints"}</Status>
       <h3>Items needing review</h3>{screenCandidate(candidate,a.result.candidates).map(f=><p key={f.code}><strong>{f.code}:</strong> {f.message}</p>)}
       {serviceCaseSummary(a.result).map(c=><p key={c.id}><strong>{c.name} displacement:</strong> {c.status.replaceAll("-"," ")}. Strength and fatigue not evaluated.</p>)}
       <div className="journeyNotice"><strong>Not a print approval.</strong><p>Orientation ranking is based on geometry and user preferences; material strength, defect risk, process distortion and first-time acceptance require separate validation.</p></div>
      </>:isDed&&ded.plan&&ded.flow?<><h3>Compare example deposition directions</h3>
        <div className="journeyChoiceGrid">{(["alternating","one-way"] as const).map(strategy=>{const r=planDedWall({...j.dedInput,strategy});return <button key={strategy} className={strategy===j.dedInput.strategy?"selected":""} onClick={()=>dedSet("strategy",strategy)}><strong>{strategy==="alternating"?"Alternating direction":"One-way tracks"}</strong><span>Commanded time {num(r.commandedSubtotalSeconds/60)} min</span><small>Reposition {num(r.repositionLengthMm)} mm · illustrative geometry</small></button>;})}</div>
        <p>Factory scenario mean lead time: {num(ded.flow.meanLeadTimeMin)} min. This is an assumed deterministic flow-shop outcome, not verified production throughput.</p>
        <Status kind="missing">Print feasibility and quality not established</Status>
      </>:<div className="journeyNotice">No process-specific decision is available. Return to options to generate supported results.</div>}
     </>}
     {j.step==="report"&&<>
      <p className="guidedEyebrow">STEP 7 / ENGINEERING REVIEW</p><h2>Export what we know—and what we do not.</h2>
      {isLPBF&&a.result?<><p>The report contains the current STL checksum, geometric screening, original-part service cases, numerical findings and missing evidence.</p><Link className="studioAction primary" href="/report">Open engineering PDF / JSON report</Link><button className="studioAction secondary" onClick={()=>void exportProject()} disabled={exportBusy}>Export complete project backup</button></>:
       isDed&&ded.plan&&ded.flow?<><p>This example's results are teaching motion and manufacturing-flow estimates. No aerospace qualification, physical acceptance or actual Simio run is included.</p>
         <button className="studioAction primary" onClick={()=>download(ded.plan!.scenarioId+"-engineering-review.json",JSON.stringify({schema:"orientai-example-review-v1",source:"synthetic-ded-wall",project:a.projectName,process:j.process,inputs:j.dedInput,plan:ded.plan,manufacturingFlow:ded.flow,evidence:"illustrative",machineFeasibility:"not_evaluated",structural:"not_evaluated",thermal:"not_evaluated",distortion:"not_evaluated",firstPassQuality:"not_evaluated"},null,2),"application/json")}>Download DED research review (JSON)</button>
         <button className="studioAction secondary" onClick={exportSimio}>Download Simio scenario tables (ZIP)</button></>:
        <div className="journeyNotice">No current supported result to export. Check the process and calculation status in previous stages.</div>}
       <h3>Before manufacturing</h3><p>Review missing material properties, machine-specific constraints, fixtures, tolerance requirements and independent physical evidence. This is a research engineering review, not an approval to manufacture or certify a part.</p>
       <details><summary>Advanced research tools</summary><p><Link href="/orientation/advanced">Legacy advanced part calculations</Link> · <Link href="/simulation/benchmarks">Numerical benchmarks</Link> · <Link href="/ml">ML research</Link></p></details>
     </>}
     <footer className="journeyFooter">
      <button onClick={()=>setStage(STEPS[Math.max(0,STEPS.indexOf(j.step)-1)])} disabled={j.step==="part"}>Back</button>
      <span>{STEPS.indexOf(j.step)+1} of 7</span>
      {j.step!=="report"&&<button className="studioAction primary" onClick={next} disabled={!verified&&j.step==="part"}>Continue: {STEP_LABELS[STEPS[STEPS.indexOf(j.step)+1]]} →</button>}
     </footer>
    </section>
   </div>
   <div className="journeyBottom"><span><strong>Part:</strong> {summaryName}</span><span><strong>Process:</strong> {isDed?j.process:j.process==="PBF_LB_METAL"?"LPBF":j.process+" (unsupported for user STL)"}</span><span><strong>Evidence:</strong> research / not qualified</span><Link href="/orientation/advanced">Advanced tools</Link></div>
  </div>
 </AppShell>;
}
