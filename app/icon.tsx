import {ImageResponse} from "next/og";
export const size={width:64,height:64};
export const contentType="image/png";
export default function Icon(){
 return new ImageResponse(
 <div style={{width:64,height:64,display:"flex",position:"relative",alignItems:"center",justifyContent:"center",background:"#10243a",borderRadius:14,overflow:"hidden"}}>
  <div style={{position:"absolute",left:10,top:10,width:44,height:44,border:"2px solid #477da7",borderRadius:9,transform:"rotate(-17deg)",display:"flex"}}/>
  <div style={{position:"absolute",left:14,top:42,width:37,height:4,background:"#5cb7ff",borderRadius:2,transform:"rotate(-10deg)",display:"flex"}}/>
  <div style={{position:"absolute",left:20,top:22,width:24,height:24,border:"5px solid #ffffff",borderRadius:3,transform:"rotate(-24deg)",display:"flex",background:"#234766"}}/>
  <div style={{position:"absolute",left:40,top:8,width:5,height:27,background:"#32c4e8",borderRadius:3,transform:"rotate(35deg)",display:"flex"}}/>
  <div style={{position:"absolute",left:44,top:5,width:0,height:0,borderLeft:"7px solid transparent",borderRight:"7px solid transparent",borderBottom:"11px solid #32c4e8",transform:"rotate(35deg)",display:"flex"}}/>
  <div style={{position:"absolute",left:12,top:48,width:8,height:5,background:"#ffab52",borderRadius:2,display:"flex"}}/>
 </div>,{...size}
 );
}
