import test from "node:test";
import assert from "node:assert/strict";
import {blankKnowledge} from "../lib/copilot-context";
import {applyIntakeAnswer,getIntakeStep,intakeProgress} from "../lib/engineering-intake";
const base={partName:"frame.stl",confirmed:true,loadsReviewed:false,process:"PBF_LB_METAL"};
test("intake asks one meaningful question and stores unverified engineer context",()=>{
 let k=blankKnowledge("part-a");
 const expected=[
  ["component","Frame rib / support"],
  ["assembly","Fuselage at station 20; attaches to skin stringers"],
  ["interfaces","Bolted to adjacent structure; attachment faces need verification"],
  ["requirements","500 N discussed in D1 but not validated"]
 ] as const;
 for(const [stage,answer] of expected){
  const step=getIntakeStep(k,base);
  assert.equal(step.stage,stage);
  k=applyIntakeAnswer(k,step,answer);
 }
 assert.equal(getIntakeStep(k,base).stage,"review");
 assert.equal(getIntakeStep(k,{...base,loadsReviewed:true}).stage,"ready");
 assert.equal(intakeProgress(k,{...base,loadsReviewed:true}).filter(x=>x.done).length,3);
 assert.equal(k.reviewedRequirements,"500 N discussed in D1 but not validated");
});
test("never use freeform input as numerical approval",()=>{
 const k=blankKnowledge("part-a");
 const missing=getIntakeStep(k,{...base,partName:null});
 assert.equal(missing.stage,"part");
 assert.throws(()=>applyIntakeAnswer(k,missing,"approve everything"),/explicit workflow control/);
 const units=getIntakeStep(k,{...base,confirmed:false});
 assert.equal(units.stage,"units");
 assert.throws(()=>applyIntakeAnswer(k,units,"mm"),/explicit workflow control/);
 assert.equal(getIntakeStep(k,{...base,process:"DED_LB_WIRE"}).stage,"component");
});
test("DED uploaded part enables service calculations without implying deposition simulation",()=>{
 let k=blankKnowledge("part-c");
 for(const value of ["Bracket","Fuselage assembly","Bolted at ends","500 N engineer-entered"]){
  const step=getIntakeStep(k,base);
  k=applyIntakeAnswer(k,step,value);
 }
 const stage=getIntakeStep(k,{...base,loadsReviewed:true,process:"DED_LB_POWDER"});
 assert.equal(stage.stage,"ready");
 assert.match(stage.hint,/DED deposition/);
});
