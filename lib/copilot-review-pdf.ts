/** Reproducible research review for the original uploaded STL, independent
 * of LPBF / DED printing path availability. Export is not engineering approval.
 */
import type {ProjectKnowledge} from "./copilot-context";
import type {ReviewedEvidence} from "./engineering-evidence";
import type {EngineeringReadiness} from "./engineering-readiness";
export type CopilotPdfInputs={
 projectName:string;partName:string;partSha256:string;process:string;
 unitsConfirmed:boolean;createdAt:string;knowledge:ProjectKnowledge;
 reviewedEvidence:ReviewedEvidence[];readiness:EngineeringReadiness;
 study?:{jobId:string;stressMPa?:number;displacementMm?:number;
 temperatureMinC?:number;temperatureMaxC?:number;
 structuralModel?:string;thermalModel?:string};
};
export async function createCopilotReviewPDF(input:CopilotPdfInputs){
 const {jsPDF}=await import("jspdf");
 const pdf=new jsPDF({unit:"mm",format:"a4",compress:true});
 const left=17,right=193,usable=right-left,bottom=275;
 let y=20;
 const printable=(value:string)=>value.replace(/[^\x20-\x7e\n]/g," ").replace(/ {2,}/g," ").trim();
 const newline=(height=4)=>{if(y+height>bottom){pdf.addPage();y=20;}};
 const paragraph=(value:string,fontSize=9,color:[number,number,number]=[32,48,63])=>{
  pdf.setFont("helvetica","normal");pdf.setFontSize(fontSize);pdf.setTextColor(...color);
  const lines=pdf.splitTextToSize(printable(value),usable) as string[];
  for(const line of lines){newline(5);pdf.text(line,left,y);y+=4.6;}y+=2;
 };
 const title=(value:string)=>{newline(13);pdf.setTextColor(20,49,70);pdf.setFont("helvetica","bold");pdf.setFontSize(13);pdf.text(printable(value),left,y);y+=9;};
 const meta=(key:string,value:string)=>paragraph(key+": "+value,9);
 pdf.setFont("helvetica","bold");pdf.setFontSize(17);pdf.setTextColor(19,54,82);pdf.text("ORIENTAI - Engineering Evidence Review",left,y);y+=9;
 pdf.setFontSize(10);pdf.setTextColor(158,62,30);pdf.text("RESEARCH ONLY - NOT QUALIFIED OR APPROVED",left,y);y+=8;
 meta("Project",input.projectName);meta("STL",input.partName);
 meta("Geometry SHA-256",input.partSha256);
 meta("Process label",input.process);
 meta("Units and dimensions",input.unitsConfirmed?"Engineer-confirmed":"NOT CONFIRMED");
 meta("Exported",input.createdAt);
 title("Part role and assembly context");
 meta("Component",input.knowledge.componentName||"Not documented");
 meta("Assembly",input.knowledge.assemblyContext||"Not documented");
 meta("Fixture and attachment notes",input.knowledge.attachmentNotes||"Not documented");
 meta("Recorded design requirements",input.knowledge.reviewedRequirements||"Not documented");
 title("Document provenance");
 if(!input.knowledge.sources.length)paragraph("No engineering references attached to this browser project.");
 for(const source of input.knowledge.sources){
  paragraph("["+source.id+"] "+source.name+" | extraction: "+source.extraction+
    " | "+(source.engineerNotes?"engineer notes present":"no engineer notes"),9);
 }
 title("Engineer-reviewed reference passages");
 if(!input.reviewedEvidence.length)paragraph("No current source excerpts were reviewed for applicability.");
 for(const e of input.reviewedEvidence.slice(0,30)){
  paragraph("["+e.sourceId+" "+e.locator+"] "+e.category+" | "+e.sourceName,9);
  paragraph(e.excerpt.slice(0,450));
  paragraph("Review: "+e.reviewerNote.slice(0,350),8,[75,84,95]);
 }
 title("Simulated original-part service response");
 if(input.study){
  meta("Study job",input.study.jobId);
  meta("Linear-elastic model",input.study.structuralModel??"not available");
  meta("Maximum von Mises stress",Number.isFinite(input.study.stressMPa) ? input.study.stressMPa!.toPrecision(6)+" MPa" : "not calculated");
  meta("Maximum displacement",Number.isFinite(input.study.displacementMm) ? input.study.displacementMm!.toPrecision(6)+" mm" : "not calculated");
  meta("Steady conduction model",input.study.thermalModel??"not available");
  meta("Steady temperature",Number.isFinite(input.study.temperatureMinC)&&Number.isFinite(input.study.temperatureMaxC)?
   input.study.temperatureMinC!.toPrecision(6)+" to "+input.study.temperatureMaxC!.toPrecision(6)+" C":"not calculated");
 }else paragraph("No current numerical service study was completed for this STL and process setup.");
 paragraph("Simplified numerical fields depend on idealized fixtures and engineer-entered material/thermal inputs. They do not establish strength allowables, fatigue, build anisotropy, residual stresses or manufacturing deformation.");
 title("Evidence readiness - NOT a quality pass");
 for(const gate of input.readiness.gates){
  paragraph(gate.title+" ["+gate.status+"]: "+gate.detail);
 }
 title("Known limitations");
 for(const caveat of input.readiness.caveats)paragraph("- "+caveat);
 paragraph("Any real aerospace manufacturing approval requires applicable qualified processes, independently verified material properties, laboratory/inspection evidence and authorized engineering review.",9,[140,55,35]);
 const total=pdf.getNumberOfPages();
 for(let i=1;i<=total;i++){
  pdf.setPage(i);pdf.setFontSize(8);pdf.setTextColor(111,123,130);
  pdf.text("ORIENTAI research evidence | Page "+i+" / "+total,17,289);
 }
 return pdf;
}
