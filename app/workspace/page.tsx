"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import "./workspace.css";
import "./review-demo.css";
import {useEffect,useMemo,useRef,useState} from "react";
import {ArrowRight,Box,Download,FileUp,Play,RotateCcw,ShieldCheck,TriangleAlert,FileText,CheckCircle2,Settings2} from "lucide-react";
import {evaluateAxisFits,isUsableMetrics,normalizeToMm,researchNotice,type RawMetrics} from "@/lib/team-review";
const ModelViewer=dynamic(()=>import("@/components/ModelViewer"),{ssr:false});
type LoadKey="force"|"moment"|"torque"|"pressure"|"displacement";
type Settings={projectName:string;material:string;process:string;notes:string;units:"mm"|"in";envelope:{x:number;y:number;z:number};loads:Record<LoadKey,number>};
type AMCheck={name:string;status:string;reason:string};
type AMResult={risk:string;geometryRisk:number;processCompatibility:string;checks:AMCheck[];limitations:string[]};
const DEFAULT:Settings={projectName:"Team Review Demonstration",material:"Ti-6Al-4V",process:"LPBF",notes:"",units:"mm",envelope:{x:200,y:200,z:200},loads:{force:0,moment:0,torque:0,pressure:0,displacement:0}};
const STAGES=["CAD intake","Geometry","Requirements","AM screening","Compare","Report"];
const SIZE_LIMIT=25*1024*1024;
const fmt=(n:number)=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:2}):"n/a";
function parseSaved(text:string|null):Settings{
 if(!text)return DEFAULT;
 try{
  const v=JSON.parse(text);
  const units=v.units==="in"?"in":"mm";
  const envelope={...DEFAULT.envelope,...v.envelope};
  const loads={...DEFAULT.loads,...v.loads};
  for(const k of ["x","y","z"] as const)if(!Number.isFinite(envelope[k])||envelope[k]<=0||envelope[k]>100000)envelope[k]=DEFAULT.envelope[k];
  for(const k of Object.keys(DEFAULT.loads) as LoadKey[])if(!Number.isFinite(loads[k]))loads[k]=0;
  return {...DEFAULT,projectName:String(v.projectName||DEFAULT.projectName).slice(0,100),material:String(v.material||DEFAULT.material),process:String(v.process||DEFAULT.process),notes:String(v.notes||"").slice(0,3000),units,envelope,loads};
 }catch{return DEFAULT}
}
export default function Workspace(){
 const [settings,setSettings]=useState<Settings>(DEFAULT);
 const [hydrated,setHydrated]=useState(false);
 const [file,setFile]=useState<File|null>(null);
 const [source,setSource]=useState<"upload"|"sample">("upload");
 const [viewerUrl,setViewerUrl]=useState<string>();
 const [fileHash,setFileHash]=useState("");
 const [metrics,setMetrics]=useState<RawMetrics>();
 const [am,setAm]=useState<AMResult>();
 const [inspecting,setInspecting]=useState(false);
 const [screening,setScreening]=useState(false);
 const [error,setError]=useState("");
 const [amError,setAmError]=useState("");
 const [showGeometry,setShowGeometry]=useState(false);
 const geometryRef=useRef<HTMLDivElement>(null);
 const requestId=useRef(0);
 const screenVersion=useRef(0);
 useEffect(()=>{setSettings(parseSaved(window.localStorage.getItem("ftq-team-review-settings-v1")));setHydrated(true)},[]);
 useEffect(()=>{if(hydrated)try{window.localStorage.setItem("ftq-team-review-settings-v1",JSON.stringify(settings))}catch{}},[hydrated,settings]);
 useEffect(()=>{if(!file||!metrics){setViewerUrl(undefined);return}const u=URL.createObjectURL(file);setViewerUrl(u);return()=>URL.revokeObjectURL(u)},[file,metrics]);
 const mm=useMemo(()=>metrics?normalizeToMm(metrics,settings.units):undefined,[metrics,settings.units]);
 const fits=useMemo(()=>mm?evaluateAxisFits(mm,settings.envelope):[],[mm,settings.envelope]);
 const validEnvelope=Object.values(settings.envelope).every(n=>Number.isFinite(n)&&n>0);
 const fitCount=validEnvelope?fits.filter(f=>f.fits).length:0;
 const ext=file?.name.split(".").pop()?.toLowerCase();
 const canPreview=ext==="stl"&&!!metrics&&!!viewerUrl;
 const hasSettings=hydrated;
 function patch(changes:Partial<Settings>){screenVersion.current+=1;setSettings(p=>({...p,...changes}));setAm(undefined);setAmError("")}
 function clearFile(){requestId.current+=1;screenVersion.current+=1;setFile(null);setMetrics(undefined);setAm(undefined);setFileHash("");setViewerUrl(undefined);setError("");setAmError("");setSource("upload");setShowGeometry(false);setInspecting(false);setScreening(false)}
 async function doAM(m:RawMetrics,current:Settings,id:number){
  const currentScreen=++screenVersion.current;
  setScreening(true);setAmError("");
  try{
   const body={metrics:normalizeToMm(m,current.units),material:current.material,process:current.process};
   const res=await fetch("/api/am/screen",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
   const json=await res.json();
   if(!res.ok||!Array.isArray(json.checks))throw new Error(json.error||"Manufacturing screening failed.");
   if(id===requestId.current&&currentScreen===screenVersion.current)setAm(json as AMResult);
  }catch(e){if(id===requestId.current&&currentScreen===screenVersion.current)setAmError(e instanceof Error?e.message:"Manufacturing screening failed.")}
  finally{if(id===requestId.current&&currentScreen===screenVersion.current)setScreening(false)}
 }
 async function loadFile(f?:File,kind:"upload"|"sample"="upload",activeSettings:Settings=settings){
  if(!f)return;
  const id=++requestId.current;
  screenVersion.current+=1;
  setScreening(false);
  setFile(null);setMetrics(undefined);setAm(undefined);setFileHash("");setError("");setAmError("");setShowGeometry(false);setSource(kind);
  if(f.size===0||f.size>SIZE_LIMIT){setError(f.size===0?"Selected file is empty.":"Maximum file size is 25 MB.");return}
  const e=f.name.split(".").pop()?.toLowerCase();
  if(!e||!["stl","step","stp","3mf"].includes(e)){setError("Choose an STL, STEP/STP, or 3MF file.");return}
  setFile(f);setInspecting(true);
  try{
   if(typeof crypto!=="undefined"&&crypto.subtle){
    const bytes=await f.arrayBuffer();
    const digest=await crypto.subtle.digest("SHA-256",bytes);
    if(id===requestId.current)setFileHash(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join(""));
   }
   if(e!=="stl")return;
   const form=new FormData();form.append("file",f);
   const response=await fetch("/api/geometry/inspect",{method:"POST",body:form});
   const result=await response.json();
   if(!response.ok||!isUsableMetrics(result.metrics))throw new Error(result.error||"STL mesh is empty or invalid.");
   if(id!==requestId.current)return;
   setMetrics(result.metrics);
   await doAM(result.metrics,activeSettings,id);
  }catch(e){if(id===requestId.current){setMetrics(undefined);setError(e instanceof Error?e.message:"Geometry inspection failed.");}}
  finally{if(id===requestId.current)setInspecting(false)}
 }
 async function loadSample(){
  setError("");
  try{
   const r=await fetch("/api/sample");
   if(!r.ok)throw new Error("Sample generator unavailable.");
   const stl=await r.text();
   if(!stl.includes("solid synthetic_mounting_plate"))throw new Error("Invalid generated sample.");
   const configured={...settings,units:"mm" as const};
   patch({units:"mm"});
   await loadFile(new File([stl],"Synthetic_Mounting_Plate_80x50x8.stl",{type:"model/stl"}),"sample",configured);
  }catch(e){setError(e instanceof Error?e.message:"Could not create sample.");}
 }
 async function runScreen(){if(!metrics)return;setAm(undefined);await doAM(metrics,settings,requestId.current)}
 function navigateGeometry(){if(!metrics)return;setShowGeometry(true);requestAnimationFrame(()=>geometryRef.current?.scrollIntoView({behavior:"smooth",block:"start"}))}
 function makeReport(){
  if(!file||!metrics||!mm)return;
  const report={title:"Metal AM First-Time Quality — Research Screening Summary",generatedAt:new Date().toISOString(),status:"Research screening; not qualified manufacturing or structural analysis",project:settings.projectName,
   source:{name:file.name,type:source,bytes:file.size,sha256:fileHash||null,declaredUnits:settings.units},
   inputs:{material:settings.material,process:settings.process,notes:settings.notes,loads:settings.loads,exampleBuildEnvelopeMm:settings.envelope},
   geometry:{sourceMetrics:metrics,normalizedMm: mm},
   screening:am||{status:"Not current; rerun required"},
   envelope:{status:"Example envelope only. No machine profile is qualified.",fits},
   limitations:[researchNotice,"STL contains no native units; units entered manually.","STEP/3MF parsing and general structural optimization are not implemented.","Build-envelope orientation comparison uses only six axis-aligned permutations.","The geometry cannot be certified based on these screens."]};
  const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"});
  const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download="ftq-research-summary.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
 }
 return <main className="designPage">
  <header className="designHeader"><Link href="/">← Home / Team Review</Link><div><b>METAL AM · ENGINEERING WORKSPACE</b><span>Upload CAD · inspect geometry · evaluate preliminary manufacturing constraints</span></div><div className="researchBadge">RESEARCH PROTOTYPE · NOT QUALIFIED</div></header>
  <section className="uploadHero"><p className="eyebrow">VT SENIOR DESIGN · TEAM DEMONSTRATION</p><h1>Start with the part you want to improve.</h1><p>Upload an approved CAD mesh, confirm its units, inspect calculated geometry, configure engineering requirements and evaluate an illustrative build envelope. All screening results are preliminary.</p>
   <div className="stageRail">{STAGES.map((s,i)=><div key={s} className={(i===0?"active":i===1&&metrics?"working":i===3&&am?"working":"")}><span>{i+1}</span>{s}</div>)}</div>
  </section>
  <div className="uploadWorkspace">
   <section className="mainPanel">
    <div className="panelTitle"><div><Box/><div><h2>CAD Model & Geometry</h2><p>STL inspection now · STEP/STP/3MF parsers planned</p></div></div>{file&&<button type="button" className="secondary" onClick={clearFile}><RotateCcw size={14}/> Replace file</button>}</div>
    {!file?<div className="reviewUpload"><div className="reviewUploadIcon"><FileUp size={36}/></div><h3>Load a geometry file</h3><p>Choose a local STL file for real mesh inspection, or use a generated, non-proprietary sample part to evaluate the workflow immediately.</p><label className="reviewFileButton">Choose CAD file<input type="file" accept=".stl,.step,.stp,.3mf" onChange={e=>{void loadFile(e.target.files?.[0]);e.currentTarget.value=""}}/></label><button type="button" className="secondary" onClick={()=>void loadSample()}><Play size={15}/> Load sample mounting plate</button><Link className="reviewQuietLink" href="/fuselage">Open legacy fuselage benchmark →</Link></div>:<>
      {canPreview?<div className="reviewViewport"><ModelViewer key={fileHash||file.name} url={viewerUrl}/></div>:<div className="cadPlaceholder"><Box/><b>{file.name}</b>{inspecting&&ext==="stl"?<span>Inspecting geometry…</span>:<><span>{ext?.toUpperCase()} selected</span><p>{ext==="stl"?"No preview available. Review the inspection error below.":"Native STEP/3MF CAD parsing is not yet available. No measurements or design features have been inferred."}</p></>}</div>}
      <div className="filebar"><div><Box/><span><b>{file.name}</b><small>{fmt(file.size/1024)} KB · {ext?.toUpperCase()} · {source==="sample"?"Generated synthetic sample":"User-selected file"}</small></span></div><span className="loaded">{metrics?"INSPECTED":ext==="stl"?"NOT ANALYZED":"PARSER PLANNED"}</span></div>
      {fileHash&&<div className="reviewFingerprint">SHA-256: {fileHash}</div>}
      {metrics&&<div ref={geometryRef} id="geometry-results" className="reviewResultBlock"><div className="reviewSectionTop"><h3>Geometry results</h3><span>Calculated from STL triangle mesh</span></div><div className="geometryMetrics"><div><small>ENVELOPE · {settings.units}</small><b>{fmt(metrics.dimensions.x)} × {fmt(metrics.dimensions.y)} × {fmt(metrics.dimensions.z)}</b></div><div><small>ESTIMATED MESH VOLUME</small><b>{fmt(mm!.volumeMm3/1000)} cm³</b></div><div><small>SURFACE AREA</small><b>{fmt(mm!.surfaceAreaMm2/100)} cm²</b></div><div><small>TRIANGLES</small><b>{fmt(metrics.triangleCount)}</b></div><div><small>MESH EDGE CLOSURE</small><b>{metrics.watertightEstimate}</b></div><div><small>ASPECT RATIO</small><b>{fmt(metrics.aspectRatio)}</b></div></div><p className="reviewSubtle">Volume is an approximate signed-mesh result and is not reliable for open or inconsistently oriented meshes. Closure is a connectivity estimate, not proof of a watertight solid.</p></div>}
     </>}
     {inspecting&&<p role="status" className="reviewInfo">Processing file and computing geometry…</p>}
     {error&&<p role="alert" className="reviewError">{error}</p>}
     {!file&&<p className="reviewSubtle">Data boundary: do not upload proprietary, export-controlled or other restricted Boeing files to this preview. Use only approved research data.</p>}
   </section>
   <aside className="reviewAside">
    <section className="card"><h3><Settings2 size={17}/> Engineering inputs</h3><label>Project name<input className="reviewTextInput" value={settings.projectName} onChange={e=>patch({projectName:e.target.value.slice(0,100)})}/></label><div className="reviewTwoCols"><label>Material<select value={settings.material} onChange={e=>patch({material:e.target.value})}><option>Ti-6Al-4V</option><option>Aluminum alloy</option><option>Inconel 718</option><option>316L Stainless Steel</option></select></label><label>AM process<select value={settings.process} onChange={e=>patch({process:e.target.value})}><option>LPBF</option><option>EBM</option><option>DED</option></select></label></div><label>STL units (confirm from CAD source)<select value={settings.units} onChange={e=>patch({units:e.target.value as "mm"|"in"})}><option value="mm">Millimeters</option><option value="in">Inches</option></select></label><label>Part intent / critical surfaces<textarea value={settings.notes} onChange={e=>patch({notes:e.target.value})} placeholder="Purpose, preserved interfaces, critical dimensions, inspection goals…"/></label><p className="reviewSubtle">Engineering form inputs are auto-saved in this browser only. Uploaded CAD files are not saved and must be reselected after reloading.</p></section>
    <section className="card"><h3>Loads & constraints</h3><p className="fieldHelp">These are engineer-defined inputs. No generic structural FEA is performed.</p><div className="loadGrid">{(Object.keys(DEFAULT.loads) as LoadKey[]).map(k=><label key={k}>{({force:"Resultant force (N)",moment:"Bending moment (N·mm)",torque:"Torque (N·mm)",pressure:"Pressure (MPa)",displacement:"Max displacement (mm)"} as Record<LoadKey,string>)[k]}<input type="number" step="any" value={settings.loads[k]} onChange={e=>{const v=Number(e.target.value);patch({loads:{...settings.loads,[k]:Number.isFinite(v)?v:0}})}}/></label>)}</div><div className="notice"><TriangleAlert/><span><b>Structural validation not available</b>Real boundary conditions, allowable properties, solver benchmarks and engineer review are required before making structural performance claims.</span></div></section>
    <section className="card"><h3>Research build envelope</h3><p className="fieldHelp">Illustrative rectangular space, not a qualified printer profile. Axis-aligned orientations only.</p><div className="reviewThreeCols">{(["x","y","z"] as const).map(k=><label key={k}>{k.toUpperCase()} (mm)<input type="number" min="0.01" step="1" value={settings.envelope[k]} onChange={e=>patch({envelope:{...settings.envelope,[k]:Number(e.target.value)}})}/></label>)}</div>{!validEnvelope?<p className="reviewError">Enter positive envelope dimensions.</p>:metrics?<><div className="reviewFitHeadline">{fitCount} of {fits.length} axis-aligned orientations fit the example envelope.</div><div className="reviewFitRows">{fits.map(x=><div key={x.name}><span>{x.name}<small>{x.dimensionsMm.map(fmt).join(" × ")} mm</small></span><b className={x.fits?"reviewOk":"reviewNo"}>{x.fits?"FITS":"OUTSIDE"}</b></div>)}</div></>:<p className="reviewSubtle">Upload or load a sample STL to check these dimensions.</p>}</section>
    <section className="card"><h3>Preliminary AM screening</h3>{!metrics?<p className="reviewSubtle">Geometry screening is available after a valid STL inspection.</p>:<><button type="button" className="primary reviewFull" onClick={()=>void runScreen()} disabled={screening}>{screening?"SCREENING…":am?"Re-run geometry/process checks":"Run geometry/process checks"}</button>{am&&<><div className="reviewRisk">Heuristic geometry risk: <b>{am.risk}</b> <small>(rule-based indicator; not a defect probability)</small></div><div className="reviewChecks">{am.checks.map(x=><div key={x.name}><div><strong>{x.name}</strong><span>{x.status}</span></div><p>{x.reason}</p></div>)}</div></>}</>}{amError&&<p role="alert" className="reviewError">{amError}</p>}<p className="reviewSubtle">Overhangs, supports, thermal distortion, and machine-qualified settings are not calculated by this prototype.</p></section>
    <section className="card"><h3>Team-review exports</h3><p className="fieldHelp">Export geometry findings, chosen research inputs, limitations and the illustrative build-envelope results.</p><div className="reviewActions"><button type="button" className="primary" onClick={navigateGeometry} disabled={!metrics}><ArrowRight size={15}/> Continue to geometry</button><button type="button" className="secondary" onClick={makeReport} disabled={!metrics}><Download size={15}/> Download JSON</button><button type="button" className="secondary" disabled={!metrics} onClick={()=>window.print()}><FileText size={15}/> Print / Save PDF</button></div><div className="notice"><ShieldCheck/><span><b>Research use only</b>Results are for team discussion, not flight approval, qualified AM manufacture or unsupervised printer operation.</span></div></section>
   </aside>
  </div>
  <section className="reviewBoundary"><TriangleAlert/><div><b>Capability boundary</b><p>{researchNotice} STEP/3MF processing and arbitrary-part structural optimization remain planned. The sample part is synthetic and its calculations are geometry screening only.</p></div></section>
  {metrics&&mm&&file&&<article className="reviewPrintSheet"><h1>AM First-Time Quality — Research Screening</h1><p>Project: {settings.projectName}</p><p>Source file: {file.name} ({source}) · Units declared: {settings.units}</p><p>Material: {settings.material} · Process: {settings.process}</p><p>Dimensions (mm): {fmt(mm.dimensions.x)} × {fmt(mm.dimensions.y)} × {fmt(mm.dimensions.z)}</p><p>Surface area (mm²): {fmt(mm.surfaceAreaMm2)} · Mesh volume (mm³): {fmt(mm.volumeMm3)}</p><p>Triangles: {metrics.triangleCount} · Estimated closure: {metrics.watertightEstimate}</p><p>Example machine envelope: {Object.values(settings.envelope).join(" × ")} mm; fitting axis-aligned orientations: {fitCount}/{fits.length}</p><p>Heuristic AM screening: {am?am.risk:"Not current / not run"}</p><p>Loads: {JSON.stringify(settings.loads)}</p><p>Part notes: {settings.notes||"Not supplied"}</p><p>File hash: {fileHash||"Unavailable"}</p><h2>Limitations</h2><p>{researchNotice} STL source units were manually declared. No validated structure or process simulation was performed. The example envelope does not represent a qualified machine. No Boeing-controlled files should be used.</p><p>Generated: {new Date().toLocaleDateString()}</p></article>}
 </main>
}
