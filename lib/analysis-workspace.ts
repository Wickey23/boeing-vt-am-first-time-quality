import {assertAnalysisIdentity,sha256} from "./study-identity";
import type {ServicePlan} from "./service-plan";
import type {Journey} from "./engineering-journey";
import type {MeshAudit} from "./stl-mesh-audit";
import type {ServiceSetup} from "./service-load";
import type {StructuralField} from "./voxel-structural";
import type {ThermalField} from "./voxel-thermal";
import type {OrientationRequest,analyzeOrientations} from './orientation-engine';
export const DEFAULT_SETTINGS={x:250,y:250,z:300,overhangDeg:45,support:55,height:30,contact:15,searchSamples:72,unitScale:1,layerHeightMm:.04,recoatSeconds:8,scanSecondsPerLayer:20,machineHourlyRate:100,material:'Ti-6Al-4V (user selection; no physical properties inferred)',criticalFaces:''};
export type Settings=typeof DEFAULT_SETTINGS;
export type Analysis=ReturnType<typeof analyzeOrientations>&{servicePlan?:ServicePlan;structuralCases?:Record<string,{candidateId:string;runId:string;inputKey:string;field:StructuralField}>;serviceSetup?:ServiceSetup;meshAudit?:MeshAudit;meshSensitivity?:Partial<Record<"thermal"|"structural",{runId:string;candidateId:string;input:object;comparison:object}>>;source:{fileName:string;fileHashSha256:string;byteSize:number};generatedAt:string;algorithm:string;runId:string;configuration:Settings;structural?:{candidateId:string;runId:string;field:StructuralField};thermal?:{candidateId:string;runId:string;field:ThermalField}};
export function requestFor(s:Settings):OrientationRequest{return {machine:{x:s.x,y:s.y,z:s.z},overhangDeg:s.overhangDeg,weights:{support:s.support,height:s.height,contact:s.contact},searchSamples:s.searchSamples,unitScale:s.unitScale,layerHeightMm:s.layerHeightMm,recoatSeconds:s.recoatSeconds,scanSecondsPerLayer:s.scanSecondsPerLayer,machineHourlyRate:s.machineHourlyRate,criticalFaces:s.criticalFaces.trim()?s.criticalFaces.split(',').map(x=>Number(x.trim())):[]};}
export type Snapshot={recoveryNotice?:string;schema:1;journey?:Journey;servicePlan?:ServicePlan;projectName?:string;file:File|null;settings:Settings;result:Analysis|null;selected:string|null};
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('orientai-local-workspace',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function verifyWorkspace(snapshot:Snapshot):Promise<Snapshot>{
 if(!snapshot.result)return snapshot;
 try{
  if(!snapshot.file)throw Error('Saved analysis has no source STL.');
  assertAnalysisIdentity(snapshot.result,{...DEFAULT_SETTINGS,...snapshot.settings},await sha256(await snapshot.file.arrayBuffer()),snapshot.file.size);
  if(snapshot.journey&&snapshot.journey.process!=='PBF_LB_METAL')throw Error('Saved LPBF analysis has a different process.');
  return {...snapshot,selected:snapshot.result.candidates.some(c=>c.id===snapshot.selected)?snapshot.selected:null};
 }catch(error){return {...snapshot,result:null,selected:null,recoveryNotice:'Saved results were set aside because their inputs could not be verified. Your part and settings were retained; run the assessment again. '+(error instanceof Error?error.message:'')};}
}
export async function loadWorkspace():Promise<Snapshot|undefined>{
 const db=await database();
 try{
  const saved=await new Promise<Snapshot|undefined>((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').get('active');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  if(!saved||saved.schema!==1)return saved;
  const verified=await verifyWorkspace(saved);
  if(saved.result&&!verified.result)await new Promise<void>((resolve,reject)=>{const t=db.transaction('workspace','readwrite');t.objectStore('workspace').put(saved,'recovery-'+saved.result!.runId);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});
  return verified;
 }finally{db.close();}
}
export async function saveWorkspace(value:Snapshot){const db=await database();try{await new Promise<void>((resolve,reject)=>{const t=db.transaction('workspace','readwrite');t.objectStore('workspace').put(value,'active');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}finally{db.close();}}
