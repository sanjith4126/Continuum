import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";
import { redirect } from "next/navigation";
export default async function LoginPage({searchParams}:{searchParams:Promise<{changed?:string}>}) {
 const user=await currentUser();if(user) redirect(user.mustChange?"/account":homeFor(user.role));
 const {changed}=await searchParams;
 return <main className="lg:grid lg:min-h-screen lg:grid-cols-2">
  {/* Below lg, main is normal block flow (not a stretching grid row), so
      each section is exactly as tall as its own content -- no artificial
      gap. From lg up, the original min-h-screen split-screen grid returns
      unchanged. */}
  <section className="flex flex-col bg-[#152b36] p-5 text-white lg:min-h-screen lg:justify-between lg:p-16">
   <div className="text-base font-semibold tracking-tight lg:text-lg">Continuum <span className="ml-3 font-mono text-xs text-emerald-300">BUSINESS OPERATIONS</span></div>
   <div className="hidden py-14 lg:block"><p className="mb-5 font-mono text-xs uppercase tracking-[.25em] text-emerald-300">Enquiry to outcome</p><h1 className="max-w-lg text-4xl leading-tight font-semibold lg:text-6xl">Every programme.<br/>Every rupee.<br/>One clear picture.</h1><p className="mt-8 max-w-md text-sm leading-7 text-slate-300">Connect sales, training delivery and finance. Follow each batch from its first enquiry to its final margin.</p></div>
   <p className="mt-3 text-xs text-slate-300 lg:hidden">Every programme. Every rupee. One clear picture.</p>
   <div className="mt-4 hidden gap-8 border-t border-white/20 pt-6 font-mono text-xs text-slate-300 lg:flex"><span>01 / SALES</span><span>02 / DELIVERY</span><span>03 / FINANCE</span></div>
  </section>
  <section className="flex justify-center p-6 sm:p-8 lg:min-h-screen lg:items-center"><div className="w-full max-w-sm"><p className="mb-3 font-mono text-xs uppercase tracking-widest text-slate-500">Your workspace</p><h2 className="mb-2 text-3xl font-semibold">Welcome back</h2><p className="mb-8 text-sm text-slate-500">Sign in with the account provided by your administrator.</p>{changed&&<p role="status" className="mb-6 text-sm text-green-700">Password updated. Sign in with your new password.</p>}<AuthForm/><p className="mt-4 text-xs"><Link href="/forgot-password" className="text-blue-700">Forgot your password?</Link></p><p className="mt-3 text-xs leading-6 text-slate-500">Need access? Contact your workspace administrator.</p></div></section>
 </main>;
}
