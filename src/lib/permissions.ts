// src/lib/permissions.ts
// Single source of what each role may do in the CRM (ticket #21).
// Pure module: no server imports, so the middleware (edge), the sidebar (client) and the APIs share it.
// Safe default: anything not granted to STAFF here is ADMIN only; any other role gets nothing.
import { CAPABILITIES, isCapabilityVisible, type CapabilityContext } from "./capabilities";

export const ADMIN_ROLE = "ADMIN";
export const STAFF_ROLE = "STAFF";

export const PERMISSIONS = [
  "appointments.view",
  "appointments.status",
  "appointments.reschedule",
  "appointments.book",
  "appointments.notes",
  "appointments.delete",
  "whatsapp.chats",
  "whatsapp.bot",
  "whatsapp.chats.delete",
  "whatsapp.confirmations",
  "whatsapp.settings",
  "history.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STAFF_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "appointments.view",
  "appointments.status",
  "appointments.reschedule",
  "appointments.book",
  "whatsapp.chats",
  "whatsapp.bot",
  "whatsapp.confirmations",
  "whatsapp.settings",
  "history.view",
]);

// The CRM sections STAFF may open, in the order used to pick STAFF's home page.
const STAFF_SECTIONS: readonly { readonly capabilityId: string; readonly route: string }[] = [
  { capabilityId: "appointments", route: "/admin/citas" },
  { capabilityId: "whatsapp", route: "/admin/whatsapp" },
  { capabilityId: "history", route: "/admin/historial" },
];

const ADMIN_ENTRY = "/admin";
const ADMIN_HOME = "/admin/dashboard";
const STORE_HOME = "/";

// Fields that only a role with "appointments.notes" may receive.
const CLINICAL_KEYS = ["internalNotes", "notesHistory"] as const;
type ClinicalKey = (typeof CLINICAL_KEYS)[number];

type Role = string | null | undefined;

// The roles that may enter the CRM at all (which sections each one opens is canAccessAdminPath).
export function isCrmRole(role: Role): boolean {
  return role === ADMIN_ROLE || role === STAFF_ROLE;
}

export function can(role: Role, permission: Permission): boolean {
  if (role === ADMIN_ROLE) return true;
  if (role === STAFF_ROLE) return STAFF_PERMISSIONS.has(permission);
  return false;
}

export interface PermissionSession {
  readonly user: { readonly role?: string | null; readonly tenantId?: string | null };
}

// Pure core of requirePermission: 401 without a session or tenant, 403 without the permission.
export function permissionStatus(session: PermissionSession | null | undefined, permission: Permission): 401 | 403 | null {
  if (!session?.user?.tenantId) return 401;
  return can(session.user.role, permission) ? null : 403;
}

function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function isUnder(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

// Whether the role may open an /admin page. STAFF may open its sections and the /admin entry,
// which sends it to its home page (or shows the empty screen).
export function canAccessAdminPath(role: Role, pathname: string): boolean {
  const path = trimTrailingSlash(pathname);
  if (!isUnder(path, ADMIN_ENTRY)) return false;
  if (role === ADMIN_ROLE) return true;
  if (role !== STAFF_ROLE) return false;
  return path === ADMIN_ENTRY || STAFF_SECTIONS.some((s) => isUnder(path, s.route));
}

// Role and plan together: the role may open the tool's page, and the business has it (plan, flags, activation).
export function canUseCapability(role: Role, capabilityId: string, ctx: CapabilityContext): boolean {
  const capability = CAPABILITIES.find((c) => c.id === capabilityId);
  if (!capability) return false;
  return canAccessAdminPath(role, capability.route) && isCapabilityVisible(capability, ctx);
}

// First STAFF section the business has, or null when there is none (empty screen, never a redirect loop).
export function staffHomePath(ctx: CapabilityContext): string | null {
  const section = STAFF_SECTIONS.find((s) => canUseCapability(STAFF_ROLE, s.capabilityId, ctx));
  return section ? section.route : null;
}

// Where a signed-in user lands. STAFF goes to the /admin entry, which resolves its section.
export function roleHomePath(role: Role): string {
  if (role === ADMIN_ROLE) return ADMIN_HOME;
  if (role === STAFF_ROLE) return ADMIN_ENTRY;
  return STORE_HOME;
}

export type WithoutClinicalNotes<T> = Omit<T, ClinicalKey>;

// Returns a copy without clinical notes for any role that may not read them; never mutates the input.
export function omitClinicalNotes<T extends object>(role: Role, record: T): T | WithoutClinicalNotes<T> {
  if (can(role, "appointments.notes")) return record;
  const entries = Object.entries(record).filter(([key]) => !(CLINICAL_KEYS as readonly string[]).includes(key));
  return Object.fromEntries(entries) as WithoutClinicalNotes<T>;
}

interface PatientTimelineShape {
  readonly visits: readonly { readonly note: unknown }[];
  readonly orphanNotes: readonly unknown[];
}

// Patient history for a role that may not read notes: visits and reasons stay, each visit's note and the notes
// left without a visit go. Same shape, so the screen needs no special case. Never mutates the input.
export function omitPatientNotes<T extends PatientTimelineShape>(role: Role, timeline: T): T {
  if (can(role, "appointments.notes")) return timeline;
  return { ...timeline, visits: timeline.visits.map((v) => ({ ...v, note: null })), orphanNotes: [] };
}

// Patient list for a role that may not read notes: the per-patient notes count is left out.
export function omitNoteCounts<T extends { readonly notes: number }>(role: Role, rows: readonly T[]): (T | Omit<T, "notes">)[] {
  if (can(role, "appointments.notes")) return [...rows];
  return rows.map(({ notes: _notes, ...rest }) => rest);
}
