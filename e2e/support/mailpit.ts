/**
 * Reads OTP emails from the local Supabase mail catcher (Mailpit).
 * Only works against the local stack.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type Summary = { ID: string; To: { Address: string }[]; Created: string };

async function messagesTo(email: string): Promise<Summary[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
  const body = (await res.json()) as { messages: Summary[] };
  return body.messages;
}

/** Number of emails sent to `email` so far. */
export async function countEmailsTo(email: string) {
  return (await messagesTo(email)).length;
}

/** Waits for the newest email to `email` and returns its 6-digit code. */
export async function latestCodeFor(email: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [newest] = await messagesTo(email);
    if (newest) {
      const res = await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`);
      const msg = (await res.json()) as { Text: string };
      const code = msg.Text.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No code emailed to ${email} within ${timeoutMs}ms`);
}
