import {restoreServicePlan,type ServicePlan} from "./service-plan";
import {DEFAULT_SETTINGS} from "./analysis-workspace";
import type {Analysis,Settings} from "./analysis-workspace";
export type PortableProject={servicePlan?:ServicePlan;format:"ORIENTAI_PROJECT_V1";name:string;createdAt:string;fileName:string;fileSha256:string;stlBase64:string;settings:Settings;result:Analysis|null;selected:string|null};
const hex=(buf:ArrayBuffer)=>Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,"0")).join("");
const hash=async(bytes:ArrayBuffer)=>hex(await crypto.subtle.digest("SHA-256",bytes));
export async function exportPortableProject(name:string,file:File,settings:Settings,result:Analysis|null,selected:string|null,servicePlan?:ServicePlan){
 if(!file.name.toLowerCase().endsWith(".stl")||!file.size||file.size>20_000_000)throw Error("Export requires an STL up to 20 MB");
 const bytes=await file.arrayBuffer(),octets=new Uint8Array(bytes);let binary="";
 for(let i=0;i<octets.length;i+=32768)binary+=String.fromCharCode(...octets.subarray(i,i+32768));
 const saved:PortableProject={format:"ORIENTAI_PROJECT_V1",name:name.trim().slice(0,120)||"Untitled part",createdAt:new Date().toISOString(),fileName:file.name,fileSha256:await hash(bytes),stlBase64:btoa(binary),settings,result,selected,servicePlan:restoreServicePlan(servicePlan,result)};
 return JSON.stringify(saved);
}
export async function importPortableProject(text:string){
 if(text.length>32_000_000)throw Error("Project file exceeds safe import limit");
 const data:PortableProject=JSON.parse(text);
 if(data?.format!=="ORIENTAI_PROJECT_V1"||typeof data.stlBase64!=="string"||!data.stlBase64.length||typeof data.fileName!=="string"||!data.fileName.toLowerCase().endsWith(".stl")||typeof data.fileSha256!=="string"||!/^[0-9a-f]{64}$/i.test(data.fileSha256))throw Error("Not a supported ORIENTAI project export");
 const binary=atob(data.stlBase64);if(binary.length>20_000_000||binary.length===0)throw Error("Invalid STL byte length");
 const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const digest=await hash(bytes.buffer);if(digest.toLowerCase()!==data.fileSha256.toLowerCase())throw Error("Project STL checksum mismatch; import stopped");
 const s=data.settings;
 if(!s||!Number.isFinite(s.x)||!Number.isFinite(s.y)||!Number.isFinite(s.z)||!Number.isFinite(s.unitScale)||s.unitScale<=0)throw Error("Invalid manufacturing configuration");
 for(const [k,v] of Object.entries(DEFAULT_SETTINGS)){const actual=(s as unknown as Record<string,unknown>)[k];if(typeof actual!==typeof v||(typeof actual==='number'&&!Number.isFinite(actual)))throw Error('Invalid configuration field: '+k);}
 if(s.x<=0||s.y<=0||s.z<=0||s.layerHeightMm<=0||s.searchSamples<0||s.searchSamples>360||!Number.isInteger(s.searchSamples))throw Error('Configuration out of range');
 const r=data.result;
 if(r&&Object.keys(DEFAULT_SETTINGS).some(k=>(r.configuration as unknown as Record<string,unknown>)?.[k]!==(s as unknown as Record<string,unknown>)[k]))throw Error('Saved results use a different manufacturing configuration');
 const valid=r===null||(r&&Array.isArray(r.candidates)&&r.candidates.every(c=>c&&typeof c.id==="string"&&c.rotation&&Number.isFinite(c.score))&&typeof r.runId==="string"&&r.source?.fileHashSha256===digest);
 if(!valid)throw Error("Analysis result doesn't match imported part or has an incompatible schema");

 const file=new File([bytes],data.fileName,{type:"model/stl"});
 return {servicePlan:restoreServicePlan(data.servicePlan,r),name:typeof data.name==="string"?data.name.slice(0,120):"Imported part",file,settings:s,result:r,selected:r&&r.candidates.some(c=>c.id===data.selected)?data.selected:null};
}
