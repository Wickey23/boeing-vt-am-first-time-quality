import {NextResponse} from "next/server";
import {predictSupport, type SupportModel} from "@/lib/support-ml";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
export const runtime="nodejs";
export async function GET(){
 try{const raw=await readFile(join(process.cwd(),"ml/models/support-model.json"),"utf8");const m=JSON.parse(raw) as SupportModel;
 return NextResponse.json({ready:true,version:m.version,profileId:m.profile_id,qualification:m.status,holdout:m.training});
 }catch{return NextResponse.json({ready:false,message:"No validated training dataset/model artifact has been supplied; predictions disabled."});}
}
export async function POST(req:Request){
 try{
 const body=await req.json();const raw=await readFile(join(process.cwd(),"ml/models/support-model.json"),"utf8");const model=JSON.parse(raw) as SupportModel;
 if(typeof body.profileId!=="string"||typeof body.features!=="object"||body.features===null)return NextResponse.json({error:"profileId and numeric features required"},{status:400});
 return NextResponse.json(predictSupport(model,body.features,body.profileId));
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"ML model is unavailable"},{status:503});}
}
