/** Portable ORIENTAI team handoff. Archive files are data, never executable code.
 * All parsing is browser-local and bounded; this is NOT cloud collaboration or a
 * storage option approved for controlled aerospace technical information.
 */
import {zipSync,unzipSync,strToU8,strFromU8} from "fflate";
import {exportPortableProject,importPortableProject} from "./project-transfer";
import {restoreKnowledge,type ProjectKnowledge} from "./copilot-context";
import type {ServicePlan} from "./service-plan";
import type {Settings,Analysis} from "./analysis-workspace";
import type {Journey} from "./engineering-journey";
const MAX_ARCHIVE_BYTES=70_000_000;
const MAX_DOCUMENT_BYTES=3*1024*1024;
const MAX_CONTEXT_BYTES=1_500_000;
const MAX_PROJECT_BYTES=30_000_000;
const MAX_DOCS=12;
type RefEntry={id:string;name:string;size:number;sha256:string|null;included:boolean};
type Manifest={format:"ORIENTAI_TEAM_BUNDLE_V1";createdAt:string;
 partSha256:string;references:RefEntry[];privacy:"user-authorized-local-export";
 limitations:string[]};
const hash=async(bytes:Uint8Array)=>{
 const copy=new ArrayBuffer(bytes.byteLength);new Uint8Array(copy).set(bytes);
 const digest=await crypto.subtle.digest("SHA-256",copy);
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
};
const hex64=(s:string)=>/^[a-f0-9]{64}$/i.test(s);
function assertDocId(id:string){if(!/^D[1-9]\d{0,3}$/.test(id))throw Error("Invalid reference identifier.");}
function safeArrayBuffer(data:Uint8Array):ArrayBuffer{
 const buffer=new ArrayBuffer(data.byteLength);new Uint8Array(buffer).set(data);return buffer;
}
export type BundleExportInput={
 projectName:string;file:File;settings:Settings;result:Analysis|null;
 selected:string|null;servicePlan:ServicePlan;journey:Journey;
 knowledge:ProjectKnowledge;attachments:ReadonlyMap<string,File>;
};
export async function exportEngineeringTeamBundle(input:BundleExportInput):Promise<{bytes:ArrayBuffer;included:number;notesOnly:number}>{
 if(input.knowledge.sources.length>MAX_DOCS)throw Error("Too many reference documents.");
 const portable=await exportPortableProject(input.projectName,input.file,input.settings,input.result,input.selected,input.servicePlan,input.journey);
 const project=JSON.parse(portable) as {fileSha256:string};
 const context=JSON.stringify(input.knowledge);
 if(context.length>MAX_CONTEXT_BYTES||portable.length>MAX_PROJECT_BYTES)throw Error("Project context exceeds safe export limits.");
 const refs:RefEntry[]=[];
 const files:Record<string,Uint8Array>={"project.json":strToU8(portable),"context.json":strToU8(context)};
 let included=0;
 for(const source of input.knowledge.sources){
  assertDocId(source.id);
  const attached=input.attachments.get(source.id);
  if(attached){
   if(attached.name!==source.name||attached.size!==source.size||attached.size>MAX_DOCUMENT_BYTES)
    throw Error("Reference attachment does not match current source metadata: "+source.name);
   const bytes=new Uint8Array(await attached.arrayBuffer());
   refs.push({id:source.id,name:source.name,size:source.size,sha256:await hash(bytes),included:true});
   files["references/"+source.id+".bin"]=bytes;included++;
  }else{
   refs.push({id:source.id,name:source.name,size:source.size,sha256:null,included:false});
  }
 }
 const manifest:Manifest={
  format:"ORIENTAI_TEAM_BUNDLE_V1",createdAt:new Date().toISOString(),
  partSha256:project.fileSha256,references:refs,privacy:"user-authorized-local-export",
  limitations:["Contains unverified engineering source material and optional original reference bytes.",
   "Use only with approved, non-controlled information; do not share Boeing proprietary or export-controlled files without authorization.",
   "Numerical outputs remain research estimates and do not constitute print approval."]
 };
 files["manifest.json"]=strToU8(JSON.stringify(manifest));
 const zip=zipSync(files,{level:1});
 if(zip.byteLength>MAX_ARCHIVE_BYTES)throw Error("Compressed bundle exceeds safe export limit.");
 return {bytes:safeArrayBuffer(zip),included,notesOnly:refs.length-included};
}
export async function importEngineeringTeamBundle(upload:File){
 if(!upload.size||upload.size>MAX_ARCHIVE_BYTES||!upload.name.toLowerCase().endsWith(".zip"))
  throw Error("Choose an ORIENTAI ZIP bundle under 70 MB.");
 const data=new Uint8Array(await upload.arrayBuffer());
 const allow=/^(manifest\.json|project\.json|context\.json|references\/D[1-9]\d{0,3}\.bin)$/;
 const seen=new Set<string>();
 let totalSize=0;
 const extracted=unzipSync(data,{filter:file=>{
  if(!allow.test(file.name)||seen.has(file.name))throw Error("Unexpected or duplicate archive entry.");
  seen.add(file.name);
  const max=file.name==="project.json"?MAX_PROJECT_BYTES:
   file.name==="context.json"?MAX_CONTEXT_BYTES:
   file.name==="manifest.json"?50000:MAX_DOCUMENT_BYTES;
  if(file.originalSize<0||file.originalSize>max)throw Error("Archive entry exceeds safe size.");
  totalSize+=file.originalSize;
  if(totalSize>55_000_000)throw Error("Uncompressed bundle exceeds safe limit.");
  return true;
 }});
 for(const entry of ["manifest.json","project.json","context.json"]){
  if(!extracted[entry])throw Error("Incomplete ORIENTAI bundle: missing "+entry);
 }
 const manifest=JSON.parse(strFromU8(extracted["manifest.json"])) as Manifest;
 if(manifest?.format!=="ORIENTAI_TEAM_BUNDLE_V1"||
  !hex64(manifest.partSha256)||!Array.isArray(manifest.references)||manifest.references.length>MAX_DOCS)
  throw Error("Invalid ORIENTAI bundle manifest.");
 const project=await importPortableProject(strFromU8(extracted["project.json"]));
 const array=new Uint8Array(await project.file.arrayBuffer());
 const digest=await hash(array);
 if(digest!==manifest.partSha256.toLowerCase())throw Error("STL fingerprint does not match the bundle manifest.");
 const context=restoreKnowledge(JSON.parse(strFromU8(extracted["context.json"])),digest);
 if(context.partKey!==digest||context.sources.length!==manifest.references.length)
  throw Error("Bundle context does not match its part and reference manifest.");
 const attachments=new Map<string,File>(),ids=new Set<string>();
 for(const ref of manifest.references){
  if(!ref||typeof ref.id!=="string")throw Error("Invalid reference.");
  assertDocId(ref.id);
  if(ids.has(ref.id))throw Error("Duplicate document ID.");ids.add(ref.id);
  const source=context.sources.find(s=>s.id===ref.id);
  if(!source||ref.name!==source.name||ref.size!==source.size)throw Error("Reference metadata mismatch.");
  const raw=extracted["references/"+ref.id+".bin"];
  if(ref.included){
   if(!raw||raw.length!==ref.size||!ref.sha256||!hex64(ref.sha256))throw Error("Missing or invalid source bytes: "+ref.name);
   if(await hash(raw)!==ref.sha256.toLowerCase())throw Error("Reference checksum mismatch: "+ref.name);
   attachments.set(ref.id,new File([safeArrayBuffer(raw)],ref.name));
  }else if(raw)throw Error("Unexpected reference bytes for notes-only document.");
 }
 if(Object.keys(extracted).some(key=>key.startsWith("references/")&&!ids.has(key.slice(11,-4))))
  throw Error("Unlisted reference attachment.");
 return {project,context,attachments,manifest};
}
