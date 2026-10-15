/// <reference lib="webworker" />
import {analyzeOrientations} from "../lib/orientation-engine";
type Request={file:ArrayBuffer;settings:{machine:{x:number;y:number;z:number};overhangDeg:number;weights:{support:number;height:number;contact:number}};layerHeightMm?:number};
self.onmessage=async (event:MessageEvent<Request>)=>{
 try {
 const {file,settings,layerHeightMm}=event.data;
 const result=analyzeOrientations(file,settings);
 if(layerHeightMm!==undefined){if(!Number.isFinite(layerHeightMm)||layerHeightMm<.01||layerHeightMm>1)throw new Error("Layer height must be 0.01–1 mm");}
 const candidates=result.candidates.map(c=>({...c,...(layerHeightMm!==undefined?{estimatedLayers:Math.ceil(c.buildHeightMm/layerHeightMm)}:{})}));
 const reply={ok:true,analysis:{...result,candidates,generatedAt:new Date().toISOString(),algorithm:"local-orientation-engine-v0.2.0"}};
 self.postMessage(reply);
 }catch(e){self.postMessage({ok:false,error:e instanceof Error?e.message:"Could not analyze this STL."});}
};
