import test from "node:test";
import assert from "node:assert/strict";
import {sectionPlane,type MeshBounds} from "../lib/cad-section-plane";
const bounds:MeshBounds={min:{x:-5,y:0,z:-8},max:{x:5,y:10,z:2}};
const clean=(n:number)=>n===0?0:n;
test("section planes follow build axes and oriented bounds",()=>{
 const x=sectionPlane(bounds,{axis:"X",percent:25,reverse:false})!;
 assert.equal(x.offset,-2.5);
 assert.equal(x.normal.x,-1);
 assert.equal(x.constant,-2.5);
 const y=sectionPlane(bounds,{axis:"Y",percent:25,reverse:false})!;
 assert.equal(y.offset,.5);
 assert.equal(y.normal.z,1);
 assert.equal(y.constant,.5);
 const z=sectionPlane(bounds,{axis:"Z",percent:50,reverse:false})!;
 assert.equal(z.normal.y,-1);
 assert.equal(z.constant,5);
});
test("reverse retains the opposite side without moving the plane",()=>{
 const a=sectionPlane(bounds,{axis:"Z",percent:25,reverse:false})!;
 const b=sectionPlane(bounds,{axis:"Z",percent:25,reverse:true})!;
 assert.equal(a.offset,b.offset);
 assert.deepEqual(Object.values(a.normal).map(x=>clean(-x)),Object.values(b.normal).map(clean));
 assert.equal(a.constant,-b.constant);
 const signed=(p:{x:number;y:number;z:number},v:typeof a)=>p.x*v.normal.x+p.y*v.normal.y+p.z*v.normal.z+v.constant;
 assert.ok(signed({x:0,y:1,z:0},a)>0);
 assert.ok(signed({x:0,y:1,z:0},b)<0);
});
test("invalid input fails closed and valid positions clamp to bounds",()=>{
 assert.equal(sectionPlane(bounds,{axis:"Z",percent:NaN,reverse:false}),null);
 assert.equal(sectionPlane(bounds,{axis:"Z",percent:-50,reverse:false})!.offset,0);
 assert.equal(sectionPlane(bounds,{axis:"Z",percent:200,reverse:false})!.offset,10);
});
