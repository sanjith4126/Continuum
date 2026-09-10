import { NextRequest, NextResponse } from "next/server";
import { currentUser, takeQuota } from "./auth";
import { can, type Permission } from "./permissions";
export async function apiAccess(req:NextRequest,permission:Permission){
 const origin=req.headers.get("origin");
 if((origin&&origin!==req.nextUrl.origin)||req.headers.get("sec-fetch-site")==="cross-site")return {error:NextResponse.json({ok:false,message:"Invalid origin."},{status:403})};
 const user=await currentUser();
 if(!user)return {error:NextResponse.json({ok:false,message:"Sign in to continue."},{status:401})};
 if(user.mustChange||!can(user.role,permission))return {error:NextResponse.json({ok:false,message:"Access restricted."},{status:403})};
 if(!await takeQuota(`ai-minute:${user.id}`,20,60)||!await takeQuota(`ai-day:${user.id}`,200,86400))return {error:NextResponse.json({ok:false,message:"Your AI request limit has been reached. Try again later."},{status:429})};
 return {user};
}
export async function smallJson(req:NextRequest):Promise<Record<string,unknown>>{
 const reader=req.body?.getReader();if(!reader)throw new Error("Missing body");
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new Error("Body too large");}chunks.push(value);}}finally{reader.releaseLock();}
 const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
 if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("Invalid body");
 return body;
}
