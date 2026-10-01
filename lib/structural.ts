export type StructuralMaterialId="aluminum"|"titanium";
export type WingBoxInput={span:number;chord:number;height:number;skin:number;spar:number;rib:number;ribCount:number;material:StructuralMaterialId;lift:number;tipForce:number;bendingMoment:number;torque:number;safetyFactor:number};
export type StructuralResult={massKg:number;skinMassFraction:number;rootBendingStressMPa:number;torsionalShearMPa:number;combinedStressMPa:number;tipDeflectionMm:number;utilization:number;status:"PASS"|"REVIEW";recommendations:string[];assumptions:string[]};
const props={aluminum:{density:2.70e-6,E:70000,yield:250},titanium:{density:4.43e-6,E:114000,yield:830}};
export function analyzeWingBox(p:WingBoxInput):StructuralResult{
 const m=props[p.material], b=p.chord,h=p.height,L=p.span,ts=p.skin,tw=p.spar;
 const skinVol=2*b*L*ts+2*h*L*ts; const sparVol=2*h*L*tw; const ribVol=p.ribCount*b*h*p.rib*.18;
 const massKg=(skinVol+sparVol+ribVol)*m.density;
 const skinMassFraction=skinVol/(skinVol+sparVol+ribVol);
 const M=p.bendingMoment+p.lift*L/2+p.tipForce*L;
 const I=Math.max(1,2*b*ts*Math.pow(h/2,2)+2*(tw*Math.pow(h,3)/12));
 const sigma=Math.abs(M)*(h/2)/I;
 const enclosed=Math.max(1,(b-ts*2)*(h-ts*2)); const tau=Math.abs(p.torque)/(2*enclosed*Math.max(ts,.01));
 const combined=Math.sqrt(sigma*sigma+3*tau*tau);
 const delta=(Math.abs(p.lift)*Math.pow(L,4)/(8*m.E*I))+(Math.abs(p.tipForce)*Math.pow(L,3)/(3*m.E*I));
 const utilization=combined*p.safetyFactor/m.yield;
 const rec:string[]=[];
 if(utilization<.55)rec.push("Structure is lightly utilized in this screening model; evaluate reducing skin/stiffener mass while preserving buckling margin.");
 if(utilization>.9)rec.push("Combined stress utilization is high; retain or add material along the primary bending/torsion load paths.");
 if(ts<1.5)rec.push("Thin skin requires explicit local-buckling and metal-AM process-capability validation.");
 rec.push("Run shell-element FEA with local buckling/eigenvalue and nonlinear checks before treating this geometry as structurally validated.");
 return {massKg,skinMassFraction,rootBendingStressMPa:sigma,torsionalShearMPa:tau,combinedStressMPa:combined,tipDeflectionMm:delta,utilization,status:utilization<=1?"PASS":"REVIEW",recommendations:rec,assumptions:["Cantilever closed wing-box screening model; not certified FEA.","Loads are static-equivalent inputs in this prototype; dynamic/fatigue spectra require a dedicated solver.","Material allowables are illustrative research values and must be replaced by program-approved data.","Local buckling, joints, stress concentrations and AM defects are not resolved by this analytical screen."]};
}
export function optimizeWingBox(seed:WingBoxInput){
 const candidates=[] as Array<{input:WingBoxInput;result:StructuralResult}>;
 for(const skin of [seed.skin*.65,seed.skin*.8,seed.skin,seed.skin*1.15])for(const spar of [seed.spar*.75,seed.spar,seed.spar*1.2])for(const ribCount of [Math.max(2,seed.ribCount-1),seed.ribCount,seed.ribCount+2]){
  const input={...seed,skin:+skin.toFixed(2),spar:+spar.toFixed(2),ribCount}; const result=analyzeWingBox(input); if(result.utilization<=.9)candidates.push({input,result});
 }
 return candidates.sort((a,b)=>a.result.massKg-b.result.massKg).slice(0,5);
}