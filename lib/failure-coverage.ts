/**
 * Honest failure-mode coverage for a research metal-AM study.
 * In particular, service-temperature and stress calculations are NOT LPBF
 * deposition simulations and must never "promote" print-defect risks to assessed.
 */
export type CoverageState="screened"|"calculated"|"not-assessed";
export type CoverageCategory="geometry"|"manufacturability"|"service"|"print-process";
export type FailureCoverage={
 id:string;name:string;category:CoverageCategory;state:CoverageState;
 method:string;limitations:string;nextInput:string;
};
export type CoverageInputs={
 hasMeshAudit:boolean;
 hasOrientationRun:boolean;
 hasStructuralStudy:boolean;
 hasSteadyThermalStudy:boolean;
 hasLpbfTransient?:boolean;
 lpbfMethod?:"uniform"|"moving";
 process:"PBF_LB_METAL"|"DED_LB_WIRE"|"DED_LB_POWDER";
};
export function failureCoverage(input:CoverageInputs):FailureCoverage[]{
 const items:FailureCoverage[]=[
  {id:"mesh-topology",name:"Mesh integrity and watertightness",category:"geometry",
   state:input.hasMeshAudit?"screened":"not-assessed",
   method:"STL edge-topology and disconnected-shell audit",
   limitations:"Does not detect all self-intersections or verify printability.",
   nextInput:"Provide a valid STL and inspect its geometry."},
  {id:"overhangs-supports",name:"Down-facing surfaces and support burden",category:"manufacturability",
   state:input.hasOrientationRun&&input.process==="PBF_LB_METAL"?"screened":"not-assessed",
   method:"Finite LPBF orientation sweep and triangle-based support proxy",
   limitations:"No generated support structures, recoater collision or thermal failure calculation.",
   nextInput:"Confirm units and execute the LPBF geometric orientation sweep."},
  {id:"service-stress",name:"Idealized service-load stress and displacement",category:"service",
   state:input.hasStructuralStudy?"calculated":"not-assessed",
   method:"Isotropic linear-elastic voxel finite-element calculation",
   limitations:"Depends on verified loads, idealized end-face fixtures and material values; not print-induced stress.",
   nextInput:"Specify and approve load locations, fixtures and elastic properties."},
  {id:"steady-heat",name:"Steady service heat conduction",category:"service",
   state:input.hasSteadyThermalStudy?"calculated":"not-assessed",
   method:"Steady-state conduction calculation on the part",
   limitations:"No laser path, transient melting, deposition history or print residual stress.",
   nextInput:"Specify and approve conductivity, flux and boundary conditions."},
 ];
 items.push({id:"coarse-lpbf-transient",name:input.lpbfMethod==="moving"?"Experimental moving-raster LPBF enthalpy heat flow":"Coarse solid-state LPBF heat-flow prototype",category:"print-process",
  state:input.hasLpbfTransient&&input.process==="PBF_LB_METAL"?"calculated":"not-assessed",
  method:input.lpbfMethod==="moving"?"Generated serpentine Gaussian source and equilibrium latent-heat finite-volume approximation":"Explicit voxel diffusion with coarse layer activation and uniformly distributed absorbed energy",
  limitations:input.lpbfMethod==="moving"?"Not a measured scan path or resolved physical beam; no powder, fluid flow, verified melt-pool physics or calibrated defect prediction. Equilibrium phase transition is a research approximation.":"No melt-pool physics, phase change, moving beam, powder transfer or calibrated defect model. Temperatures beyond solidus invalidate solid-state assumptions.",
  nextInput:"Verify actual machine/material inputs, run the research worker and compare against benchmark measurements."});
 const unassessed=[
  ["print-thermal-history","Validated laser-scan thermal history","Requires calibrated time-dependent heat-source, scan strategy, layer evolution and alloy properties."],
  ["distortion-residual-stress","Print-induced distortion and residual stress","Requires calibrated sequential thermomechanical deposition simulation and validation."],
  ["lack-of-fusion","Lack-of-fusion porosity","Requires qualified material/laser/process parameter data and a calibrated defect predictor."],
  ["keyhole-porosity","Keyhole pore formation","Requires melt-pool evidence or a calibrated process-specific model."],
  ["hot-cracking","Hot cracking and delamination","Requires thermal/mechanical history, alloy susceptibility and build validation."],
  ["surface-dimensions","Surface finish and dimensional conformity","Requires process and finishing assumptions, dimensional tolerances and measured validation."],
  ["in-service-fatigue","Fatigue performance of as-built material","Requires load spectrum, defect population, anisotropic properties and fatigue test data."],
  ["recoater-collision","Recoater collision and build interruption","Requires machine kinematics, layer geometry, support stiffness and thermal deformation."],
 ] as const;
 return [...items,...unassessed.map(([id,name,nextInput]):FailureCoverage=>({
  id,name,category:"print-process",state:"not-assessed",
  method:"No qualified process-physics or calibrated statistical model connected",
  limitations:"An STL geometry screen or service solve cannot establish this defect's probability or absence.",
  nextInput
 }))];
}
export function coverageSummary(items:FailureCoverage[]){
 return {screened:items.filter(x=>x.state==="screened").length,
  calculated:items.filter(x=>x.state==="calculated").length,
  notAssessed:items.filter(x=>x.state==="not-assessed").length};
}
