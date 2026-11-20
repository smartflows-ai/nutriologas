// src/lib/messaging/service.ts
// Ban prevention: the one path every outbound WhatsApp message takes. No direct I/O: the store, the gateway
// (instance state and the provider call) and the clock are injected, so the rules are tested without a database
// or a network. Production wiring: src/lib/messaging/gateway.ts. Tests: tests/messaging-service.test.ts.
//
// Order: idempotency first (a message already sent is never sent again), then the policy, then the attempt.
// A message held for quiet hours keeps its recipient and text until it is sent or closed; drainHeld sends it later.

import { decide, type ConsentState, type MessagePurpose, type PolicyMode, type RiskState } from "./policy";
import { canAttempt, isRetryable, statusAfterFailure, type AttemptError, type OutboxStatus } from "./delivery";

export type OutboundRequest = {
  tenantId: string;
  /** Digits of the recipient, as the provider expects them. */
  to: string;
  purpose: MessagePurpose;
  text: string;
  /** Same key = same message. A retry reuses it, so a message cannot be created twice. */
  idempotencyKey: string;
  /** Consent for this recipient, decided by the caller (the reminder gate already ran for reminders). */
  consent: ConsentState;
  urgent?: boolean;
  /** True when `to` is one of the business's own numbers. */
  recipientIsTeam?: boolean;
  maxAttempts?: number;
};

export type OutboxRow = {
  id: string;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
};

/** A message waiting for its send window (held for quiet hours). */
export type HeldRow = {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  purpose: MessagePurpose;
  recipient: string;
  body: string;
};

export type OutboxPatch = Partial<{
  status: OutboxStatus;
  attempts: number;
  policyDecision: string;
  lastError: string | null;
  providerMessageId: string | null;
  sentAt: Date | null;
  body: string | null;
  recipient: string | null;
  scheduledAt: Date | null;
}>;

export interface OutboxStore {
  find(tenantId: string, idempotencyKey: string): Promise<OutboxRow | null>;
  create(row: {
    tenantId: string;
    recipientKey: string;
    recipient: string | null;
    purpose: MessagePurpose;
    idempotencyKey: string;
    status: OutboxStatus;
    policyDecision: string;
    scheduledAt: Date | null;
    body: string | null;
    maxAttempts: number;
  }): Promise<OutboxRow>;
  update(id: string, patch: OutboxPatch): Promise<void>;
  /** Held messages whose time has come, oldest first. */
  listHeld(now: Date, limit: number): Promise<HeldRow[]>;
}

/** What the gateway knows about the instance and the recipient right now. */
export type GatewayContext = {
  riskState: RiskState;
  killSwitch: { global: boolean; tenant: boolean; instance: boolean };
  optedOut: boolean;
  mode: PolicyMode;
  quietHours: boolean;
};

export type SendTextOutcome = { ok: true; messageId: string | null } | { ok: false; error: AttemptError };

export interface Gateway {
  context(tenantId: string, to: string): Promise<GatewayContext>;
  sendText(tenantId: string, to: string, text: string): Promise<SendTextOutcome>;
  /** Persists the result of an attempt: the breaker and the risk state live with the instance. */
  recordAttempt(tenantId: string, outcome: { ok: true } | { ok: false; error: AttemptError }): Promise<void>;
}

export type SendOutcome =
  | { status: "SENT"; providerMessageId: string | null; duplicate: boolean }
  | { status: "FAILED"; reason: string; duplicate: boolean }
  | { status: "UNKNOWN"; duplicate: boolean }
  | { status: "BLOCKED"; decision: string; duplicate: boolean }
  | { status: "QUEUED"; decision: string; duplicate: boolean };

export const DEFAULT_MAX_ATTEMPTS = 3;

function recipientKeyOf(to: string): string {
  // Stored without the full number in the outbox: the last four digits identify it for an operator.
  return `***${to.slice(-4)}`;
}

