/**
 * Public, synthetic, geometry-only ORIENTAI benchmark inputs.
 * Regenerated as watertight binary STL at runtime; no proprietary CAD or
 * measured Boeing parameters. All coordinates are millimetres by convention,
 * but the engineer must still explicitly confirm them in the study UI.
 *
 * Source reference: independent 2026-11-20 three-part orientation study.
 */
export type BenchmarkPart =
  | "calibration-cube"
  | "thin-walled-sleeve"
  | "l-bracket"
  | "unsupported-bridge";

type Vec = readonly [number,number,number];
type Triangle = readonly [Vec,Vec,Vec];
type ProfilePoint = readonly [number,number];

export const ORIENTAI_BENCHMARKS: ReadonlyArray<{
  id: BenchmarkPart;
  name: string;
  purpose: string;
  nominalVolumeMm3: number;
  nominalHeightMm: number;
}> = [
  {id:"calibration-cube",name:"Calibration cube",purpose:"Check 20 mm dimensions, volume and physical-layer registration",nominalVolumeMm3:8000,nominalHeightMm:20},
  {id:"thin-walled-sleeve",name:"Thin-walled sleeve",purpose:"Review 2 mm radial wall and hollow-area retention",nominalVolumeMm3:32*128*Math.sin(2*Math.PI/128)*(12*12-10*10)/2,nominalHeightMm:32},
  {id:"l-bracket",name:"L-bracket",purpose:"Compare baseline build height with a rotated, shorter alternative",nominalVolumeMm3:5310,nominalHeightMm:34},
  {id:"unsupported-bridge",name:"Bridge structure",purpose:"Review the 420 mm² downward roof and orientation-dependent geometry",nominalVolumeMm3:7680,nominalHeightMm:24}
] as const;

function cross2(a:ProfilePoint,b:ProfilePoint,c:ProfilePoint):number{
  return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
}
function insideTriangle(p:ProfilePoint,a:ProfilePoint,b:ProfilePoint,c:ProfilePoint):boolean{
  return cross2(a,b,p)>=-1e-10&&cross2(b,c,p)>=-1e-10&&cross2(c,a,p)>=-1e-10;
}
function profilePrism(input:ReadonlyArray<ProfilePoint>,depth:number):Triangle[]{
  // The 2D polygon lives in XZ; extrusion runs along Y, matching the study.
  let pts=[...input];
  const signed=pts.reduce((sum,p,i)=>sum+p[0]*pts[(i+1)%pts.length][1]-pts[(i+1)%pts.length][0]*p[1],0);
  if(signed<0)pts.reverse();
  if(Math.abs(signed)<1e-8)throw Error("Degenerate benchmark profile");
  const vertices:Vec[]=[...pts.map(([x,z]):Vec=>[x,depth,z]),...pts.map(([x,z]):Vec=>[x,0,z])];
  const n=pts.length,indices=pts.map((_,i)=>i),faces:Array<[number,number,number]>=[];
  while(indices.length>3){
    let clipped=false;
    for(let k=0;k<indices.length;k++){
      const a=indices[(k+indices.length-1)%indices.length],b=indices[k],c=indices[(k+1)%indices.length];
      if(cross2(pts[a],pts[b],pts[c])<=1e-10)continue;
      if(indices.some(j=>j!==a&&j!==b&&j!==c&&insideTriangle(pts[j],pts[a],pts[b],pts[c])))continue;
      faces.push([c,b,a],[a+n,b+n,c+n]);
      indices.splice(k,1);clipped=true;break;
    }
    if(!clipped)throw Error("Cannot triangulate benchmark profile");
  }
  const [a,b,c]=indices;
  faces.push([c,b,a],[a+n,b+n,c+n]);
  for(let i=0;i<n;i++){
    const j=(i+1)%n;
    faces.push([i,j,j+n],[i,j+n,i+n]);
  }
  return faces.map(([i,j,k]):Triangle=>[vertices[i],vertices[j],vertices[k]]);
}
function annularSleeve():Triangle[]{
  const n=128,triangles:Triangle[]=[];
  const ring=(r:number,i:number,z:number):Vec=>{
    const a=2*Math.PI*(i%n)/n;
    return [12+r*Math.cos(a),12+r*Math.sin(a),z];
  };
  for(let i=0;i<n;i++){
    const j=i+1;
    const ob=ring(12,i,0),on=ring(12,j,0),ot=ring(12,i,32),ont=ring(12,j,32);
    const ib=ring(10,i,0),inn=ring(10,j,0),it=ring(10,i,32),int=ring(10,j,32);
    triangles.push(
      [ob,on,ont],[ob,ont,ot],
      [ib,int,inn],[ib,it,int],
      [ob,inn,on],[ob,ib,inn],
      [ot,ont,int],[ot,int,it]
    );
  }
  return triangles;
}
function trianglesFor(part:BenchmarkPart):Triangle[]{
  switch(part){
    case "calibration-cube":return profilePrism([[0,0],[20,0],[20,20],[0,20]],20);
    case "thin-walled-sleeve":return annularSleeve();
    case "l-bracket":return profilePrism([[0,0],[30,0],[30,5],[5,5],[5,34],[0,34]],18);
    case "unsupported-bridge":return profilePrism([[0,0],[6,0],[6,16],[34,16],[34,0],[40,0],[40,24],[0,24]],15);
    default:throw Error("Unknown synthetic benchmark");
  }
}
/** Make a standalone binary STL without depending on WebGL, servers or Three.js. */
export function createOrientaiBenchmarkStl(part:BenchmarkPart):ArrayBuffer{
  const tris=trianglesFor(part);
  const buffer=new ArrayBuffer(84+tris.length*50),bytes=new Uint8Array(buffer),view=new DataView(buffer);
  const title="ORIENTAI synthetic benchmark "+part+"; geometry only; unqualified";
  for(let i=0;i<Math.min(80,title.length);i++)bytes[i]=title.charCodeAt(i);
  view.setUint32(80,tris.length,true);
  tris.forEach((triangle,i)=>{
    let offset=84+i*50+12; // normal left zero; geometric normal recovered from winding
    for(const vertex of triangle)for(const v of vertex){
      view.setFloat32(offset,v,true);offset+=4;
    }
  });
  return buffer;
}
