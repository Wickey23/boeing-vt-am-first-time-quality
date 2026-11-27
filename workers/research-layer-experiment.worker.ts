import {runRegisteredLayerExperiment} from "@/lib/lpbf-registered-layer-experiment";
type Request={id:number;stl:ArrayBuffer;expectedPartSha256:string;csv:ArrayBuffer};
self.onmessage=async(e:MessageEvent<Request>)=>{
 const {id,stl,csv,expectedPartSha256}=e.data;
 try{
  const result=await runRegisteredLayerExperiment({stl,csv,expectedPartSha256,
   sliceOptions:{unitScaleToMm:.1,xyPitchMm:.5,layerThicknessMm:.5,translationMm:{x:.5,y:.5,z:.5}},
   conditions:{powerCouplingFraction:.5,beamRadiusMm:.4,densityKgM3:7800,specificHeatJKgK:500,
    powderConductivityWmK:2,solidConductivityWmK:20,convectionWm2K:8,ambientTemperatureC:25,plateTemperatureC:25},
   acknowledgeUnvalidatedResearch:true,captureFrames:true,sourceName:"synthetic-two-layer.csv"});
  self.postMessage({id,ok:true,result});
 }catch(error){self.postMessage({id,ok:false,error:error instanceof Error?error.message:"Research experiment failed"});}
};
