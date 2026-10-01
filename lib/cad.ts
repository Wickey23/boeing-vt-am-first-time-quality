import {PartIntent} from "./types";
export function buildParametricCad(p:PartIntent){
 const x=p.length/2,y=p.width/2,z=p.height/2; const h=Math.max(0.5,p.holeDiameter/2);
 return {kind:"parametric-block-v1",name:p.name,parameters:p,operations:[{type:"box",min:[-x,-y,0],max:[x,y,p.height]},{type:"through-hole",axis:"z",center:[0,0],radius:h,depth:p.height}],note:"Browser-native parametric seed geometry. Production CAD kernel integration is a separate service boundary."};
}
export function cadToAsciiStl(p:PartIntent){const x=p.length/2,y=p.width/2,z=p.height;const v=[[-x,-y,0],[x,-y,0],[x,y,0],[-x,y,0],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];const f=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];return "solid ftq\n"+f.map(t=>`facet normal 0 0 0\n outer loop\n${t.map(i=>`  vertex ${v[i].join(" ")}`).join("\n")}\n endloop\nendfacet`).join("\n")+"\nendsolid ftq";}