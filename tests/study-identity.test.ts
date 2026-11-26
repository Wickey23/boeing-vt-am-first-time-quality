import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_SETTINGS,requestFor,verifyWorkspace,type Analysis,type Snapshot} from '../lib/analysis-workspace';
import {analyzeOrientations} from '../lib/orientation-engine';
import {sha256,canonicalJSON,assertAnalysisIdentity} from '../lib/study-identity';
import {exportPortableProject,importPortableProject} from '../lib/project-transfer';
const bytes=Uint8Array.from(readFileSync('public/verification/cube-10mm.stl')).buffer;
const settings={...DEFAULT_SETTINGS,searchSamples:0};
async function fixture(){
 const file=new File([bytes],'cube.stl');
 const result:Analysis={...analyzeOrientations(bytes,requestFor(settings)),generatedAt:'2026-11-25T00:00:00Z',algorithm:'identity-test',runId:'run-a',configuration:settings,source:{fileName:file.name,fileHashSha256:await sha256(bytes),byteSize:file.size}};
 return {file,result};
}
test('canonical identity is independent of object insertion order and rejects nonfinite values',()=>{
 assert.equal(canonicalJSON({b:2,a:{d:4,c:3}}),canonicalJSON({a:{c:3,d:4},b:2}));
 assert.throws(()=>canonicalJSON({x:NaN}),/finite/);
});
test('portable manifest binds geometry, settings and candidate without claiming validation',async()=>{
 const {file,result}=await fixture();const selected=result.candidates[0].id;
 const packed=await exportPortableProject('test',file,settings,result,selected);
 const data=JSON.parse(packed);assert.equal(data.evidenceManifest.physicalValidation,'not-established');
 assert.equal(data.evidenceManifest.unitsConfirmed,false);
 assert.equal((await importPortableProject(packed)).result?.runId,result.runId);
 const second=JSON.parse(await exportPortableProject('renamed',file,settings,result,selected));
 assert.equal(second.evidenceManifest.inputSha256,data.evidenceManifest.inputSha256);
 data.evidenceManifest.inputSha256='0'.repeat(64);
 await assert.rejects(importPortableProject(JSON.stringify(data)),/manifest/);
});
test('export rejects wrong part, changed settings, unknown candidate and unrelated simulation',async()=>{
 const {file,result}=await fixture();
 await assert.rejects(exportPortableProject('x',new File(['different'],'cube.stl'),settings,result,null),/STL bytes/);
 await assert.rejects(exportPortableProject('x',file,{...settings,unitScale:25.4},result,null),/configuration/);
 await assert.rejects(exportPortableProject('x',file,settings,result,'missing'),/orientation/);
 const bad={...result,thermal:{runId:'other',candidateId:result.candidates[0].id}} as Analysis;
 assert.throws(()=>assertAnalysisIdentity(bad,settings,result.source.fileHashSha256,file.size),/different run/);
});
test('workspace recovery retains inputs and clears stale analysis without mutating historical record',async()=>{
 const {file,result}=await fixture();
 const original:Snapshot={schema:1,file,settings:{...settings,x:10},result,selected:result.candidates[0].id,projectName:'Saved part'};
 const recovered=await verifyWorkspace(original);
 assert.equal(recovered.file,file);assert.deepEqual(recovered.settings,original.settings);
 assert.equal(recovered.result,null);assert.equal(recovered.selected,null);assert.match(recovered.recoveryNotice!,/run the assessment again/);
 assert.equal(original.result,result);
 const valid=await verifyWorkspace({...original,settings});assert.equal(valid.result,result);
});
test('legacy projects without a manifest remain importable and gain one on export',async()=>{
 const {file,result}=await fixture();const data=JSON.parse(await exportPortableProject('legacy',file,settings,result,null));
 delete data.evidenceManifest;const restored=await importPortableProject(JSON.stringify(data));
 assert.equal(restored.result?.runId,result.runId);
});
