import {test} from "node:test";
import assert from "node:assert/strict";
import {benchmarkTwoCellPlateHeating,benchmarkContinuumPlateHeating} from "../lib/lpbf-analytical-thermal-benchmark";
test("M07 staged two-cell plate heating approaches its exact semi-discrete reference",()=>{
 const report=benchmarkTwoCellPlateHeating();
 assert.equal(report.scope,"SEMI_DISCRETE_ANALYTICAL_TIME_BENCHMARK");
 assert.equal(report.productionActivationAuthorized,false);
 assert.ok(report.reference.finalLowerC>report.reference.finalUpperC);
 assert.ok(report.reference.finalUpperC>25);
 const [a,b,c]=report.runs;
 assert.ok(a.maxAbsoluteErrorC<.15);
 assert.ok(b.maxAbsoluteErrorC<a.maxAbsoluteErrorC*.6);
 assert.ok(c.maxAbsoluteErrorC<b.maxAbsoluteErrorC*.6);
 assert.ok(c.maxAbsoluteErrorC<.04);
 for(const run of report.runs){
  assert.equal(run.energy.commandedJ,0);
  assert.equal(run.energy.absorbedJ,0);
  assert.equal(run.energy.convectionExchangeJ,0);
  assert.ok(run.energy.plateExchangeJ<0&&run.energy.storedJ>0);
  assert.ok(run.energy.relativeImbalance<1e-9);
 }
});

test("M07 continuum slab cell averages improve under vertical refinement",()=>{
 const report=benchmarkContinuumPlateHeating();
 assert.equal(report.scope,"CONTINUUM_SLAB_CONDUCTION_BENCHMARK");
 assert.equal(report.productionActivationAuthorized,false);
 const [a,b,c]=report.runs;
 assert.deepEqual(report.runs.map(r=>r.cells),[2,4,8]);
 assert.ok(a.maxAbsoluteErrorC<9);
 assert.ok(b.maxAbsoluteErrorC<2.2);
 assert.ok(c.maxAbsoluteErrorC<.55);
 assert.ok(b.maxAbsoluteErrorC<a.maxAbsoluteErrorC*.3);
 assert.ok(c.maxAbsoluteErrorC<b.maxAbsoluteErrorC*.3);
 for(const run of report.runs){
  assert.ok(run.activationSensitivityC<.001);
  assert.ok(run.actualMaxTimeStepSeconds!<=1e-5+1e-12);
  assert.ok(run.energy.relativeImbalance<1e-9);
  assert.equal(run.energy.absorbedJ,0);
  assert.ok(run.energy.plateExchangeJ<0);
 }
});
