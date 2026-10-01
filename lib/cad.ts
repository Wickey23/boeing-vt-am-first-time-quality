import {PartIntent} from "./types";
export function buildParametricCad(p:PartIntent){
 const x=p.length/2,y=p.width/2; const h=Math.max(0.5,Math.min(p.holeDiameter/2,Math.min(x,y)*.8));
 return {kind:"parametric-block-v2",name:p.name,parameters:p,operations:[{type:"box",min:[-x,-y,0],max:[x,y,p.height]},{type:"through-hole",axis:"z",center:[0,0],radius:h,depth:p.height}],note:"Deterministic seed geometry with a tessellated central through-hole. Production STEP/BREP generation remains a separate CAD-kernel service boundary."};
}
type V=[number,number,number];
function tri(a:V,b:V,c:V){return `facet normal 0 0 0\n outer loop\n  vertex ${a.join(" ")}\n  vertex ${b.join(" ")}\n  vertex ${c.join(" ")}\n endloop\nendfacet`}
export function cadToAsciiStl(p:PartIntent){
 const x=p.length/2,y=p.width/2,z=p.height,r=Math.max(.5,Math.min(p.holeDiameter/2,Math.min(x,y)*.8)),n=32;
 const out:string[]=[]; const corners:[number,number][]=[[-x,-y],[x,-y],[x,y],[-x,y]];
 // Outer vertical walls.
 for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];out.push(tri([a[0],a[1],0],[b[0],b[1],0],[b[0],b[1],z]),tri([a[0],a[1],0],[b[0],b[1],z],[a[0],a[1],z]));}
 // Build top/bottom annulus by connecting the circular hole to the rectangular boundary using four angular quadrants.
 for(let i=0;i<n;i++){const a=2*Math.PI*i/n,b=2*Math.PI*(i+1)/n;const ha0:V=[r*Math.cos(a),r*Math.sin(a),0],hb0:V=[r*Math.cos(b),r*Math.sin(b),0],ha1:V=[ha0[0],ha0[1],z],hb1:V=[hb0[0],hb0[1],z];
  const boundary=(t:number):[number,number]=>{const cx=Math.cos(t),sy=Math.sin(t);const s=Math.min(x/Math.max(Math.abs(cx),1e-9),y/Math.max(Math.abs(sy),1e-9));return [cx*s,sy*s]};
  const oa=boundary(a),ob=boundary(b);const oa0:V=[oa[0],oa[1],0],ob0:V=[ob[0],ob[1],0],oa1:V=[oa[0],oa[1],z],ob1:V=[ob[0],ob[1],z];
  out.push(tri(oa0,ob0,hb0),tri(oa0,hb0,ha0));out.push(tri(oa1,hb1,ob1),tri(oa1,ha1,hb1));
  // Hole cylinder wall.
  out.push(tri(ha0,hb0,hb1),tri(ha0,hb1,ha1));
 }
 return "solid ftq_parametric_v2\n"+out.join("\n")+"\nendsolid ftq_parametric_v2";
}