import {validateServiceSetup,type ServiceSetup} from "./service-load";

export type StudyKind="geometry"|"service-structural"|"steady-conduction";
export type StudyState="needs-input"|"ready"|"not-supported";
export type StudySpec={kind:StudyKind;name:string;status:StudyState;reason:string;scope:string};
export type RunbookInput={
 filePresent:boolean;geometryConfirmed:boolean;process:string;
 runStructural:boolean;runThermal:boolean;loadsReviewed:boolean;requirementsDocumented:boolean;
 serviceInput:ServiceSetup;thermalInputReviewed:boolean;
 thermalInput:{conductivityWmK:number;baseTemperatureC:number;topFluxWm2:number;resolution:number};
};
export function buildEngineeringRunbook(input:RunbookInput):{allowed:boolean;steps:StudySpec[];limitations:string[]}{
 const lpbf=input.process==="PBF_LB_METAL";
 const geometryReady=lpbf&&input.filePresent&&input.geometryConfirmed;
 let loadValid=false;
 try{
  validateServiceSetup(input.serviceInput);
  loadValid=[input.serviceInput.forceXN,input.serviceInput.forceYN??0,input.serviceInput.forceZN].some(v=>Math.abs(v)>0);
 }catch{/* Validate before scheduling worker, not after. */}
 const structuralReady=geometryReady&&input.loadsReviewed&&input.requirementsDocumented&&loadValid;
 const t=input.thermalInput;
 const thermalValid=Number.isFinite(t.conductivityWmK)&&t.conductivityWmK>0&&t.conductivityWmK<=10000&&
  Number.isFinite(t.baseTemperatureC)&&t.baseTemperatureC>=-273.15&&
  Number.isFinite(t.topFluxWm2)&&t.topFluxWm2>=0&&t.topFluxWm2<=1e8&&
  Number.isInteger(t.resolution)&&t.resolution>=6&&t.resolution<=24;
 const thermalReady=geometryReady&&input.thermalInputReviewed&&thermalValid;
 const steps:StudySpec[]=[
  {kind:"geometry",name:"LPBF geometric orientation screening",status:!lpbf?"not-supported":geometryReady?"ready":"needs-input",
   reason:!lpbf?"Arbitrary-part DED path planning is not implemented.":geometryReady?"Confirmed STL and process inputs.":"Upload an STL and confirm units and dimensions.",
   scope:"Actual STL: sample orientations, geometric envelope, support and build-time proxies."}
 ];
 if(input.runStructural)steps.push({
  kind:"service-structural",name:"Idealized service-load FEM",status:!lpbf?"not-supported":structuralReady?"ready":"needs-input",
  reason:!lpbf?"Only original-STL LPBF research projects supported.":structuralReady?"Reviewed original-part end-face force and elastic inputs.":"Confirm named service requirements, real force/fixture assumptions and nonzero valid loads.",
  scope:"Isotropic linear-elastic voxel numerical model; no strength, fatigue or process-induced anisotropy."
 });
 if(input.runThermal)steps.push({
  kind:"steady-conduction",name:"Steady thermal conduction",status:!lpbf?"not-supported":thermalReady?"ready":"needs-input",
  reason:!lpbf?"No DED transient thermal solver exists.":thermalReady?"Engineer-reviewed flux, boundary temperature and conductivity.":"Confirm thermal assumptions and enter physically valid values.",
  scope:"Solid steady conduction, NOT a laser heating or printing-distortion model."
 });
 return {allowed:steps.every(step=>step.status==="ready"),steps,
  limitations:[
   "No solver output is a flight qualification, print acceptance or first-time-quality probability.",
   "Isotropic service FEM does not rank mechanical strength solely by rigid build orientation.",
   "No transient deposition thermal history, calibrated residual stress or dimensional distortion model is run."
  ]};
}
