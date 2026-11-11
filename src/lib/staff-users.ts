// src/lib/staff-users.ts
// Rules for the owner's team screen: create a staff user, reset the password, deactivate and activate (ticket #22).
// Pure logic: the database, the hash and the password generator come in as `deps`, so the rules are tested
// without them (tests/staff-users.test.ts). The real ones are in src/lib/staff-users-data.ts.
// tenantId always comes from the caller's session, never from the request.
import type { CapabilityPlan } from "./capabilities";
import { STAFF_ROLE } from "./permissions";
import { USER_LIMIT_BY_PLAN, type UserSeats } from "./user-limits";

// What the team screen may know about a user. Never the password hash.
export interface StaffUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: string;
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
}

// What the team screen receives: the staff of the business and how many of its plan's seats are in use.
export interface TeamOverview {
  readonly users: readonly StaffUser[];
  readonly seats: UserSeats;
}

// Who is asking: the signed-in owner.
export interface StaffActor {
  readonly tenantId: string;
  readonly userId: string;
}

export interface NewStaffInput {
  readonly email: string;
  readonly name: string;
}

export interface NewStaffRow {
  readonly tenantId: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly limit: number;
}

export interface StaffDeps {
  planOf: (tenantId: string) => Promise<CapabilityPlan>;
  // Any role: a customer of the business with that email also blocks the creation.
  findUserByEmail: (tenantId: string, email: string) => Promise<{ readonly id: string } | null>;
  findUserById: (tenantId: string, userId: string) => Promise<StaffUser | null>;
  // Counts the active CRM users and inserts a STAFF user in one transaction, so two requests at once cannot pass
  // the limit. "email_taken" is the unique index (tenantId, email) refusing a second insert of the same email.
  createStaffWithinLimit: (input: NewStaffRow) => Promise<StaffUser | "limit_reached" | "email_taken">;
  // The three writes below must filter by id, tenantId and the STAFF role, and report whether a row changed:
  // the user can be deleted or change role between the rule's read and its write.
  // Same transaction rule as the creation.
  activateWithinLimit: (tenantId: string, userId: string, limit: number) => Promise<"activated" | "limit_reached" | "not_found">;
  deactivate: (tenantId: string, userId: string) => Promise<boolean>;
  // Stores the hash, turns mustChangePassword on and clears any pending reset code.
  saveTempPassword: (tenantId: string, userId: string, passwordHash: string) => Promise<boolean>;
  hashPassword: (password: string) => Promise<string>;
  generatePassword: () => string;
}

export type StaffFailure = "email_already_registered" | "user_limit_reached" | "user_not_found";

const NOT_FOUND = { ok: false, reason: "user_not_found" } as const;

type Failed<R extends StaffFailure> = { readonly ok: false; readonly reason: R };

export type CreateStaffResult =
  // tempPassword is returned once, to show to the owner. It is never stored in clear.
  | { readonly ok: true; readonly user: StaffUser; readonly tempPassword: string }
  | Failed<"email_already_registered" | "user_limit_reached">;

export type ResetStaffResult = { readonly ok: true; readonly tempPassword: string } | Failed<"user_not_found">;

export type SetActiveResult = { readonly ok: true } | Failed<"user_not_found" | "user_limit_reached">;

// The fields the screen receives: a copy without anything else the store may carry (such as the hash).
function publicUser(user: StaffUser): StaffUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

// The team screen only acts on staff users of the caller's business. The owner's own account, another owner,
// a customer and a user of another business all answer "not found", so the reply reveals nothing.
async function findStaffTarget(deps: StaffDeps, actor: StaffActor, userId: string): Promise<StaffUser | null> {
  if (userId === actor.userId) return null;
  const user = await deps.findUserById(actor.tenantId, userId);
  return user && user.role === STAFF_ROLE ? user : null;
}

export async function createStaffUser(deps: StaffDeps, actor: StaffActor, input: NewStaffInput): Promise<CreateStaffResult> {
  // Same form sign-in uses to look the user up; otherwise "Ana@x.com" could never sign in.
  const email = input.email.trim().toLowerCase();
  const existing = await deps.findUserByEmail(actor.tenantId, email);
  if (existing) return { ok: false, reason: "email_already_registered" };

  const limit = USER_LIMIT_BY_PLAN[await deps.planOf(actor.tenantId)];
  const tempPassword = deps.generatePassword();
  const created = await deps.createStaffWithinLimit({
    tenantId: actor.tenantId,
    email,
    name: input.name.trim(),
    passwordHash: await deps.hashPassword(tempPassword),
    limit,
  });
  if (created === "limit_reached") return { ok: false, reason: "user_limit_reached" };
  if (created === "email_taken") return { ok: false, reason: "email_already_registered" };

  return { ok: true, user: publicUser(created), tempPassword };
}

export async function resetStaffPassword(deps: StaffDeps, actor: StaffActor, userId: string): Promise<ResetStaffResult> {
  const target = await findStaffTarget(deps, actor, userId);
  if (!target) return NOT_FOUND;

  // A deactivated user may get a new temporary password: it stays unusable until the owner activates the account.
  const tempPassword = deps.generatePassword();
  const saved = await deps.saveTempPassword(actor.tenantId, target.id, await deps.hashPassword(tempPassword));
  return saved ? { ok: true, tempPassword } : NOT_FOUND;
}

export async function setStaffActive(
  deps: StaffDeps,
  actor: StaffActor,
  userId: string,
  isActive: boolean
): Promise<SetActiveResult> {
  const target = await findStaffTarget(deps, actor, userId);
  if (!target) return NOT_FOUND;
  // Already in the wanted state: nothing to do, and an active user must not be counted as a new seat.
  if (target.isActive === isActive) return { ok: true };

  if (!isActive) return (await deps.deactivate(actor.tenantId, target.id)) ? { ok: true } : NOT_FOUND;

  const limit = USER_LIMIT_BY_PLAN[await deps.planOf(actor.tenantId)];
  const outcome = await deps.activateWithinLimit(actor.tenantId, target.id, limit);
  if (outcome === "not_found") return NOT_FOUND;
  return outcome === "activated" ? { ok: true } : { ok: false, reason: "user_limit_reached" };
}
