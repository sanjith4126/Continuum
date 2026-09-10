import { NextRequest,NextResponse } from "next/server";
import { apiAccess,smallJson } from "@/lib/api-access";
import { askConsultant } from "@/lib/ai/consultant";
export async function POST(req:NextRequest){
 try{
  const access=await apiAccess(req,"consultant");if(access.error)return access.error;
  let body;try{body=await smallJson(req);}catch{return NextResponse.json({ok:false,message:"Invalid request body."},{status:400});}
  if(typeof body.question!=="string")return NextResponse.json({ok:false,message:"Missing question."},{status:400});
  const result=await askConsultant(body.question);return NextResponse.json(result,{status:result.ok?200:400});
 }catch{return NextResponse.json({ok:false,message:"Service unavailable. Please try again."},{status:503});}
}
