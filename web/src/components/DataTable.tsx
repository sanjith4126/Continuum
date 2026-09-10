import type { ReactNode } from "react";
export function DataTable({columns,rows,empty="No records yet."}:{columns:string[];rows:ReactNode[][];empty?:string}){
 return <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="data-table"><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={columns.length} className="py-10 text-center text-slate-500">{empty}</td></tr>}</tbody></table></div>;
}
