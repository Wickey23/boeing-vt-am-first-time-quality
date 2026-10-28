import test from "node:test";
import assert from "node:assert/strict";
import {zipSync,strToU8} from "fflate";
import {addProjectSource,findEvidence} from "../lib/copilot-context";
import {extractDocx,extractXlsx} from "../lib/document-extraction";
import {buildEngineeringRunbook} from "../lib/engineering-runbook";
import {DEFAULT_SERVICE_SETUP} from "../lib/service-load";
const zipped=(parts:Record<string,string>)=>zipSync(Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,strToU8(v)])));
test("local DOCX extraction cites individual numbered paragraphs",async()=>{
 const bytes=zipped({"word/document.xml":'<w:document xmlns:w="word"><w:body><w:p><w:r><w:t>Fuselage frame</w:t></w:r><w:r><w:t> at station 42</w:t></w:r></w:p><w:p><w:r><w:t>Nominal 500 N is unverified</w:t></w:r></w:p></w:body></w:document>'});
 assert.match(extractDocx(bytes),/P1: Fuselage frame at station 42/);
 const sources=await addProjectSource([],new File([new Uint8Array(bytes)],"assembly.docx"));
 assert.equal(sources[0].extraction,"local_document");
 assert.ok(findEvidence(sources,"station 42",2).some(x=>x.sourceId==="D1"));
});
test("local spreadsheet parsing includes cell references and only first worksheet",async()=>{
 const bytes=zipped({
  "xl/sharedStrings.xml":'<sst><si><t>Station 42</t></si><si><t>500 N candidate load</t></si></sst>',
  "xl/worksheets/sheet1.xml":'<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>unverified</t></is></c></row></sheetData></worksheet>'
 });
 assert.match(extractXlsx(bytes),/Row 1: A1=Station 42 \| B1=500 N candidate load/);
 const sources=await addProjectSource([],new File([new Uint8Array(bytes)],"load-cases.xlsx"));
 assert.equal(sources[0].extraction,"local_document");
 assert.match(sources[0].extractedText,/unverified/);
});
test("corrupt Office references fail rather than pretend content was understood",async()=>{
 await assert.rejects(addProjectSource([],new File(["not a zip"],"invalid.docx")));
 await assert.rejects(addProjectSource([],new File([zipped({"some-file.txt":"hello"})],"not-a-document.docx")));
});
const state={
 filePresent:true,geometryConfirmed:true,process:"PBF_LB_METAL",runStructural:true,runThermal:false,
 loadsReviewed:false,requirementsDocumented:true,serviceInput:DEFAULT_SERVICE_SETUP,
 thermalInputReviewed:false,thermalInput:{conductivityWmK:6.7,baseTemperatureC:20,topFluxWm2:1000,resolution:12}
};
test("study plan never launches FEM from default load values without explicit review",()=>{
 const plan=buildEngineeringRunbook(state);
 assert.equal(plan.allowed,false);
 assert.equal(plan.steps[0].status,"ready");
 assert.equal(plan.steps[1].status,"needs-input");
 assert.equal(buildEngineeringRunbook({...state,loadsReviewed:true}).allowed,true);
});
test("study plan rejects unconfirmed part, unsupported DED and invalid thermal values",()=>{
 assert.equal(buildEngineeringRunbook({...state,geometryConfirmed:false,runStructural:false}).allowed,false);
 assert.equal(buildEngineeringRunbook({...state,process:"DED_LB_WIRE",runStructural:false}).steps[0].status,"not-supported");
 assert.equal(buildEngineeringRunbook({...state,loadsReviewed:true,runThermal:true,thermalInputReviewed:false}).allowed,false);
 assert.equal(buildEngineeringRunbook({...state,loadsReviewed:true,runThermal:true,thermalInputReviewed:true}).allowed,true);
 assert.equal(buildEngineeringRunbook({...state,loadsReviewed:true,runThermal:true,thermalInputReviewed:true,thermalInput:{...state.thermalInput,conductivityWmK:-10}}).allowed,false);
});
