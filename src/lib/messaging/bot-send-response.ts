// src/lib/messaging/bot-send-response.ts
// The answer of POST /api/internal/whatsapp/send for n8n. Pure. Tests: tests/bot-send-response.test.ts.
// n8n treats any non-2xx answer as a failure: it alerts the owner ("Alert Owner: Bot Failure") and raises
// "Respuesta no entregada". A reply the policy stopped on purpose (the patient opted out, a kill switch, a paused
// number) is not a failure, so it answers 200 with blocked: true (QA 2026-11-20). Anything else that did not
// leave stays 502.

export interface BotSendResult {
  success: boolean;
  reason?: string;
  data?: unknown;
}

export interface BotSendResponse {
  status: 200 | 502;
  body: { success: boolean; blocked: boolean; reason: string | null };
}

function outcomeStatus(data: unknown): string | null {
  if (data && typeof data === "object" && "status" in data) {
    const status = (data as { status?: unknown }).status;
    return typeof status === "string" ? status : null;
  }
  return null;
}

export function botSendResponse(result: BotSendResult): BotSendResponse {
  if (result.success) return { status: 200, body: { success: true, blocked: false, reason: null } };
  const blocked = outcomeStatus(result.data) === "BLOCKED";
  return { status: blocked ? 200 : 502, body: { success: false, blocked, reason: result.reason ?? null } };
}
