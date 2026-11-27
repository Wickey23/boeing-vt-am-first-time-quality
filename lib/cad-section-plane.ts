import type {MeshPoint} from "./cad-mesh-measurement";
export type SectionView={axis:"X"|"Y"|"Z";percent:number;reverse:boolean};
export type MeshBounds={min:MeshPoint;max:MeshPoint};
/** Build axes mapped into the displayed, rotated, centered mesh: X=+x,Y=-z,Z=+y.
 * Retains one side of a visualization plane; no section caps, contour or physical layer calculation.
 */
export function sectionPlane(bounds:MeshBounds,view:SectionView){
 const axis:MeshPoint=view.axis==="X"?{x:1,y:0,z:0}:view.axis==="Y"?{x:0,y:0,z:-1}:{x:0,y:1,z:0};
 const [lo,hi]=view.axis==="X"?[bounds.min.x,bounds.max.x]:view.axis==="Y"?[-bounds.max.z,-bounds.min.z]:[bounds.min.y,bounds.max.y];
 if(![lo,hi,view.percent].every(Number.isFinite)||hi<lo)return null;
 const offset=lo+(hi-lo)*Math.min(100,Math.max(0,view.percent))/100;
 const sign=view.reverse?1:-1;
 return {normal:{x:axis.x*sign,y:axis.y*sign,z:axis.z*sign},constant:-offset*sign,offset};
}
