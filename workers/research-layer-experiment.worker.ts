import {runRegisteredLayerExperiment} from "@/lib/lpbf-registered-layer-experiment";
import {prepareRegisteredThermalMeshHistory} from "@/lib/lpbf-registered-thermal-mesh-history";
type Request={id:number;stl:ArrayBuffer;expectedPartSha256:string;csv:ArrayBuffer;mechanical?:boolean};
self.onmessage=async(e:MessageEvent<Request>)=>{
 const {id,stl,csv,expectedPartSha256,mechanical}=e.data;
 try{
  const result=await runRegisteredLayerExperiment({stl,csv,expectedPartSha256,
   sliceOptions:{unitScaleToMm:.1,xyPitchMm:.5,layerThicknessMm:.5,translationMm:{x:.5,y:.5,z:.5}},
   conditions:{powerCouplingFraction:.5,beamRadiusMm:.4,densityKgM3:7800,specificHeatJKgK:500,
    powderConductivityWmK:2,solidConductivityWmK:20,convectionWm2K:8,ambientTemperatureC:25,plateTemperatureC:25},
   acknowledgeUnvalidatedResearch:true,captureFrames:true,sourceName:"synthetic-two-layer.csv"});
  const mechanicalResult=mechanical?prepareRegisteredThermalMeshHistory(result,{referenceFrame:1,releaseFrame:2,acknowledgeStressFreeReset:true,material:{youngsModulusMPa:200000,poissonRatio:.3,thermalExpansionPerK:1e-5,yieldStressMPa:400,sourceLabel:"Synthetic mechanical benchmark only"}}):undefined;
  self.postMessage({id,ok:true,result,mechanicalResult});
 }catch(error){self.postMessage({id,ok:false,error:error instanceof Error?error.message:"Research experiment failed"});}
};