export async function sendOutbound(
  req: OutboundRequest,
  deps: { store: OutboxStore; gateway: Gateway; now: () => Date },
): Promise<SendOutcome> {
  const maxAttempts = req.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  // 1. Idempotency: a message that already left, whose outcome is unknown, or that failed for good is never sent again.
  // A BLOCKED or held message is not final: when the block lifts, the same key can still go out.
  const existing = await deps.store.find(req.tenantId, req.idempotencyKey);
  if (existing && existing.status === "SENT") return { status: "SENT", providerMessageId: null, duplicate: true };
  if (existing && existing.status === "UNKNOWN") return { status: "UNKNOWN", duplicate: true };
  if (existing && existing.status === "FAILED" && !canAttempt(existing)) {
    return { status: "FAILED", reason: "attempts_exhausted", duplicate: true };
  }

  // 2. The policy, with the instance and recipient state at this moment.
  const ctx = await deps.gateway.context(req.tenantId, req.to);
  const verdict = decide({
    purpose: req.purpose,
    killSwitch: ctx.killSwitch,
    riskState: ctx.riskState,
    optedOut: ctx.optedOut,
    consent: req.consent,
    mode: ctx.mode,
    quietHours: ctx.quietHours,
    urgent: req.urgent ?? false,
    recipientIsTeam: req.recipientIsTeam ?? false,
  });

  if (verdict.stopped) {
    // A blocked message keeps no recipient and no text: nothing waits for it.
    if (existing) {
      await deps.store.update(existing.id, { status: "BLOCKED", policyDecision: verdict.decision, recipient: null, body: null });
    } else {
      await deps.store.create({
        tenantId: req.tenantId,
        recipientKey: recipientKeyOf(req.to),
        recipient: null,
        purpose: req.purpose,
        idempotencyKey: req.idempotencyKey,
        status: "BLOCKED",
        policyDecision: verdict.decision,
        scheduledAt: null,
        body: null,
        maxAttempts,
      });
    }
    return { status: "BLOCKED", decision: verdict.decision, duplicate: existing !== null };
  }

  if (verdict.decision === "DEFER_QUIET_HOURS") {
    // Held, not dropped: the row keeps the recipient and text until its send window opens (see drainHeld).
    if (existing) {
      await deps.store.update(existing.id, {
        status: "QUEUED",
        policyDecision: verdict.decision,
        scheduledAt: deps.now(),
        recipient: req.to,
        body: req.text,
      });
    } else {
      await deps.store.create({
        tenantId: req.tenantId,
        recipientKey: recipientKeyOf(req.to),
        recipient: req.to,
        purpose: req.purpose,
        idempotencyKey: req.idempotencyKey,
        status: "QUEUED",
        policyDecision: verdict.decision,
        scheduledAt: deps.now(),
        body: req.text,
        maxAttempts,
      });
    }
    return { status: "QUEUED", decision: verdict.decision, duplicate: existing !== null };
  }

  // 3. The attempt. The row is written before the call, so a crash in the middle leaves a trace.
  const row =
    existing ??
    (await deps.store.create({
      tenantId: req.tenantId,
      recipientKey: recipientKeyOf(req.to),
      recipient: req.to,
      purpose: req.purpose,
      idempotencyKey: req.idempotencyKey,
      status: "QUEUED",
      policyDecision: verdict.decision,
      scheduledAt: null,
      body: req.text,
      maxAttempts,
    }));
  if (existing) await deps.store.update(existing.id, { body: req.text, recipient: req.to, policyDecision: verdict.decision });
  const attemptsUsed = row.attempts + 1;
  await deps.store.update(row.id, { attempts: attemptsUsed, policyDecision: verdict.decision });

  const result = await deps.gateway.sendText(req.tenantId, req.to, req.text);
  if (result.ok) {
    await deps.store.update(row.id, {
      status: "SENT",
      providerMessageId: result.messageId,
      sentAt: deps.now(),
      body: null,
      recipient: null,
      lastError: null,
    });
    await deps.gateway.recordAttempt(req.tenantId, { ok: true });
    return { status: "SENT", providerMessageId: result.messageId, duplicate: false };
  }

  const status = statusAfterFailure(result.error);
  // A missing setup is not an attempt: the attempt is given back, so the message goes out once the setup is fixed.
  // A failure that cannot be retried (client error, auth) closes the row and drops its text and recipient.
  const retryable = isRetryable(result.error);
  const attemptsLeft = result.error.kind === "unavailable" ? row.attempts : retryable || status === "UNKNOWN" ? attemptsUsed : maxAttempts;
  const closed = status === "UNKNOWN" || (!retryable && result.error.kind !== "unavailable") || attemptsLeft >= maxAttempts;
  await deps.store.update(row.id, {
    status,
    attempts: attemptsLeft,
    lastError: result.error.kind,
    body: closed ? null : req.text,
    recipient: closed ? null : req.to,
  });
  await deps.gateway.recordAttempt(req.tenantId, { ok: false, error: result.error });
  if (status === "UNKNOWN") return { status: "UNKNOWN", duplicate: false };
  return { status: "FAILED", reason: result.error.kind, duplicate: false };
}

export type DrainResult = { checked: number; sent: number; held: number; failed: number };

/**
 * Sends the messages held for quiet hours whose window has opened. Each one goes through sendOutbound again, so the
 * policy, the kill switches and the breaker still apply. A held message already passed the consent check when it was
 * held (quiet hours come after consent), so it is sent again with consent YES. Urgent messages are never held.
 */
export async function drainHeld(
  deps: { store: OutboxStore; gateway: Gateway; now: () => Date },
  limit = 10,
): Promise<DrainResult> {
  const rows = await deps.store.listHeld(deps.now(), limit);
  const result: DrainResult = { checked: rows.length, sent: 0, held: 0, failed: 0 };
  for (const row of rows) {
    const out = await sendOutbound(
      {
        tenantId: row.tenantId,
        to: row.recipient,
        purpose: row.purpose,
        text: row.body,
        idempotencyKey: row.idempotencyKey,
        consent: "YES",
        urgent: false,
        recipientIsTeam: row.purpose === "INTERNAL",
      },
      deps,
    );
    if (out.status === "SENT") result.sent++;
    else if (out.status === "QUEUED") result.held++;
    else result.failed++;
  }
  return result;
}
