/// <reference lib="webworker" />
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
import {auditSTL} from '../lib/stl-mesh-audit';
self.onmessage=(event:MessageEvent<{file:ArrayBuffer;scale:number}>)=>{
 try {
  const {file,scale}=event.data;
  const audit=auditSTL(file,scale);
  if(!audit.triangles)throw Error('The STL contains no triangles.');
  const geometry=new STLLoader().parse(file);geometry.computeBoundingBox();
  const b=geometry.boundingBox!;
  const dimensions={x:(b.max.x-b.min.x)*scale,y:(b.max.y-b.min.y)*scale,z:(b.max.z-b.min.z)*scale};
  geometry.dispose();
  self.postMessage({ok:true,audit,dimensions});
 }catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:'Unable to inspect STL'});}
};
