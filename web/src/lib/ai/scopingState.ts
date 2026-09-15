// Plain client-safe state types and pure helpers for the scoping
// interview -- split out of scoping.ts because a "use server" module may
// only export async server actions; newScopingState/confirmAssumption are
// synchronous and were silently dropped by Next's build when they lived
// there (caught by a real build failure, not assumed).
export type Assumption = { text: string; slot: string | null; status: "unconfirmed" | "confirmed" };
export type ScopingState = {
  phaseIndex: number;
  slots: Record<string, string>;
  assumptions: Assumption[];
  notes: string[];
  messages: { role: "user" | "assistant"; content: string }[];
  done: boolean;
};

export function newScopingState(): ScopingState {
  return { phaseIndex: 0, slots: {}, assumptions: [], notes: [], messages: [], done: false };
}

export function confirmAssumption(state: ScopingState, index: number, accept: boolean, correction?: string): ScopingState {
  const assumptions = [...state.assumptions];
  const a = assumptions[index];
  if (!a) return state;
  const slots = { ...state.slots };
  if (accept && a.slot) slots[a.slot] = correction || a.text;
  else if (!accept && a.slot && correction) slots[a.slot] = correction;
  assumptions[index] = { ...a, status: "confirmed" };
  return { ...state, slots, assumptions };
}
