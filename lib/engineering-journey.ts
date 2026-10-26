import {DED_WALL_EXAMPLE,planDedWall,type DedWallInput} from "./ded-planning";
export const STEPS=["part","requirements","process","options","studies","decision","report"] as const;
export type JourneyStep=typeof STEPS[number];
export type ProcessKind="PBF_LB_METAL"|"DED_LB_WIRE"|"DED_LB_POWDER";
export type Journey={
  schema:2;
  mode:"uploaded"|"ded-example";
  process:ProcessKind;
  step:JourneyStep;
  confirmedFileName:string|null;
  confirmedUnitScale:number|null;
  dedInput:DedWallInput;
};
export function newJourney():Journey {
 return {schema:2,mode:"uploaded",process:"PBF_LB_METAL",step:"part",confirmedFileName:null,confirmedUnitScale:null,dedInput:{...DED_WALL_EXAMPLE}};
}
export function restoreJourney(value:unknown):Journey{
 const fallback=newJourney();
 if(!value||typeof value!=="object")return fallback;
 const o=value as Partial<Journey>;
 if(o.schema!==2||!STEPS.includes(o.step as JourneyStep)||
 (o.mode!=="uploaded"&&o.mode!=="ded-example")||
 !["PBF_LB_METAL","DED_LB_WIRE","DED_LB_POWDER"].includes(o.process as string))return fallback;
 let dedInput=DED_WALL_EXAMPLE;
 try{if(o.dedInput){planDedWall(o.dedInput);dedInput=o.dedInput;}}catch{/* Reject invalid persisted DED inputs. */}
 // An uploaded part is not silently promoted to a DED deposition path study.
 return {
  schema:2,mode:o.mode,process:o.process as ProcessKind,step:o.step as JourneyStep,
  confirmedFileName:typeof o.confirmedFileName==="string"?o.confirmedFileName:null,
  confirmedUnitScale:Number.isFinite(o.confirmedUnitScale)?o.confirmedUnitScale!:null,
  dedInput,
 };
}
export function switchProcess(current:Journey,process:ProcessKind):Journey {
 if(process===current.process)return current;
 return {...current,process,
  dedInput:process==="DED_LB_WIRE"||process==="DED_LB_POWDER"?{...current.dedInput,process}:current.dedInput};
}
export function completedPart(j:Journey,file:File|null,unitScale:number){
 return j.mode==="ded-example" ||
 (!!file&&j.confirmedFileName===file.name&&j.confirmedUnitScale===unitScale);
}
export function allowsGeometryRanking(j:Journey){return j.mode==="uploaded"&&j.process==="PBF_LB_METAL";}
export function dedExample(j:Journey){return j.mode==="ded-example"&&j.process!=="PBF_LB_METAL";}
export const STEP_LABELS:Record<JourneyStep,string>={
 part:"Part",requirements:"Requirements",process:"Print process",
 options:"Options",studies:"Simulations",decision:"Decision",report:"Report"
};
