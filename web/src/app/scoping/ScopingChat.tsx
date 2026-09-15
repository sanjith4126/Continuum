"use client";
import { useState } from "react";
import { scopingTurn, writeScopingBrief, type ScopingBrief } from "@/lib/ai/scoping";
import { newScopingState, confirmAssumption, type ScopingState } from "@/lib/ai/scopingState";
import { SCOPING_PHASES } from "@/lib/ai/scopingInterview";
import { createQuotationFromScoping } from "@/lib/scopingToQuotation";
import { formatINR } from "@/lib/format";

export function ScopingChat({ leads }: { leads: { value: string; label: string }[] }) {
  const [state, setState] = useState<ScopingState>(newScopingState());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<ScopingBrief | null>(null);
  const [writingBrief, setWritingBrief] = useState(false);
  const [selectedLead, setSelectedLead] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");

  async function send(message: string) {
    if (!message.trim() || loading) return;
    setLoading(true);
    setInput("");
    try {
      const next = await scopingTurn(state, message);
      setState(next);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(index: number, accept: boolean) {
    setState((s) => confirmAssumption(s, index, accept));
  }

  async function handleWriteBrief() {
    setWritingBrief(true);
    try {
      const result = await writeScopingBrief(state);
      setBrief(result);
    } finally {
      setWritingBrief(false);
    }
  }

  async function handleCreateQuotation() {
    if (!selectedLead || !brief?.estimate) return;
    const mid = Math.round((brief.estimate.suggestedTotalLow + brief.estimate.suggestedTotalHigh) / 2);
    const result = await createQuotationFromScoping(selectedLead, String(mid), brief.markdown.slice(0, 1500));
    setQuoteMessage(result.ok ? `Quotation created for ${formatINR(mid)}.` : ("message" in result ? result.message : "Could not create quotation."));
  }

  const phase = SCOPING_PHASES[state.phaseIndex];
  const started = state.messages.length > 0;

  return (
    <div className="space-y-5">
      {!started && (
        <div className="panel">
          <p className="mb-4 text-sm text-slate-600">Describe the training need to start — for example, &quot;Our support team needs to get better at handling escalations.&quot;</p>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm" placeholder="What's the training need?" />
            <button className="primary" disabled={loading}>{loading ? "Thinking..." : "Start"}</button>
          </form>
        </div>
      )}

      {started && !state.done && (
        <div className="panel">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phase {state.phaseIndex + 1} of {SCOPING_PHASES.length}: {phase?.label}</span>
          </div>
          <div className="mb-4 max-h-96 space-y-3 overflow-y-auto" aria-live="polite">
            {state.messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-blue-700 p-3 text-sm text-white" : "max-w-[85%] rounded-lg bg-slate-100 p-3 text-sm text-slate-800"}>
                {m.content}
              </div>
            ))}
            {loading && <p className="text-sm text-slate-500">Thinking...</p>}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Your answer..." disabled={loading} />
            <button className="primary" disabled={loading || !input.trim()}>Send</button>
          </form>
        </div>
      )}

      {state.assumptions.some((a) => a.status === "unconfirmed") && (
        <div className="panel">
          <h3 className="mb-3 text-sm font-semibold">Assumptions to confirm</h3>
          <div className="space-y-2">
            {state.assumptions.map((a, i) =>
              a.status === "unconfirmed" ? (
                <div key={i} className="flex items-center justify-between gap-3 rounded-md bg-amber-50 p-3 text-sm">
                  <span>{a.text}</span>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => handleConfirm(i, true)} className="rounded bg-green-700 px-2 py-1 text-xs text-white">Confirm</button>
                    <button onClick={() => handleConfirm(i, false)} className="rounded border border-slate-300 px-2 py-1 text-xs">Dismiss</button>
                  </div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {state.done && !brief && (
        <div className="panel text-center">
          <p className="mb-4 text-sm text-slate-600">Interview complete. Generate the scoping brief and cost estimate.</p>
          <button onClick={handleWriteBrief} className="primary" disabled={writingBrief}>{writingBrief ? "Writing..." : "Generate brief"}</button>
        </div>
      )}

      {brief && (
        <div className="space-y-4">
          <div className="panel">
            <h3 className="mb-3 text-sm font-semibold">Scoping brief</h3>
            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700">{brief.markdown}</div>
          </div>
          {brief.estimate && (
            <div className="panel">
              <h3 className="mb-3 text-sm font-semibold">Cost estimate</h3>
              <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="data-table">
                  <thead><tr><th>Item</th><th>Category</th><th>Low</th><th>High</th></tr></thead>
                  <tbody>
                    {brief.estimate.lineItems.map((li, i) => (
                      <tr key={i}><td>{li.name}</td><td>{li.category}</td><td>{formatINR(li.amountLow)}</td><td>{formatINR(li.amountHigh)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mb-4 text-sm font-semibold">
                Suggested total: {formatINR(brief.estimate.suggestedTotalLow)} – {formatINR(brief.estimate.suggestedTotalHigh)}
                <span className="ml-2 font-normal text-slate-500">(risk factor {brief.estimate.riskFactor}× — {brief.estimate.riskReason})</span>
              </p>
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                <label className="field">
                  Create a quotation against
                  <select value={selectedLead} onChange={(e) => setSelectedLead(e.target.value)}>
                    <option value="">Select a lead...</option>
                    {leads.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </label>
                <button onClick={handleCreateQuotation} disabled={!selectedLead} className="primary self-end">Create quotation</button>
              </div>
              {quoteMessage && <p className="mt-3 text-sm text-green-700">{quoteMessage}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
