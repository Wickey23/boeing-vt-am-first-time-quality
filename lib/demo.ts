import type {PartIntent} from "./types";
export const DEMO_PART:PartIntent={
 name:"AM Flight Bracket Demo",
 description:"Synthetic non-flight aerospace-style bracket used to demonstrate the first-time-quality workflow.",
 length:96,width:54,height:42,wall:2.6,holeDiameter:10,material:"ti64",process:"lpbf",
 requirements:[
  {name:"Mounting envelope length",target:96,unit:"mm",tolerance:.2},
  {name:"Mounting-hole diameter",target:10,unit:"mm",tolerance:.1},
  {name:"Nominal web thickness",target:2.6,unit:"mm",tolerance:.15}
 ]
};
export const DEMO_STL_URL="/demo/am-flight-bracket-demo.stl";