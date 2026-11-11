// src/lib/staff-users-data.ts
// Real database for the owner's team screen (the rules are in staff-users.ts).
// Every query filters by tenantId, and every write also by the STAFF role.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toCapabilityPlan, type CapabilityPlan } from "@/lib/capabilities";
import { hashPassword } from "@/lib/password-hash";
import { ADMIN_ROLE, STAFF_ROLE } from "@/lib/permissions";
import type { NewStaffRow, StaffDeps, StaffUser, TeamOverview } from "@/lib/staff-users";
import { generateTempPassword } from "@/lib/temp-password";
import { userSeats } from "@/lib/user-limits";

// What the team screen may read. Never the password hash or the reset code.
const PUBLIC_FIELDS = { id: true, email: true, name: true, role: true, isActive: true, mustChangePassword: true } as const;
const UNIQUE_VIOLATION = "P2002";

// The owner and the active staff are the users that use a seat.
const SEAT_USERS = (tenantId: string): Prisma.UserWhereInput => ({ tenantId, isActive: true, role: { in: [ADMIN_ROLE, STAFF_ROLE] } });
const STAFF_ROW = (tenantId: string, userId: string): Prisma.UserWhereInput => ({ id: userId, tenantId, role: STAFF_ROLE });

// The part of a Prisma transaction the seat rules use. Narrow on purpose, so the rules are tested with a fake
// transaction that records the order of its calls (tests/staff-users-data.test.ts).
export interface SeatTx {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  user: {
    count: (args: { where: Prisma.UserWhereInput }) => Promise<number>;
    create: (args: { data: Prisma.UserUncheckedCreateInput; select: typeof PUBLIC_FIELDS }) => Promise<StaffUser>;
    updateMany: (args: { where: Prisma.UserWhereInput; data: Prisma.UserUncheckedUpdateManyInput }) => Promise<{ count: number }>;
  };
}

const seatTx = (tx: Prisma.TransactionClient): SeatTx => ({
  $queryRaw: (query, ...values) => tx.$queryRaw(query, ...values),
  user: {
    count: (args) => tx.user.count(args),
    create: (args) => tx.user.create(args),
    updateMany: (args) => tx.user.updateMany(args),
  },
});

// Locks the business row, then counts its seats. Two requests for the same business wait for each other here,
// so they cannot both see a free seat and pass the limit. NO KEY UPDATE still makes them wait for each other,
// but it does not hold back inserts that reference the business (appointments, messages, orders).
async function seatsInUse(tx: SeatTx, tenantId: string): Promise<number> {
  await tx.$queryRaw`SELECT id FROM "tenants" WHERE id = ${tenantId} FOR NO KEY UPDATE`;
  return tx.user.count({ where: SEAT_USERS(tenantId) });
}

async function planOf(tenantId: string): Promise<CapabilityPlan> {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId }, select: { plan: true } });
  return toCapabilityPlan(subscription?.plan);
}

export async function createStaffTx(tx: SeatTx, input: NewStaffRow): Promise<StaffUser | "limit_reached"> {
  if ((await seatsInUse(tx, input.tenantId)) >= input.limit) return "limit_reached";
  return tx.user.create({
    data: {
      tenantId: input.tenantId,
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      role: STAFF_ROLE,
      mustChangePassword: true,
    },
    select: PUBLIC_FIELDS,
  });
}

export async function activateStaffTx(
  tx: SeatTx,
  tenantId: string,
  userId: string,
  limit: number
): Promise<"activated" | "limit_reached" | "not_found"> {
  if ((await seatsInUse(tx, tenantId)) >= limit) return "limit_reached";
  const { count } = await tx.user.updateMany({ where: STAFF_ROW(tenantId, userId), data: { isActive: true } });
  return count > 0 ? "activated" : "not_found";
}

async function createStaffWithinLimit(input: NewStaffRow): Promise<StaffUser | "limit_reached" | "email_taken"> {
  try {
    return await prisma.$transaction((tx) => createStaffTx(seatTx(tx), input));
  } catch (error) {
    // The unique index (tenantId, email) refused it: another request created that email a moment before.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) return "email_taken";
    throw error;
  }
}

function activateWithinLimit(tenantId: string, userId: string, limit: number): Promise<"activated" | "limit_reached" | "not_found"> {
  return prisma.$transaction((tx) => activateStaffTx(seatTx(tx), tenantId, userId, limit));
}

async function deactivate(tenantId: string, userId: string): Promise<boolean> {
  // The version goes up so every open session of that user ends for good, also after a later activation.
  const { count } = await prisma.user.updateMany({
    where: STAFF_ROW(tenantId, userId),
    data: { isActive: false, sessionVersion: { increment: 1 } },
  });
  return count > 0;
}

async function saveTempPassword(tenantId: string, userId: string, passwordHash: string): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: STAFF_ROW(tenantId, userId),
    // A pending WhatsApp reset code dies with the old password, and so does every session opened with it.
    data: {
      passwordHash,
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
      passwordResetCodeHash: null,
      passwordResetExpiresAt: null,
      passwordResetAttempts: 0,
    },
  });
  return count > 0;
}

export function staffDeps(): StaffDeps {
  return {
    planOf,
    findUserByEmail: (tenantId, email) => prisma.user.findFirst({ where: { tenantId, email }, select: { id: true } }),
    findUserById: (tenantId, userId) => prisma.user.findFirst({ where: { id: userId, tenantId }, select: PUBLIC_FIELDS }),
    createStaffWithinLimit,
    activateWithinLimit,
    deactivate,
    saveTempPassword,
    hashPassword,
    generatePassword: () => generateTempPassword(),
  };
}

// The staff of one business and how many of its plan's seats are in use (the owner uses one).
export async function teamOverview(tenantId: string): Promise<TeamOverview> {
  const [users, used, plan] = await Promise.all([
    prisma.user.findMany({ where: { tenantId, role: STAFF_ROLE }, select: PUBLIC_FIELDS, orderBy: { createdAt: "asc" } }),
    prisma.user.count({ where: SEAT_USERS(tenantId) }),
    planOf(tenantId),
  ]);
  return { users, seats: userSeats(plan, used) };
}
