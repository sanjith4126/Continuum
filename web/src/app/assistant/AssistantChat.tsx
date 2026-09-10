"use client";
import { useState,useRef } from "react";
type Turn={question:string;answer:string;error?:boolean};
export function AssistantChat(){
 const [question,setQuestion]=useState("");const [turns,setTurns]=useState<Turn[]>([]);const [loading,setLoading]=useState(false);const busy=useRef(false);
 async function ask(q:string){
  if(!q.trim()||busy.current)return;busy.current=true;setLoading(true);setQuestion("");
  try{const res=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q.trim()})});const data=await res.json();setTurns(t=>[...t,{question:q,answer:data.ok?data.answer:data.message,error:!data.ok}]);}
  catch{setTurns(t=>[...t,{question:q,answer:"Unable to connect. Please try again.",error:true}]);}
  finally{busy.current=false;setLoading(false);}
 }
 return <div><div className="panel mb-6"><p className="text-sm leading-6 text-slate-600">Ask about your next class or your programme balance. Your answers are based on the programmes linked to your account.</p></div><div className="space-y-5" aria-live="polite">{turns.map((t,i)=><div key={i}><div className="ml-auto mb-3 max-w-[85%] rounded-lg bg-blue-700 p-3 text-sm text-white">{t.question}</div><div className={`panel text-sm leading-6 ${t.error?"text-red-700":""}`}>{t.answer}</div></div>)}{loading&&<p role="status" className="text-sm text-slate-500">Checking your programmes...</p>}</div><div className="mt-6 flex flex-wrap gap-2">{["When's my next class?","What's my balance?"].map(q=><button key={q} disabled={loading} onClick={()=>ask(q)} className="rounded-full border bg-white px-3 py-2 text-xs">{q}</button>)}</div><form className="mt-4 flex gap-2" onSubmit={e=>{e.preventDefault();ask(question);}}><label className="field min-w-0 flex-1"><span className="sr-only">Your question</span><input value={question} onChange={e=>setQuestion(e.target.value)} maxLength={300} placeholder="Ask about your schedule or balance..."/></label><button className="primary" disabled={loading||!question.trim()}>Send</button></form></div>;
}
