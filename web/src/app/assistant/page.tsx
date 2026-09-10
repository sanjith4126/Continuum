import { AppShell } from "@/components/AppShell";
import { AssistantChat } from "./AssistantChat";
import { requireUser } from "@/lib/auth";
export default async function AssistantPage(){
 const user=await requireUser("assistant");
 return <AppShell breadcrumb="Student Assistant"><div className="mx-auto max-w-2xl px-6 py-8"><p className="eyebrow">YOUR LEARNING JOURNEY</p><h1 className="mt-3 text-3xl font-semibold">Hello, {user.name.split(" ")[0]}</h1><p className="mt-3 mb-8 text-sm text-slate-500">Your programmes, upcoming sessions and shared programme balance.</p><AssistantChat/></div></AppShell>;
}
