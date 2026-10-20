"use client";
import {createContext,useContext,useEffect,useRef,useState,useCallback} from 'react';
import type {StructuralField} from "@/lib/voxel-structural";
import type {ThermalField} from "@/lib/voxel-thermal";
import {DEFAULT_SETTINGS,requestFor,loadWorkspace,saveWorkspace,type Settings,type Analysis} from '@/lib/analysis-workspace';
type Context={attachMeshSensitivity:(kind:"thermal"|"structural",runId:string,candidateId:string,data:{input:object;comparison:object})=>void;projectName:string;setProjectName:(name:string)=>void;restoreProject:(snapshot:{projectName:string;file:File;settings:Settings;result:Analysis|null;selected:string|null})=>void;file:File|null;settings:Settings;result:Analysis|null;selected:string|null;busy:boolean;progress:number;error:string;storageError:string;ready:boolean;upload:(f:File|null)=>void;update:<K extends keyof Settings>(k:K,v:Settings[K])=>void;select:(id:string)=>void;retry:()=>void;cancel:()=>void;clear:()=>void;attachStructural:(runId:string,candidateId:string,field:StructuralField)=>void;attachThermal:(runId:string,candidateId:string,field:ThermalField)=>void;clearThermal:()=>void;clearStructural:()=>void};
const C=createContext<Context|null>(null);
export function AnalysisProvider({children}:{children:React.ReactNode}){
 const [projectName,setProjectName]=useState("Untitled part");const [file,setFile]=useState<File|null>(null),[settings,setSettings]=useState<Settings>(DEFAULT_SETTINGS),[result,setResult]=useState<Analysis|null>(null),[selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[storageError,setStorageError]=useState(''),[ready,setReady]=useState(false),[attempt,setAttempt]=useState(0);
 const generation=useRef(0),stop=useRef<()=>void>(()=>{}),restored=useRef(false),saveQueue=useRef(Promise.resolve());
 const cancel=useCallback(()=>{generation.current++;stop.current();setBusy(false);setProgress(0);},[]);
 const invalidate=()=>{cancel();setResult(null);setSelected(null);setError('');};
 useEffect(()=>{let active=true;loadWorkspace().then(s=>{if(!active)return;if(s?.schema===1){
 const validFile=s.file===null||(typeof File!=="undefined"&&s.file instanceof File&&s.file.name.toLowerCase().endsWith('.stl'));
 const validSettings=!!s.settings&&typeof s.settings==='object'&&Number.isFinite(s.settings.x)&&Number.isFinite(s.settings.y)&&Number.isFinite(s.settings.z);
 const validResult=s.result===null||(!!s.result&&typeof s.result==='object'&&typeof s.result.runId==='string'&&Array.isArray(s.result.candidates)&&s.result.candidates.every(c=>c&&typeof c.id==='string'&&c.rotation&&Number.isFinite(c.score))&&s.result.source&&typeof s.result.source.fileHashSha256==='string');
 if(validFile&&validSettings&&validResult){
  setProjectName(s.projectName||"Untitled part");setFile(s.file);setSettings({...DEFAULT_SETTINGS,...s.settings});
  setResult(s.result);setSelected(s.selected&&s.result?.candidates.some(c=>c.id===s.selected)?s.selected:null);
  restored.current=!!s.result;
 }else{setStorageError('Old or incompatible local workspace was ignored. Start a new analysis; no server copy of the STL exists.');}
}}).catch(()=>{if(active)setStorageError('Local workspace could not be restored. This session remains usable.');}).finally(()=>{if(active)setReady(true);});return()=>{active=false;stop.current();};},[]);
 useEffect(()=>{if(!ready)return;const snapshot={schema:1 as const,projectName,file,settings,result,selected};saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>saveWorkspace(snapshot)).then(()=>setStorageError('')).catch(()=>setStorageError('Local save failed (storage unavailable or full). Export the report before closing this tab.'));},[ready,file,settings,result,selected,projectName]);
 useEffect(()=>{
  if(!ready||!file)return;
  if(restored.current){restored.current=false;return;}
  const seq=++generation.current;let worker:Worker|undefined;let timeout:ReturnType<typeof setTimeout>|undefined;let disposed=false;
  const cleanup=()=>{disposed=true;clearTimeout(timer);clearTimeout(timeout);worker?.terminate();};stop.current=cleanup;
  const timer=setTimeout(async()=>{setBusy(true);setProgress(0);setError('');setResult(null);setSelected(null);
   try{const bytes=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);if(disposed||seq!==generation.current)return;
    const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
    worker=new Worker(new URL('../workers/orientation.worker.ts',import.meta.url));
    timeout=setTimeout(()=>{if(seq===generation.current){cleanup();setBusy(false);setError('Analysis exceeded 120 seconds. Reduce search samples or mesh size, then retry.');}},120000);
    worker.onmessage=e=>{if(disposed||seq!==generation.current)return;if(typeof e.data.progress==='number'){setProgress(e.data.progress);return;}clearTimeout(timeout);worker?.terminate();setBusy(false);if(!e.data.ok){setError(e.data.error||'Analysis failed');return;}const analysis:Analysis={...e.data.analysis,source:{fileName:file.name,fileHashSha256:hash,byteSize:file.size},runId:crypto.randomUUID(),configuration:{...settings}};setResult(analysis);setProgress(1);setSelected(analysis.candidates.find(c=>c.feasible)?.id??analysis.candidates[0]?.id??null);};
    worker.onerror=()=>{cleanup();if(seq===generation.current){setBusy(false);setError('Local analysis worker failed. Retry or use a smaller mesh.');}};
    worker.postMessage({file:bytes,settings:requestFor(settings)},[bytes]);
   }catch(e){cleanup();if(seq===generation.current){setBusy(false);setError(e instanceof Error?e.message:'Analysis failed');}}
  },500);return cleanup;
 },[ready,file,settings,attempt]);
 const upload=(f:File|null)=>{invalidate();if(f&&(!f.name.toLowerCase().endsWith('.stl')||f.size>20*1024*1024||!f.size)){setFile(null);setError('Select a nonempty STL up to 20 MB. STEP is not supported.');return;}setFile(f);setAttempt(x=>x+1);};
 const update=<K extends keyof Settings>(k:K,v:Settings[K])=>{invalidate();setSettings(s=>({...s,[k]:v}));};
 const retry=()=>{invalidate();setAttempt(x=>x+1);};
 const attachStructural=(runId:string,candidateId:string,field:StructuralField)=>setResult(r=>r?.runId===runId?{...r,structural:{runId,candidateId,field}}:r);
 const attachThermal=(runId:string,candidateId:string,field:ThermalField)=>setResult(r=>r?.runId===runId?{...r,thermal:{runId,candidateId,field}}:r);
 const attachMeshSensitivity:Context["attachMeshSensitivity"]=(kind,runId,candidateId,data)=>setResult(r=>r?.runId===runId?{...r,meshSensitivity:{...r.meshSensitivity,[kind]:{runId,candidateId,...data}}}:r);
 const clearThermal=()=>setResult(r=>r?{...r,thermal:undefined,meshSensitivity:{...r.meshSensitivity,thermal:undefined}}:r);
 const clearStructural=()=>setResult(r=>r?{...r,structural:undefined,meshSensitivity:{...r.meshSensitivity,structural:undefined}}:r);
 const restoreProject=(snapshot:{projectName:string;file:File;settings:Settings;result:Analysis|null;selected:string|null})=>{invalidate();restored.current=!!snapshot.result;setProjectName(snapshot.projectName);setFile(snapshot.file);setSettings({...DEFAULT_SETTINGS,...snapshot.settings});setResult(snapshot.result);setSelected(snapshot.selected);setError("");};
 const clear=()=>{invalidate();setFile(null);setSettings(DEFAULT_SETTINGS);setProjectName("Untitled part");};
 return <C.Provider value={{attachMeshSensitivity,projectName,setProjectName,restoreProject,file,settings,result,selected,busy,progress,error,storageError,ready,upload,update,select:setSelected,retry,cancel,clear,attachThermal,attachStructural,clearThermal,clearStructural}}>{children}</C.Provider>;
}
export function useAnalysis(){const value=useContext(C);if(!value)throw new Error('AnalysisProvider missing');return value;}
