import Link from "next/link";
import type { ReactNode } from "react";
import { SidebarNav } from "./SidebarNav";
import { requireUser } from "@/lib/auth";
import { logout } from "@/lib/auth-actions";

export async function AppShell({
  children,
  breadcrumb,
}: {
  children: ReactNode;
  breadcrumb: string;
}) {
  const user=await requireUser();
  return (
    <div className="min-h-screen bg-(--color-surface) font-(family-name:--font-ui)">
      <aside className="relative z-50 flex w-full flex-col justify-between border-r border-(--color-outline-variant)/60 bg-(--color-surface-container-lowest) md:fixed md:left-0 md:top-0 md:h-full md:w-60">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-14 items-center border-b border-(--color-outline-variant)/40 px-4">
            <span className="text-[15px] font-semibold tracking-tight text-(--color-on-surface)">
              Continuum
            </span>
            <span className="ml-auto rounded bg-(--color-surface-container) px-1.5 py-0.5 font-(family-name:--font-data) text-[11px] text-(--color-on-surface-variant)">
              v1
            </span>
          </div>
          <SidebarNav role={user.role} />
        </div>
        <div className="border-t border-(--color-outline-variant)/40 p-3">
          <div className="mb-3 flex justify-between text-xs"><Link href="/account">Account</Link><form action={logout}><button>Sign out</button></form></div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--color-accent-500) text-white text-xs font-semibold">
              {user.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-(--color-on-surface)">
                {user.role}
              </div>
              <div className="truncate font-(family-name:--font-data) text-[11px] text-(--color-outline)">
                {user.email}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 md:pl-60">
        <header className="relative z-40 flex h-14 items-center justify-between border-b border-(--color-outline-variant)/50 bg-(--color-surface-container-lowest)/90 px-6 backdrop-blur-sm md:fixed md:left-60 md:right-0 md:top-0">
          <div className="flex items-center gap-3 text-[13px] text-(--color-on-surface-variant)">
            <Link
              href="/"
              className="text-(--color-outline) hover:text-(--color-on-surface)"
            >
              Continuum
            </Link>
            <span className="text-(--color-outline)">/</span>
            <span className="font-medium text-(--color-on-surface)">
              {breadcrumb}
            </span>
          </div>
        </header>
        <main className="min-h-screen w-full min-w-0 bg-(--color-surface) md:pt-14">
          {children}
        </main>
      </div>
    </div>
  );
}
