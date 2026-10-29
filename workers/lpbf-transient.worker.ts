/// <reference lib="webworker" />
import {simulateLpbfTransient,validateLpbfInputs,type LpbfInputs} from "../lib/lpbf-transient";

type Request={file:ArrayBuffer;unitScale:number;inputs:LpbfInputs;partHash:string};
self.onmessage=(event:MessageEvent<Request>)=>{
 try{
  const {file,unitScale,inputs,partHash}=event.data;
  if(!/^[a-f0-9]{64}$/.test(partHash))throw Error("Invalid part identity.");
  validateLpbfInputs(inputs);
  const result=simulateLpbfTransient(file,unitScale,inputs,(done,total)=>{
   self.postMessage({type:"progress",done,total,partHash});
  });
  self.postMessage({type:"result",result,partHash});
 }catch(error){
  self.postMessage({type:"error",error:error instanceof Error?error.message:"LPBF transient solve failed"});
 }
};
