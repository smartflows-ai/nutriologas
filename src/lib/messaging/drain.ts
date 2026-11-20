// src/lib/messaging/drain.ts
// Ban prevention: runs the held-message drain with the production store and gateway. Called by the reminder job
// (every 15 minutes), after its own work. A failure here never changes the reminder job's answer.
import { drainHeld, type DrainResult } from "@/lib/messaging/service";
import { prismaGateway, prismaOutboxStore } from "@/lib/messaging/gateway";

export async function runHeldDrain(now: Date, limit = 10): Promise<DrainResult | null> {
  try {
    return await drainHeld({ store: prismaOutboxStore, gateway: prismaGateway, now: () => now }, limit);
  } catch (error: unknown) {
    console.error("[messaging/drain] held messages failed", error instanceof Error ? error.message : error);
    return null;
  }
}
