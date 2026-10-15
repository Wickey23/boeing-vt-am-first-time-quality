import {NextResponse} from "next/server";
import {analyzeOrientations} from "@/lib/orientation-engine";
import {createHash} from "node:crypto";
export const runtime="nodejs";
export async function POST(req:Request){
 try{
 const form=await req.formData(),file=form.get("file");
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".stl"))return NextResponse.json({error:"An STL file is required."},{status:400});
 if(!file.size||file.size>20*1024*1024)return NextResponse.json({error:"STL must be between 1 byte and 20 MB."},{status:413});
 const raw=JSON.parse(String(form.get("config")||"{}"));
 const layer=Number(raw.layerHeightMm),overhang=Number(raw.overhangDeg);
 if(!Number.isFinite(layer)||layer<.01||layer>1)throw Error("Layer height must be 0.01–1 mm");
 if(!Number.isFinite(overhang)||overhang<0||overhang>89)throw Error("Overhang threshold must be 0–89 degrees");
 const envelope=raw.machine||{};
 const source=await file.arrayBuffer();
 const base={machine:{x:Number(envelope.x),y:Number(envelope.y),z:Number(envelope.z)},overhangDeg:overhang,weights:{support:50,height:35,contact:15}};
 const result=analyzeOrientations(source,base);
 const comparison=result.candidates.map(c=>({...c,estimatedLayers:Math.ceil(c.buildHeightMm/layer)}));
 const fingerprint=createHash("sha256").update(Buffer.from(source)).digest("hex");
 return NextResponse.json({source:{fileName:file.name,sha256:fingerprint},generatedAt:new Date().toISOString(),engine:"geometric-layer-sensitivity-v1",setup:{machine:base.machine,overhangDeg:overhang,layerHeightMm:layer},candidates:comparison,limitations:["Layer count = ceil(build height / nominal layer thickness), excluding recoater travel, calibration, scan time and layer-specific scheduling.","Support burden is a centroid-based geometric proxy, not generated support geometry or slicer volume.","Changing overhang angle reclassifies triangle surfaces. No thermal, residual stress, distortion or structural physics are solved.","No material properties, qualified process envelope, scan strategy or measured machine timings have been supplied.","Research comparison only. Neither suitability nor certification is established."]});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to evaluate model"},{status:400})}
}
