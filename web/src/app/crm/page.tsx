import Link from "next/link";
import {AppShell} from "@/components/AppShell";
import {WorkspaceForm} from "@/components/WorkspaceForm";
import {EditLeadForm} from "@/components/EditLeadForm";
import {DataTable} from "@/components/DataTable";
import {crmData,options} from "@/lib/workspace";
import {formatINR} from "@/lib/format";
export default async function CrmPage(){const data=await crmData();const leads=options(data.leads);return <AppShell breadcrumb="Sales & enquiries"><div className="mx-auto max-w-6xl space-y-7 px-6 py-8"><header><p className="eyebrow">01 / SALES</p><h1 className="mt-3 text-3xl font-semibold">From first conversation<br/>to a confirmed programme.</h1><p className="mt-3 text-sm text-slate-500">Capture enquiries, keep a contact history, and move qualified leads into training.</p></header><DataTable columns={["Customer","Stage","Source","Contact","Journey"]} rows={data.leads.map(r=>[String(r.name),String(r.stage),String(r.source??"—"),String(r.email??"—"),<Link key={String(r.id)} className="text-blue-700" href={`/trace/${r.id}`}>View trace</Link>])}/><div className="grid items-start gap-4 lg:grid-cols-2">
 <WorkspaceForm title="Capture an enquiry" kind="lead" fields={[{name:"name",label:"Customer name"},{name:"email",label:"Email",type:"email",required:false},{name:"phone",label:"Phone",required:false},{name:"source",label:"Source",required:false},{name:"partyKind",label:"Customer type",value:"org",options:[{value:"org",label:"Company"},{value:"person",label:"Individual"}]}]}/>
 <WorkspaceForm title="Record contact activity" kind="activity" fields={[{name:"enquiryId",label:"Enquiry",options:leads},{name:"activityKind",label:"Activity",options:["call","email","note","meeting"].map(v=>({value:v,label:v}))},{name:"note",label:"Notes",type:"textarea"}]}/>
 <WorkspaceForm title="Record a quotation" kind="quotation" description="Records a quotation in this workspace. No email is sent." fields={[{name:"enquiryId",label:"Enquiry",options:leads},{name:"amount",label:"Quoted amount (INR, before GST)",type:"number",min:"0.01"}]}/>
 <WorkspaceForm title="Record an agreement" kind="agreement" description="Record the signed agreement reference and agreed terms." fields={[{name:"enquiryId",label:"Enquiry",options:leads},{name:"note",label:"Agreement reference / terms",type:"textarea"}]}/>
 <WorkspaceForm title="Convert a lead" kind="convert" description="Mark a won lead ready for operations to create a batch." fields={[{name:"enquiryId",label:"Enquiry",options:leads}]}/>
 <EditLeadForm leads={data.leads.map(r=>({id:String(r.id),name:String(r.name),email:(r.email as string|null)??null,phone:(r.phone as string|null)??null,source:(r.source as string|null)??null}))}/></div>
 <section><h2 className="mb-3 text-lg font-semibold">Recent quotations</h2><DataTable columns={["Customer","Amount","Status"]} rows={data.quotations.map(r=>[String(r.name),formatINR(String(r.amount)),String(r.status)])}/></section>
 <section><h2 className="mb-3 text-lg font-semibold">Contact history</h2><DataTable columns={["Customer","Activity","Notes"]} rows={data.activities.map(r=>[String(r.name),String(r.kind),String(r.note??"—")])}/></section>
 </div></AppShell>;}
