// src/lib/user-limits.ts
// How many CRM users (the owner plus active staff) each plan allows (ticket #22).
// Same numbers the landing publishes. Pure module: no I/O (tests in tests/user-limits.test.ts).
import type { CapabilityPlan } from "./capabilities";

export const USER_LIMIT_BY_PLAN: Readonly<Record<CapabilityPlan, number>> = { START: 1, PLUS: 2, PRO: 3 };

export interface UserSeats {
  readonly used: number;
  readonly limit: number;
  readonly available: number;
}

// `activeUsers` counts the owner and every active staff user; deactivated users do not use a seat.
export function userSeats(plan: CapabilityPlan, activeUsers: number): UserSeats {
  const limit = USER_LIMIT_BY_PLAN[plan];
  // A business that moved to a smaller plan keeps its users: never report negative seats.
  return { used: activeUsers, limit, available: Math.max(0, limit - activeUsers) };
}

export function canAddUser(plan: CapabilityPlan, activeUsers: number): boolean {
  return userSeats(plan, activeUsers).available > 0;
}
