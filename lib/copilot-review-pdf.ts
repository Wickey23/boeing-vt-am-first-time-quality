/** ORIENTAI pre-build engineering review.
 * Research / evidence report, not a qualified printability or strength certificate.
 * All numeric values must originate in the current inspected STL or existing worker.
 */
import type {ProjectKnowledge} from "./copilot-context";
import type {ReviewedEvidence} from "./engineering-evidence";
import type {EngineeringReadiness} from "./engineering-readiness";
import type {ApprovedParameterBinding} from "./engineering-parameter-binding";
import type {FailureCoverage} from "./failure-coverage";

export type CopilotPdfInputs={
 projectName:string;partName:string;partSha256:string;process:string;
 unitsConfirmed:boolean;createdAt:string;knowledge:ProjectKnowledge;
 reviewedEvidence:ReviewedEvidence[];approvedBindings?:ApprovedParameterBinding[];
 readiness:EngineeringReadiness;coverage?:FailureCoverage[];
 geometricConcerns?:{code:string;message:string;basis:string;severity?:string}[];
 geometry?:{dimensionsMm:{x:number;y:number;z:number};triangles:number;
  openEdges:number;nonManifoldEdges:number;disconnectedShells:number;smallestEdgeMm:number};
 selectedOrientation?:{id:string;buildHeightMm:number;downFacingAreaMm2:number;
  supportProxyMm3:number;overhangFraction:number;contactAreaMm2:number;
  rotation?:{x:number;y:number;z:number}};
 study?:{jobId:string;stressMPa?:number;displacementMm?:number;
  temperatureMinC?:number;temperatureMaxC?:number;
  structuralModel?:string;thermalModel?:string};
};

const nice=(value:unknown)=>String(value??"").replace(/[^\x20-\x7e\n]/g," ").replace(/ {2,}/g," ").trim();
const fmt=(v:number|undefined,digits=2)=>typeof v==="number"&&Number.isFinite(v)?v.toFixed(digits):"Not measured";
const riskMeaning=(code:string)=>{
 switch(code){
  case "DISCONNECTED":return "Independent mesh shells may represent intentionally separate bodies or unintended disconnections. Verify physical attachment and the intended load path.";
  case "SMALL_FEATURE":return "Very short triangle edges could be tessellation artifacts or unresolved geometry in a coarse simulation; they are NOT measurements of wall thickness.";
  case "DOWN_FACING":return "Down-facing surfaces can increase support demand and require a verified support plan; this is not a prediction of sagging or failed fusion.";
  case "BUILD_ENVELOPE":return "This orientation is outside the configured geometric build envelope. Confirm machine settings and candidate selection.";
  case "SUPPORT_LIMIT":return "The geometric support-volume proxy exceeds the user-selected bound; generated supports and machine limits require independent verification.";
  case "PLATE_CONTACT":return "The geometric contact heuristic found little or no near-bed facing area. Inspect fixture/contact design, not just adhesion.";
  case "SUPPORT_COMPARISON":return "Another screened orientation may reduce the support-volume proxy; verify support accessibility and trade-offs.";
  case "OPEN_SURFACE":return "Unclosed mesh boundaries can invalidate watertight geometry or voxel calculations. Repair mesh before physical interpretation.";
  case "TOPOLOGY":return "Inconsistent triangle connectivity requires mesh repair before treating physical solver output as credible.";
  default:return "Review this geometric flag against the real component and intended metal AM process; its presence alone does not establish a defect.";
 }
};

