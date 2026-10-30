/**
 * M02/M03 human-factors preflight: compare a filename's declared nominal
 * dimensions against displayed *scaled* STL bounds. Name-based evidence can
 * only prompt a review; it must never silently change units or approve a part.
 */
export type Dimensions3={x:number;y:number;z:number};
export type UnitReview={
 status:"CHECK_SCALE";
 declaredMm:[number,number,number];
 measuredMm:[number,number,number];
 ratio:number;
 suggestedScaleToMm:number|null;
 message:string;
};
const supported=[1,25.4,1000];
export function reviewUnitsFromFilename(filename:string,measured:Dimensions3,scale:number):UnitReview|null{
 if(!Number.isFinite(scale)||scale<=0)return null;
 const match=filename.toLowerCase().match(/(?:^|[_ -])(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mm|millimeters?)\b/);
 if(!match)return null;
 const expected=match.slice(1,4).map(Number).sort((a,b)=>a-b) as [number,number,number];
 const actual=[measured.x,measured.y,measured.z].sort((a,b)=>a-b) as [number,number,number];
 if([...expected,...actual].some(x=>!Number.isFinite(x)||x<=0))return null;
 const ratios=actual.map((x,i)=>x/expected[i]);
 const average=Math.cbrt(ratios[0]*ratios[1]*ratios[2]);
 if(!(average>=50||average<=.02)||ratios.some(x=>Math.abs(x/average-1)>.07))return null;
 const correction=scale/average;
 const supportedScale=supported.find(v=>Math.abs(v/correction-1)<.02)??null;
 return {status:"CHECK_SCALE",declaredMm:expected,measuredMm:actual,ratio:average,
  suggestedScaleToMm:supportedScale,
  message:"Filename suggests nominal "+expected.join(" × ")+" mm, but currently displayed dimensions are "+
   actual.map(n=>Number(n.toPrecision(5))).join(" × ")+" mm (about "+Number(average.toPrecision(4))+
   "× larger/smaller). "+
   (supportedScale!==null?
    "Verify the source drawing and consider choosing "+({1:"Millimeters",25.4:"Inches",1000:"Meters"} as Record<number,string>)[supportedScale]+" in the STL units selector.":
    "No available units option aligns with this filename; check the CAD export scale and re-export in mm.")+
   " The filename is not proof of correct units."};
}
