import test from "node:test";
import assert from "node:assert/strict";
import {DED_WALL_EXAMPLE} from "../lib/ded-planning";
import {allowsGeometryRanking,completedPart,dedExample,newJourney,restoreJourney,switchProcess,STEPS} from "../lib/engineering-journey";
const file={name:"mounting-lug.stl"} as File;
test("guided journey defaults to uploaded LPBF and seven distinct stages",()=>{
 const j=newJourney();
 assert.equal(j.schema,2);
 assert.deepEqual(STEPS,["part","requirements","process","options","studies","decision","report"]);
 assert.equal(j.mode,"uploaded");
 assert.equal(j.process,"PBF_LB_METAL");
 assert.equal(allowsGeometryRanking(j),true);
 assert.equal(completedPart(j,file,1),false);
});
test("part confirmation is tied to file name and unit scale, not just file presence",()=>{
 const j={...newJourney(),confirmedFileName:file.name,confirmedUnitScale:1};
 assert.equal(completedPart(j,file,1),true);
 assert.equal(completedPart(j,file,25.4),false);
 assert.equal(completedPart(j,{name:"different.stl"} as File,1),false);
});
test("switching to DED does not make STL a deposition-path demonstration",()=>{
 const j=switchProcess(newJourney(),"DED_LB_WIRE");
 assert.equal(j.mode,"uploaded");
 assert.equal(allowsGeometryRanking(j),false);
 assert.equal(dedExample(j),false);
 assert.equal(j.dedInput.process,"DED_LB_WIRE");
});
test("ded example status requires selected DED process",()=>{
 const j={...newJourney(),mode:"ded-example" as const,process:"DED_LB_WIRE" as const};
 assert.equal(dedExample(j),true);
 assert.equal(completedPart(j,null,1),true);
 assert.equal(dedExample({...j,process:"PBF_LB_METAL"}),false);
});
test("legacy and malformed saved journey records safely migrate to defaults",()=>{
 const def=newJourney();
 assert.deepEqual(restoreJourney(undefined),def);
 assert.deepEqual(restoreJourney({schema:3,mode:"ded-example"}),def);
 assert.deepEqual(restoreJourney({...def,step:"unauthorized"}),def);
 const restored=restoreJourney({...def,mode:"ded-example",process:"DED_LB_POWDER",step:"studies",dedInput:{...DED_WALL_EXAMPLE,process:"DED_LB_POWDER"}});
 assert.equal(restored.step,"studies");
 assert.equal(restored.dedInput.process,"DED_LB_POWDER");
 const invalid=restoreJourney({...restored,dedInput:{...DED_WALL_EXAMPLE,depositionSpeedMmS:-5}});
 assert.equal(invalid.dedInput.depositionSpeedMmS,DED_WALL_EXAMPLE.depositionSpeedMmS);
});
