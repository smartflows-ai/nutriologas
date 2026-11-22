// src/lib/help-notice.ts
// The WhatsApp notice sent to an assistant or to the owner when a chat needs a person. It names the reason and
// links the chat in the panel. It never carries the customer's message or name: it lands on a personal phone.
import type { HelpReason } from "@/lib/help-reasons";

const SUBJECT_ES: Readonly<Record<HelpReason, string>> = {
  purchase_intent: "un cliente quiere comprar",
  person_requested: "un cliente pide hablar con una persona",
  send_failed: "una respuesta no llegó a un cliente",
  agent_failed: "el asistente no pudo responder a un cliente",
  unanswered: "un cliente lleva tiempo sin respuesta",
  unanswered_long: "un cliente lleva mucho tiempo sin respuesta",
  credits_exhausted: "se agotaron los créditos del asistente y no responde",
  online_link_missing: "una cita en línea no tiene enlace de videollamada",
  tool_loop: "el asistente repite un error con un cliente",
  reminder_failed: "no se pudo entregar un recordatorio",
  urgency: "un cliente pudo escribir sobre una urgencia",
  opted_out: "un cliente pidió no recibir más mensajes (revisa que sea correcto)",
  booking_limit: "un cliente pidió más citas de las permitidas en un mismo día",
};

export type NoticeKind = "assistant" | "assignment" | "owner" | "owner_unreachable" | "escalation";

export function helpNoticeText(reason: HelpReason, url: string, kind: NoticeKind): string {
  const subject = SUBJECT_ES[reason];
  if (kind === "escalation") return `Nadie atendió a tiempo: ${subject}. Ábrelo en el panel: ${url}`;
  if (kind === "assignment") return `Te asignaron un chat que necesita ayuda: ${subject}. Ábrelo en el panel: ${url}`;
  if (kind === "owner_unreachable") return `Un chat necesita ayuda: ${subject}. No se pudo avisar por WhatsApp a su asistente a cargo. Ábrelo en el panel: ${url}`;
  return `Un chat necesita ayuda: ${subject}. Ábrelo en el panel: ${url}`;
}
