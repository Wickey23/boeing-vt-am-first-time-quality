import {NextResponse} from "next/server";
import {makeMountingPlateSTL} from "@/lib/sample-plate";
export async function GET(){
 return new NextResponse(makeMountingPlateSTL(),{headers:{"content-type":"model/stl; charset=utf-8","cache-control":"public, max-age=3600"}});
}
