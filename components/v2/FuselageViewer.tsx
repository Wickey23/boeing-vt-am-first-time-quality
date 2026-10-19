"use client";
import dynamic from 'next/dynamic';
const FuselageViewer=dynamic(()=>import('./FuselageScene'),{ssr:false});
export default FuselageViewer;
