// src/lib/credits.ts
// Central module for AI token credit management.
// - Tracks OpenRouter token spend per tenant per billing period
// - Enforces spending caps by plan
// - Auto-pauses social campaigns when credits are exhausted
// - Resumes campaigns when credits are replenished

import { prisma } from "@/lib/db";
import { CreditExhaustedError } from "@/lib/credits-error";

// ── Plan limits (USD per month) ─────────────────────────────────────────────
export const PLAN_CREDIT_LIMITS: Record<string, number> = {
  STARTER:    15.0,
  PRO:        50.0,
  ENTERPRISE: 200.0,
};

// ── OpenRouter model pricing (per 1M tokens, USD) ──────────────────────────
// These mirror env vars so ops can tune without code deploys.
function getInputPricePerM(): number {
  return parseFloat(process.env.OPENROUTER_INPUT_PRICE_PER_M ?? "3.0");
}
function getOutputPricePerM(): number {
  return parseFloat(process.env.OPENROUTER_OUTPUT_PRICE_PER_M ?? "15.0");
}

/**
 * Computes the tenant-facing retail billed amount.
 * Billed at the standard platform retail rate ($3.00 / 1M prompt, $15.00 / 1M completion)
 * REGARDLESS of whether a free or paid model was used behind the scenes.
 * This ensures steady depletion of their $15 Starter monthly limit and drives Stripe recharges.
 */
export function computeBilledCost(promptTokens: number, completionTokens: number): number {
  const inputCost  = (promptTokens     / 1_000_000) * getInputPricePerM();
  const outputCost = (completionTokens / 1_000_000) * getOutputPricePerM();
  return inputCost + outputCost;
}

/**
 * Computes the actual wholesale cost owed to OpenRouter for this interaction (COGS).
 * - Free models (*:free and openrouter/free): $0.00
 * - OpenAI GPT-4o: $2.50 / $10.00 per 1M
 * - Claude Sonnet / Default: uses env rates (default $3.00 / $15.00 per 1M)
 */
export function computeProviderCost(
  promptTokens: number,
  completionTokens: number,
  modelId?: string,
): number {
  if (modelId) {
    const normalized = modelId.toLowerCase();
    if (normalized.endsWith(":free") || normalized === "openrouter/free") {
      return 0;
    }
    if (normalized.includes("gpt-4o") && !normalized.includes("mini")) {
      const inputCost  = (promptTokens     / 1_000_000) * 2.50;
      const outputCost = (completionTokens / 1_000_000) * 10.00;
      return inputCost + outputCost;
    }
  }

  const inputCost  = (promptTokens     / 1_000_000) * getInputPricePerM();
  const outputCost = (completionTokens / 1_000_000) * getOutputPricePerM();
  return inputCost + outputCost;
}

/**
 * Backward-compatible wrapper: returns the tenant-facing billed cost.
 */
export function computeTokenCost(
  promptTokens: number,
  completionTokens: number,
  _modelId?: string,
): number {
  return computeBilledCost(promptTokens, completionTokens);
}



// ── Period helpers ──────────────────────────────────────────────────────────

/**
 * Returns the start of the current calendar month (UTC midnight).
 */
function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Returns the start of the next calendar month (UTC midnight).
 */
function currentPeriodEnd(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

// ── Ledger helpers ──────────────────────────────────────────────────────────

/**
 * Fetches the active AiTokenLedger for the tenant's current billing period,
 * creating it if it doesn't exist yet.
 * 
 * planId: the tenant's Subscription.plan — used only at creation time to set the limit.
 */
export async function getOrCreateLedger(tenantId: string, planId: string = "STARTER") {
  const periodStart = currentPeriodStart();
  const periodEnd   = currentPeriodEnd();

  // Check for a per-tenant override credit limit
  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { aiCreditLimitUsd: true },
  });

  const creditLimit = tenantRow?.aiCreditLimitUsd
    ?? PLAN_CREDIT_LIMITS[planId]
    ?? PLAN_CREDIT_LIMITS.STARTER;

  const ledger = await (prisma as any).aiTokenLedger.upsert({
    where: {
      tenantId_periodStart: { tenantId, periodStart },
    },
    create: {
      tenantId,
      periodStart,
      periodEnd,
      creditLimitUsd: creditLimit,
      totalCostUsd: 0,
      realProviderCostUsd: 0,
      netMarginUsd: 0,
      promptTokens: 0,
      completionTokens: 0,
    },
    update: {
      // Always refresh the limit in case the plan changed
      creditLimitUsd: creditLimit,
    },
  });

  return ledger;
}

// ── Credit status ───────────────────────────────────────────────────────────

export interface CreditStatus {
  limitUsd: number;
  usedUsd: number;
  remainingUsd: number;
  isExhausted: boolean;
  percentUsed: number;
  periodStart: Date;
  periodEnd: Date;
  promptTokens: number;
  completionTokens: number;
  realProviderCostUsd?: number;
  netMarginUsd?: number;
}

/**
 * Returns the current credit status for a tenant.
 */
