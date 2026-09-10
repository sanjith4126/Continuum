"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// /trace has no page of its own -- only /trace/[leadId] is a real route
// (see src/app/trace/[leadId]/page.tsx). Point the nav at the seeded
// Acme lead so "Traceability" always lands somewhere real; the dashboard's
// per-batch "Trace →" links are the primary way into other leads.
const ACME_LEAD_ID = "00000000-0000-0000-0000-0000000000e1";

const CORE_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/collections", label: "Collections" },
  { href: `/trace/${ACME_LEAD_ID}`, label: "Traceability" },
  { href: "/pipeline", label: "Run lifecycle" },
];

const INTELLIGENCE_ITEMS = [
  { href: "/consultant", label: "AI Consultant" },
  { href: "/assistant", label: "Student Assistant" },
];

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors " +
        (active
          ? "bg-(--color-accent-100) font-medium text-(--color-accent-600)"
          : "text-(--color-on-surface-variant) hover:bg-(--color-surface-container-low) hover:text-(--color-on-surface)")
      }
    >
      {label}
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-(--color-outline)">
        Core Operations
      </div>
      {CORE_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={item.label}
          active={pathname === item.href || pathname?.startsWith(item.href + "/")}
        />
      ))}
      <div className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-(--color-outline)">
        Intelligence
      </div>
      {INTELLIGENCE_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={item.label}
          active={pathname === item.href}
        />
      ))}
    </nav>
  );
}
