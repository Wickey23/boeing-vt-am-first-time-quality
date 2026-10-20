// Original educational geometry, millimeters. No aircraft drawing was copied.
import * as THREE from 'three';import {STLExporter} from 'three/examples/jsm/exporters/STLExporter.js';import {writeFileSync} from 'node:fs';
const shape=new THREE.Shape();shape.moveTo(-20,0);shape.lineTo(20,0);shape.lineTo(20,8);shape.lineTo(12,32);shape.absarc(0,32,12,0,Math.PI,false);shape.lineTo(-20,8);shape.closePath();
const hole=new THREE.Path();hole.absarc(0,32,5,0,Math.PI*2,true);shape.holes.push(hole);
const geometry=new THREE.ExtrudeGeometry(shape,{depth:6,bevelEnabled:false,curveSegments:16});
const stl=new STLExporter().parse(new THREE.Mesh(geometry));writeFileSync('public/verification/aerospace-mounting-lug.stl',stl);
