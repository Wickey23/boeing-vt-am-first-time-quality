/** Temperature-dependent effective conductivities. No extrapolation or alloy defaults.
 * The two branches follow the existing heuristic exposure state, not phase fraction.
 */
export type ConductivityPoint={temperatureC:number;powderWmK:number;exposedWmK:number};
export type ConductivityTable={materialLabel:string;sourceLabel:string;sourceKind:"synthetic"|"reviewed-user-data";points:ConductivityPoint[]};
export function createConductivityTable(input:ConductivityTable){
 if(!input.materialLabel.trim()||!input.sourceLabel.trim()||!["synthetic","reviewed-user-data"].includes(input.sourceKind)||!Array.isArray(input.points)||input.points.length<2||input.points.length>200)
  throw Error("Explicit conductivity material, source and 2–200 points required.");
 const points=input.points.map(p=>({...p}));
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(!Number.isFinite(p.temperatureC)||p.temperatureC< -273.15||p.temperatureC>5000||(i>0&&p.temperatureC<=points[i-1].temperatureC)||
    ![p.powderWmK,p.exposedWmK].every(v=>Number.isFinite(v)&&v>=.01&&v<=1000)||p.powderWmK>p.exposedWmK)
   throw Error("Invalid or unordered conductivity table points.");
 }
 const minTemperatureC=points[0].temperatureC,maxTemperatureC=points.at(-1)!.temperatureC;
 function at(temperatureC:number,exposed:boolean){
  if(!Number.isFinite(temperatureC)||temperatureC<minTemperatureC||temperatureC>maxTemperatureC)
   throw Error("Temperature outside supplied conductivity data range; research result withheld.");
  const key=exposed?"exposedWmK":"powderWmK";
  let hi=1;
  while(hi<points.length-1&&temperatureC>points[hi].temperatureC)hi++;
  const a=points[hi-1],b=points[hi],f=(temperatureC-a.temperatureC)/(b.temperatureC-a.temperatureC);
  return a[key]+f*(b[key]-a[key]);
 }
 return {parameters:{...input,points},minTemperatureC,maxTemperatureC,maximumWmK:Math.max(...points.map(p=>p.exposedWmK)),at};
}
