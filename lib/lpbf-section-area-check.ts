/** Independent midpoint-section area diagnostic from directed STL triangle intersections.
 * Not a certified reference: does not prove absence of self-intersections or sublayer features.
 * Vertex/coplanar cuts and nonclosed directed contours yield unavailable, never a guessed area.
 */
type P={x:number;y:number;z:number};
type XY={x:number;y:number};
export type SectionTriangle={a:P;b:P;c:P};
export type SectionAreaCheck={areaMm2:number|null;reason:string|null;segmentCount:number};
const EPS=1e-7;
export function sectionAreaCheck(triangles:readonly SectionTriangle[],z:number,origin:XY):SectionAreaCheck{
 const fail=(reason:string,segmentCount=0):SectionAreaCheck=>({areaMm2:null,reason,segmentCount});
 if(![z,origin.x,origin.y].every(Number.isFinite))return fail("Nonfinite section coordinates");
 const nodes=new Map<string,{incoming:number;outgoing:number}>();
 const edges=new Set<string>();
 let twiceArea=0,count=0;
 const key=(p:XY)=>Math.round(p.x/EPS)+","+Math.round(p.y/EPS);
 for(const {a,b,c} of triangles){
  const p=[a,b,c],d=p.map(v=>v.z-z);
  if(d.every(v=>v>EPS)||d.every(v=>v< -EPS))continue;
  if(d.some(v=>Math.abs(v)<=EPS))return fail("Vertex or coplanar intersection within section tolerance",count);
  const hits:XY[]=[];
  for(let j=0;j<3;j++){
   const k=(j+1)%3;
   if(d[j]*d[k]<0){
    const t=d[j]/(d[j]-d[k]);
    hits.push({x:p[j].x-origin.x+t*(p[k].x-p[j].x),y:p[j].y-origin.y+t*(p[k].y-p[j].y)});
   }
  }
  if(hits.length!==2)return fail("Ambiguous triangle intersection",count);
  let [u,v]=hits;
  const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz;
  const direction=(v.x-u.x)*(-ny)+(v.y-u.y)*nx;
  if(!Number.isFinite(direction)||direction===0)return fail("Degenerate directed segment",count);
  if(direction<0)[u,v]=[v,u];
  const from=key(u),to=key(v),edge=[from,to].sort().join("|");
  if(from===to||edges.has(edge))return fail("Degenerate or duplicated section edge",count);
  edges.add(edge);
  const start=nodes.get(from)??{incoming:0,outgoing:0};start.outgoing++;nodes.set(from,start);
  const end=nodes.get(to)??{incoming:0,outgoing:0};end.incoming++;nodes.set(to,end);
  twiceArea+=u.x*v.y-v.x*u.y;count++;
 }
 if(!count)return fail("No intersected triangle segments");
 if([...nodes.values()].some(n=>n.incoming!==1||n.outgoing!==1))return fail("Open or branching directed section contour",count);
 const area=Math.abs(twiceArea)/2;
 return Number.isFinite(area)&&area>0?{areaMm2:area,reason:null,segmentCount:count}:fail("Nonpositive section area",count);
}
