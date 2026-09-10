// Minimal Resend client, same style as web/src/lib/ai/groq.ts (plain fetch,
// no SDK dependency). Requires RESEND_API_KEY in the environment; throws a
// clear error rather than silently no-op-ing if it's missing, so a failed
// send surfaces as a real error instead of a password reset that looks
// like it worked but never arrives.
const RESEND_URL = "https://api.resend.com/emails";

// Resend's shared onboarding sender works without verifying a custom
// domain -- fine for a demo/hackathon deployment. Swap to a verified
// domain address for real production use.
const FROM = "Continuum <onboarding@resend.dev>";

export async function sendPasswordResetEmail(to: string, tempPassword: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  const res = await fetch(RESEND_URL, {
    method: "POST",
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
