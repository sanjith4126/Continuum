"use server";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { authorizedTransaction } from "./transaction";
import { requireUuid, requireMoney } from "./validation";

// Closes the loop: the scoping interview produces a suggested total, and
// this turns it into a real quotation against the lead -- the same
// quotation table and quotation.sent ledger event the CRM's own "Record a
// quotation" form already writes to (see case "quotation" in
// operations.ts), so a scoped programme shows up in the CRM exactly like
// any other quote.
export async function createQuotationFromScoping(enquiryId: string, amount: string, notes: string) {
  requireUuid(enquiryId, "enquiryId");
  requireMoney(amount, "amount");
  return authorizedTransaction("crm", async (tx, user) => {
    const found = await tx.execute(sql`select party_id from enquiry where id=${enquiryId}::uuid for update`);
    if (!found.rows[0]) throw new Error("Lead not found.");
    const partyId = String(found.rows[0].party_id);
    const rows = await tx.execute(
      sql`insert into quotation(enquiry_id,party_id,amount) values(${enquiryId}::uuid,${partyId}::uuid,${amount}) returning id`
    );
    await tx.execute(sql`update enquiry set stage='quoted' where id=${enquiryId}::uuid`);
    await tx.execute(
      sql`insert into ledger_event(actor_id,event_type,entity_type,entity_id,payload) values(${user.id}::uuid,'quotation.sent'::event_type,'quotation',${String(rows.rows[0].id)}::uuid,${JSON.stringify({ enquiryId, amount, source: "ai_scoping", notes: notes.slice(0, 2000) })}::jsonb)`
    );
    revalidatePath("/crm");
    return { ok: true, quotationId: String(rows.rows[0].id) };
  }).catch((error: unknown) => {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, message: error instanceof Error ? error.message : "Could not create quotation." };
  });
}
