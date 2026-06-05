// Transactional email via Resend.
//
// Used by the dunning runner to notify members of failed payments. Best-effort:
// if RESEND_API_KEY is not configured, this logs and no-ops so the underlying
// dunning action never breaks. Callers should `await` it after the DB work.
//
// Env:
//   RESEND_API_KEY    Resend API key (required to actually send)
//   DUNNING_FROM_EMAIL  Verified sender, e.g. "Billing <billing@yourgym.com>"
//                       (falls back to Resend's onboarding sandbox address)

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "onboarding@resend.dev";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  // Display name for the sender (e.g. the gym's name). The address always stays
  // the platform's verified DUNNING_FROM_EMAIL; only the friendly name changes.
  fromName?: string;
  // Address replies should go to (e.g. the gym's billing email).
  replyTo?: string;
}

// Extract the bare address from a "Name <addr@x>" or "addr@x" string.
function bareAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

// Build a "Name <addr@x>" header, stripping characters that would break it.
function formatFrom(name: string, baseFrom: string): string {
  const clean = name.replace(/["<>\r\n]/g, "").trim();
  const address = bareAddress(baseFrom);
  return clean ? `${clean} <${address}>` : baseFrom;
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn(`RESEND_API_KEY not set — skipping email "${message.subject}" to ${message.to}`);
    return false;
  }
  if (!message.to) {
    console.warn(`No recipient for email "${message.subject}" — skipping`);
    return false;
  }

  const baseFrom = Deno.env.get("DUNNING_FROM_EMAIL") || DEFAULT_FROM;
  const from = message.fromName ? formatFrom(message.fromName, baseFrom) : baseFrom;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Resend send failed (${res.status}): ${body}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Resend send threw:", e);
    return false;
  }
}

// ---- Templates --------------------------------------------------------------

function layout(orgName: string, body: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.5">
${body}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#6b7280">This is an automated billing message from ${orgName}.</p>
</div>`;
}

function money(amount: number): string {
  return `$${Number(amount).toFixed(2)}`;
}

export function paymentFailedEmail(
  orgName: string,
  studentName: string,
  amount: number,
  nextAttempt: string,
): EmailMessage {
  return {
    to: "",
    subject: `Payment issue — ${orgName}`,
    html: layout(
      orgName,
      `<h2 style="margin:0 0 12px">We couldn't process your payment</h2>
<p>Hi ${studentName},</p>
<p>Your recent membership payment of <strong>${money(amount)}</strong> to ${orgName} didn't go through.</p>
<p>We'll automatically try again on <strong>${nextAttempt}</strong>. To avoid any interruption, please make sure your payment method on file is up to date.</p>`,
    ),
  };
}

export function finalNoticeEmail(
  orgName: string,
  studentName: string,
  amount: number,
  finalAttempt: string,
): EmailMessage {
  return {
    to: "",
    subject: `Final payment attempt coming up — ${orgName}`,
    html: layout(
      orgName,
      `<h2 style="margin:0 0 12px">Action needed: final payment attempt</h2>
<p>Hi ${studentName},</p>
<p>We still haven't been able to collect your membership payment of <strong>${money(amount)}</strong>.</p>
<p>We'll make a <strong>final attempt on ${finalAttempt}</strong>. If it doesn't succeed, your membership will be paused until payment is resolved. Please update your payment method to keep your membership active.</p>`,
    ),
  };
}

export function membershipFrozenEmail(
  orgName: string,
  studentName: string,
  amount: number,
): EmailMessage {
  return {
    to: "",
    subject: `Your membership is paused — ${orgName}`,
    html: layout(
      orgName,
      `<h2 style="margin:0 0 12px">Your membership has been paused</h2>
<p>Hi ${studentName},</p>
<p>After several attempts we were unable to collect your membership payment of <strong>${money(amount)}</strong>, so your membership with ${orgName} has been paused.</p>
<p>Please contact ${orgName} or update your payment method to reactivate your membership.</p>`,
    ),
  };
}
