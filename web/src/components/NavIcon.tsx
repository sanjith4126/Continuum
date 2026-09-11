// Tiny inline-SVG icon set for the mobile bottom tab bar and drawer — kept
// as hand-drawn 24x24 outline icons rather than pulling in an icon font or
// library, matching the rest of the app's lean, dependency-free style.
const paths: Record<string, string> = {
  space_dashboard: "M4 5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5ZM4 13a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z",
  contacts: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  school: "m2 9 10-5 10 5-10 5-10-5Zm4 3v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5",
  payments: "M3 6h18v12H3V6Zm0 5h18M7 15h4",
  account_balance: "M3 10h18M5 10v9M9 10v9M15 10v9M19 10v9M3 19h18M12 3 3 8h18L12 3Z",
  smart_toy: "M9 4h6v3H9V4Zm-3 5h12v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9Zm2 4h.01M14 13h.01",
  forum: "M4 4h13v9H8l-4 4V4Zm7 12h9v5l-4-4h-5v-1Z",
  admin_panel_settings: "M12 3 4 6v6c0 4.5 3.4 7.9 8 9 4.6-1.1 8-4.5 8-9V6l-8-3Zm0 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm0 6.5c-1.9 0-3.5.9-3.5 2v.5h7v-.5c0-1.1-1.6-2-3.5-2Z",
  bolt: "m13 2-9 12h6l-1 8 9-12h-6l1-8Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  account: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  logout: "M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4m6-4 4-4-4-4m4 4H9",
};

export function NavIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const d = paths[name] ?? paths.bolt;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
