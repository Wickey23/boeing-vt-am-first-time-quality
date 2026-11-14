import {test} from "node:test";
import assert from "node:assert/strict";
import {evaluateHeldOutDefects,type DefectValidationInput} from "../lib/lpbf-defect-validation";

const sample=():DefectValidationInput=>({
 defect:"lack-of-fusion",material:"Synthetic alloy",machine:"Synthetic LPBF machine",
 processRevision:"example-1",inspectedOutcomeDefinition:"Synthetic inspection label",
 sourceReference:"SYNTHETIC-ONLY",split:"held-out-builds",decisionThreshold:0.5,
 cases:[
  {id:"a",buildId:"B1",actualDefect:true,predictedProbability:0.9},
  {id:"b",buildId:"B2",actualDefect:false,predictedProbability:0.8},
  {id:"c",buildId:"B3",actualDefect:false,predictedProbability:0.1},
  {id:"d",buildId:"B4",actualDefect:true,predictedProbability:0.2},
  {id:"e",buildId:"B5",actualDefect:true,predictedProbability:null}
 ]
});
test("scores held-out confusion, calibration, and explicit abstention coverage",()=>{
 const out=evaluateHeldOutDefects(sample());
 assert.deepEqual(out.confusion,{tp:1,fp:1,tn:1,fn:1});
 assert.equal(out.sampleSize,5);assert.equal(out.distinctBuilds,5);
 assert.equal(out.coverage,0.8);assert.equal(out.abstained,1);
 assert.equal(out.precision,0.5);assert.equal(out.recall,0.5);
 assert.equal(out.specificity,0.5);assert.equal(out.balancedAccuracy,0.5);
 assert.ok(Math.abs(out.brierScore!-0.325)<1e-12);
 assert.equal(out.observedPrevalence,0.6);
 assert.equal(out.status,"VALIDATION_ONLY_NOT_QUALIFIED");
 assert.ok(out.warnings.some(w=>/abstention/i.test(w)));
});
test("all abstentions yield null metrics rather than invented performance",()=>{
 const input=sample();input.cases=input.cases.map(c=>({...c,predictedProbability:null}));
 const out=evaluateHeldOutDefects(input);
 assert.equal(out.coverage,0);assert.equal(out.brierScore,null);
 assert.equal(out.precision,null);assert.equal(out.recall,null);
});
test("rejects nonprobabilities, duplicate IDs, invalid thresholds, missing provenance",()=>{
 const input=sample();input.cases[0].predictedProbability=1.2;
 assert.throws(()=>evaluateHeldOutDefects(input),/Prediction/);
 input.cases[0].predictedProbability=0.9;
 input.cases[1].id="a";
 assert.throws(()=>evaluateHeldOutDefects(input),/unique ID/);
 input.cases[1].id="b";input.decisionThreshold=1;
 assert.throws(()=>evaluateHeldOutDefects(input),/threshold/);
 input.decisionThreshold=.5;input.sourceReference="";
 assert.throws(()=>evaluateHeldOutDefects(input),/evidence source/);
});
test("one-class evidence warns, and never calculates missing class metric",()=>{
 const input=sample();input.cases=input.cases.map(c=>({...c,actualDefect:false}));
 const out=evaluateHeldOutDefects(input);
 assert.equal(out.recall,null);assert.equal(out.balancedAccuracy,null);
 assert.ok(out.warnings.some(w=>/one observed outcome class/i.test(w)));
});
