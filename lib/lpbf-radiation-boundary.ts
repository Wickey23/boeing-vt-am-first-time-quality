/** Bounded gray-surface radiative exchange for the research solver.
 * Environment is an imposed isothermal reservoir, not a resolved chamber.
 */
export const STEFAN_BOLTZMANN=5.670374419e-8;
export type RadiationInput={emissivity:number;environmentTemperatureC:number;maximumTemperatureC:number;sourceLabel:string};
export function createRadiationBoundary(input:RadiationInput){
 const p={...input};
 if(![p.emissivity,p.environmentTemperatureC,p.maximumTemperatureC].every(Number.isFinite)||p.emissivity<0||p.emissivity>1||
  p.environmentTemperatureC<=-273.15||p.maximumTemperatureC>5000||p.maximumTemperatureC<p.environmentTemperatureC||!p.sourceLabel.trim())
  throw Error("Invalid radiation parameters or missing source label.");
 function assertTemperature(t:number){
  if(!Number.isFinite(t)||t<=-273.15||t>p.maximumTemperatureC)throw Error("Temperature outside bounded radiation range; research result withheld.");
 }
 const envK=p.environmentTemperatureC+273.15;
 return {parameters:p,assertTemperature,maximumLinearizedWm2K:4*p.emissivity*STEFAN_BOLTZMANN*(p.maximumTemperatureC+273.15)**3,
  fluxWm2(t:number){assertTemperature(t);const k=t+273.15;return p.emissivity*STEFAN_BOLTZMANN*(k-envK)*(k+envK)*(k*k+envK*envK);}};
}
