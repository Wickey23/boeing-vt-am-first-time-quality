"use client";
import {AlertTriangle,ArrowRight,Box,CheckCircle2,ChevronDown,Eye,FileUp,Layers,Play,Ruler,ShieldCheck,SlidersHorizontal,Target} from "lucide-react";
import type {Inspection} from "@/components/PartInspection";
import type {MeshFinding} from "@/lib/stl-mesh-audit";
import StudioCanvasFallback from "./StudioCanvasFallback";

type SelectedOrientation={id:string;buildHeightMm:number;downFacingAreaMm2:number;supportProxyMm3:number};
type Finding={code:string;message:string;basis:string};
type Props={
 file:File|null;url?:string;inspection?:Inspection;inspectionError?:string;
 unitScale:number;unitsConfirmed:boolean;meshFindings:MeshFinding[];
 selected?:SelectedOrientation;findings:Finding[];hasRun:boolean;busy:boolean;
 progress:number;analysisError:string;
 onUpload:()=>void;onAttachFile:(file:File)=>void;onChangeUnits:(unit:number)=>void;onConfirm:()=>void;
 onRun:()=>void;onContinue:()=>void;onQuickView:()=>void;
};
const dimension=(data:Inspection|undefined)=>data?
 [data.dimensions.x,data.dimensions.y,data.dimensions.z].map(n=>n.toFixed(1)).join(" × ")+" mm":"Inspecting…";
