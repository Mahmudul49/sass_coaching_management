import "server-only";
import { forTenant } from "@/lib/db/scoped";
import { Collections, type SmsKind } from "@/lib/db/collections";

/**
 * Pluggable SMS adapter (§10).
 *
 * `sendSms` always writes an `smsLog` doc so behaviour is observable at $0 in
 * dev (default provider = "stub", a no-op). A real BD gateway drops in via env
 * (SMS_PROVIDER / SMS_API_URL / SMS_API_KEY / SMS_SENDER_ID) WITHOUT changing
 * any call site.
 */
export type SendSmsArgs = {
  to: string;
  body: string;
  tenantId: string;
  studentId?: string | null;
  kind: SmsKind;
};

async function deliver(to: string, body: string): Promise<boolean> {
  const provider = (process.env.SMS_PROVIDER ?? "stub").toLowerCase();
  if (provider === "stub" || !process.env.SMS_API_URL) {
    // No-op: pretend success. The smsLog row is the record of what *would* send.
    return true;
  }

  try {
    // Generic HTTP gateway shape — adjust field names for your provider.
    const res = await fetch(process.env.SMS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.SMS_API_KEY,
        senderid: process.env.SMS_SENDER_ID,
        number: to,
        message: body,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("SMS delivery failed:", err);
    return false;
  }
}

/** Send one SMS and log it (always scoped to the tenant). */
export async function sendSms(args: SendSmsArgs): Promise<{ ok: boolean }> {
  const ok = await deliver(args.to, args.body);
  await forTenant(args.tenantId)
    .collection(Collections.smsLog)
    .insertOne({
      studentId: args.studentId ?? null,
      phone: args.to,
      body: args.body,
      kind: args.kind,
      sentAt: new Date(),
      ok,
    } as never);
  return { ok };
}

/**
 * Send many SMS for one tenant. Returns how many were accepted. Phones that are
 * empty/blank are skipped (and not logged).
 */
export async function sendSmsBatch(
  tenantId: string,
  messages: Array<{ to: string; body: string; studentId?: string | null; kind: SmsKind }>
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const m of messages) {
    if (!m.to || !m.to.trim()) continue;
    const { ok } = await sendSms({
      to: m.to.trim(),
      body: m.body,
      tenantId,
      studentId: m.studentId ?? null,
      kind: m.kind,
    });
    if (ok) sent++;
    else failed++;
  }
  return { sent, failed };
}
