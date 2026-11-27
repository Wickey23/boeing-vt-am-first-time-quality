/** Display-only mesh measurements. Coordinates refer to the original STL axes in confirmed mm. */
export type MeshPoint = {x:number;y:number;z:number};
export type MeshPick = {triangle:number;point:MeshPoint;areaMm2:number;normal:MeshPoint};
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
