/** Display-only mesh measurements. Coordinates refer to the original STL axes in confirmed mm. */
export type MeshPoint = {x:number;y:number;z:number};
export type MeshPick = {triangle:number;point:MeshPoint;areaMm2:number;normal:MeshPoint;snapDistanceMm?:number;mode?:MeshSnapMode};
export function distanceMm(a:MeshPoint,b:MeshPoint):number {
 return Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
}
export function triangleMetrics(a:MeshPoint,b:MeshPoint,c:MeshPoint) {
 const u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z};
 const cross={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};
 const length=Math.hypot(cross.x,cross.y,cross.z);
 if(!Number.isFinite(length)||length<=0)return null;
 return {areaMm2:length/2,normal:{x:cross.x/length,y:cross.y/length,z:cross.z/length}};
}
/** A third click starts a new pair, so points cannot silently be mixed across measurements. */
export function appendMeasurement(points:readonly MeshPick[],pick:MeshPick):MeshPick[]{
 return points.length===1?[points[0],pick]:[pick];
}

export type MeshSnapMode="surface"|"vertex"|"edge";
export type MeshSnapResult={point:MeshPoint;snapDistanceMm:number;mode:MeshSnapMode};
/** Restrict snapping to the clicked STL triangle, not inferred CAD features.
 * Explicit modes select the nearest triangle vertex/edge even when far from it.
 * Report the correction distance so this behavior is visible to the engineer.
 */
export function snapMeshPoint(hit:MeshPoint,vertices:readonly MeshPoint[],mode:MeshSnapMode):MeshSnapResult|null{
 if(vertices.length!==3||![hit,...vertices].every(p=>[p.x,p.y,p.z].every(Number.isFinite)))return null;
 if(!triangleMetrics(vertices[0],vertices[1],vertices[2]))return null;
 if(mode==="surface")return {point:{x:hit.x,y:hit.y,z:hit.z},snapDistanceMm:0,mode};
 const candidates:MeshPoint[]=mode==="vertex"?vertices.map(p=>({x:p.x,y:p.y,z:p.z})):vertices.map((a,i)=>{
  const b=vertices[(i+1)%3],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  const length2=dx*dx+dy*dy+dz*dz;
  const t=length2>0?Math.max(0,Math.min(1,((hit.x-a.x)*dx+(hit.y-a.y)*dy+(hit.z-a.z)*dz)/length2)):0;
  return {x:a.x+t*dx,y:a.y+t*dy,z:a.z+t*dz};
 });
 let nearest=candidates[0],distance=distanceMm(hit,nearest);
 for(const candidate of candidates.slice(1)){
  const d=distanceMm(hit,candidate);
  if(d<distance){nearest=candidate;distance=d;}
 }
 return Number.isFinite(distance)?{point:nearest,snapDistanceMm:distance,mode}:null;
}
