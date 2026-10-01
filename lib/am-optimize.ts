import type {WingBoxInput,StructuralResult} from "./structural";
export type AMInput={structure:WingBoxInput;structural:StructuralResult;process:"lpbf"|"ebm";orientation:"span-z"|"chord-z"|"skin-z";machineProfile:"research-unqualified";};
export type AMResult={manufacturability:number;risk:"LOW"|"MEDIUM"|"HIGH";supportBurden:number;thinWallRisk:number;distortionRisk:number;powderRemovalRisk:number;recommendations:Array<{title:string;reason:string;action:string}>;assumptions:string[]};
export function analyzeAM(p:AMInput):AMResult{
 const t=p.structure.skin; let thin=t<1.2?90:t<1.8?65:t<2.5?38:20;
 let support=p.orientation==="skin-z"?72:p.orientation==="chord-z"?48:34;
 let distortion=Math.min(95,20+(p.structure.span/600)*20+(t<1.5?30:10));
 let powder=p.structure.ribCount>7?58:32;
 if(p.process==="ebm"&&p.structure.material==="aluminum")thin+=10;
 const score=Math.max(5,100-(thin*.32+support*.25+distortion*.28+powder*.15));
 const rec=[] as AMResult["recommendations"];
 if(thin>55)rec.push({title:"Thin-skin process risk",reason:"The selected skin thickness is sensitive to process capability and distortion.",action:"Validate with representative thin-wall coupons and a qualified machine/material profile before release."});
 if(support>55)rec.push({title:"Orientation drives support burden",reason:"This orientation exposes more load-carrying skin to support/contact risk.",action:"Compare alternate orientations while protecting critical structural surfaces."});
 if(distortion>55)rec.push({title:"Thermal distortion requires higher-fidelity analysis",reason:"Long thin-wall geometry is susceptible to residual-stress-driven distortion.",action:"Run thermal/process simulation and compare predicted distortion with instrumented builds."});
 rec.push({title:"Preserve structural intent",reason:"AM changes must not erase the load-path benefits selected by structural optimization.",action:"Re-run structural analysis after support, machining allowance, or geometry compensation changes."});
 return {manufacturability:score,risk:score<50?"HIGH":score<72?"MEDIUM":"LOW",supportBurden:support,thinWallRisk:Math.min(100,thin),distortionRisk:distortion,powderRemovalRisk:powder,recommendations:rec,assumptions:["Research screening model only.","No Boeing-qualified machine, feedstock lot, parameter set, scan strategy or post-process route is encoded.","Scores rank alternatives; they are not probabilities of successful flight-part manufacture."]};
}
export function optimizeAM(structure:WingBoxInput,structural:StructuralResult){return (["span-z","chord-z","skin-z"] as const).map(orientation=>({orientation,result:analyzeAM({structure,structural,process:"lpbf",orientation,machineProfile:"research-unqualified"})})).sort((a,b)=>b.result.manufacturability-a.result.manufacturability);}
