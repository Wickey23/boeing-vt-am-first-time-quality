/** M11 independent uniaxial material-point research benchmark.
 * Small-strain linear elasticity, constant alpha/E/yield, elastic-perfectly plastic
 * return mapping, prescribed temperature and total axial strain. No geometry,
 * multiaxial equilibrium, supports, creep, hardening or LPBF validation.
 */
export type AxialThermoplasticMaterial={youngsModulusMPa:number;yieldStressMPa:number;thermalExpansionPerK:number;referenceTemperatureC:number;sourceLabel:string};
export type AxialThermoplasticStep={timeSeconds:number;temperatureC:number;constraint:"fixed-strain"|"traction-free";prescribedTotalStrain?:number};
export function runAxialThermoplasticResearch(material:AxialThermoplasticMaterial,history:AxialThermoplasticStep[]){
 const m={...material};
 if(!Number.isFinite(m.youngsModulusMPa)||m.youngsModulusMPa<100||m.youngsModulusMPa>1e6||
 !Number.isFinite(m.yieldStressMPa)||m.yieldStressMPa<=0||m.yieldStressMPa>=m.youngsModulusMPa*.05||
 !Number.isFinite(m.thermalExpansionPerK)||m.thermalExpansionPerK<0||m.thermalExpansionPerK>1e-3||
 !Number.isFinite(m.referenceTemperatureC)||m.referenceTemperatureC<=-273.15||m.referenceTemperatureC>3000||!m.sourceLabel.trim())
  throw Error("Invalid uniaxial research material or missing source label.");
 if(!Array.isArray(history)||history.length<2||history.length>10000)throw Error("Bounded prescribed thermal history required.");
 if(history[0].timeSeconds!==0||history[0].temperatureC!==m.referenceTemperatureC||
 (history[0].constraint==="fixed-strain"&&history[0].prescribedTotalStrain!==0))
  throw Error("History must start stress-free at reference temperature and time zero.");
 let plastic=0,accumulatedPlastic=0,priorTime=-1;
 const steps=history.map(h=>{
  if(!Number.isFinite(h.timeSeconds)||h.timeSeconds<=priorTime||!Number.isFinite(h.temperatureC)||h.temperatureC<=-273.15||h.temperatureC>3000)
   throw Error("Invalid or unordered prescribed thermomechanical history.");
  priorTime=h.timeSeconds;
  const thermal=m.thermalExpansionPerK*(h.temperatureC-m.referenceTemperatureC);
  let total:number,stress:number,increment=0;
  if(h.constraint==="traction-free"){
   if(h.prescribedTotalStrain!==undefined)throw Error("Traction-free step cannot also prescribe strain.");
   total=thermal+plastic;stress=0;
  }else if(h.constraint==="fixed-strain"){
   if(h.prescribedTotalStrain===undefined||!Number.isFinite(h.prescribedTotalStrain))throw Error("Fixed-strain step requires explicit total strain.");
   total=h.prescribedTotalStrain;
   const trial=m.youngsModulusMPa*(total-thermal-plastic);
   stress=Math.max(-m.yieldStressMPa,Math.min(m.yieldStressMPa,trial));
   increment=(trial-stress)/m.youngsModulusMPa;
   plastic+=increment;accumulatedPlastic+=Math.abs(increment);
  }else throw Error("Unsupported axial constraint.");
  const elastic=stress/m.youngsModulusMPa;
  if(Math.max(Math.abs(total),Math.abs(thermal),Math.abs(plastic),Math.abs(elastic))>.05)
   throw Error("Small-strain research bound exceeded.");
  if(Math.abs(total-thermal-plastic-elastic)>1e-10)throw Error("Axial strain decomposition failed.");
  return {timeSeconds:h.timeSeconds,temperatureC:h.temperatureC,constraint:h.constraint,totalStrain:total,thermalStrain:thermal,elasticStrain:elastic,plasticStrain:plastic,accumulatedPlasticStrain:accumulatedPlastic,plasticIncrement:increment,stressMPa:stress};
 });
 return {scope:"UNVALIDATED_UNIAXIAL_THERMOPLASTIC_BENCHMARK" as const,productionActivationAuthorized:false as const,material:m,steps,
  limitations:["Prescribed thermal history and one axial material point only. No part-level equilibrium, deformation field, or geometry mapping.",
  "Constant material properties and perfect plasticity; no creep, hardening, phase transformation, annealing or stress relaxation.",
  "Traction-free release is a local zero-stress idealization, not a build-plate removal or distortion prediction."]};
}
