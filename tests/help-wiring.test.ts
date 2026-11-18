// The routes and screens of the "chat needs help" feature keep their guards: tenant isolation, permissions,
// the bot never answering the team, and the reminder job never being broken by the help checks.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("the help action route is guarded, takes the tenant from the session and only the owner assigns", () => {
  const source = read("src/app/api/apps/whatsapp/chats/[id]/help/route.ts");
  assert.ok(source.includes('requirePermission("whatsapp.chats")'));
  assert.ok(/canAssignHelp\(access\.role\)/.test(source), "assign must check the owner permission");
  assert.equal(/body\??\.tenantId/.test(source), false, "the tenant never comes from the body");
  assert.ok(/tenantId,\s*role: "STAFF"/.test(source), "an assignee must be an active STAFF of this business");
});

test("the internal help routes check the internal key and take the tenant from the WhatsApp instance", () => {
  const handler = read("src/lib/help-handler.ts");
  assert.ok(handler.includes("isInternalKeyValid(req)"));
  assert.ok(handler.includes("resolveBotTenant(instance)"));
  assert.equal(/tenantId\s*[:=]\s*body/.test(handler), false);
  for (const route of ["src/app/api/internal/bot/handoff/route.ts", "src/app/api/internal/bot/help/route.ts"]) {
    assert.ok(read(route).includes("handleHelpRequest("), route);
  }
  assert.ok(read("src/app/api/internal/bot/help/route.ts").includes("handleHelpRequest(req, null)"), "bot/help requires a reason");
});

test("the chat list puts the chats that need help first and only the owner receives the assistants", () => {
  const source = read("src/app/api/apps/whatsapp/chats/route.ts");
  assert.ok(/orderBy:\s*\[\{ helpPriority: "desc" \}/.test(source));
  assert.ok(source.includes("canAssignHelp(access.role)"));
});

test("answering from the panel hands the chat over and turning the bot back on closes the request", () => {
  assert.ok(read("src/app/api/apps/whatsapp/chats/[id]/send/route.ts").includes("repliedPatch("));
  assert.ok(read("src/app/api/apps/whatsapp/chats/[id]/route.ts").includes("resolvePatch()"));
});

test("a message sent from the phone, and any reply to an unanswered customer, ends the request", () => {
  const source = read("src/app/api/internal/whatsapp/sync/route.ts");
  assert.ok(source.includes("resolvePatch()"));
  assert.ok(source.includes('startsWith("unanswered")'));
});

test("the bot never answers the owner or the staff", () => {
  const source = read("src/app/api/internal/bot/contact-status/route.ts");
  assert.ok(source.includes("isTeamNumber("));
  assert.ok(source.includes("botEnabled: false"));
});

test("the help checks run after the reminders, inside their own try/catch, and never change the reminder status", () => {
  const source = read("src/app/api/internal/reminders/run/route.ts");
  assert.ok(source.includes("runHelpChecks(now)"));
  const fn = source.slice(source.indexOf("async function runHelpChecks"), source.indexOf("export async function POST"));
  assert.ok(fn.includes("try {") && fn.includes("catch"));
  assert.ok(source.includes("reminderRunStatus(batch, dryRun)"), "the status still comes from the reminders alone");
});

test("the staff number action refuses the business line and the owner's number", () => {
  const source = read("src/app/api/admin/users/[id]/route.ts");
  assert.ok(source.includes('raw?.action === "set_whatsapp"'));
  assert.ok(source.includes("isSameWhatsAppNumber(number, botLine?.waPhoneNumber)"));
  assert.ok(source.includes("isSameWhatsAppNumber(number, tenant?.whatsappNumber)"));
  assert.ok(source.includes('role: "STAFF"'), "only STAFF users of this business can be changed");
});

test("the sidebar shows the help counter next to WhatsApp", () => {
  const source = read("src/components/admin/AdminSidebar.tsx");
  assert.equal((source.match(/<HelpCountBadge/g) ?? []).length, 2, "mobile and desktop menus");
});

test("the notice to an assistant never carries the customer's message", () => {
  const source = read("src/lib/help-notice.ts");
  assert.equal(/lastMessage|pushName|content/.test(source), false);
});

test("a reason that hits the whole business is quiet while another chat was told in the last hour", () => {
  const handler = read("src/lib/help-handler.ts");
  assert.ok(handler.includes("isTenantWide(reason)"));
  assert.ok(handler.includes("shouldAlertOwner("), "the same one-hour rule as the owner alerts");
  assert.ok(handler.includes("quiet"));
});

test("marking handled turns the bot back on when a hand-off paused it, and a person writing keeps it paused", () => {
  const action = read("src/app/api/apps/whatsapp/chats/[id]/help/route.ts");
  assert.ok(action.includes("resumeBotPatch(chat.botPausedReason)"));
  assert.ok(/botEnabled: true,\s*botPausedReason: true/.test(action), "the screen needs the bot state back to update at once");
  assert.ok(read("src/app/api/apps/whatsapp/chats/[id]/send/route.ts").includes("ownerTookOverPatch(chat.botPausedReason)"));
  assert.ok(read("src/app/api/internal/whatsapp/sync/route.ts").includes("ownerTookOverPatch(chat.botPausedReason)"));
});

test("taking a chat pauses the bot that was answering it", () => {
  const action = read("src/app/api/apps/whatsapp/chats/[id]/help/route.ts");
  assert.ok(action.includes("takePatch(userId, new Date(), chat.botEnabled)"));
});

test("the help escalation setting is owner only: the route and the card both require users.manage", () => {
  const route = read("src/app/api/tenants/help/route.ts");
  assert.equal((route.match(/requirePermission\("users\.manage"\)/g) ?? []).length, 2, "GET and PATCH are owner only");
  assert.doesNotMatch(route, /requirePermission\("whatsapp\.settings"\)/, "no staff permission on the escalation setting");
  const page = read("src/app/admin/whatsapp/page.tsx");
  assert.match(page, /canAssignHelpChats && <HelpSettingsCard \/>/, "the card is shown to the owner only");
});
