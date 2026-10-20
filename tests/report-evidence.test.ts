import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {analyzeOrientations} from "../lib/orientation-engine";
import {engineeringReport} from "../lib/engineering-report";
import {auditSTL} from "../lib/stl-mesh-audit";
import {DEFAULT_SETTINGS} from "../lib/analysis-workspace";
const raw=readFileSync("public/verification/cube-10mm.stl");
const bytes=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
test("engineering evidence labels distinguish estimates and unperformed physics",()=>{
 const base=analyzeOrientations(bytes,{machine:{x:250,y:250,z:300},overhangDeg:45,weights:{support:55,height:30,contact:15},searchSamples:0});
 const run={...base,runId:"verification",generatedAt:new Date(0).toISOString(),algorithm:"test",source:{fileName:"cube-10mm.stl",fileHashSha256:"test",byteSize:raw.byteLength},configuration:DEFAULT_SETTINGS,meshAudit:auditSTL(bytes)};
 const report=engineeringReport(run,base.candidates[0]?.id??null);
 assert.equal(report.evidenceLabels.support,"Estimate");
 assert.equal(report.evidenceLabels.thermal,"Simulation result (unvalidated)");
 assert.ok(report.physicsAvailability.some(p=>p.label==="Residual stress and distortion"&&p.state==="Not calculated"));
 assert.equal(report.meshReview.blockingIssues.length,0);
 assert.equal(report.selectedCandidate?.id,base.candidates[0]?.id);
});
