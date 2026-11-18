// src/app/api/internal/bot/help/route.ts
// POST: n8n marks a WhatsApp chat as needing a person for any registered reason (a failed send, a failed agent...).
// `reason` is required and must be one of src/lib/help-reasons.ts. Auth: x-internal-key.
import { NextRequest } from "next/server";
import { handleHelpRequest } from "@/lib/help-handler";

export async function POST(req: NextRequest) {
  return handleHelpRequest(req, null);
}
