// Read-only check for ticket #16 (phase 0b): is Google Calendar connected, and since when?
// Prints no tokens, emails or phone numbers. tsx does not load .env by itself, so pass it explicitly
// (without it the pg client falls back to localhost and fails with ECONNREFUSED):
//   npx tsx --env-file=.env local-utils/check-google-connection.ts
import { prisma } from "../src/lib/db";

async function main() {
  const apps = await prisma.connectedApp.findMany({
    select: { provider: true, connectedAt: true, scopes: true, tenant: { select: { slug: true } } },
    orderBy: { connectedAt: "asc" },
  });
  console.log("connected_apps:");
  for (const a of apps) {
    console.log(`  ${a.tenant.slug}  ${a.provider}  connectedAt=${a.connectedAt.toISOString()}  scopes=${a.scopes ?? "-"}`);
  }

  const byProvider = await prisma.appointment.groupBy({ by: ["externalProvider"], _count: true });
  console.log("appointments by calendar provider:", JSON.stringify(byProvider));

  const stuck = await prisma.appointment.count({ where: { status: "CANCELLED", externalEventId: { not: null } } });
  console.log("cancelled appointments whose calendar event was not removed:", stuck);

  const latest = await prisma.appointment.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { createdAt: true, status: true, externalProvider: true },
  });
  console.log("latest appointments (created, status, provider):");
  for (const a of latest) console.log(`  ${a.createdAt.toISOString()}  ${a.status}  ${a.externalProvider ?? "none"}`);
}

main()
  .catch((e: unknown) => {
    // Code and a scrubbed message only: connection strings must never reach the terminal or the chat.
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "-";
    const message = e instanceof Error ? e.message.replace(/\w+:\/\/\S+/g, "<url>").split("\n").filter(Boolean).slice(-2).join(" | ") : "";
    console.error("failed:", e instanceof Error ? e.name : "error", "code=" + code, message);
  })
  .finally(() => prisma.$disconnect());
