// src/lib/help-requests.ts
// Raising help on a WhatsApp chat, escalating to the owner and detecting a customer who waits without an answer.
// I/O (database, WhatsApp) comes in through `deps`, so the logic is testable without them (same pattern as
// reminder-run.ts). Decisions live in help-state.ts and help-routing.ts; here they are put in order.
import { helpNoticeText, type NoticeKind } from "@/lib/help-notice";
import { isHelpReason, type HelpReason } from "@/lib/help-reasons";
import { assignmentReminderDue, escalationDue, helpNotifyPlan, pickFirstResponder, type Assistant, type AssignmentState } from "@/lib/help-routing";
import { raiseHelp, unansweredReason, type HelpState } from "@/lib/help-state";
import { tenantPublicUrl } from "@/lib/tenant-url";

/** Minutes a customer's last message waits before the chat counts as "unanswered". */
export const UNANSWERED_MINUTES = 10;

export interface HelpChatRow {
  id: string;
  tenantId: string;
  helpReason: string | null;
  helpPriority: number;
  helpRequestedAt: Date | null;
  assignedToId: string | null;
  helpAssigneeNotifiedAt: Date | null;
  helpOwnerNotifiedAt: Date | null;
  helpTakenAt: Date | null;
  helpAssignedAt?: Date | null;
}

export interface HelpTenant {
  id: string;
  slug: string;
  customDomain: string | null;
  helpEscalationMinutes: number;
}

export interface HelpDeps {
  loadAssistants: (tenantId: string) => Promise<Assistant[]>;
  saveChat: (id: string, data: Record<string, unknown>) => Promise<void>;
  sendToAssistant: (tenantId: string, assistantId: string, text: string) => Promise<boolean>;
  sendToOwner: (tenantId: string, text: string) => Promise<boolean>;
}

export interface RaiseOutcome {
  raised: boolean;
  notified: "assistant" | "owner" | null;
}

function chatUrl(tenant: HelpTenant, chatId: string): string {
  return tenantPublicUrl(tenant, `/admin/whatsapp?chat=${chatId}`);
}

function stateOf(chat: HelpChatRow): HelpState {
  return {
    reason: isHelpReason(chat.helpReason) ? chat.helpReason : null,
    priority: chat.helpPriority,
    requestedAt: chat.helpRequestedAt,
  };
}

export async function raiseHelpOnChat(
  deps: HelpDeps,
  tenant: HelpTenant,
  chat: HelpChatRow,
  reason: HelpReason,
  now: Date,
  options: { quiet?: boolean } = {}
): Promise<RaiseOutcome> {
  const before = stateOf(chat);
  const raised = raiseHelp(before, reason, now);
  if (raised.state === before) return { raised: false, notified: null };

  const data: Record<string, unknown> = {
    helpReason: raised.state.reason,
    helpPriority: raised.state.priority,
    helpRequestedAt: raised.state.requestedAt,
  };
  // Somebody already took this chat, or the business was just told about the same problem: the state shows in the
  // panel, but nobody is told again.
  const notify = raised.notify && !chat.helpTakenAt && !options.quiet;
  let notified: RaiseOutcome["notified"] = null;

  if (notify) {
    // A request that goes up in priority starts a new wait.
    if (chat.helpOwnerNotifiedAt) data.helpOwnerNotifiedAt = null;
    if (chat.helpAssigneeNotifiedAt) data.helpAssigneeNotifiedAt = null;

    const assistants = await deps.loadAssistants(tenant.id);
    const responder = pickFirstResponder({ assignedToId: chat.assignedToId, assistants });
    const url = chatUrl(tenant, chat.id);
    // The assistant in charge cannot be told (no number, inactive, or the send failed): the owner is told that, and the
    // chat stays with that assistant. A queue pick never takes a chat over in silence.
    const assigneeUnreachable = chat.assignedToId !== null && responder.kind === "assistant" && responder.source === "queue";
    let plan = helpNotifyPlan({ notify: true, responder });
    if (assigneeUnreachable) plan = { assistantId: null, notifyOwner: true };
    let ownerNeeded = plan.notifyOwner;
    let ownerKind: NoticeKind = assigneeUnreachable ? "owner_unreachable" : "owner";

    if (plan.assistantId) {
      const sent = await deps.sendToAssistant(tenant.id, plan.assistantId, helpNoticeText(reason, url, "assistant"));
      if (sent) {
        data.helpAssigneeNotifiedAt = now;
        // The in-app toast is keyed by this time, so every notice to an assistant shows it, not only the owner's assignments.
        // The 15-minute WhatsApp reminder does not repeat: it waits for a notice older than the assignment.
        data.helpAssignedAt = now;
        if (!chat.assignedToId && responder.kind === "assistant") data.assignedToId = plan.assistantId;
        notified = "assistant";
      } else {
        // The assistant could not be told: the owner is, so the chat never goes unseen.
        ownerNeeded = true;
        ownerKind = chat.assignedToId ? "owner_unreachable" : "owner";
      }
    }
    if (ownerNeeded) {
      const sent = await deps.sendToOwner(tenant.id, helpNoticeText(reason, url, ownerKind));
      if (sent) {
        data.helpOwnerNotifiedAt = now;
        notified = "owner";
      }
    }
  }

  await deps.saveChat(chat.id, data);
  return { raised: true, notified };
}

