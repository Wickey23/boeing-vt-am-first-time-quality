import * as THREE from 'three';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
import type {jsPDF} from 'jspdf';
export function drawPartWireframe(doc:jsPDF,bytes:ArrayBuffer,rotation:{x:number;y:number;z:number},x:number,y:number,width:number,height:number){
 const geometry=new STLLoader().parse(bytes);const e=new THREE.Euler(rotation.x*Math.PI/180,rotation.y*Math.PI/180,rotation.z*Math.PI/180,'XYZ');geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));const p=geometry.getAttribute('position');const points:Array<[number,number]>=[];
 for(let i=0;i<p.count;i++){const a=p.getX(i),b=p.getY(i),c=p.getZ(i);points.push([(a-b)*.70710678,(a+b)*.40824829-c*.81649658]);}
 let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;for(const [a,b] of points){xmin=Math.min(xmin,a);xmax=Math.max(xmax,a);ymin=Math.min(ymin,b);ymax=Math.max(ymax,b);}const scale=Math.min(width/Math.max(1e-8,xmax-xmin),height/Math.max(1e-8,ymax-ymin));
 const project=(i:number)=>[x+width/2+(points[i][0]-(xmin+xmax)/2)*scale,y+height/2+(points[i][1]-(ymin+ymax)/2)*scale];
 doc.setDrawColor(40,94,135);doc.setLineWidth(.08);const stride=Math.max(1,Math.ceil(p.count/3/1500));for(let i=0;i<p.count;i+=3*stride){for(let j=0;j<3;j++){const a=project(i+j),b=project(i+(j+1)%3);doc.line(a[0],a[1],b[0],b[1]);}}geometry.dispose();doc.setDrawColor(0);return stride>1;
}
