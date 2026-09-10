"use client";
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <main className="mx-auto max-w-lg px-6 py-20"><p className="eyebrow">CONTINUUM</p><h1 className="my-4 text-3xl font-semibold">We couldn’t load this workspace.</h1><p className="mb-6 text-sm leading-6 text-slate-500">The service may be temporarily unavailable. Your saved records are still in place.</p><button onClick={reset} className="primary">Try again</button></main>;
}
