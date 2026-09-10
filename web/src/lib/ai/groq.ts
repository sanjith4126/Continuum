// Thin client for Groq's OpenAI-compatible chat completions endpoint, with
// primary -> fallback key rotation on rate-limit / quota errors.
//
// Deviation from CLAUDE.md's "the Anthropic API for the two assistants":
// the user explicitly asked to use Groq (4 keys, 2 assistants x primary +
// fallback) instead. Confirmed with the user; CLAUDE.md and BUILD_PLAN.md
// have been updated to describe this as the actual provider.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// llama-3.3-70b-versatile was the original choice but returned a live 404
// ("does not exist or you do not have access to it") against this
// project's Groq keys/catalog — Groq's available model list had moved on.
// openai/gpt-oss-20b was chosen instead after a live comparison against
// openai/gpt-oss-120b: both are reasoning models (they emit a hidden
// `reasoning` field before `content` and need a generous max_tokens budget
// to leave room for both), 20b answered a real SQL-generation question
// correctly in ~730ms. If this 404s again on a fresh Groq account, run
// `GET https://api.groq.com/openai/v1/models` with the key to see what's
// actually available before assuming the code is broken.
const MODEL = "openai/gpt-oss-20b";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class GroqError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
  }
}

function isRetryable(status: number) {
  // 429 = rate limited, 402 = quota/payment required on Groq
  return status === 429 || status === 402 || status >= 500;
}

async function callGroq(apiKey: string, messages: ChatMessage[], maxTokens: number) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GroqError(`Groq ${res.status}: ${body.slice(0, 300)}`, res.status);
  }

  const json = await res.json();
  const choice = json.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== "string") {
    throw new GroqError("Groq returned no content");
  }
  // gpt-oss models are reasoning models: they spend tokens on a hidden
  // `reasoning` field before `content`. If max_tokens is too tight, content
  // comes back as "" (finish_reason "length") rather than throwing — that
  // would otherwise surface as a silent empty answer instead of a clear
  // error, so treat it the same as missing content.
  if (content.trim() === "" && choice?.finish_reason === "length") {
    throw new GroqError("Groq ran out of tokens before producing a visible answer (reasoning-only output)");
  }
  return content;
}

/**
 * Calls Groq chat completions with a named pair of keys (primary + fallback
 * env vars). Falls back automatically on 429/402/5xx. Throws if both fail.
 */
export async function chatWithFallback(
  purpose: "consultant" | "assistant",
  messages: ChatMessage[],
  maxTokens = 500
): Promise<string> {
  const primaryVar =
    purpose === "consultant" ? "GROQ_API_KEY_CONSULTANT" : "GROQ_API_KEY_ASSISTANT";
  const fallbackVar =
    purpose === "consultant"
      ? "GROQ_API_KEY_CONSULTANT_FALLBACK"
      : "GROQ_API_KEY_ASSISTANT_FALLBACK";

  const primary = process.env[primaryVar];
  const fallback = process.env[fallbackVar];

  if (!primary) {
    throw new GroqError(`${primaryVar} is not set`);
  }

  try {
    return await callGroq(primary, messages, maxTokens);
  } catch (err) {
    const retryable = err instanceof GroqError && isRetryable(err.status ?? 0);
    if (!retryable || !fallback) throw err;
    console.warn(`[groq:${purpose}] primary key failed (${(err as GroqError).status}), trying fallback`);
    return callGroq(fallback, messages, maxTokens);
  }
}
