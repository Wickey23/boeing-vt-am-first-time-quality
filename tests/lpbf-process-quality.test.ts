import {test} from "node:test";
import assert from "node:assert/strict";
import {assessLpbfProcessWindow,emptyProcessQualityInput,type ProcessQualityInput} from "../lib/lpbf-process-quality";

const reviewed=():ProcessQualityInput=>{
 const input=emptyProcessQualityInput();
 input.machine="Synthetic machine A";input.material="Synthetic alloy - NOT a real preset";
 input.parameterSet="Synthetic window v1";input.reference="SYNTHETIC-TEST-ONLY revision 1";
 input.referenceReviewed=true;
 input.values={powerW:200,speedMmS:800,hatchMm:0.1,layerMm:0.04};
 input.windows={powerW:{min:180,max:230},speedMmS:{min:700,max:900},
  hatchMm:{min:0.09,max:0.12},layerMm:{min:0.03,max:0.05}};
 return input;
};
test("unknown machine conditions do not produce an approved quality verdict",()=>{
 const r=assessLpbfProcessWindow(emptyProcessQualityInput());
 assert.equal(r.decision,"insufficient-evidence");
 assert.equal(r.checksCompleted,0);assert.equal(r.indicators.volumeEnergyJMm3,null);
 assert.ok(r.findings.some(f=>f.code==="PHYSICAL_DEFECTS_UNASSESSED"));
});
test("fully entered synthetic in-window scenario calculates energy proxies but never defect likelihood",()=>{
 const r=assessLpbfProcessWindow(reviewed());
 assert.equal(r.decision,"inside-declared-ranges");
 assert.equal(r.checksCompleted,4);
 assert.equal(r.outsideCount,0);
 assert.equal(r.indicators.lineEnergyJMm,0.25);
 assert.equal(r.indicators.areaEnergyJMm2,2.5);
 assert.ok(Math.abs(r.indicators.volumeEnergyJMm3!-62.5)<1e-12);
 assert.ok(r.findings.some(f=>f.code==="COMBINATION_NOT_VALIDATED"));
 assert.ok(r.findings.some(f=>f.code==="PHYSICAL_DEFECTS_UNASSESSED"));
 assert.ok(!("probability" in r));
});
test("outside limits gives explicit numeric blocker, not physical defect prediction",()=>{
 const input=reviewed();input.values.speedMmS=1050;
 const r=assessLpbfProcessWindow(input);
 assert.equal(r.decision,"outside-declared-range");
 assert.equal(r.outsideCount,1);
 assert.equal(r.findings.find(f=>f.code==="OUTSIDE_speedMmS")?.severity,"blocker");
 assert.match(r.findings.find(f=>f.code==="OUTSIDE_speedMmS")!.observation,/1050 mm\/s/);
 assert.equal(r.findings.some(f=>f.code==="PREDICTED_POROSITY"),false);
});
test("invalid or reversed ranges fail closed; invalid values cannot calculate derived energy",()=>{
 const input=reviewed();input.values.powerW=0;input.windows.hatchMm={min:0.2,max:0.1};
 const r=assessLpbfProcessWindow(input);
 assert.equal(r.decision,"invalid-configuration");
 assert.equal(r.indicators.volumeEnergyJMm3,null);
 assert.ok(r.findings.some(f=>f.code==="INVALID_powerW"));
 assert.ok(r.findings.some(f=>f.code==="INVALID_WINDOW_hatchMm"));
});
test("unreviewed or partial bounds cannot be reported as reviewed in-window",()=>{
 const input=reviewed();input.referenceReviewed=false;
 assert.equal(assessLpbfProcessWindow(input).decision,"insufficient-evidence");
 input.referenceReviewed=true;input.windows.layerMm={min:null,max:null};
 const result=assessLpbfProcessWindow(input);
 assert.equal(result.decision,"insufficient-evidence");
 assert.ok(result.findings.some(f=>f.code==="NO_WINDOW_layerMm"));
});
test("boundary values compare inclusively; zero and unknown limits remain distinct",()=>{
 const input=reviewed();input.values.powerW=180;
 assert.equal(assessLpbfProcessWindow(input).outsideCount,0);
 input.windows.powerW.min=0;
 assert.equal(assessLpbfProcessWindow(input).decision,"invalid-configuration");
});

test("a one-sided bound can flag violations but cannot yield full in-range review",()=>{
 const input=reviewed();
 input.windows.powerW.max=null;
 const result=assessLpbfProcessWindow(input);
 assert.equal(result.decision,"insufficient-evidence");
 assert.equal(result.checksCompleted,4);
 input.values.powerW=100;
 const violation=assessLpbfProcessWindow(input);
 assert.equal(violation.decision,"outside-declared-range");
 assert.equal(violation.outsideCount,1);
});
