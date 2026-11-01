// src/app/api/calendar/account/route.ts
// GET: the external calendar linked to the business (Google or Outlook) and the account email, so the admin
// can check it is the right one. Admin only; the business comes from the session.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getConnectedProvider } from "@/lib/connected-apps";
import { getCalendarAccount } from "@/lib/calendar-account";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;
  const connected = await getConnectedProvider(tenantId, ["GOOGLE", "MICROSOFT"]);
  const account = await getCalendarAccount(tenantId, connected);

  // Private: the email belongs to this business. A short cache avoids asking the provider on every visit.
  return NextResponse.json(
    { account },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
