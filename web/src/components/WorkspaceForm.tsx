"use client";
import { useActionState,useRef } from "react";
import { submitOperation } from "@/lib/operations";
export type Field={name:string;label:string;type?:string;required?:boolean;options?:{value:string;label:string}[];value?:string;min?:string;max?:string};
export function WorkspaceForm({title,kind,fields,description}:{title:string;kind:string;fields:Field[];description?:string}){
 const request=useRef<string|null>(null);
 const [state,action,pending]=useActionState(async(prev:{ok:boolean;message:string},data:FormData)=>{
  request.current??=crypto.randomUUID();data.set("requestId",request.current);data.set("kind",kind);
  const result=await submitOperation(prev,data);if(result.ok)request.current=null;return result;
 },{ok:false,message:""});
 return <details className="panel"><summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">{title}</summary>{description&&<p className="mt-3 text-xs leading-6 text-slate-500">{description}</p>}<form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map(f=><label className={`field ${f.type==="textarea"?"sm:col-span-2":""}`} key={f.name}>{f.label}{f.options?<select name={f.name} defaultValue={f.value??""} required={f.required!==false} className="truncate"><option value="">Select...</option>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:f.type==="textarea"?<textarea name={f.name} required={f.required!==false} maxLength={4000} rows={3}/>:<input name={f.name} type={f.type??"text"} defaultValue={f.value} required={f.required!==false} min={f.min} max={f.max} step={f.type==="number"?"0.01":undefined} maxLength={f.type==="email"?254:200}/> }</label>)}<div className="sm:col-span-2 flex flex-wrap items-center gap-4"><button className="primary min-h-11 w-full sm:w-auto" disabled={pending}>{pending?"Saving...":"Save"}</button>{state.message&&<p role="status" className={`min-h-5 text-sm ${state.ok?"text-green-700":"text-red-700"}`}>{state.message}</p>}</div></form></details>;
}
