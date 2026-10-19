/// <reference lib="webworker" />
import {solvePartStructural} from '../lib/voxel-structural';
self.onmessage=e=>{try{const {file,rotation,unitScale,input}=e.data;self.postMessage({ok:true,field:solvePartStructural(file,rotation,unitScale,input)});}catch(e){self.postMessage({ok:false,error:e instanceof Error?e.message:'Structural solve failed'});}};
