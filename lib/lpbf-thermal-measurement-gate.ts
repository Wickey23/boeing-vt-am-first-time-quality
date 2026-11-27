/** M09 measurement compatibility gate. No implicit conversion of surface
 * thermography or substrate/chamber measurements into volume temperatures.
 */
export type ThermalMeasurementObservable="volume-cell-average-temperature"|"surface-radiometric-temperature"|"substrate-thermocouple-temperature"|"chamber-air-temperature"|"melt-pool-duration"|"solidification-cooling-rate";
export type ThermalMeasurementManifest={
 datasetDoi:string;sourceSha256:string;buildId:string;role:"calibration"|"held-out-validation";
 observable:ThermalMeasurementObservable;temperatureUnit:"C"|"K";
 coordinateFrame:string;spatialRegistrationReviewed:boolean;timeRegistrationReviewed:boolean;
 measurementUncertaintyReviewed:boolean;measurementOperatorReviewed:boolean;
};
export function assessThermalMeasurementCompatibility(m:ThermalMeasurementManifest){
 const blockers:string[]=[];
 if(!/^10\.\d{4,9}\/\S+$/.test(m.datasetDoi)||! /^[a-f0-9]{64}$/.test(m.sourceSha256)||!m.buildId.trim())
  blockers.push("Missing DOI, verified source-file SHA-256 or independent build identity.");
 if(m.observable!=="volume-cell-average-temperature")
  blockers.push("The current uniform-cell solver outputs volume-cell temperatures only; this measurement needs a separately validated observation operator and compatible physics.");
 if(m.temperatureUnit!=="C"&&m.temperatureUnit!=="K")blockers.push("Temperature unit is not explicit.");
 if(!m.coordinateFrame.trim()||!m.spatialRegistrationReviewed||!m.timeRegistrationReviewed)
  blockers.push("Explicit spatial and time-origin registration must be reviewed.");
 if(!m.measurementUncertaintyReviewed||!m.measurementOperatorReviewed)
  blockers.push("Measurement uncertainty and observation operator require review.");
 return {status:blockers.length?"BLOCKED_INCOMPATIBLE_MEASUREMENT":"REVIEW_REQUIRED_FOR_NUMERICAL_COMPARISON",
  blockers,validationEstablished:false as const,productionActivationAuthorized:false as const};
}
export function assertIndependentThermalBuilds(manifests:ThermalMeasurementManifest[]){
 const calibration=new Set(manifests.filter(m=>m.role==="calibration").map(m=>m.buildId.trim()));
 const heldOut=new Set(manifests.filter(m=>m.role==="held-out-validation").map(m=>m.buildId.trim()));
 if(!calibration.size||!heldOut.size||calibration.has("")||heldOut.has("")||[...heldOut].some(id=>calibration.has(id)))
  throw Error("Calibration and validation must use distinct nonempty build identities.");
 const calibrationHashes=new Set(manifests.filter(m=>m.role==="calibration").map(m=>m.sourceSha256));
 if(manifests.some(m=>m.role==="held-out-validation"&&calibrationHashes.has(m.sourceSha256)))
  throw Error("Source-file reuse across calibration and held-out builds is not allowed.");
 return {calibrationBuilds:[...calibration],heldOutBuilds:[...heldOut],validationEstablished:false as const};
}