export default function ProfessionalGeometryStage(p:Props){
 const audit=p.inspection?.audit;
 const geometryReady=Boolean(audit&&p.unitsConfirmed);
 const manifold=Boolean(audit&&audit.openEdges===0&&audit.nonManifoldEdges===0);
 const decision=!p.file?{text:"Upload an STL to begin reviewing the part geometry.",button:"Upload STL"}:
  !p.unitsConfirmed?{text:"Confirm the STL coordinate units and dimensions against the engineering drawing.",button:"Review units"}:
  !p.hasRun?{text:"Units confirmed. Run the supported geometry screening to review candidate orientations and geometric concerns.",button:"Run geometry screening"}:
  {text:"Geometry screening is available. Continue to describe how the part works in its assembly.",button:"Continue to Engineering Context"};
 const advance=()=>{
  if(!p.file)p.onUpload();
  else if(!p.unitsConfirmed)document.getElementById("ps-units-confirmation")?.scrollIntoView({block:"center",behavior:"smooth"});
  else if(!p.hasRun)p.onRun();
  else p.onContinue();
 };
 return <section className="psStage psReferenceGeometry" aria-label="Part geometry stage">
  <div className="psReferenceHeading">
   <span>STEP 1 OF 3</span>
   <h2>Part Geometry</h2>
   <p>Upload and review the part geometry, confirm units and mesh quality, then proceed to define the engineering context.</p>
  </div>
  {!p.file?<article className="psEmptyCard psReferenceEmpty"
   onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const file=e.dataTransfer.files[0];if(file)p.onAttachFile(file);}}>
   <Box size={30}/><h3>Upload the part you want to evaluate</h3>
   <p>STL geometry is processed locally. Dimensions and engineering requirements must be verified before analysis.</p>
   <button type="button" onClick={p.onUpload}><FileUp size={16}/> Upload STL</button>
   <small>STL · up to 20 MB</small>
  </article>:<>
   <div className="psReferenceGrid psReferenceTopGrid">
    <article className="psPanel psReferenceModel" aria-label="Uploaded model">
     <div className="psReferenceCardHeading"><strong><Box size={18}/> Uploaded Model</strong>
      <span className="psModelLoaded"><CheckCircle2 size={13}/> Model loaded</span></div>
     <div className="psModelContents">
      <div className="psModelThumbnail" aria-label="Uploaded STL thumbnail">
       <StudioCanvasFallback url={p.url} thumbnail/>
      </div>
      <div className="psModelDescription">
       <strong title={p.file.name}>{p.file.name}</strong>
       <p><Box size={14}/>{audit?.triangles.toLocaleString()??"Inspecting"} mesh triangles</p>
       <p><Ruler size={14}/>{dimension(p.inspection)}</p>
       <button type="button" onClick={p.onQuickView}><Eye size={14}/> Quick view</button>
      </div>
     </div>
    </article>
    <section className="psPanel psReferenceMesh" aria-label="Mesh inspection">
     <div className="psReferenceCardHeading"><strong><ShieldCheck size={18}/> Mesh Facts</strong></div>
     <dl>
      <div><dt>Triangles</dt><dd>{audit?.triangles.toLocaleString()??"—"}</dd></div>
      <div><dt>Open edges</dt><dd>{audit?.openEdges.toLocaleString()??"—"}</dd></div>
      <div><dt>Non-manifold edges</dt><dd>{audit?.nonManifoldEdges.toLocaleString()??"—"}</dd></div>
      <div><dt>Shells</dt><dd>{audit?.disconnectedShells.toLocaleString()??"—"}</dd></div>
      <div><dt>Surface area</dt><dd>{audit?.surfaceAreaMm2?.toFixed(1)??"—"} mm²</dd></div>
      <div><dt>Solid volume</dt><dd>{audit?.solidVolumeMm3?.toFixed(1)??"Not resolved"} {audit?.solidVolumeMm3?"mm³":""}</dd></div>
      <div><dt>Edge topology</dt><dd>{audit?<span className={manifold?"psMeshClear":"psMeshReview"}>{manifold?<CheckCircle2 size={13}/>:<AlertTriangle size={13}/>}
       {manifold?"No flags":"Review needed"}</span>:"Pending"}</dd></div>
     </dl>
     {p.inspectionError&&<p className="psError" role="alert">{p.inspectionError}</p>}
    </section>
   </div>
   <div className="psReferenceGrid psReferenceBottomGrid">
    <section className="psPanel psReferenceDimensions" aria-label="Dimensions and units">
     <div className="psReferenceCardHeading"><strong><Ruler size={18}/> Dimensions & units</strong></div>
     <p>Confirm the model size and original STL units.</p>
     <dl><div><dt>Model size (X × Y × Z)</dt><dd>{dimension(p.inspection)}</dd></div></dl>
     <label>STL coordinate units
      <select aria-label="STL coordinate units" value={p.unitScale} onChange={e=>p.onChangeUnits(Number(e.target.value))}>
       <option value={1}>Millimeters (mm)</option><option value={25.4}>Inches (in)</option><option value={1000}>Meters (m)</option>
      </select>
     </label>
    </section>
    <article className="psPanel psReferenceConfirmation" id="ps-units-confirmation" aria-label="STL units confirmation">
     <div className="psReferenceCardHeading"><strong><Layers size={18}/> STL Units Confirmation</strong></div>
     <p>STL files do not encode units. Confirm these values against the source drawing.</p>
     {p.unitsConfirmed?<div className="psUnitsConfirmed" role="status"><CheckCircle2 size={17}/>
      <strong>Units confirmed</strong><span>{p.unitScale===1?"Millimeters":p.unitScale===25.4?"Inches":"Meters"}</span>
     </div>:<button type="button" className="psConfirmUnits" onClick={p.onConfirm} disabled={!p.inspection}>
      <CheckCircle2 size={17}/> Confirm units & dimensions <ArrowRight size={15}/>
     </button>}
    </article>
   </div>
   {p.meshFindings.length>0&&<details className="psMeshIssues">
    <summary><AlertTriangle size={15}/>{p.meshFindings.length} mesh findings need engineering review <ChevronDown size={15}/></summary>
    <div>{p.meshFindings.map(f=><p key={f.code}><strong>{f.code} · {f.level}</strong> {f.message}</p>)}</div>
   </details>}
   <article className="psReferenceRecommendation">
    <Target size={27}/>
    <div><strong>Recommended next action</strong><p>{decision.text}</p></div>
    <button type="button" onClick={advance} disabled={p.busy||(!p.unitsConfirmed&&Boolean(p.file)&&!p.inspection)}>
     {p.busy?"Screening…":decision.button}<ArrowRight size={16}/>
    </button>
   </article>
   {p.hasRun&&p.selected&&<details className="psReferenceAnalysis" open={false}>
    <summary><SlidersHorizontal size={16}/> Geometry screening results · selected orientation {p.selected.id} <ChevronDown size={15}/></summary>
    <div className="psReferenceScreenResults">
     <div><small>Build height</small><strong>{p.selected.buildHeightMm.toFixed(1)} mm</strong></div>
     <div><small>Down-facing area</small><strong>{p.selected.downFacingAreaMm2.toFixed(1)} mm²</strong></div>
     <div><small>Support proxy</small><strong>{p.selected.supportProxyMm3.toFixed(1)} mm³</strong></div>
    </div>
    {p.findings.map(f=><p key={f.code} className="psFinding"><AlertTriangle size={14}/>{f.message}</p>)}
    <p className="psCaveat">Geometric orientation estimates are not metal print-process simulations.</p>
   </details>}
   {!p.hasRun&&<details className="psReferenceAnalysis">
    <summary><SlidersHorizontal size={16}/> Additional engineering tools <ChevronDown size={15}/></summary>
    <p>Geometry screening uses the existing local analysis worker. More advanced numerical studies remain in the engineering tools section.</p>
    <button type="button" onClick={p.onRun} disabled={!geometryReady||p.busy}>
     <Play size={14}/> Run geometry screening
    </button>
   </details>}
   {p.busy&&<div className="psProgress" role="status"><div style={{width:Math.round(p.progress*100)+"%"}}/><span>{Math.round(p.progress*100)}% · screening geometry</span></div>}
   {p.analysisError&&<p className="psError" role="alert">{p.analysisError}</p>}
  </>}
 </section>;
}
