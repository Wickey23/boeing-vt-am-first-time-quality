/** Linear Euler-Bernoulli cantilever benchmark. Not FEM and not an AM-process prediction. */
export type BeamInput={lengthMm:number;widthMm:number;thicknessMm:number;elasticModulusGPa:number;forceN:number;allowableStressMPa:number};
export function analyzeCantilever(p:BeamInput){
 if(Object.values(p).some(x=>!Number.isFinite(x)))throw new Error("Provide finite numerical inputs.");
 if(p.lengthMm<=0||p.widthMm<=0||p.thicknessMm<=0||p.elasticModulusGPa<=0||p.allowableStressMPa<=0||p.forceN<0)throw new Error("Dimensions, modulus and allowable must be positive; force must be nonnegative.");
 if(Math.max(p.lengthMm,p.widthMm,p.thicknessMm)>10000||p.forceN>1e7)throw new Error("Input exceeds research benchmark bounds.");
 const L=p.lengthMm/1000,b=p.widthMm/1000,h=p.thicknessMm/1000,E=p.elasticModulusGPa*1e9,F=p.forceN;
 const I=b*Math.pow(h,3)/12;
 const displacementMm=F*Math.pow(L,3)/(3*E*I)*1000;
 const maxStressMPa=F*L*h/(2*I)/1e6;
 const utilization=maxStressMPa/p.allowableStressMPa;
 const samples=Array.from({length:31},(_,i)=>{const x=L*i/30;return{xMm:x*1000,deflectionMm:F*x*x*(3*L-x)/(6*E*I)*1000,bendingStressMPa:F*(L-x)*h/(2*I)/1e6}});
 return {model:"EULER_BERNOULLI_CANTILEVER_ANALYTICAL_V1",status:"RESEARCH_ONLY_NOT_QUALIFIED",input:p,results:{secondMomentM4:I,tipDisplacementMm:displacementMm,maxBendingStressMPa:maxStressMPa,utilization,passesIllustrativeAllowable:utilization<=1},samples,limitations:["Rectangular prismatic cantilever, linear elastic small-deflection beam theory only.","Assumes a perfectly clamped end and vertical point load at the free tip.","No mesh, geometric complexity, plasticity, fatigue, buckling, notch stresses or additive-manufacturing anisotropy.","Illustrative allowable is user supplied, not a qualified aerospace material allowable.","Not a finite-element analysis; does not assess print orientation or first-time build quality."]};
}