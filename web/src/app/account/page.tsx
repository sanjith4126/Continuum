import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { logout } from "@/lib/auth-actions";
export default async function AccountPage(){
 const user=await currentUser();if(!user)redirect("/login");
 return <main className="mx-auto w-full max-w-md px-6 py-16"><p className="eyebrow">CONTINUUM / ACCOUNT</p><h1 className="mt-3 mb-3 text-3xl font-semibold">Secure your account</h1><p className="mb-8 text-sm text-slate-600">{user.mustChange?"Replace your temporary password before opening your workspace.":"Changing your password signs out all active sessions."}</p><AuthForm change/><div className="mt-8 flex justify-between text-sm">{!user.mustChange&&<Link href={homeFor(user.role)}>Back to workspace</Link>}<form action={logout}><button>Sign out</button></form></div></main>;
}
