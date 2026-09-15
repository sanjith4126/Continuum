"use server";
// The AI program-scoping interview's turn-taking logic -- ported from
// Scopewright's main.py `turn()` handler, adapted to be stateless per call
// (the client holds the interview state and resends it each turn) rather
// than an in-memory session dict, matching how Continuum's other two AI
// features (consultant, assistant) are already built -- no server-side
// session store in this codebase to extend.
//
// Only async server actions live in this file -- a "use server" module's
// non-async exports are silently dropped by Next's build (found live,
// not assumed; see scopingState.ts's comment for the fix).
import { chatWithFallback, GroqError } from "./groq";
import { SCOPING_PHASES, phaseAt, missingRequired, missingSlots, isSkip, UNKNOWN_VALUE } from "./scopingInterview";
import { buildInterviewerPrompt, buildWriterPrompt, INTERVIEWER_SYSTEM, WRITER_SYSTEM } from "./scopingPrompts";
import type { ScopingState } from "./scopingState";

const ALL_SLOT_KEYS = new Set(SCOPING_PHASES.flatMap((p) => p.slots.map((s) => s.key)));

function extractJson(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output.");
  return JSON.parse(trimmed.slice(start, end + 1));
}

export async function scopingTurn(state: ScopingState, userMessage: string): Promise<ScopingState> {
  if (state.done) return state;
  const messages = [...state.messages, { role: "user" as const, content: userMessage }];
  const phase = phaseAt(state.phaseIndex);
  if (!phase) return { ...state, done: true };

  const slots = { ...state.slots };
  const notes = [...state.notes];

  // "I don't know" ends the question rather than restarting it -- handled
  // here, not left to the prompt, so the buyer can always move on.
  if (isSkip(userMessage)) {
    const missing = missingRequired(phase, slots);
    const skipped = missing[0];
    if (skipped) {
      slots[skipped.key] = UNKNOWN_VALUE;
      notes.push(`Buyer could not answer '${skipped.key}'. Carry it into open questions.`);
    }
  }

  const task = buildInterviewerPrompt(phase, slots, state.assumptions.map((a) => ({ text: a.text, slot: a.slot ?? "" })), missingSlots(phase, slots));

  let raw: string;
  try {
    raw = await chatWithFallback("scoping", [{ role: "system", content: INTERVIEWER_SYSTEM + "\n\n" + task }, ...messages], 700);
  } catch (err) {
    const status = err instanceof GroqError ? err.status : undefined;
    return {
      ...state,
      messages: [...messages, { role: "assistant", content: status === 429 || status === 402 ? "The AI service is rate-limited right now — please try again shortly." : "Couldn't reach the AI service. Please try again." }],
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(raw);
  } catch {
    return { ...state, messages: [...messages, { role: "assistant", content: "Sorry, could you say that again?" }] };
  }

  const slotUpdates = (parsed.slot_updates as Record<string, string>) ?? {};
  for (const [key, value] of Object.entries(slotUpdates)) {
    if (!value || !ALL_SLOT_KEYS.has(key)) continue;
    slots[key] = value;
  }

  const assumptions = [...state.assumptions];
  const rawAssumptions = (parsed.assumptions as { text?: string; slot?: string }[]) ?? [];
  for (const a of rawAssumptions) {
    if (!a?.text) continue;
    if (a.slot && !ALL_SLOT_KEYS.has(a.slot)) continue;
    if (a.slot && slots[a.slot]) continue;
    if (a.slot && assumptions.some((x) => x.slot === a.slot && x.status === "unconfirmed")) continue;
    if (assumptions.some((x) => x.text.toLowerCase() === a.text!.toLowerCase())) continue;
    assumptions.push({ text: a.text, slot: a.slot ?? null, status: "unconfirmed" });
  }

  if (typeof parsed.note_for_spec === "string" && parsed.note_for_spec) notes.push(parsed.note_for_spec);

  const reply = typeof parsed.reply === "string" && parsed.reply ? parsed.reply : "Tell me more about that.";
  const nextMessages = [...messages, { role: "assistant" as const, content: reply }];

  let phaseIndex = state.phaseIndex;
  let done = false;
  if (parsed.phase_complete && missingRequired(phase, slots).length === 0) {
    phaseIndex += 1;
    if (phaseIndex >= SCOPING_PHASES.length) done = true;
  }

  return { phaseIndex, slots, assumptions, notes, messages: nextMessages, done };
}

export type ScopingBrief = { markdown: string; estimate: { lineItems: { name: string; category: string; amountLow: number; amountHigh: number; note: string }[]; riskFactor: number; riskReason: string; suggestedTotalLow: number; suggestedTotalHigh: number } | null };

export async function writeScopingBrief(state: ScopingState): Promise<ScopingBrief> {
  const prompt = buildWriterPrompt({ slots: state.slots, assumptions: state.assumptions, notes: state.notes });
  const raw = await chatWithFallback("scoping", [{ role: "system", content: WRITER_SYSTEM }, { role: "user", content: prompt }], 3000);
  const marker = "---ESTIMATE---";
  const idx = raw.indexOf(marker);
  if (idx === -1) return { markdown: raw.trim(), estimate: null };
  const markdown = raw.slice(0, idx).trim();
  const jsonPart = raw.slice(idx + marker.length).trim();
  try {
    const parsed = JSON.parse(jsonPart.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, ""));
    return {
      markdown,
      estimate: {
        lineItems: (parsed.line_items ?? []).map((li: { name: string; category: string; amount_low: number; amount_high: number; note: string }) => ({
          name: li.name,
          category: li.category,
          amountLow: li.amount_low,
          amountHigh: li.amount_high,
          note: li.note,
        })),
        riskFactor: parsed.risk_factor ?? 1.1,
        riskReason: parsed.risk_reason ?? "",
        suggestedTotalLow: parsed.suggested_total_low ?? 0,
        suggestedTotalHigh: parsed.suggested_total_high ?? 0,
      },
    };
  } catch {
    return { markdown, estimate: null };
  }
}
