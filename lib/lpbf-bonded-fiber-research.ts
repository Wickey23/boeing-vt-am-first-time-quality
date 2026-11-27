/** M11 bonded parallel axial fibers, common total strain, no bending.
 * Prescribed temperature histories; ideal plasticity and axial force equilibrium.
 * This is a synthetic mechanical benchmark, not geometry-resolved print stress.
 */
import type {AxialThermoplasticMaterial} from "./lpbf-axial-thermoplastic-research";
export type AxialFiber={id:string;areaMm2:number;material:AxialThermoplasticMaterial};
export type BondedFiberStep={timeSeconds:number;temperaturesC:number[];constraint:"fixed-strain"|"zero-resultant-force";prescribedTotalStrain?:number};
export function runBondedFiberResearch(fibers:AxialFiber[],history:BondedFiberStep[]){
 if(fibers.length<2||fibers.length>100||history.length<2||history.length>1000||
 new Set(fibers.map(f=>f.id)).size!==fibers.length)throw Error("Invalid bounded bonded fiber study.");
 const fs=fibers.map(f=>({...f,material:{...f.material}}));
 for(const f of fs){
  const m=f.material;
  if(!f.id.trim()||!Number.isFinite(f.areaMm2)||f.areaMm2<=0||f.areaMm2>1e6||
   !Number.isFinite(m.youngsModulusMPa)||m.youngsModulusMPa<100||m.youngsModulusMPa>1e6||
   !Number.isFinite(m.yieldStressMPa)||m.yieldStressMPa<=0||m.yieldStressMPa>=m.youngsModulusMPa*.05||
   !Number.isFinite(m.thermalExpansionPerK)||m.thermalExpansionPerK<0||m.thermalExpansionPerK>1e-3||
   !Number.isFinite(m.referenceTemperatureC)||m.referenceTemperatureC<=-273.15||m.referenceTemperatureC>3000||!m.sourceLabel.trim())
   throw Error("Invalid fiber material or area.");
 }
 if(history[0].timeSeconds!==0||history[0].temperaturesC.some((t,i)=>t!==fs[i]?.material.referenceTemperatureC)||
 (history[0].constraint==="fixed-strain"&&history[0].prescribedTotalStrain!==0))
  throw Error("Initial fibers must be stress-free at reference temperature and time zero.");
 const plastic=fs.map(()=>0),accumulated=fs.map(()=>0);
 const forceScale=fs.reduce((s,f)=>s+f.areaMm2*f.material.yieldStressMPa,0),tol=1e-10*forceScale;
 let previous=-1;
 const steps=history.map(h=>{
  if(!Number.isFinite(h.timeSeconds)||h.timeSeconds<=previous||h.temperaturesC.length!==fs.length||
   h.temperaturesC.some(t=>!Number.isFinite(t)||t<=-273.15||t>3000))throw Error("Invalid fiber thermal history.");
  previous=h.timeSeconds;
  const thermal=fs.map((f,i)=>f.material.thermalExpansionPerK*(h.temperaturesC[i]-f.material.referenceTemperatureC));
  const trial=(e:number,i:number)=>fs[i].material.youngsModulusMPa*(e-thermal[i]-plastic[i]);
  const stressAt=(e:number,i:number)=>Math.max(-fs[i].material.yieldStressMPa,Math.min(fs[i].material.yieldStressMPa,trial(e,i)));
  const force=(e:number)=>fs.reduce((s,f,i)=>s+f.areaMm2*stressAt(e,i),0);
  let e:number;
  if(h.constraint==="fixed-strain"){
   if(h.prescribedTotalStrain===undefined||!Number.isFinite(h.prescribedTotalStrain))throw Error("Fixed strain requires finite prescribed strain.");
   e=h.prescribedTotalStrain;
  }else if(h.constraint==="zero-resultant-force"){
   if(h.prescribedTotalStrain!==undefined)throw Error("Free axial equilibrium cannot also prescribe strain.");
   let lo=-.05,hi=.05;
   if(force(lo)>0||force(hi)<0)throw Error("No axial equilibrium within small-strain bound.");
   for(let j=0;j<90;j++){const mid=(lo+hi)/2;if(force(mid)>0)hi=mid;else lo=mid;}
   e=(lo+hi)/2;
   if(Math.abs(force(e))>tol)throw Error("Axial force equilibrium failed.");
   // Reject a zero-force plastic plateau: release displacement is nonunique.
   if(!fs.some((f,i)=>Math.abs(trial(e,i))<f.material.yieldStressMPa*(1-1e-9)))
    throw Error("Nonunique or fully yielded free-strain equilibrium; result withheld.");
  }else throw Error("Unsupported bonded fiber constraint.");
  const states=fs.map((f,i)=>{
   const stressMPa=stressAt(e,i),elasticStrain=stressMPa/f.material.youngsModulusMPa;
   const increment=(trial(e,i)-stressMPa)/f.material.youngsModulusMPa;
   plastic[i]+=increment;accumulated[i]+=Math.abs(increment);
   if(Math.max(Math.abs(e),Math.abs(thermal[i]),Math.abs(plastic[i]),Math.abs(elasticStrain))>.05)
    throw Error("Small-strain fiber bound exceeded.");
   if(Math.abs(e-thermal[i]-plastic[i]-elasticStrain)>1e-10)throw Error("Fiber strain compatibility failed.");
   return {id:f.id,temperatureC:h.temperaturesC[i],thermalStrain:thermal[i],plasticStrain:plastic[i],
    accumulatedPlasticStrain:accumulated[i],elasticStrain,stressMPa,forceN:stressMPa*f.areaMm2};
  });
  return {timeSeconds:h.timeSeconds,constraint:h.constraint,commonTotalStrain:e,
   resultantForceN:states.reduce((s,f)=>s+f.forceN,0),fibers:states};
 });
 return {scope:"UNVALIDATED_BONDED_AXIAL_FIBER_BENCHMARK" as const,productionActivationAuthorized:false as const,
  fibers:fs,steps,limitations:["Parallel fibers are perfectly bonded with common axial strain and bending suppressed.",
  "Prescribed temperatures, constant properties and ideal plasticity. No deposition activation, 3D equilibrium, support removal or print qualification.",
  "Zero axial resultant does not imply zero local stress or a traction-free three-dimensional part."]};
}
