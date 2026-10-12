/** Deterministic watertight, faceted mounting-plate research test article. */
type V=[number,number,number];
function facet(a:V,b:V,c:V){return "facet normal 0 0 0\n outer loop\n  vertex "+a.join(" ")+"\n  vertex "+b.join(" ")+"\n  vertex "+c.join(" ")+"\n endloop\nendfacet";}
export function makeMountingPlateSTL(){
 const X=40,Y=25,H=8,R=6,N=64;
 const outer=(t:number):[number,number]=>{
  const c=Math.cos(t),s=Math.sin(t);
  const scale=Math.min(X/Math.max(Math.abs(c),1e-12),Y/Math.max(Math.abs(s),1e-12));
  return [c*scale,s*scale];
 };
 const p: string[]=[];
 for(let i=0;i<N;i++){
  const a=2*Math.PI*i/N,b=2*Math.PI*(i+1)/N;
  const o=outer(a),q=outer(b);
  const A:V=[o[0],o[1],0],B:V=[q[0],q[1],0],C:V=[o[0],o[1],H],D:V=[q[0],q[1],H];
  const E:V=[R*Math.cos(a),R*Math.sin(a),0],F:V=[R*Math.cos(b),R*Math.sin(b),0],G:V=[E[0],E[1],H],I:V=[F[0],F[1],H];
  // Outer cylindrical/chamfered side, top annulus, bottom annulus, hole wall.
  p.push(facet(A,B,D),facet(A,D,C));
  p.push(facet(C,D,I),facet(C,I,G));
  p.push(facet(A,F,B),facet(A,E,F));
  p.push(facet(E,I,F),facet(E,G,I));
 }
 return "solid synthetic_mounting_plate_80x50x8\n"+p.join("\n")+"\nendsolid synthetic_mounting_plate_80x50x8";
}
