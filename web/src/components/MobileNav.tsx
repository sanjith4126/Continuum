"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { navItemsFor } from "./SidebarNav";
import { NavIcon } from "./NavIcon";
import { logout } from "@/lib/auth-actions";
import type { Role } from "@/lib/permissions";

// Mobile-only nav: a fixed top bar (hamburger + breadcrumb + account),
// a bottom tab bar with up to 4 primary workspaces, and a slide-in drawer
// listing every workspace the role can reach. Desktop keeps the existing
// fixed left sidebar (AppShell) untouched -- this whole component is
// `md:hidden`.
export function MobileNav({
  role,
  breadcrumb,
  userName,
  userEmail,
}: {
  role: Role;
  breadcrumb: string;
  userName: string;
  userEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = navItemsFor(role);
  const tabItems = items.slice(0, 4);

  // Close the drawer on route change so it never stays open across nav.
  // Adjusted during render (React's documented pattern for resetting state
  // in response to a prop/derived-value change) rather than in a
  // useEffect, which would cause an extra render pass on every navigation.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur-sm pt-safe">
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
        >
          <NavIcon name="menu" className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">
          <span className="text-slate-400">Continuum /</span> {breadcrumb}
        </div>
        <Link
          href="/account"
          aria-label="Account"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#14224A] text-xs font-semibold text-white">
            {userName[0]}
          </span>
        </Link>
      </header>

      {/* Bottom tab bar */}
      {tabItems.length > 0 && (
        <nav
          aria-label="Primary workspaces"
          className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t border-slate-200 bg-white pb-safe"
        >
          {tabItems.map((i) => {
            const active = pathname === i.href;
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active ? "page" : undefined}
                className="flex min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1"
              >
                <NavIcon
                  name={i.icon}
                  className={`h-5 w-5 ${active ? "text-[#0E9AA7]" : "text-slate-400"}`}
                />
                <span
                  className={`text-[11px] font-medium ${active ? "text-[#0E9AA7]" : "text-slate-500"}`}
                >
                  {i.shortLabel}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Slide-in drawer with every workspace */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 pt-safe">
              <span className="text-[15px] font-semibold tracking-tight text-slate-900">
                Continuum
              </span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                <NavIcon name="close" className="h-6 w-6" />
              </button>
            </div>
            <nav aria-label="All workspaces" className="flex-1 overflow-y-auto px-3 py-4">
              <p className="eyebrow px-2 pb-3">WORKSPACE</p>
              <div className="flex flex-col gap-1">
                {items.map((i) => {
                  const active = pathname === i.href;
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-[14px] ${
                        active
                          ? "bg-blue-50 font-semibold text-blue-700"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <NavIcon name={i.icon} className="h-5 w-5 shrink-0" />
                      {i.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
            <div className="border-t border-slate-200 p-3 pb-safe">
              <div className="mb-3 flex items-center gap-2 px-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14224A] text-xs font-semibold text-white">
                  {userName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-slate-800">{role}</div>
                  <div className="truncate text-[11px] text-slate-500">{userEmail}</div>
                </div>
              </div>
              <Link
                href="/account"
                className="flex min-h-[44px] items-center gap-2 rounded-md px-2 py-2 text-[13px] text-slate-600 hover:bg-slate-100"
              >
                <NavIcon name="account" className="h-4 w-4" /> Account
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="flex min-h-[44px] w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-100"
                >
                  <NavIcon name="logout" className="h-4 w-4" /> Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
