import test from "node:test";
import assert from "node:assert/strict";
import {distanceMm,triangleMetrics,appendMeasurement,type MeshPick} from "../lib/cad-mesh-measurement";
const point=(x:number,y:number,z:number)=>({x,y,z});
test("mesh triangle area and normal use confirmed millimeter coordinates",()=>{
 const m=triangleMetrics(point(0,0,0),point(10,0,0),point(0,10,0));
 assert.deepEqual(m,{areaMm2:50,normal:point(0,0,1)});
 assert.equal(triangleMetrics(point(0,0,0),point(1,0,0),point(2,0,0)),null);
 assert.equal(triangleMetrics(point(0,0,0),point(Infinity,0,0),point(0,2,0)),null);
});
test("3D distance includes all axes and is symmetric",()=>{
 assert.equal(distanceMm(point(0,0,0),point(3,4,12)),13);
 assert.equal(distanceMm(point(3,4,12),point(0,0,0)),13);
 assert.equal(distanceMm(point(1,1,1),point(1,1,1)),0);
});
test("third pick begins a fresh pair without mutating previous picks",()=>{
 const pick=(triangle:number):MeshPick=>({triangle,point:point(triangle,0,0),areaMm2:2,normal:point(0,0,1)});
 const first=appendMeasurement([],pick(1));
 const pair=appendMeasurement(first,pick(2));
 assert.equal(first.length,1);
 assert.deepEqual(pair.map(p=>p.triangle),[1,2]);
 assert.deepEqual(appendMeasurement(pair,pick(3)).map(p=>p.triangle),[3]);
});