export async function getCreditStatus(tenantId: string, planId?: string): Promise<CreditStatus> {
  const ledger = await getOrCreateLedger(tenantId, planId);

  const used      = ledger.totalCostUsd;
  const limit     = ledger.creditLimitUsd;
  const remaining = Math.max(0, limit - used);
  const percent   = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;

  return {
    limitUsd:            limit,
    usedUsd:             used,
    remainingUsd:        remaining,
    isExhausted:         used >= limit,
    percentUsed:         Math.round(percent * 10) / 10,
    periodStart:         ledger.periodStart,
    periodEnd:           ledger.periodEnd,
    promptTokens:        ledger.promptTokens,
    completionTokens:    ledger.completionTokens,
    realProviderCostUsd: (ledger as any).realProviderCostUsd ?? 0,
    netMarginUsd:        (ledger as any).netMarginUsd ?? 0,
  };
}

// ── Enforcement ─────────────────────────────────────────────────────────────

/**
 * Checks whether the tenant has credits remaining.
 * Throws CreditExhaustedError if they don't.
 * Call this BEFORE making an OpenRouter request.
 */
export async function enforceCredits(tenantId: string, planId?: string): Promise<void> {
  const status = await getCreditStatus(tenantId, planId);
  if (status.isExhausted) {
    throw new CreditExhaustedError(status.usedUsd, status.limitUsd);
  }
}

// ── Token recording ─────────────────────────────────────────────────────────

/**
 * Records token usage after an AI call (Platform AI Metering).
 * - totalCostUsd: Billed to the tenant at standard retail platform rates ($3/$15 per 1M).
 * - realProviderCostUsd: Actual cost owed to the provider ($0.00 for free models).
 * - netMarginUsd: Gross profit retained by NewAigent on this interaction.
 */
export async function recordTokenUsage(
  tenantId: string,
  promptTokens: number,
  completionTokens: number,
  planId?: string,
  modelId?: string,
): Promise<CreditStatus> {
  const billedCostUsd       = computeBilledCost(promptTokens, completionTokens);
  const realProviderCostUsd = computeProviderCost(promptTokens, completionTokens, modelId);
  const netMarginUsd        = billedCostUsd - realProviderCostUsd;

  // Atomic increment via Prisma
  const periodStart = currentPeriodStart();
  await (prisma as any).aiTokenLedger.update({
    where: { tenantId_periodStart: { tenantId, periodStart } },
    data: {
      totalCostUsd:        { increment: billedCostUsd },
      realProviderCostUsd: { increment: realProviderCostUsd },
      netMarginUsd:        { increment: netMarginUsd },
      promptTokens:        { increment: promptTokens },
      completionTokens:    { increment: completionTokens },
    },
  });

  const updatedStatus = await getCreditStatus(tenantId, planId);

  // Auto-pause campaigns if credit limit just crossed
  if (updatedStatus.isExhausted) {

    await pauseCampaignsForTenant(tenantId);

    // Mark ledger as paused
    await (prisma as any).aiTokenLedger.update({
      where: { tenantId_periodStart: { tenantId, periodStart } },
      data: { isPaused: true, pausedAt: new Date() },
    });
  }

  return updatedStatus;
}

// ── Campaign pause / resume ─────────────────────────────────────────────────

/**
 * Pauses all currently active social campaigns that are NOT already
 * paused by credits. Sets pausedByCredits = true so we can distinguish
 * user-paused vs system-paused on resume.
 */
export async function pauseCampaignsForTenant(tenantId: string): Promise<void> {
  await prisma.socialCampaign.updateMany({
    where: {
      tenantId,
      isActive: true,
      pausedByCredits: false,
    },
    data: {
      isActive: false,
      pausedByCredits: true,
    },
  });
}

/**
 * Resumes all campaigns that were auto-paused by the credits system.
 * Does NOT touch campaigns that the user manually paused (pausedByCredits = false).
 */
export async function resumeCampaignsForTenant(tenantId: string): Promise<void> {
  await prisma.socialCampaign.updateMany({
    where: {
      tenantId,
      pausedByCredits: true,
    },
    data: {
      isActive: true,
      pausedByCredits: false,
    },
  });
}

/**
 * Tops up the tenant's credit ledger for the current period.
 * Called after a successful Stripe credit recharge payment.
 * Adds `amountUsd` to creditLimitUsd and resumes paused campaigns.
 */
export async function rechargeCredits(tenantId: string, amountUsd: number): Promise<void> {
  const periodStart = currentPeriodStart();

  await (prisma as any).aiTokenLedger.upsert({
    where: { tenantId_periodStart: { tenantId, periodStart } },
    create: {
      tenantId,
      periodStart,
      periodEnd: currentPeriodEnd(),
      creditLimitUsd: (PLAN_CREDIT_LIMITS.STARTER + amountUsd),
      totalCostUsd: 0,
      promptTokens: 0,
      completionTokens: 0,
    },
    update: {
      creditLimitUsd: { increment: amountUsd },
      isPaused: false,
      resumedAt: new Date(),
    },
  });

  await resumeCampaignsForTenant(tenantId);
}
