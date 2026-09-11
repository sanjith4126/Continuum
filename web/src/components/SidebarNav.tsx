"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {can,type Role,type Permission} from "@/lib/permissions";
export const NAV_ITEMS:{href:string;label:string;shortLabel:string;permission:Permission;icon:string}[]=[
 {href:"/dashboard",label:"Overview",shortLabel:"Home",permission:"dashboard",icon:"space_dashboard"},
 {href:"/crm",label:"Sales & enquiries",shortLabel:"CRM",permission:"crm",icon:"contacts"},
 {href:"/training",label:"Training operations",shortLabel:"Training",permission:"training",icon:"school"},
 {href:"/finance",label:"Billing & payments",shortLabel:"Finance",permission:"finance",icon:"payments"},
 {href:"/collections",label:"Collections",shortLabel:"Collections",permission:"finance",icon:"account_balance"},
 {href:"/consultant",label:"Data consultant",shortLabel:"Consultant",permission:"consultant",icon:"smart_toy"},
 {href:"/assistant",label:"My programmes",shortLabel:"Assistant",permission:"assistant",icon:"forum"},
 {href:"/accounts",label:"Team & access",shortLabel:"Accounts",permission:"accounts",icon:"admin_panel_settings"},
 {href:"/pipeline",label:"Demo lifecycle",shortLabel:"Pipeline",permission:"demo",icon:"bolt"},
];
export function navItemsFor(role:Role){return NAV_ITEMS.filter(i=>can(role,i.permission));}
export function SidebarNav({role}:{role:Role}){const pathname=usePathname();return <nav aria-label="Workspace navigation" className="hidden md:flex md:flex-1 md:flex-col gap-1 overflow-y-auto px-3 py-4"><p className="eyebrow px-2 pb-3">WORKSPACE</p>{navItemsFor(role).map(i=><Link key={i.href} href={i.href} aria-current={pathname===i.href?"page":undefined} className={`rounded-md px-3 py-2 text-[13px] ${pathname===i.href?"bg-blue-50 font-semibold text-blue-700":"text-slate-600 hover:bg-slate-100"}`}>{i.label}</Link>)}</nav>;}
