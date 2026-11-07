// src/app/api/calendar/account/route.ts
// GET: the external calendar linked to the business (Google or Outlook) and the account email, so the admin
// can check it is the right one. ADMIN and STAFF ("appointments.view"); the business comes from the session.
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permission-guard";
import { getConnectedProvider } from "@/lib/connected-apps";
import { getCalendarAccount } from "@/lib/calendar-account";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requirePermission("appointments.view");
  if (!access.ok) return access.response;
  const { tenantId } = access;
  const connected = await getConnectedProvider(tenantId, ["GOOGLE", "MICROSOFT"]);
  const account = await getCalendarAccount(tenantId, connected);

  // Private: the email belongs to this business. A short cache avoids asking the provider on every visit.
  return NextResponse.json(
    { account },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
