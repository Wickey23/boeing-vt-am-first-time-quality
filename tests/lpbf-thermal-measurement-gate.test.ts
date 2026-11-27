import {test} from "node:test";
import assert from "node:assert/strict";
import {assessThermalMeasurementCompatibility,assertIndependentThermalBuilds,type ThermalMeasurementManifest} from "../lib/lpbf-thermal-measurement-gate";
const base:ThermalMeasurementManifest={datasetDoi:"10.18434/example",sourceSha256:"a".repeat(64),buildId:"synthetic-calibration",
 role:"calibration",observable:"volume-cell-average-temperature",temperatureUnit:"C",coordinateFrame:"synthetic build frame",
 spatialRegistrationReviewed:true,timeRegistrationReviewed:true,measurementUncertaintyReviewed:true,measurementOperatorReviewed:true};
test("M09 incompatible measurements do not validate cell-volume temperatures",()=>{
 for(const observable of ["surface-radiometric-temperature","substrate-thermocouple-temperature","chamber-air-temperature","melt-pool-duration","solidification-cooling-rate"] as const){
  const result=assessThermalMeasurementCompatibility({...base,observable});
  assert.equal(result.status,"BLOCKED_INCOMPATIBLE_MEASUREMENT");
  assert.equal(result.productionActivationAuthorized,false);
  assert.equal(result.validationEstablished,false);
 }
 const compatible=assessThermalMeasurementCompatibility(base);
 assert.equal(compatible.status,"REVIEW_REQUIRED_FOR_NUMERICAL_COMPARISON");
 assert.equal(compatible.validationEstablished,false);
 assert.equal(assessThermalMeasurementCompatibility({...base,timeRegistrationReviewed:false}).status,"BLOCKED_INCOMPATIBLE_MEASUREMENT");
});
test("M09 calibration and held-out evaluation reject shared builds and source files",()=>{
 const validation={...base,role:"held-out-validation" as const,buildId:"synthetic-held-out",sourceSha256:"b".repeat(64)};
 assert.deepEqual(assertIndependentThermalBuilds([base,validation]).heldOutBuilds,["synthetic-held-out"]);
 assert.throws(()=>assertIndependentThermalBuilds([base,{...validation,buildId:base.buildId}]),/distinct/);
 assert.throws(()=>assertIndependentThermalBuilds([base,{...validation,sourceSha256:base.sourceSha256}]),/reuse/);
 assert.throws(()=>assertIndependentThermalBuilds([base]),/distinct/);
});
