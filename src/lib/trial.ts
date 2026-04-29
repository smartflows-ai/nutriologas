// src/lib/trial.ts
import { prisma } from "@/lib/db";

const TRIAL_DAYS = 14;

export async function getTenantSubscription(tenantId: string) {
  return prisma.subscription.findUnique({ where: { tenantId } });
}

export function getTrialDaysLeft(trialEndsAt: Date): number {
  const ms = trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function isTenantOnTrial(status: string, trialEndsAt: Date): boolean {
  return status === "TRIALING" && trialEndsAt.getTime() > Date.now();
}

export function isTrialExpired(status: string, trialEndsAt: Date): boolean {
  return status === "TRIALING" && trialEndsAt.getTime() <= Date.now();
}

export function isSubscriptionBlocked(status: string, trialEndsAt: Date): boolean {
  return (
    isTrialExpired(status, trialEndsAt) ||
    status === "PAST_DUE" ||
    status === "CANCELED" ||
    status === "UNPAID"
  );
}

export function trialEndsAtDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}
