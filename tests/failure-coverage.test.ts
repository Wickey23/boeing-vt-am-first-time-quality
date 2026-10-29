import {test} from "node:test";
import assert from "node:assert/strict";
import {failureCoverage,coverageSummary} from "../lib/failure-coverage";

const base={hasMeshAudit:false,hasOrientationRun:false,hasStructuralStudy:false,hasSteadyThermalStudy:false,process:"PBF_LB_METAL" as const};
test("no checks or predictions are asserted for a new uploaded part",()=>{
 const items=failureCoverage(base);
 assert.equal(items.filter(i=>i.state!=="not-assessed").length,0);
 assert.equal(coverageSummary(items).notAssessed,items.length);
});
test("geometry screening cannot be promoted to physical print-defect prediction",()=>{
 const items=failureCoverage({...base,hasMeshAudit:true,hasOrientationRun:true});
 assert.equal(items.find(x=>x.id==="mesh-topology")?.state,"screened");
 assert.equal(items.find(x=>x.id==="overhangs-supports")?.state,"screened");
 for(const x of items.filter(x=>x.category==="print-process"))assert.equal(x.state,"not-assessed",x.id);
});
test("service thermal and structural solver results never imply print residual stress or porosity",()=>{
 const items=failureCoverage({...base,hasMeshAudit:true,hasOrientationRun:true,hasStructuralStudy:true,hasSteadyThermalStudy:true});
 assert.equal(items.find(x=>x.id==="service-stress")?.state,"calculated");
 assert.equal(items.find(x=>x.id==="steady-heat")?.state,"calculated");
 for(const code of ["print-thermal-history","distortion-residual-stress","lack-of-fusion","keyhole-porosity","in-service-fatigue"]){
  assert.equal(items.find(x=>x.id===code)?.state,"not-assessed");
 }
});
test("LPBF geometry eligibility never transfers to an unimplemented uploaded-part DED path study",()=>{
 const items=failureCoverage({...base,hasOrientationRun:true,process:"DED_LB_WIRE"});
 assert.equal(items.find(x=>x.id==="overhangs-supports")?.state,"not-assessed");
});

test("successful coarse LPBF heat flow does not mark validated scan-path or defect predictions as assessed",()=>{
 const items=failureCoverage({...base,hasMeshAudit:true,hasLpbfTransient:true});
 assert.equal(items.find(x=>x.id==="coarse-lpbf-transient")?.state,"calculated");
 for(const id of ["print-thermal-history","distortion-residual-stress","lack-of-fusion","keyhole-porosity","hot-cracking"]){
  assert.equal(items.find(x=>x.id===id)?.state,"not-assessed",id);
 }
});
