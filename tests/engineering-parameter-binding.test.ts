import test from "node:test";
import assert from "node:assert/strict";
import {addProjectSource,updateSourceNotes} from "../lib/copilot-context";
import {acceptEngineeringEvidence,suggestEngineeringEvidence} from "../lib/engineering-evidence";
import {activeParameterBindings,approveParameterBinding,proposeNumericalParameters,restoreParameterBindings} from "../lib/engineering-parameter-binding";
import {createServicePlan,activeServiceCase} from "../lib/service-plan";
import {createEngineeringJob,type StudySnapshot} from "../lib/engineering-job-ledger";
test("converts a reviewed kN load into N but never chooses a missing direction",async()=>{
 const sources=await addProjectSource([],new File(["The bracket sees axial force 2.5 kN."],"loads.txt"));
 const reviewed=acceptEngineeringEvidence(suggestEngineeringEvidence(sources)[0],"Applies to the public test bracket; check direction.");
 const candidates=proposeNumericalParameters([reviewed],sources);
 assert.equal(candidates.length,1);
 assert.equal(candidates[0].normalizedMagnitude,2500);
 assert.equal(candidates[0].normalizedUnit,"N");
 assert.equal(candidates[0].suggestedTarget,null);
 const service=activeServiceCase(createServicePlan());
 assert.throws(()=>approveParameterBinding({candidate:candidates[0],target:"forceXN",serviceCase:service,
  reviewedEvidence:[reviewed],sources,rationale:"Axis and sign independently confirmed in test.",independentlyVerified:false,direction:1}),/confirmation/);
 assert.throws(()=>approveParameterBinding({candidate:candidates[0],target:"forceXN",serviceCase:service,
  reviewedEvidence:[reviewed],sources,rationale:"Axis and sign independently confirmed in test.",independentlyVerified:true}),/direction/);
 const {binding,setup}=approveParameterBinding({candidate:candidates[0],target:"forceXN",serviceCase:service,
  reviewedEvidence:[reviewed],sources,rationale:"Verified load and negative X sign against independent fixture notes.",
  independentlyVerified:true,direction:-1,at:"2026-10-28T22:00:00Z"});
 assert.equal(setup.forceXN,-2500);
 assert.equal(setup.forceZN,100);
 assert.equal(binding.value,-2500);
 assert.equal(activeParameterBindings([binding],sources,[reviewed],{...service,input:setup}).length,1);
 assert.equal(activeParameterBindings([binding],sources,[reviewed],{...service,input:{...setup,forceXN:-2400}}).length,0);
 assert.equal(activeParameterBindings([binding],updateSourceNotes(sources,"D1","changed"),[reviewed],{...service,input:setup}).length,0);
});
test("explicit Fx direction, elastic modulus and ratio are recognized only as candidates",async()=>{
 const sources=await addProjectSource([],new File([
  "Fx = -2 kN actual service load",
  "Young's modulus: 110 GPa material input",
  "Poisson ratio: 0.33 assumed material"
 ],"engineering.txt"));
 const reviewed=suggestEngineeringEvidence(sources).map(x=>acceptEngineeringEvidence(x,"Requires engineering confirmation before use."));
 const hits=proposeNumericalParameters(reviewed,sources);
 assert.equal(hits.length,3);
 assert.equal(hits.find(x=>x.targetKind==="force")?.suggestedTarget,"forceXN");
 assert.equal(hits.find(x=>x.targetKind==="force")?.normalizedMagnitude,-2000);
 assert.equal(hits.find(x=>x.targetKind==="elastic")?.normalizedMagnitude,110000);
 assert.equal(hits.find(x=>x.targetKind==="ratio")?.normalizedMagnitude,.33);
 assert.equal(hits.find(x=>x.targetKind==="ratio")?.uncertain,true);
 const service=activeServiceCase(createServicePlan());
 const modulus=hits.find(x=>x.targetKind==="elastic")!;
 const {setup,binding}=approveParameterBinding({candidate:modulus,target:"youngModulusMPa",serviceCase:service,
  reviewedEvidence:reviewed,sources,rationale:"Checked material value for this example, not an approved flight allowables set.",
  independentlyVerified:true});
 assert.equal(setup.youngModulusMPa,110000);
 assert.equal(binding.normalizedUnit,"MPa");
 assert.throws(()=>approveParameterBinding({candidate:modulus,target:"forceXN",serviceCase:service,
  reviewedEvidence:reviewed,sources,rationale:"Invalid conversion into a force target.",independentlyVerified:true,direction:1}),/target/);
});
test("ambiguity, incorrect units and unsupported torque never become force proposals",async()=>{
 const sources=await addProjectSource([],new File([
  "Station 20 dimensional clearance 500 mm, not a force.",
  "Applied torque 500 N m at joint.",
  "Engineering drawing allows 500 N force but UNVERIFIED.",
  "Poisson ratio: 1.5 invalid material ratio."
 ],"mixed.txt"));
 const reviewed=suggestEngineeringEvidence(sources).map(x=>acceptEngineeringEvidence(x,"Public lab sample; applicability must be checked."));
 const hits=proposeNumericalParameters(reviewed,sources);
 assert.equal(hits.length,1);
 assert.equal(hits[0].uncertain,true);
 assert.match(hits[0].excerpt,/UNVERIFIED/);
});
test("frozen job snapshots reject stale or mismatched parameter bindings",async()=>{
 const sources=await addProjectSource([],new File(["Force X: 500 N on fixture."],"loads.txt"));
 const reviewed=acceptEngineeringEvidence(suggestEngineeringEvidence(sources)[0],"Verified public fixture load and X sign.");
 const candidate=proposeNumericalParameters([reviewed],sources)[0];
 const service=activeServiceCase(createServicePlan());
 const {binding,setup}=approveParameterBinding({candidate,target:"forceXN",direction:1,
  serviceCase:service,reviewedEvidence:[reviewed],sources,rationale:"Independent X-axis fixture verification.",
  independentlyVerified:true});
 const snapshot:StudySnapshot={
  partSha256:"f".repeat(64),partFileName:"example.stl",projectName:"Public fixture",
  process:"PBF_LB_METAL",analysisMode:"service-independent",approvedAt:"2026-10-28T23:00:00Z",
  machineSettings:{unitScale:1},sourceIds:["D1"],reviewedEvidence:[reviewed],
  serviceCase:{id:service.id,name:service.name,input:{...setup}},parameterBindings:[binding],
  modelScope:"research-not-qualified"
 };
 const job=createEngineeringJob("job-sources",snapshot,["service-structural","steady-conduction"]);
 assert.equal(job.snapshot.parameterBindings?.[0].value,500);
 assert.equal(restoreParameterBindings([binding,binding]).length,1);
 assert.throws(()=>createEngineeringJob("bad",{...snapshot,serviceCase:{...snapshot.serviceCase!,input:{...snapshot.serviceCase!.input,forceXN:400}}},
  ["service-structural","steady-conduction"]),/mismatched/);
 assert.throws(()=>createEngineeringJob("bad2",{...snapshot,sourceIds:[]},
  ["service-structural","steady-conduction"]),/Invalid or unreviewed/);
});
