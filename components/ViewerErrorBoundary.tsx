"use client";
import React from "react";
type Props={children:React.ReactNode;fallback?:React.ReactNode};
type State={error:Error|null};
export default class ViewerErrorBoundary extends React.Component<Props,State>{
 state:State={error:null};
 static getDerivedStateFromError(error:Error):State{return {error};}
 componentDidCatch(error:Error,info:React.ErrorInfo){console.error("ORIENTAI 3D viewer failed",error,info.componentStack);}
 render(){if(this.state.error)return <div role="alert" style={{padding:20,background:"#f4f7fb",color:"#183c62",borderRadius:10}}><strong>3D preview could not start</strong><p>The geometry analysis may still be available below. A WebGL or mesh preview failure should not cancel the engineering results.</p><p style={{fontSize:12,overflowWrap:"anywhere"}}>Browser diagnostic: {this.state.error.message}</p><button type="button" onClick={()=>this.setState({error:null})}>Retry 3D preview</button></div>;return this.props.children;}
}
