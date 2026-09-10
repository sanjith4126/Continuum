"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {can,type Role,type Permission} from "@/lib/permissions";
const items:{href:string;label:string;permission:Permission}[]=[
 {href:"/dashboard",label:"Overview",permission:"dashboard"},
 {href:"/crm",label:"Sales & enquiries",permission:"crm"},
 {href:"/training",label:"Training operations",permission:"training"},
 {href:"/finance",label:"Billing & payments",permission:"finance"},
 {href:"/collections",label:"Collections",permission:"finance"},
 {href:"/consultant",label:"Data consultant",permission:"consultant"},
 {href:"/assistant",label:"My programmes",permission:"assistant"},
 {href:"/accounts",label:"Team & access",permission:"accounts"},
 {href:"/pipeline",label:"Demo lifecycle",permission:"demo"},
];
export function SidebarNav({role}:{role:Role}){const pathname=usePathname();return <nav aria-label="Workspace navigation" className="grid grid-cols-2 gap-1 overflow-y-auto px-3 py-4 md:flex md:flex-1 md:flex-col"><p className="eyebrow col-span-2 px-2 pb-3">WORKSPACE</p>{items.filter(i=>can(role,i.permission)).map(i=><Link key={i.href} href={i.href} aria-current={pathname===i.href?"page":undefined} className={`rounded-md px-3 py-2 text-[13px] ${pathname===i.href?"bg-blue-50 font-semibold text-blue-700":"text-slate-600 hover:bg-slate-100"}`}>{i.label}</Link>)}</nav>;}
