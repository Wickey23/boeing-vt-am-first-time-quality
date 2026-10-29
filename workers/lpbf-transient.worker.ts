/// <reference lib="webworker" />
import {simulateLpbfTransient,validateLpbfInputs,type LpbfInputs} from "../lib/lpbf-transient";

import {simulateMovingSource,validateMovingInputs,type MovingInputs} from "../lib/lpbf-moving-source";
type Request={file:ArrayBuffer;unitScale:number;inputs:LpbfInputs|MovingInputs;partHash:string;mode?:"uniform"|"moving"};
self.onmessage=(event:MessageEvent<Request>)=>{
 try{
  const {file,unitScale,inputs,partHash,mode="uniform"}=event.data;
  if(!/^[a-f0-9]{64}$/.test(partHash))throw Error("Invalid part identity.");
  if(mode!=="uniform"&&mode!=="moving")throw Error("Unknown thermal research mode.");
  if(mode==="moving")validateMovingInputs(inputs as MovingInputs);else validateLpbfInputs(inputs);
  const progress=(done:number,total:number)=>{
   self.postMessage({type:"progress",done,total,partHash});
  };
  const result=mode==="moving"?simulateMovingSource(file,unitScale,inputs as MovingInputs,progress):
   simulateLpbfTransient(file,unitScale,inputs,progress);
  self.postMessage({type:"result",result,partHash});
 }catch(error){
  self.postMessage({type:"error",error:error instanceof Error?error.message:"LPBF transient solve failed"});
 }
};
