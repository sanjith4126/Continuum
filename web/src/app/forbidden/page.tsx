import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";
export default async function ForbiddenPage(){const user=await currentUser();return <main className="mx-auto max-w-xl p-12"><h1 className="text-3xl font-semibold">Access restricted</h1><p className="my-5">Your account does not have permission to open this workspace.</p><Link className="primary" href={user?homeFor(user.role):"/login"}>Return to your workspace</Link></main>;}
