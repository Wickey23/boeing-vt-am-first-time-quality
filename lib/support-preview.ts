import * as THREE from "three";
export type Post={x:number;z:number;bottomY:number;topY:number;radius:number};
export function sampleVerticalSupports(geometry:THREE.BufferGeometry,overhangDeg:number,limit=240):Post[]{
 const pos=geometry.getAttribute("position");
 if(!pos||pos.count%3!==0)return [];
 const box=new THREE.Box3().setFromBufferAttribute(pos),height=box.max.y-box.min.y;
 const raycaster=new THREE.Raycaster(), mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 mesh.updateMatrixWorld(true);
 const threshold=-Math.sin(Math.max(0,Math.min(89,overhangDeg))*Math.PI/180);
 const stride=Math.max(1,Math.ceil((pos.count/3)/Math.max(limit*8,1)));
 const posts:Post[]=[];
 for(let i=0;i<pos.count;i+=3*stride){
  const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);
  const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(n.y>=threshold)continue;
  const center=a.add(b).add(c).multiplyScalar(1/3);
  if(center.y-box.min.y<Math.max(.02,height*.001))continue;
  const origin=new THREE.Vector3(center.x,center.y-.02,center.z);
  raycaster.set(origin,new THREE.Vector3(0,-1,0));raycaster.far=Math.max(.01,center.y-box.min.y);
  const hit=raycaster.intersectObject(mesh,false).find(h=>h.distance>.02);
  const base=hit?hit.point.y:box.min.y;
  if(center.y-base<=.03)continue;
  const radius=Math.max(.12,Math.min(1.5,Math.sqrt((box.max.x-box.min.x)*(box.max.z-box.min.z))/180));
  posts.push({x:center.x,z:center.z,bottomY:base,topY:center.y,radius});
  if(posts.length>=limit)break;
 }
 return posts;
}
