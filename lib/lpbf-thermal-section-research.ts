/** M11 elastic section equilibrium with prescribed thermal and inelastic strains.
 * Plane sections remain plane. Prescribed inelastic strains are inputs, not
 * inferred plastic history; elastic release exceeding yield is rejected.
 */
import type {AxialThermoplasticMaterial} from "./lpbf-axial-thermoplastic-research";
export type SectionFiber={id:string;areaMm2:number;zMm:number;material:AxialThermoplasticMaterial;temperatureC:number;prescribedInelasticStrain:number};
export type SectionConstraint={kind:"fixed";axialStrainAtOrigin:number;curvaturePerMm:number}|{kind:"free"};
export function solveThermalSectionResearch(fibers:SectionFiber[],constraint:SectionConstraint){
 if(!Array.isArray(fibers)||fibers.length<2||fibers.length>100||new Set(fibers.map(f=>f.id)).size!==fibers.length)
  throw Error("Invalid bounded section fibers.");
 const fs=fibers.map(f=>({...f,material:{...f.material}}));
 const data=fs.map(f=>{
  const m=f.material;
  if(!f.id.trim()||!Number.isFinite(f.areaMm2)||f.areaMm2<=0||f.areaMm2>1e6||
   !Number.isFinite(f.zMm)||Math.abs(f.zMm)>100000||
   !Number.isFinite(m.youngsModulusMPa)||m.youngsModulusMPa<100||m.youngsModulusMPa>1e6||
   !Number.isFinite(m.yieldStressMPa)||m.yieldStressMPa<=0||m.yieldStressMPa>=m.youngsModulusMPa*.05||
   !Number.isFinite(m.thermalExpansionPerK)||m.thermalExpansionPerK<0||m.thermalExpansionPerK>1e-3||
   !Number.isFinite(m.referenceTemperatureC)||m.referenceTemperatureC<=-273.15||m.referenceTemperatureC>3000||
   !Number.isFinite(f.temperatureC)||f.temperatureC<=-273.15||f.temperatureC>3000||
   !Number.isFinite(f.prescribedInelasticStrain)||Math.abs(f.prescribedInelasticStrain)>.05||!m.sourceLabel.trim())
    throw Error("Invalid section geometry, material or eigenstrain.");
  const thermal=m.thermalExpansionPerK*(f.temperatureC-m.referenceTemperatureC);
  if(Math.abs(thermal)>.05)throw Error("Small-strain thermal bound exceeded.");
  return {f,thermal,eigen:thermal+f.prescribedInelasticStrain,w:f.areaMm2*m.youngsModulusMPa};
 });
 const sumW=data.reduce((s,d)=>s+d.w,0),center=data.reduce((s,d)=>s+d.w*d.f.zMm,0)/sumW;
 const span=Math.max(...fs.map(f=>Math.abs(f.zMm-center)));
 if(span<1e-6)throw Error("Section requires distinct through-height fiber coordinates.");
 const stiffness=data.reduce((s,d)=>s+d.w*((d.f.zMm-center)/span)**2,0);
 if(stiffness/sumW<1e-10)throw Error("Ill-conditioned section bending stiffness.");
 let centeredStrain:number,curvaturePerMm:number;
 if(constraint.kind==="free"){
  centeredStrain=data.reduce((s,d)=>s+d.w*d.eigen,0)/sumW;
  curvaturePerMm=data.reduce((s,d)=>s+d.w*((d.f.zMm-center)/span)*d.eigen,0)/stiffness/span;
 }else if(constraint.kind==="fixed"){
  if(!Number.isFinite(constraint.axialStrainAtOrigin)||!Number.isFinite(constraint.curvaturePerMm))
   throw Error("Fixed section requires explicit finite strain and curvature.");
  curvaturePerMm=constraint.curvaturePerMm;
  centeredStrain=constraint.axialStrainAtOrigin+curvaturePerMm*center;
 }else throw Error("Unsupported section constraint.");
 const states=data.map(({f,thermal,eigen})=>{
  const totalStrain=centeredStrain+curvaturePerMm*(f.zMm-center);
  const elasticStrain=totalStrain-eigen;
  const stressMPa=f.material.youngsModulusMPa*elasticStrain;
  if(Math.max(Math.abs(totalStrain),Math.abs(elasticStrain))>.05)throw Error("Small-strain section bound exceeded.");
  if(Math.abs(stressMPa)>f.material.yieldStressMPa*(1+1e-9))throw Error("Elastic section would yield; nonlinear bending solution required.");
  const forceN=stressMPa*f.areaMm2;
  return {id:f.id,zMm:f.zMm,areaMm2:f.areaMm2,temperatureC:f.temperatureC,totalStrain,thermalStrain:thermal,
   prescribedInelasticStrain:f.prescribedInelasticStrain,elasticStrain,stressMPa,forceN,momentAboutCenterNmm:forceN*(f.zMm-center)};
 });
 const resultantForceN=states.reduce((s,f)=>s+f.forceN,0);
 const resultantMomentAboutCenterNmm=states.reduce((s,f)=>s+f.momentAboutCenterNmm,0);
 const scale=fs.reduce((s,f)=>s+f.areaMm2*f.material.yieldStressMPa,0);
 if(constraint.kind==="free"&&(Math.abs(resultantForceN)>1e-9*scale||Math.abs(resultantMomentAboutCenterNmm)>1e-9*scale*span))
  throw Error("Free section force or moment equilibrium failed.");
 return {scope:"UNVALIDATED_ELASTIC_THERMAL_SECTION_BENCHMARK" as const,productionActivationAuthorized:false as const,
  constraint,stiffnessCentroidMm:center,axialStrainAtCentroid:centeredStrain,axialStrainAtOrigin:centeredStrain-curvaturePerMm*center,
  curvaturePerMm,resultantForceN,resultantMomentAboutCenterNmm,fibers:states,
  limitations:["Section fibers are idealized point-area quadrature with plane-section compatibility; no 3D deformation or supports.",
   "Prescribed inelastic strain is not a predicted plastic history. Any elastic trial exceeding yield is rejected.",
   "Curvature is local section curvature, not a part displacement or validated print distortion."]};
}
