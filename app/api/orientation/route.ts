import {NextResponse} from "next/server";
import {analyzeOrientations} from "@/lib/orientation-engine";
import {createHash} from "crypto";
export const runtime="nodejs";
export async function POST(req:Request){try{
 const form=await req.formData();const file=form.get("file");if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".stl"))return NextResponse.json({error:"Upload a valid STL file."},{status:400});
 if(file.size>20*1024*1024)return NextResponse.json({error:"STL limit is 20 MB."},{status:413});
 const settings=JSON.parse(String(form.get("settings")||"{}"));const array=await file.arrayBuffer();
 const analysis=analyzeOrientations(array,settings);
 const sha256=createHash("sha256").update(Buffer.from(array)).digest("hex");
 return NextResponse.json({...analysis,source:{fileName:file.name,fileHashSha256:sha256,byteSize:file.size},generatedAt:new Date().toISOString(),algorithm:"orientation-engine-v0.1.0"});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Orientation analysis failed"},{status:400});}}