export interface EscalationDeps {
  /** Chats with help open, an assistant told, nobody took them and the owner not told yet. */
  loadWaiting: () => Promise<{ chat: HelpChatRow; tenant: HelpTenant }[]>;
  saveChat: (id: string, data: Record<string, unknown>) => Promise<void>;
  sendToOwner: (tenantId: string, text: string) => Promise<boolean>;
}

export interface EscalationResult {
  checked: number;
  escalated: number;
  failed: number;
}

export async function escalateDueChats(deps: EscalationDeps, now: Date): Promise<EscalationResult> {
  const waiting = await deps.loadWaiting();
  let escalated = 0;
  let failed = 0;
  for (const { chat, tenant } of waiting) {
    const clock = { assigneeNotifiedAt: chat.helpAssigneeNotifiedAt, ownerNotifiedAt: chat.helpOwnerNotifiedAt, takenAt: chat.helpTakenAt };
    if (!escalationDue(now, clock, tenant.helpEscalationMinutes)) continue;
    const reason = isHelpReason(chat.helpReason) ? chat.helpReason : "person_requested";
    const sent = await deps.sendToOwner(tenant.id, helpNoticeText(reason, chatUrl(tenant, chat.id), "escalation"));
    if (!sent) {
      failed++;
      continue;
    }
    await deps.saveChat(chat.id, { helpOwnerNotifiedAt: now });
    escalated++;
  }
  return { checked: waiting.length, escalated, failed };
}

export interface UnansweredSource {
  /** Chats whose last message is the customer's, with the time of that message. */
  loadCandidates: () => Promise<{ chat: HelpChatRow; tenant: HelpTenant; lastInboundAt: Date }[]>;
}

export async function detectUnanswered(
  deps: HelpDeps,
  source: UnansweredSource,
  now: Date
): Promise<{ checked: number; raised: number }> {
  const candidates = await source.loadCandidates();
  let raised = 0;
  for (const { chat, tenant, lastInboundAt } of candidates) {
    const reason = unansweredReason(now, lastInboundAt, UNANSWERED_MINUTES);
    if (!reason) continue;
    const outcome = await raiseHelpOnChat(deps, tenant, chat, reason, now);
    if (outcome.raised) raised++;
  }
  return { checked: candidates.length, raised };
}

export interface AssignmentDeps {
  /** Chats with help open that the owner assigned, with nobody having taken them and the owner not told yet. */
  loadPending: () => Promise<{ chat: HelpChatRow; tenant: HelpTenant }[]>;
  saveChat: (id: string, data: Record<string, unknown>) => Promise<void>;
  sendToAssistant: (tenantId: string, assistantId: string, text: string) => Promise<boolean>;
  sendToOwner: (tenantId: string, text: string) => Promise<boolean>;
}

export interface AssignmentResult {
  checked: number;
  reminded: number;
  ownerTold: number;
}

/**
 * The WhatsApp that follows the in-app notice of an assignment. If the assistant cannot receive it, the owner is told
 * (the chat is not silent). The escalation to the owner later counts from this reminder.
 */
export async function remindAssignees(deps: AssignmentDeps, now: Date): Promise<AssignmentResult> {
  const pending = await deps.loadPending();
  let reminded = 0;
  let ownerTold = 0;
  for (const { chat, tenant } of pending) {
    const state: AssignmentState = {
      assignedToId: chat.assignedToId,
      helpPriority: chat.helpPriority,
      helpAssignedAt: chat.helpAssignedAt ?? null,
      takenAt: chat.helpTakenAt,
      assigneeNotifiedAt: chat.helpAssigneeNotifiedAt,
      ownerNotifiedAt: chat.helpOwnerNotifiedAt,
    };
    if (!chat.assignedToId || !assignmentReminderDue(now, state)) continue;
    const reason = isHelpReason(chat.helpReason) ? chat.helpReason : "person_requested";
    const url = chatUrl(tenant, chat.id);
    const sent = await deps.sendToAssistant(tenant.id, chat.assignedToId, helpNoticeText(reason, url, "assignment"));
    if (sent) {
      await deps.saveChat(chat.id, { helpAssigneeNotifiedAt: now });
      reminded++;
      continue;
    }
    const told = await deps.sendToOwner(tenant.id, helpNoticeText(reason, url, "owner_unreachable"));
    if (told) {
      await deps.saveChat(chat.id, { helpOwnerNotifiedAt: now });
      ownerTold++;
    }
  }
  return { checked: pending.length, reminded, ownerTold };
}
