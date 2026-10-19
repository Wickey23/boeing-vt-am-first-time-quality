/// <reference lib="webworker" />
import {solvePartThermal} from '../lib/voxel-thermal';
self.onmessage=e=>{try{const {file,rotation,unitScale,input}=e.data;self.postMessage({ok:true,field:solvePartThermal(file,rotation,unitScale,input)});}catch(e){self.postMessage({ok:false,error:e instanceof Error?e.message:'Thermal solve failed'});}};
