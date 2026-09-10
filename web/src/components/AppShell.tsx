import Link from "next/link";
import type { ReactNode } from "react";
import { SidebarNav } from "./SidebarNav";

export function AppShell({
  children,
  breadcrumb,
}: {
  children: ReactNode;
  breadcrumb: string;
}) {
  return (
    <div className="min-h-screen bg-(--color-surface) font-(family-name:--font-ui)">
      <aside className="fixed left-0 top-0 z-50 flex h-full w-60 flex-col justify-between border-r border-(--color-outline-variant)/60 bg-(--color-surface-container-lowest)">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-14 items-center border-b border-(--color-outline-variant)/40 px-4">
            <span className="text-[15px] font-semibold tracking-tight text-(--color-on-surface)">
              Continuum
            </span>
            <span className="ml-auto rounded bg-(--color-surface-container) px-1.5 py-0.5 font-(family-name:--font-data) text-[11px] text-(--color-on-surface-variant)">
              v1
            </span>
          </div>
          <SidebarNav />
        </div>
        <div className="border-t border-(--color-outline-variant)/40 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--color-accent-500) text-white text-xs font-semibold">
              A
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-(--color-on-surface)">
                Admin / Ops
              </div>
              <div className="truncate font-(family-name:--font-data) text-[11px] text-(--color-outline)">
                continuum-demo
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="pl-60">
        <header className="fixed left-60 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-(--color-outline-variant)/50 bg-(--color-surface-container-lowest)/90 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 text-[13px] text-(--color-on-surface-variant)">
            <Link
              href="/dashboard"
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
        <main className="min-h-screen w-full bg-(--color-surface) pt-14">
          {children}
        </main>
      </div>
    </div>
  );
}
