/** M08 bounded, reversible equilibrium enthalpy closure.
 * Constant solid/liquid sensible heat capacities and a linear mushy interval.
 * No material defaults, kinetics, irreversible densification or fluid flow.
 */
export type PhaseEnthalpyInput={solidusC:number;liquidusC:number;latentHeatJKg:number;solidSpecificHeatJKgK:number;liquidSpecificHeatJKgK:number;sourceLabel:string};
export function createPhaseEnthalpyModel(input:PhaseEnthalpyInput){
 const p={...input};
 if(![p.solidusC,p.liquidusC,p.latentHeatJKg,p.solidSpecificHeatJKgK,p.liquidSpecificHeatJKgK].every(Number.isFinite)||
 p.solidusC<0||p.liquidusC>3000||p.liquidusC-p.solidusC<1||p.latentHeatJKg<0||p.latentHeatJKg>1e6||
 [p.solidSpecificHeatJKgK,p.liquidSpecificHeatJKgK].some(c=>c<50||c>5000)||!p.sourceLabel.trim())
  throw Error("Invalid research enthalpy parameters or missing source label.");
 const {solidusC:s,liquidusC:l,solidSpecificHeatJKgK:cs,liquidSpecificHeatJKgK:cl,latentHeatJKg:L}=p;
 // Reference enthalpy is zero at 0 C. Linear latent fraction within [s,l].
 const hs=cs*s,cm=cs+L/(l-s),hl=hs+cm*(l-s);
 function enthalpyJKg(t:number){
  if(!Number.isFinite(t))throw Error("Nonfinite phase temperature.");
  return t<=s?cs*t:t<l?hs+cm*(t-s):hl+cl*(t-l);
 }
 function state(h:number){
  if(!Number.isFinite(h))throw Error("Nonfinite specific enthalpy.");
  const temperatureC=h<=hs?h/cs:h<hl?s+(h-hs)/cm:l+(h-hl)/cl;
  return {temperatureC,liquidFraction:Math.max(0,Math.min(1,(temperatureC-s)/(l-s)))};
 }
 return {parameters:p,minimumHeatCapacityJKgK:Math.min(cs,cl),enthalpyJKg,state};
}
