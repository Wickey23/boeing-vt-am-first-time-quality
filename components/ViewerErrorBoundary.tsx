"use client";
import React from "react";
type Props={children:React.ReactNode;fallback?:React.ReactNode};
type State={error:Error|null};
/** Keep deterministic analysis and an actual STL preview available when WebGL fails. */
export default class ViewerErrorBoundary extends React.Component<Props,State>{
 state:State={error:null};
 static getDerivedStateFromError(error:Error):State{return {error};}
 componentDidCatch(error:Error,info:React.ErrorInfo){
  console.warn("ORIENTAI 3D rendering unavailable",error.message,info.componentStack);
 }
 render(){
  if(!this.state.error)return this.props.children;
  return <div style={{height:"100%",minHeight:275,display:"flex",flexDirection:"column",background:"#0d1c2d",color:"#d8e8f7"}}>
   {this.props.fallback??<p style={{padding:20}}>3D rendering is unavailable. Geometry analysis remains available.</p>}
   <div role="status" style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",
    padding:"9px 12px",borderTop:"1px solid #40566b",fontSize:11,background:"#15283b"}}>
    <span>{this.props.fallback?"WebGL unavailable · showing the uploaded STL in a 2D geometry viewer.":"WebGL unavailable."}</span>
    <button type="button" style={{background:"#28567e",color:"white",border:"1px solid #6188ab",
     padding:"6px 9px",borderRadius:7,cursor:"pointer",whiteSpace:"nowrap"}}
     onClick={()=>this.setState({error:null})}>Retry 3D</button>
   </div>
   <details style={{fontSize:10,padding:"5px 12px",color:"#a3bfd5"}}><summary>Renderer diagnostic</summary><code>{this.state.error.message}</code></details>
  </div>;
 }
}
