// src/lib/messaging/gateway.ts
// Ban prevention: the production wiring of the send service. Reads the instance and business state from the
// database, sends through the one adapter that talks to Evolution, and records each attempt on the instance.
// Tested through the service with fakes (tests/messaging-service.test.ts); this file is the thin real I/O.

import { prisma } from "@/lib/db";
import { DEFAULT_TIME_ZONE, clinicTimeOf } from "@/lib/clinic-time";
import { DEFAULT_QUIET_END_MIN, DEFAULT_QUIET_START_MIN, isWithinQuietHours, minutesOfDay } from "@/lib/wa-pacing";
import { evolutionConfigFromEnv, instanceKeyOf, sendText as evolutionSendText, typingDelayMs } from "@/lib/messaging/evolution-adapter";
import { breakerAfterFailure, breakerAfterSuccess, type AttemptError } from "@/lib/messaging/delivery";
import type { Gateway, GatewayContext, OutboxStore, SendTextOutcome } from "@/lib/messaging/service";
import type { RiskState } from "@/lib/messaging/policy";

const JID_SUFFIX = "@s.whatsapp.net";

export const prismaOutboxStore: OutboxStore = {
  async find(tenantId, idempotencyKey) {
    const row = await prisma.whatsAppOutbox.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      select: { id: true, status: true, attempts: true, maxAttempts: true },
    });
    return row ? { ...row, status: row.status as never } : null;
  },
  async create(input) {
    const row = await prisma.whatsAppOutbox.create({
      data: {
        tenantId: input.tenantId,
        recipientKey: input.recipientKey,
        purpose: input.purpose,
        idempotencyKey: input.idempotencyKey,
        status: input.status,
        policyDecision: input.policyDecision,
        scheduledAt: input.scheduledAt,
        body: input.body,
        maxAttempts: input.maxAttempts,
      },
      select: { id: true, status: true, attempts: true, maxAttempts: true },
    });
    return { ...row, status: row.status as never };
  },
  async update(id, patch) {
    await prisma.whatsAppOutbox.update({ where: { id }, data: patch as never });
  },
};

async function instanceOf(tenantId: string) {
  return prisma.connectedApp.findFirst({
    where: { tenantId, provider: "WHATSAPP" },
    select: { id: true, waInstanceName: true, waInstanceId: true, accessToken: true, riskState: true, consecutiveFailures: true, statusReason: true, killSwitch: true },
  });
}

/** Maps the adapter's error to the classes the rules understand. A timeout may have reached the provider: UNKNOWN. */
function attemptErrorOf(error: { error: "timeout" | "network" | "http"; status: number | null }): AttemptError {
  if (error.error === "timeout") return { kind: "timeout", requestLeft: true };
  if (error.error === "network") return { kind: "network" };
  const status = error.status ?? 0;
  if (status === 401 || status === 403) return { kind: "auth", status };
  if (status >= 500) return { kind: "server", status };
  return { kind: "client", status };
}

export const prismaGateway: Gateway = {
  async context(tenantId, to): Promise<GatewayContext> {
    const [app, tenant, flags, chat] = await Promise.all([
      instanceOf(tenantId),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappKillSwitch: true, messagingPolicyMode: true, quietHoursStartMin: true, quietHoursEndMin: true, timeZone: true },
      }),
      prisma.platformFlag.findUnique({ where: { id: "global" }, select: { globalKillSwitch: true } }),
      prisma.whatsAppChat.findFirst({
        where: { tenantId, remoteJid: `${to}${JID_SUFFIX}` },
        select: { optedOutAt: true },
      }),
    ]);

    const start = tenant?.quietHoursStartMin ?? DEFAULT_QUIET_START_MIN;
    const end = tenant?.quietHoursEndMin ?? DEFAULT_QUIET_END_MIN;
    const zone = tenant?.timeZone ?? DEFAULT_TIME_ZONE;
    const localMin = minutesOfDay(clinicTimeOf(new Date(), zone));

    return {
      riskState: ((app?.riskState ?? "NORMAL") as RiskState),
      killSwitch: {
        global: flags?.globalKillSwitch ?? false,
        tenant: tenant?.whatsappKillSwitch ?? false,
        instance: app?.killSwitch ?? false,
      },
      optedOut: chat?.optedOutAt != null,
      mode: tenant?.messagingPolicyMode === "ENFORCE" ? "ENFORCE" : "SHADOW",
      quietHours: isWithinQuietHours(localMin, start, end),
    };
  },

  async sendText(tenantId, to, text): Promise<SendTextOutcome> {
    const cfg = evolutionConfigFromEnv();
    const app = await instanceOf(tenantId);
    const instance = app?.waInstanceName ?? app?.waInstanceId ?? null;
    if (!cfg || !app || !instance) return { ok: false, error: { kind: "unavailable" } };

    const res = await evolutionSendText(cfg, {
      instance,
      apiKey: instanceKeyOf(app.accessToken, cfg.globalKey),
      number: to,
      text,
      delayMs: typingDelayMs(text),
    });
    if (res.ok) return { ok: true, messageId: res.messageId };
    return { ok: false, error: attemptErrorOf(res) };
  },

  async recordAttempt(tenantId, outcome) {
    const app = await instanceOf(tenantId);
    if (!app) return;
    const current = {
      consecutiveFailures: app.consecutiveFailures,
      open: app.riskState === "SENDING_PAUSED",
      reason: app.statusReason,
    };
    if (outcome.ok) {
      const next = breakerAfterSuccess(current);
      await prisma.connectedApp.update({
        where: { id: app.id },
        data: { consecutiveFailures: next.consecutiveFailures, lastSuccessfulSendAt: new Date() },
      });
      return;
    }
    const next = breakerAfterFailure(current, outcome.error);
    const opened = next.open && !current.open;
    await prisma.connectedApp.update({
      where: { id: app.id },
      data: {
        consecutiveFailures: next.consecutiveFailures,
        ...(opened
          ? { riskState: "SENDING_PAUSED", sendingPausedAt: new Date(), statusReason: next.reason }
          : {}),
      },
    });
  },
};
