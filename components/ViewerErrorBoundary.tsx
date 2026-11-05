"use client";
import React from "react";
type Props={children:React.ReactNode;fallback?:React.ReactNode};
type State={error:Error|null};
/** A failed WebGL context must not hide STL geometry or interrupt deterministic analysis. */
export default class ViewerErrorBoundary extends React.Component<Props,State>{
 state:State={error:null};
 static getDerivedStateFromError(error:Error):State{return {error};}
 componentDidCatch(error:Error,info:React.ErrorInfo){
  console.warn("ORIENTAI WebGL viewport unavailable; using safe geometric fallback",error.message,info.componentStack);
 }
 render(){
  if(!this.state.error)return this.props.children;
  return <div className="oaWebGLFallback">
   {this.props.fallback??<div role="status">3D rendering unavailable. Geometry analysis is unaffected.</div>}
   <div className="oaWebGLNotice" role="status">
    <span>WebGL unavailable. {this.props.fallback?"Showing the uploaded STL with the 2D renderer.":"The 3D preview is unavailable."}</span>
    <button type="button" onClick={()=>this.setState({error:null})}>Retry 3D</button>
   </div>
   <details className="oaWebGLDiagnostic"><summary>Renderer diagnostic</summary><code>{this.state.error.message}</code></details>
  </div>;
 }
}
