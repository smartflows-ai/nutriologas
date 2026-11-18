// The order of the WhatsApp chat list for one viewer: help priority first, then the viewer's chats, then other assigned chats.
import test from "node:test";
import assert from "node:assert/strict";
import { compareChatsForViewer, type ChatOrderRow } from "../src/lib/chat-order";

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 18, 12, minutes));
const row = (over: Partial<ChatOrderRow>): ChatOrderRow => ({ helpPriority: 0, assignedToId: null, updatedAt: at(0), ...over });
const sorted = (rows: ChatOrderRow[], viewer: string) => [...rows].sort((a, b) => compareChatsForViewer(a, b, viewer));

test("a critical chat stays above assigned ones: help priority always comes first", () => {
  const critical = row({ helpPriority: 2, assignedToId: null, updatedAt: at(1) });
  const mine = row({ helpPriority: 1, assignedToId: "me", updatedAt: at(9) });
  assert.deepEqual(sorted([mine, critical], "me"), [critical, mine]);
});

test("within the same priority, the viewer's chats come before other assistants' and unassigned ones", () => {
  const unassigned = row({ helpPriority: 1, assignedToId: null, updatedAt: at(9) });
  const other = row({ helpPriority: 1, assignedToId: "ana", updatedAt: at(8) });
  const mine = row({ helpPriority: 1, assignedToId: "me", updatedAt: at(1) });
  assert.deepEqual(sorted([unassigned, other, mine], "me"), [mine, other, unassigned]);
});

test("without help, an assigned chat is listed before an unassigned one, then by recent activity", () => {
  const unassignedNew = row({ updatedAt: at(9) });
  const assignedOld = row({ assignedToId: "ana", updatedAt: at(2) });
  const assignedNew = row({ assignedToId: "ana", updatedAt: at(5) });
  assert.deepEqual(sorted([unassignedNew, assignedOld, assignedNew], "me"), [assignedNew, assignedOld, unassignedNew]);
});

test("the owner sees the same rule with their own id: chats assigned to them first", () => {
  const owner = row({ assignedToId: "owner", updatedAt: at(1) });
  const staff = row({ assignedToId: "ana", updatedAt: at(9) });
  assert.deepEqual(sorted([staff, owner], "owner"), [owner, staff]);
});
