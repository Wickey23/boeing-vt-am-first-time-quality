/// <reference lib="webworker" />
import {solvePartThermal} from '../lib/voxel-thermal';
self.onmessage=e=>{try{const {file,rotation,unitScale,input}=e.data;if(e.data.compare===true){
 const coarse=solvePartThermal(file,rotation,unitScale,input);
 const fineResolution=Math.min(24,Math.max(input.resolution+2,Math.ceil(input.resolution*1.5)));
 if(fineResolution===input.resolution)throw new Error("Already at maximum thermal resolution");
 const finer=solvePartThermal(file,rotation,unitScale,{...input,resolution:fineResolution});
 self.postMessage({ok:true,comparison:{coarse:{resolution:input.resolution,cells:coarse.mesh.cells,min:coarse.min,max:coarse.max},finer:{resolution:fineResolution,cells:finer.mesh.cells,min:finer.min,max:finer.max},maximumDifferenceC:Math.abs(finer.max-coarse.max),minimumDifferenceC:Math.abs(finer.min-coarse.min),note:"This is two-point mesh sensitivity only. It does not verify laser physics, establish true mesh independence or validate LPBF temperature."}});
 }else self.postMessage({ok:true,field:solvePartThermal(file,rotation,unitScale,input)});}catch(e){self.postMessage({ok:false,error:e instanceof Error?e.message:'Thermal solve failed'});}};
