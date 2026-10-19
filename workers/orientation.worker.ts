import {auditSTL} from "../lib/stl-mesh-audit";
/// <reference lib="webworker" />
import {analyzeOrientations,type OrientationRequest} from "../lib/orientation-engine";
type Request={file:ArrayBuffer;settings:OrientationRequest;layerHeightMm?:number};
self.onmessage=async (event:MessageEvent<Request>)=>{
 try {
 const {file,settings,layerHeightMm}=event.data;
 const meshAudit=auditSTL(file,settings.unitScale??1);
 const result=analyzeOrientations(file,{...settings,layerHeightMm:layerHeightMm??settings.layerHeightMm},(done,total)=>self.postMessage({progress:done/total}));
 if(layerHeightMm!==undefined){if(!Number.isFinite(layerHeightMm)||layerHeightMm<.01||layerHeightMm>1)throw new Error("Layer height must be 0.01–1 mm");}
 const candidates=result.candidates.map(c=>({...c,...(layerHeightMm!==undefined?{estimatedLayers:Math.ceil(c.buildHeightMm/layerHeightMm)}:{})}));
 const reply={ok:true,analysis:{...result,meshAudit,candidates,generatedAt:new Date().toISOString(),algorithm:"local-orientation-engine-v0.3.0"}};
 self.postMessage(reply);
 }catch(e){self.postMessage({ok:false,error:e instanceof Error?e.message:"Could not analyze this STL."});}
};
