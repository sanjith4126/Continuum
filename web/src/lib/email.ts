// Minimal Resend client, same style as web/src/lib/ai/groq.ts (plain fetch,
// no SDK dependency). Requires RESEND_API_KEY in the environment; throws a
// clear error rather than silently no-op-ing if it's missing, so a failed
// send surfaces as a real error instead of a password reset that looks
// like it worked but never arrives.
const RESEND_URL = "https://api.resend.com/emails";

// The onboarding sender is suitable only for Resend's restricted test flow.
// Real recipients require RESEND_FROM on a verified sending domain.
const FROM = process.env.RESEND_FROM ?? "Continuum <onboarding@resend.dev>";

export function passwordResetEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendPasswordResetEmail(to: string, tempPassword: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  const res = await fetch(RESEND_URL, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: "Your Continuum password has been reset",
      text:
        `A password reset was requested for your Continuum account (${to}).\n\n` +
        `Your new temporary password is:\n\n  ${tempPassword}\n\n` +
        `Sign in at the login page and you will be asked to set a new password immediately. ` +
        `If you did not request this, contact your workspace administrator.`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}
