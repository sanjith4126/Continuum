import { NextRequest,NextResponse } from "next/server";
import { apiAccess,smallJson } from "@/lib/api-access";
import { askAssistant } from "@/lib/ai/assistant";
export async function POST(req:NextRequest){
 try{
  const access=await apiAccess(req,"assistant");if(access.error)return access.error;
  let body;try{body=await smallJson(req);}catch{return NextResponse.json({ok:false,message:"Invalid request body."},{status:400});}
  if("studentId" in body)return NextResponse.json({ok:false,message:"Identity is determined by your session."},{status:400});
  if(typeof body.question!=="string"||!body.question.trim()||body.question.length>300)return NextResponse.json({ok:false,message:"Question must contain 1-300 characters."},{status:400});
  if(!access.user.partyId)return NextResponse.json({ok:false,message:"Your account has no student profile. Contact your administrator."},{status:403});
  const result=await askAssistant(access.user.partyId,body.question);
  return NextResponse.json(result,{status:result.ok?200:400});
 }catch{return NextResponse.json({ok:false,message:"Service unavailable. Please try again."},{status:503});}
}
