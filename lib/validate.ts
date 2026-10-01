import type {PartIntent} from "./types";
import {MATERIALS} from "./materials";
export function validateIntent(p:PartIntent){
 const errors:string[]=[];
 if(!p||typeof p!=="object")return ["Missing part intent."];
 if(!p.name?.trim())errors.push("Part name is required.");
 for(const k of ["length","width","height","wall","holeDiameter"] as const)if(!Number.isFinite(p[k])||p[k]<=0)errors.push(`${k} must be a positive number.`);
 if(p.holeDiameter>=Math.min(p.length||0,p.width||0))errors.push("Hole diameter must be smaller than the part width and length.");
 if(!MATERIALS[p.material])errors.push("Unsupported material.");
 else if(!MATERIALS[p.material].processes.includes(p.process))errors.push(`${MATERIALS[p.material].name} is not enabled for the selected process in this research profile.`);
 return errors;
}