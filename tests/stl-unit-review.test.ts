import {test} from "node:test";
import assert from "node:assert/strict";
import {reviewUnitsFromFilename} from "../lib/stl-unit-review";
test("warn when 20x20x3mm filename is displayed at 20,000x20,000x3,000 mm",()=>{
 const result=reviewUnitsFromFilename("bioprinter_flow_test_coupon_20x20x3mm.stl",{x:20000,y:20000,z:3000},1000);
 assert.equal(result?.status,"CHECK_SCALE");
 assert.equal(result?.suggestedScaleToMm,1);
 assert.match(result!.message,/Millimeters/);
});
test("when raw source coordinates need a unit not offered, warn to re-export",()=>{
 const result=reviewUnitsFromFilename("bioprinter_flow_test_coupon_20x20x3mm.stl",{x:20000,y:20000,z:3000},1);
 assert.equal(result?.suggestedScaleToMm,null);
 assert.match(result!.message,/re-export in mm/);
});
test("correctly dimensioned and differently ordered STL axes do not warn",()=>{
 assert.equal(reviewUnitsFromFilename("coupon_20x20x3mm.stl",{x:20,y:3,z:20},1),null);
});
test("unknown filenames and mismatched shapes do not make unsupported unit claims",()=>{
 assert.equal(reviewUnitsFromFilename("secret.stl",{x:20000,y:20000,z:3000},1),null);
 assert.equal(reviewUnitsFromFilename("coupon_20x20x3mm.stl",{x:20000,y:20000,z:2500},1000),null);
});
