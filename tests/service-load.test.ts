import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {elasticSolve,solvePartStructural} from '../lib/voxel-structural';
import {DEFAULT_SERVICE_SETUP,END_FACES,displacementAssessment,endFace,oppositeFace} from '../lib/service-load';
const cells:Array<[number,number,number]>=[];
for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let z=0;z<3;z++)cells.push([x,y,z]);
test('all six original-part end fixtures reproduce axial extension and force equilibrium',()=>{
 for(const face of END_FACES){
  const axis=endFace(face).axis;const f=[0,0,0];f[axis]=90;
  const r=elasticSolve(cells,1,{...DEFAULT_SERVICE_SETUP,youngModulusMPa:100000,poissonRatio:0,fixedFace:face,forceXN:f[0],forceYN:f[1],forceZN:f[2]});
  assert.ok(Math.abs(r.maxVonMisesMPa-10)<1e-5,face);
  assert.ok(Math.abs(r.maxDisplacementMm-.0003)<1e-9,face);
  assert.ok(r.relativeForceImbalance<1e-7,face);
  assert.ok(Math.abs(r.reactionForceN[axis]+90)<1e-6,face);
 }
});
test('part-frame scalar fields do not change with arbitrary build rotation',()=>{
 const bytes=Uint8Array.from(readFileSync('public/verification/cube-10mm.stl')).buffer;
 const input={...DEFAULT_SERVICE_SETUP,resolution:6,forceXN:30,forceYN:-20};
 const a=solvePartStructural(bytes,{x:0,y:0,z:0},1,input);
 const b=solvePartStructural(bytes,{x:31,y:57,z:119},1,input);
 assert.deepEqual(a,b);assert.equal(a.solver.coordinateFrame,'original-part');
 assert.ok(a.solver.relativeForceImbalance!<1e-7);
});
test('force scales linearly and units scale expected bar response',()=>{
 const input={...DEFAULT_SERVICE_SETUP,poissonRatio:0,forceZN:90};
 const a=elasticSolve(cells,1,input),b=elasticSolve(cells,1,{...input,forceZN:180}),c=elasticSolve(cells,2,input);
 assert.ok(Math.abs(b.maxDisplacementMm/a.maxDisplacementMm-2)<1e-7);
 assert.ok(Math.abs(c.maxVonMisesMPa/a.maxVonMisesMPa-.25)<1e-7);
 assert.ok(Math.abs(c.maxDisplacementMm/a.maxDisplacementMm-.5)<1e-7);
});
test('requirements distinguish absent, exceeded and model-only within-limit states',()=>{
 assert.equal(displacementAssessment(.1).status,'not-evaluated');
 assert.equal(displacementAssessment(.1,.05).status,'exceeds-model-limit');
 assert.equal(displacementAssessment(.1,.2).status,'within-model-limit');
 for(const limit of [0,-1,NaN,Infinity])assert.throws(()=>displacementAssessment(.1,limit));
 assert.equal(oppositeFace('y-max'),'y-min');
 assert.throws(()=>endFace('invalid' as never));
 assert.throws(()=>elasticSolve(cells,1,{...DEFAULT_SERVICE_SETUP,forceYN:NaN}));
});
