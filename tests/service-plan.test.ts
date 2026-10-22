import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {File} from 'node:buffer';
import {createServicePlan,restoreServicePlan,syncServicePlan,serviceInputKey,attachServiceResult,serviceCaseSummary,validateServicePlan} from '../lib/service-plan';
import {DEFAULT_SETTINGS,requestFor,type Analysis} from '../lib/analysis-workspace';
import {analyzeOrientations} from '../lib/orientation-engine';
import {solvePartStructural} from '../lib/voxel-structural';
import {exportPortableProject,importPortableProject} from '../lib/project-transfer';
const bytes=Uint8Array.from(readFileSync('public/verification/cube-10mm.stl')).buffer;
const plan=createServicePlan();
const field=solvePartStructural(bytes,{x:0,y:0,z:0},1,plan.cases[0].input);
function run():Analysis{return {...analyzeOrientations(bytes,requestFor({...DEFAULT_SETTINGS,searchSamples:0})),generatedAt:'2026-10-22T00:00:00Z',algorithm:'test',runId:'run-a',configuration:DEFAULT_SETTINGS,source:{fileName:'cube.stl',fileHashSha256:'test',byteSize:bytes.byteLength}};}
test('case results survive case switching and names; changed inputs invalidate only that case',()=>{
 const p={...plan,cases:[plan.cases[0],{...plan.cases[0],id:'case-2',name:'Second case'}]};
 let r=syncServicePlan(run(),p);const candidate=r.candidates[0].id;
 for(const c of p.cases)r=attachServiceResult(r,r.runId,candidate,c.id,serviceInputKey(c.input),field);
 assert.equal(Object.keys(r.structuralCases!).length,2);
 const switched={...p,activeCaseId:'case-2'};r=syncServicePlan(r,switched);assert.equal(r.structural?.field,field);
 r=syncServicePlan(r,{...switched,cases:switched.cases.map(c=>({...c,name:'Renamed'}))});assert.equal(Object.keys(r.structuralCases!).length,2);
 r=syncServicePlan(r,{...switched,cases:switched.cases.map(c=>c.id==='case-2'?{...c,input:{...c.input,forceZN:200}}:c)});
 assert.equal(r.structural,undefined);assert.equal(Object.keys(r.structuralCases!).length,1);
 assert.deepEqual(serviceCaseSummary(r).map(c=>c.status),['not-evaluated','not-run']);
});
test('stale runs, edited/deleted cases and mismatched worker fields are rejected',()=>{
 const r=syncServicePlan(run(),plan),id=r.candidates[0].id,key=serviceInputKey(plan.cases[0].input);
 assert.equal(attachServiceResult(r,'old',id,'service-1',key,field),r);
 assert.equal(attachServiceResult(r,r.runId,id,'deleted',key,field),r);
 assert.equal(attachServiceResult(r,r.runId,id,'service-1','old-input',field),r);
 assert.equal(attachServiceResult(r,r.runId,'unknown','service-1',key,field),r);
 assert.equal(attachServiceResult(r,r.runId,id,'service-1',key,{...field,input:{...field.input,forceZN:200}}),r);
});
test('legacy setup migrates; fresh orientation runs retain inputs without stale fields',()=>{
 const legacy=run();legacy.serviceSetup={...plan.cases[0].input,forceYN:-30};
 const restored=restoreServicePlan(undefined,legacy);assert.equal(restored.cases[0].input.forceYN,-30);
 const fresh=syncServicePlan({...run(),runId:'run-b'},restored);assert.equal(fresh.serviceSetup?.forceYN,-30);assert.equal(fresh.structural,undefined);
});
test('portable projects preserve service drafts even without orientation results',async()=>{
 const p=createServicePlan({...plan.cases[0].input,forceYN:-45,displacementLimitMm:0});
 const file=new File([new Uint8Array(bytes)],'cube.stl') as unknown as globalThis.File;
 const packed=await exportPortableProject('Unsolved',file,DEFAULT_SETTINGS,null,null,p);
 const restored=await importPortableProject(packed);assert.deepEqual(restored.servicePlan,p);
 assert.equal(restored.result,null);
});
test('case plan rejects duplicate IDs and nonfinite values but retains editable draft ranges',()=>{
 assert.throws(()=>validateServicePlan({...plan,cases:[plan.cases[0],plan.cases[0]]}));
 assert.throws(()=>validateServicePlan({...plan,activeCaseId:'missing'}));
 assert.throws(()=>validateServicePlan(createServicePlan({...plan.cases[0].input,forceZN:NaN})));
 assert.doesNotThrow(()=>validateServicePlan(createServicePlan({...plan.cases[0].input,youngModulusMPa:0})));
});
