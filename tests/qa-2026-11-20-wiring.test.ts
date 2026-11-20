// tests/qa-2026-11-20-wiring.test.ts
// Run: npx tsx --test tests/qa-2026-11-20-wiring.test.ts
// QA 2026-11-20: opt-out goes to "Necesitan ayuda" and can be reactivated; cancelling from the panel no longer
// waits for the calendar and the WhatsApp notice one after the other, and the pressed button shows it is working.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("an inbound opt-out raises the opted_out help request on the chat", () => {
  const sync = read("src/app/api/internal/whatsapp/sync/route.ts");
  assert.match(sync, /botPausedReason: OPTED_OUT_PAUSE/);
  assert.match(sync, /raiseHelpOnChat\(realHelpDeps, helpTenant as HelpTenant, optedOut as HelpChatRow, "opted_out"/);
});

test("the help route reactivates messages only for an opted-out chat, with the recorded patch", () => {
  const route = read("src/app/api/apps/whatsapp/chats/[id]/help/route.ts");
  assert.match(route, /action !== "reactivate"/);
  assert.match(route, /if \(!chat\.optedOutAt\) return apiError\("whatsapp_not_opted_out", 409\)/);
  assert.match(route, /reactivateMessagingPatch\(userId, new Date\(\), chat\.botPausedReason, chat\.helpReason\)/);
});

test("turning the bot on never lifts an opt-out", () => {
  const route = read("src/app/api/apps/whatsapp/chats/[id]/route.ts");
  assert.match(route, /if \(body\.botEnabled && existing\.optedOutAt\)/);
  assert.match(route, /apiError\("whatsapp_chat_opted_out", 409\)/);
});

test("the panel shows the opt-out band with the reactivate action, confirmed by a person", () => {
  const page = read("src/app/admin/whatsapp/page.tsx");
  assert.match(page, /selectedChat\.optedOutAt && \(/);
  assert.match(page, /helpAction\("reactivate"\)/);
  assert.match(page, /confirm\(t\.crm\.whatsapp\.help\.reactivateConfirm\)/);
  assert.match(read("src/app/api/apps/whatsapp/chats/route.ts"), /optedOutAt: true/);
});

test("cancelling from the panel runs the calendar removal and the notice at the same time", () => {
  const route = read("src/app/api/appointments/[id]/route.ts");
  assert.doesNotMatch(route, /await cancelAppointment\(/);
  assert.match(route, /removeMirrorEvent\(tenantId, appointment\)/);
  assert.match(route, /notifyCancelledFromPanel\(params\.id, tenantId\)/);
  assert.match(route, /await Promise\.all\(followUps\)/);
});

test("the agenda button being saved shows a spinner and Cancelando", () => {
  const card = read("src/components/admin/appointments/AppointmentCard.tsx");
  assert.match(card, /busyStatus === status/);
  assert.match(card, /t\.agenda\.cancelling/);
  assert.match(card, /animate-spin/);
  assert.match(read("src/app/admin/citas/page.tsx"), /busyStatus=\{updatingId === appt\.id \? updatingStatus : null\}/);
});
