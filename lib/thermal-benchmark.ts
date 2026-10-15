/** Research-only transient 1D conduction benchmark: insulated base, convective top.
 * Finite volume explicit integration with stability-limited timestep.
 * This is NOT LPBF melt pool/process simulation. No residual stress or distortion is computed.
 */
export type ThermalInput={heightMm:number;layers:number;initialTempC:number;baseTempC:number;ambientTempC:number;peakAppliedTempC:number;conductivityWmK:number;densityKgM3:number;heatCapacityJkgK:number;convectionWm2K:number;durationSeconds:number};
export function simulateThermal(p:ThermalInput){
 const vals=Object.values(p);if(vals.some(v=>typeof v!=="number"||!Number.isFinite(v)))throw Error("All thermal inputs must be finite");
 if(p.heightMm<=0||p.heightMm>5000||p.layers<1||p.layers>1e7||p.initialTempC< -273||p.ambientTempC< -273||p.baseTempC< -273||p.peakAppliedTempC< -273||p.peakAppliedTempC>4000||p.conductivityWmK<=0||p.densityKgM3<=0||p.heatCapacityJkgK<=0||p.convectionWm2K<0||p.durationSeconds<=0||p.durationSeconds>36000)throw Error("Thermal parameters out of bounds");
 const nodes=40,dx=p.heightMm/1000/(nodes-1),alpha=p.conductivityWmK/(p.densityKgM3*p.heatCapacityJkgK);
 const stable=0.35*dx*dx/alpha;const steps=Math.ceil(p.durationSeconds/stable);
 if(steps>100000)throw Error("High-resolution thermal run exceeds compute budget; reduce duration or increase part height");
 const dt=p.durationSeconds/steps,Fourier=alpha*dt/(dx*dx),Bi=p.convectionWm2K*dx/p.conductivityWmK;
 let t=Array(nodes).fill(p.initialTempC) as number[];t[0]=p.baseTempC;t[nodes-1]=p.peakAppliedTempC;
 const frames:Array<{timeSeconds:number;minTempC:number;maxTempC:number;meanTempC:number;profileC:number[]}>=[];const snapshot=(time:number)=>{frames.push({timeSeconds:Number(time.toFixed(3)),minTempC:Math.min(...t),maxTempC:Math.max(...t),meanTempC:t.reduce((a,b)=>a+b,0)/nodes,profileC:t.map(v=>Number(v.toFixed(2)))})};
 snapshot(0);
 for(let k=0;k<steps;k++){const next=t.slice();next[0]=p.baseTempC;
 for(let i=1;i<nodes-1;i++)next[i]=t[i]+Fourier*(t[i+1]-2*t[i]+t[i-1]);
 next[nodes-1]=t[nodes-1]+2*Fourier*(t[nodes-2]-t[nodes-1]-Bi*(t[nodes-1]-p.ambientTempC));
 t=next;if((k+1)%Math.max(1,Math.floor(steps/12))===0||k===steps-1)snapshot((k+1)*dt);
 }
 return {model:"TRANSIENT_1D_CONDUCTION_BENCHMARK",qualification:"RESEARCH_ONLY",units:{length:"mm",temperature:"C",time:"s"},input:p,physics:{alphaM2S:alpha,fourier:Fourier,biotCell:Bi,nodes,steps},frames,limitations:["One-dimensional homogeneous conduction; the lateral dimensions and true part topology are not represented.","Fixed base temperature, initial heated surface and convection idealizations; no moving laser, scanning path, fusion, latent heat or powder-bed contacts.","This result cannot predict metal AM build failure, residual stress, distortion, porosity, support failure, structural strength or first-time quality.","Material properties are user supplied and constant in temperature; no aerospace qualification is inferred."]};
}
