/** M08 effective external thermal resistance network, not resolved powder/substrate physics.
 * Cell center -> half cell -> external equivalent conduction path -> reservoir.
 */
export type ExternalThermalBoundaryInput={
 powderConductivityWmK:number;powderPathMm:number;powderReservoirTemperatureC:number;
 substrateConductivityWmK:number;substrateThicknessMm:number;contactResistanceM2KW:number;
 sourceLabel:string;
};
export function createExternalThermalBoundary(input:ExternalThermalBoundaryInput){
 const p={...input};
 if(![p.powderConductivityWmK,p.substrateConductivityWmK].every(v=>Number.isFinite(v)&&v>=.01&&v<=1000)||
 ![p.powderPathMm,p.substrateThicknessMm].every(v=>Number.isFinite(v)&&v>0&&v<=1000)||
 !Number.isFinite(p.contactResistanceM2KW)||p.contactResistanceM2KW<0||p.contactResistanceM2KW>1||
 !Number.isFinite(p.powderReservoirTemperatureC)||p.powderReservoirTemperatureC<=-273.15||p.powderReservoirTemperatureC>5000||!p.sourceLabel.trim())
 throw Error("Invalid external thermal resistance parameters or source label.");
 const powderR=p.powderPathMm/1000/p.powderConductivityWmK;
 const substrateR=p.substrateThicknessMm/1000/p.substrateConductivityWmK+p.contactResistanceM2KW;
 function coefficient(k:number,halfCellM:number,externalR:number){
  if(!Number.isFinite(k)||k<=0||!Number.isFinite(halfCellM)||halfCellM<=0)throw Error("Invalid cell thermal resistance.");
  return 1/(halfCellM/k+externalR);
 }
 return {parameters:p,powderResistanceM2KW:powderR,substrateResistanceM2KW:substrateR,
 powderCoefficient:(k:number,halfCellM:number)=>coefficient(k,halfCellM,powderR),
 substrateCoefficient:(k:number,halfCellM:number)=>coefficient(k,halfCellM,substrateR)};
}
