// src/lib/chat-order.ts
// Order of the WhatsApp chat list for one viewer. Pure, no I/O.
// 1) Help priority first, so a critical chat is never buried. 2) Within the same priority, the chats the viewer is in
// charge of, then the chats assigned to someone else, then the unassigned ones. 3) Most recent activity first.
export interface ChatOrderRow {
  readonly helpPriority: number;
  readonly assignedToId: string | null;
  readonly updatedAt: Date;
}

function assignmentRank(assignedToId: string | null, viewerId: string): number {
  if (assignedToId === viewerId) return 0;
  if (assignedToId) return 1;
  return 2;
}

export function compareChatsForViewer(a: ChatOrderRow, b: ChatOrderRow, viewerId: string): number {
  if (a.helpPriority !== b.helpPriority) return b.helpPriority - a.helpPriority;
  const rank = assignmentRank(a.assignedToId, viewerId) - assignmentRank(b.assignedToId, viewerId);
  if (rank !== 0) return rank;
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}
