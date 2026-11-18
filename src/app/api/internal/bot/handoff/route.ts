// src/app/api/internal/bot/handoff/route.ts
// POST: A customer wants to buy an item the team sells through WhatsApp (or, with `reason`, asks for a person).
// The bot steps aside for this contact and the chat is marked as needing help: the assistant is told first and,
// if nobody takes it in time, the owner (src/lib/help-requests.ts). The team answers from the CRM.
import { NextRequest } from "next/server";
import { handleHelpRequest } from "@/lib/help-handler";

export async function POST(req: NextRequest) {
  return handleHelpRequest(req, "purchase_intent");
}
