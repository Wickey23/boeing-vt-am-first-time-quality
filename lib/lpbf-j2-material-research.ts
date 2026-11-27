/** M11 small-strain isotropic J2 plasticity, radial return with linear
 * isotropic hardening. Material-point kernel only; no global nonlinear solve.
 * Tensor component order xx, yy, zz, xy, yz, xz; shear strains are tensorial.
 */
export type Tensor6=[number,number,number,number,number,number];
export type J2Material={youngsModulusMPa:number;poissonRatio:number;initialYieldMPa:number;hardeningMPa:number;thermalExpansionPerK:number;sourceLabel:string};
export type J2State={plasticStrain:Tensor6;equivalentPlasticStrain:number};
const norm2=(a:Tensor6)=>a[0]**2+a[1]**2+a[2]**2+2*(a[3]**2+a[4]**2+a[5]**2);
const trace=(a:Tensor6)=>a[0]+a[1]+a[2];
const dev=(a:Tensor6)=>a.map((v,i)=>i<3?v-trace(a)/3:v) as Tensor6;
const valid=(a:Tensor6)=>Array.isArray(a)&&a.length===6&&a.every(Number.isFinite);
export const initialJ2State=():J2State=>({plasticStrain:[0,0,0,0,0,0],equivalentPlasticStrain:0});
export function updateJ2Research(m:J2Material,previous:J2State,totalStrain:Tensor6,temperatureC:number,referenceTemperatureC:number){
 const {youngsModulusMPa:E,poissonRatio:nu,initialYieldMPa:Y,hardeningMPa:H,thermalExpansionPerK:alpha}=m;
 if(![E,nu,Y,H,alpha,temperatureC,referenceTemperatureC].every(Number.isFinite)||E<100||E>1e6||nu<=-.9||nu>=.49||
 Y<=0||Y>=.05*E||H<0||H>1e6||alpha<0||alpha>1e-3||!m.sourceLabel.trim()||
 [temperatureC,referenceTemperatureC].some(t=>t<=-273.15||t>3000))throw Error("Invalid J2 research material or temperature.");
 if(!valid(totalStrain)||!valid(previous.plasticStrain)||!Number.isFinite(previous.equivalentPlasticStrain)||
 previous.equivalentPlasticStrain<0||previous.equivalentPlasticStrain>.2||
 Math.abs(trace(previous.plasticStrain))>1e-10||
 Math.sqrt(2/3*norm2(previous.plasticStrain))>previous.equivalentPlasticStrain+1e-10)
  throw Error("Invalid J2 strain history.");
 const thermal=alpha*(temperatureC-referenceTemperatureC);
 if(Math.abs(thermal)>.05||totalStrain.some(v=>Math.abs(v)>.05))throw Error("J2 small-strain bound exceeded.");
 const G=E/(2*(1+nu)),K=E/(3*(1-2*nu));
 const trialElastic=totalStrain.map((v,i)=>v-previous.plasticStrain[i]-(i<3?thermal:0)) as Tensor6;
 const pressure=K*trace(trialElastic);
 const trialDev=dev(trialElastic).map(v=>2*G*v) as Tensor6;
 const qTrial=Math.sqrt(1.5*norm2(trialDev)),oldYield=Y+H*previous.equivalentPlasticStrain;
 const delta=Math.max(0,(qTrial-oldYield)/(3*G+H));
 const increment=trialDev.map(v=>delta>0?1.5*delta*v/qTrial:0) as Tensor6;
 const plasticStrain=previous.plasticStrain.map((v,i)=>v+increment[i]) as Tensor6;
 const equivalentPlasticStrain=previous.equivalentPlasticStrain+delta;
 const stress=trialDev.map((v,i)=>v*(delta>0?1-3*G*delta/qTrial:1)+(i<3?pressure:0)) as Tensor6;
 const vonMisesMPa=Math.sqrt(1.5*norm2(dev(stress)));
 const yieldStressMPa=Y+H*equivalentPlasticStrain;
 const elasticStrain=totalStrain.map((v,i)=>v-plasticStrain[i]-(i<3?thermal:0)) as Tensor6;
 const tolerance=1e-8*Math.max(1,yieldStressMPa,qTrial);
 if(!valid(stress)||!valid(elasticStrain)||Math.abs(trace(plasticStrain))>1e-10||
 vonMisesMPa>yieldStressMPa+tolerance||(delta>0&&Math.abs(vonMisesMPa-yieldStressMPa)>tolerance)||
 equivalentPlasticStrain>.2||plasticStrain.some(v=>Math.abs(v)>.05)||elasticStrain.some(v=>Math.abs(v)>.05))
  throw Error("J2 return mapping or research strain bound failed.");
 return {scope:"UNVALIDATED_J2_MATERIAL_POINT" as const,productionActivationAuthorized:false as const,
  state:{plasticStrain,equivalentPlasticStrain},stressMPa:stress,elasticStrain,thermalStrain:thermal,vonMisesMPa,yieldStressMPa,
  plasticIncrement:delta,plasticDissipationMPa:Y*delta,
  limitations:["Constant isotropic material properties and linear isotropic hardening. No creep, phase-dependent mechanics, damage or calibrated alloy data.",
   "Local prescribed strain update only, not a globally equilibrated nonlinear mesh."]};
}
