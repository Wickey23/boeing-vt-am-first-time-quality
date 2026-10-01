import { ImageResponse } from "next/og";
export const size={width:64,height:64};
export const contentType="image/png";
export default function Icon(){return new ImageResponse(<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#07101c",border:"5px solid #e87722",color:"#ffffff",fontSize:24,fontWeight:900,letterSpacing:"-2px"}}>VT</div>,{...size});}