export async function createCopilotReviewPDF(input:CopilotPdfInputs){
 const {jsPDF}=await import("jspdf");
 const doc=new jsPDF({unit:"mm",format:"a4",compress:true});
 const W=210,M=17,R=W-M,CONTENT=R-M,BOT=273;
 const ink:[number,number,number]=[34,48,60],
  muted:[number,number,number]=[93,107,121],
  navy:[number,number,number]=[29,53,72],
  blue:[number,number,number]=[54,105,137],
  border:[number,number,number]=[218,225,232],
  light:[number,number,number]=[242,246,249],
  amber:[number,number,number]=[144,94,41],
  green:[number,number,number]=[38,107,88];
 const counts={screened:input.coverage?.filter(x=>x.state==="screened").length??0,
  calculated:input.coverage?.filter(x=>x.state==="calculated").length??0,
  unknown:input.coverage?.filter(x=>x.state==="not-assessed").length??0};
 let y=18;
 const font=(size=9,bold=false,color=ink)=>{
  doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);doc.setTextColor(...color);
 };
 const beginPage=()=>{
  doc.addPage();y=19;
  font(8,true,blue);doc.text("ORIENTAI  /  ENGINEERING REVIEW",M,y);
  doc.setDrawColor(...border);doc.line(M,y+3,R,y+3);y+=13;
 };
 const ensure=(height:number)=>{if(y+height>BOT)beginPage();};
 const linesFor=(value:string,width=CONTENT,size=9,bold=false):string[]=>{
  font(size,bold);return doc.splitTextToSize(nice(value)||"Not recorded",width) as string[];
 };
 const text=(value:string,opts:{size?:number;color?:typeof ink;bold?:boolean;width?:number;indent?:number;after?:number}={})=>{
  const size=opts.size??9,width=opts.width??CONTENT,step=size<=8?3.7:size<=9?4.4:5;
  const lines=linesFor(value,width,size,opts.bold);
  font(size,opts.bold??false,opts.color??ink);
  for(const line of lines){ensure(step+1);doc.text(line,M+(opts.indent??0),y);y+=step;}
  y+=opts.after??2;
 };
 const section=(heading:string,description?:string)=>{
  ensure(description?19:13);y+=4;
  doc.setFillColor(...navy);doc.rect(M,y-5,2,7,"F");
  font(12,true,navy);doc.text(nice(heading),M+6,y);y+=7;
  if(description)text(description,{size:8,color:muted,after:2});
 };
 const rule=()=>{ensure(4);doc.setDrawColor(...border);doc.line(M,y,R,y);y+=4;};
 const kv=(label:string,value:string)=>{
  const a=linesFor(label,46,8),b=linesFor(value,124,8.5);
  const h=Math.max(a.length*4,b.length*4)+3;ensure(h);
  font(8,true,muted);doc.text(a,M,y);
  font(8.5,false,ink);doc.text(b,M+49,y);
  y+=h;rule();
 };
 const columns=(items:{label:string;value:string}[])=>{
  const gap=3,n=items.length,cw=(CONTENT-gap*(n-1))/n;
  ensure(23);
  for(let i=0;i<n;i++){
   const x=M+i*(cw+gap);doc.setFillColor(...light);doc.setDrawColor(...border);
   doc.roundedRect(x,y,cw,22,1.4,1.4,"FD");
   font(7.2,true,muted);doc.text(nice(items[i].label).slice(0,26).toUpperCase(),x+4,y+7);
   font(12,true,navy);const fitted=doc.splitTextToSize(nice(items[i].value),cw-8) as string[];
   doc.text(fitted[0]??"",x+4,y+15);
  }
  y+=28;
 };
 const callout=(heading:string,body:string,color:"neutral"|"warning"="neutral")=>{
  const ls=linesFor(body,CONTENT-14,8.2),h=11+ls.length*4;ensure(h+4);
  doc.setFillColor(...(color==="warning"?[252,247,238] as [number,number,number]:light));
  doc.setDrawColor(...(color==="warning"?[205,173,122] as [number,number,number]:border));
  doc.roundedRect(M,y,CONTENT,h,1.5,1.5,"FD");
  font(9,true,color==="warning"?amber:navy);doc.text(nice(heading),M+6,y+6);
  font(8.2,false,ink);doc.text(ls,M+6,y+11);
  y+=h+5;
 };
 const row=(cells:string[],widths:number[],heightMin=9,header=false)=>{
  const pad=2.5;
  const all=cells.map((cell,i)=>linesFor(cell,widths[i]-2*pad,header?7.6:8));
  const h=Math.max(heightMin,Math.max(...all.map(x=>x.length))*4+3.5);
  ensure(h);
  if(header){doc.setFillColor(...navy);doc.rect(M,y,CONTENT,h,"F");}
  else{doc.setDrawColor(...border);doc.line(M,y+h,R,y+h);}
  let x=M;
  for(let i=0;i<cells.length;i++){
   font(header?7.6:8,header,header?[255,255,255]:ink);
   doc.text(all[i],x+pad,y+4.9);
   x+=widths[i];
  }
  y+=h;
 };
 const table=(headers:string[],widths:number[],data:string[][])=>{
  ensure(20);row(headers,widths,10,true);
  for(const r of data)row(r,widths);
  y+=5;
 };
 const field=(label:string,value:string)=>kv(label,value.trim()?value:"Not documented");
 const pageTitle=(headline:string,sub:string)=>{
  font(8,true,blue);doc.text("ORIENTAI    /    PRE-BUILD ENGINEERING ASSESSMENT",M,y);y+=9;
  font(21,true,navy);doc.text(nice(headline),M,y);y+=8;
  text(sub,{size:9,color:muted,after:3});
  doc.setDrawColor(...border);doc.line(M,y,R,y);y+=7;
 };
 pageTitle("Part risk & evidence dossier","Research screening summary  |  Not a qualified printability, strength or failure-probability prediction");
 callout("ENGINEERING STATUS: NOT QUALIFIED",
  "Geometry analysis may identify manufacturing concerns. Missing process inputs, assembly loads, material allowables and validation prevent reliable first-time-quality or defect predictions.","warning");
 columns([
  {label:"Geometry screened",value:String(counts.screened)},
  {label:"Research calculations",value:String(counts.calculated)},
  {label:"Not assessed",value:String(counts.unknown)},
  {label:"Review items",value:String(input.geometricConcerns?.length??0)}
 ]);
 section("Executive decision");
 text("No manufacturing release decision can be made from this report. Identified geometric concerns are screening flags, not observed print failures. Unknown mechanisms are not low-risk mechanisms.",{bold:true,size:9});
 const actionGates=input.readiness.gates.filter(g=>g.status!=="ready");
 if(actionGates.length){
  text("Priority next steps:",{size:8.5,bold:true,after:1});
  for(const [i,g] of actionGates.slice(0,5).entries())
   text((i+1)+". "+g.title+" - "+g.detail,{size:8.2,indent:2,width:CONTENT-2,after:1});
 }else text("All listed evidence gates have been addressed for research review. This does not constitute engineering acceptance.");
 section("Study identity and traceability");
 kv("Project",input.projectName);kv("File",input.partName);
 kv("Process",input.process);kv("Units",input.unitsConfirmed?"Engineer-confirmed against intended scale":"NOT CONFIRMED");
 kv("Exported",input.createdAt);kv("Part SHA-256",input.partSha256);
 section("Assessment scope");
 text("ORIENTAI screens STL topology and geometric LPBF orientation candidates. Optional service and thermal fields are research calculations made under engineer-entered assumptions. No validated porosity, melt-pool, cracking, fatigue, recoater or residual-stress model is implied.",{size:8.5});
 beginPage();
 section("01  Geometry and build setup");
 if(input.geometry){
  const g=input.geometry;
  columns([
   {label:"Triangles",value:g.triangles.toLocaleString("en-US")},
   {label:"Open edges",value:String(g.openEdges)},
   {label:"Mesh shells",value:String(g.disconnectedShells)},
   {label:"Non-manifold edges",value:String(g.nonManifoldEdges)}
  ]);
  kv("Bounding box (mm)",[g.dimensionsMm.x,g.dimensionsMm.y,g.dimensionsMm.z].map(v=>fmt(v,2)).join(" x "));
  kv("Minimum mesh edge",fmt(g.smallestEdgeMm,4)+" mm (NOT wall thickness)");
  if(g.disconnectedShells>1)callout("SHELL CONTINUITY NEEDS REVIEW",
    "Multiple closed mesh shells can be intentional. Confirm that they represent the intended geometry and, where required, have a valid physical load-transfer path.","warning");
 }else callout("STL audit not available","No current geometry audit measurements were included in this export.","warning");
 section("Orientation screening","A geometry-only comparison of candidate build directions; support volume is a proxy, not sliced support geometry.");
 if(input.selectedOrientation){
  const c=input.selectedOrientation;
  kv("Selected candidate",c.id);
  kv("Build height",fmt(c.buildHeightMm)+" mm");
  kv("Down-facing area",fmt(c.downFacingAreaMm2)+" mm2");
  kv("Support volume proxy",fmt(c.supportProxyMm3)+" mm3");
  kv("Down-facing fraction",fmt(c.overhangFraction*100,1)+" %");
  kv("Plate contact proxy",fmt(c.contactAreaMm2)+" mm2");
  if(c.rotation)kv("Rotation X/Y/Z",[c.rotation.x,c.rotation.y,c.rotation.z].map(v=>fmt(v,1)).join(" / ")+" deg");
 }else text("No current orientation screening was included. The model's appearance in the viewer does not prove build viability.");
 section("Part-specific geometric finding register");
 if(input.geometricConcerns?.length){
  table(["Finding / review level","Potential engineering implication","Observed basis"],[48,81,47],
   input.geometricConcerns.slice(0,25).map(c=>[
    c.code+(c.severity?" | "+c.severity:""),
    riskMeaning(c.code),
    c.message+" | "+c.basis
   ]));
 }else text("No geometric flags supplied. Absence of flags is not evidence of failure-free manufacturing.");
 callout("Scope boundary","The mesh audit does not measure wall thickness, verify self-intersections, generate qualified support geometry or predict physical printing defects.");
 beginPage();
 section("02  Failure-mechanism coverage","Each entry is explicitly marked SCREENED, CALCULATED or NOT ASSESSED. No entry here is a calibrated failure probability.");
 const coverage=input.coverage??[];
 if(coverage.length){
  table(["Failure mechanism","Domain","State"],[87,41,48],
   coverage.map(c=>[c.name,c.category.toUpperCase(),c.state.toUpperCase()]));
 }else text("No failure-coverage results supplied.");
 section("What the model can and cannot conclude");
 callout("SCREENED DOES NOT MEAN LOW RISK","A completed geometric check is evidence about geometry only. It does not validate the absence of lack of fusion, keyholing, hot cracking, recoater collision, residual stresses, or fatigue damage.","warning");
 text("For each unassessed process failure, the input requirements and analytical limitations are documented in the following method register.",{size:8.5});
 beginPage();
 section("03  Engineering application and requirements");
 field("Component function",input.knowledge.componentName);
 field("Assembly / interfaces",input.knowledge.assemblyContext);
 field("Attachments / fixtures",input.knowledge.attachmentNotes);
 field("Requirements / acceptance",input.knowledge.reviewedRequirements);
 section("Source documents and provenance");
 if(!input.knowledge.sources.length)text("No assembly or engineering references were attached. Application and load context remain unknown.",{color:amber});
 else table(["ID / filename","Extraction","Engineer notes"],[85,38,53],
  input.knowledge.sources.map(s=>["["+s.id+"] "+s.name,s.extraction,s.engineerNotes?"Present":"Not recorded"]));
 section("Engineer-reviewed supporting passages");
 if(!input.reviewedEvidence.length)text("No cited passages have been reviewed for applicability to this part.");
 for(const e of input.reviewedEvidence.slice(0,25)){
  ensure(15);
  font(8.5,true,navy);doc.text("["+e.sourceId+" "+nice(e.locator)+"] "+nice(e.category)+"  |  "+nice(e.sourceName).slice(0,60),M,y);y+=5;
  text(e.excerpt.slice(0,450),{size:8,after:1});
  text("Applicability: "+e.reviewerNote.slice(0,250),{size:7.8,color:muted});
 }
 beginPage();
 section("04  Traceable engineering inputs and service analysis");
 if(!input.approvedBindings?.length){
  callout("NO APPROVED SOURCE-TO-INPUT MAPPING",
   "No verified numerical quantities have been mapped to the solver. Do not infer or automatically apply loads, fixtures or material allowables from the STL or unreviewed documents.","warning");
 }else table(["Reference","Approved input","Engineer rationale"],[48,52,76],
  input.approvedBindings.map(b=>["["+b.sourceId+" "+b.locator+"]",b.target+" = "+fmt(b.value,3)+" "+b.normalizedUnit,b.reviewNote]));
 section("Numerical service response");
 if(input.study){
  field("Study reference",input.study.jobId);
  field("Structural model",input.study.structuralModel??"Not calculated");
  field("Max von Mises stress",fmt(input.study.stressMPa,3)+" MPa");
  field("Max displacement",fmt(input.study.displacementMm,4)+" mm");
  field("Thermal model",input.study.thermalModel??"Not calculated");
  field("Steady temperature range",fmt(input.study.temperatureMinC,2)+" to "+fmt(input.study.temperatureMaxC,2)+" C");
 }else callout("NO CURRENT SERVICE MODEL",
  "No traceable, current numerical service study is included for this part. A successful geometry screen is not a structural or thermal load analysis.");
 text("Research fields are idealized and depend on the actual engineer-approved load, fixtures and material properties. They do not include print-induced residual stresses, fatigue allowables, process anisotropy or melt-pool physics.",{size:8.2,color:muted});
 section("Engineering readiness gates");
 table(["Gate","Status","Required review"],[54,28,94],input.readiness.gates.map(g=>[g.title,g.status.toUpperCase(),g.detail]));
 beginPage();
 section("05  Failure mechanism method & evidence register");
 for(const c of coverage){
  const methodLines=linesFor(c.name+" ["+c.state.toUpperCase()+"]",CONTENT,9,true);
  ensure(methodLines.length*5+16);
  font(9,true,navy);doc.text(methodLines,M,y);y+=5*methodLines.length;
  text("Domain: "+c.category+"  |  Method: "+c.method,{size:8,after:1});
  text("Limitations: "+c.limitations,{size:8,color:muted,after:1});
  if(c.state==="not-assessed")text("Needed before assessment: "+c.nextInput,{size:8,color:amber,after:1});
  rule();
 }
 section("Limits and engineering disposition");
 for(const c of input.readiness.caveats)text("- "+c,{size:8.5,after:1});
 callout("RELEASE RESTRICTION",
  "Research only. Printing and service approval require a qualified process, relevant design allowables, verification of critical loads and geometric interfaces, appropriate inspection/test evidence and authorized engineering review.","warning");
 section("Engineer review record (not a certification)");
 kv("Reviewer / organization","_______________________________________");
 kv("Review date","_______________________________________");
 kv("Disposition / next tests","_______________________________________");
 const pages=doc.getNumberOfPages();
 for(let i=1;i<=pages;i++){
  doc.setPage(i);
  doc.setDrawColor(...border);doc.line(M,281,R,281);
  font(7,false,muted);
  doc.text("ORIENTAI  |  Research only - not qualified or approved",M,287);
  doc.text("Page "+i+" / "+pages,R,287,{align:"right"});
 }
 return doc;
}
