import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { currentUser } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";
import { redirect } from "next/navigation";
export default async function ForgotPasswordPage() {
 const user=await currentUser();if(user) redirect(user.mustChange?"/account":homeFor(user.role));
 return <main className="grid min-h-screen lg:grid-cols-2">
  <section className="flex flex-col justify-between bg-[#152b36] p-8 text-white lg:p-16">
   <div className="text-lg font-semibold tracking-tight">Continuum <span className="ml-3 font-mono text-xs text-emerald-300">BUSINESS OPERATIONS</span></div>
   <div className="py-14"><p className="mb-5 font-mono text-xs uppercase tracking-[.25em] text-emerald-300">Enquiry to outcome</p><h1 className="max-w-lg text-4xl leading-tight font-semibold lg:text-6xl">Every programme.<br/>Every rupee.<br/>One clear picture.</h1><p className="mt-8 max-w-md text-sm leading-7 text-slate-300">Connect sales, training delivery and finance. Follow each batch from its first enquiry to its final margin.</p></div>
   <div className="flex gap-8 border-t border-white/20 pt-6 font-mono text-xs text-slate-300"><span>01 / SALES</span><span>02 / DELIVERY</span><span>03 / FINANCE</span></div>
  </section>
  <section className="flex items-center justify-center p-8"><div className="w-full max-w-sm"><p className="mb-3 font-mono text-xs uppercase tracking-widest text-slate-500">Account recovery</p><h2 className="mb-2 text-3xl font-semibold">Forgot your password?</h2><p className="mb-8 text-sm text-slate-500">Enter the email your account was registered with. If it&apos;s enrolled, we&apos;ll email a new temporary password — you&apos;ll be asked to set your own right after signing in.</p><ForgotPasswordForm/><p className="mt-7 text-xs leading-6 text-slate-500"><Link href="/login" className="text-blue-700">Back to sign in</Link></p></div></section>
 </main>;
}
