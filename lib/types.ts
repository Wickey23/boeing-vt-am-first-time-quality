export type MaterialId="ti64"|"in718"|"alsi10mg"|"ss316l";
export type ProcessId="lpbf"|"ebm"|"ded";
export type Requirement={name:string;target:number;unit:string;tolerance?:number};
export type PartIntent={name:string;description:string;length:number;width:number;height:number;wall:number;holeDiameter:number;material:MaterialId;process:ProcessId;requirements:Requirement[]};
export type GeometryMetrics={volume:number;surfaceArea:number;dimensions:{x:number;y:number;z:number};triangleCount:number;aspectRatio:number;thinWallRisk:boolean};
export type Recommendation={id:string;category:"geometry"|"orientation"|"support"|"process"|"inspection";severity:"low"|"medium"|"high";title:string;rationale:string;action:string;confidence:number};
export type AnalysisResult={readiness:number;risk:"LOW"|"MEDIUM"|"HIGH";metrics:GeometryMetrics;recommendations:Recommendation[];assumptions:string[];modelVersion:string};