// Real check of the OAuth refresh path (ticket #16 follow-up): forces the stored Google access token to look expired,
// calls getAppToken (which must refresh against Google) and reports the outcome. Prints no tokens.
// The one write is tokenExpiry, which the refresh itself moves forward again.
//   npx tsx --env-file=.env local-utils/check-token-refresh.ts --yes
import { prisma } from "../src/lib/db";
import { getAppToken } from "../src/lib/connected-apps";

async function main() {
  const where = { provider: "GOOGLE" as const };
  const app = await prisma.connectedApp.findFirst({ where, select: { id: true, tenantId: true, tokenExpiry: true, refreshToken: true } });
  if (!app) throw new Error("no GOOGLE connection found");
  console.log(`before: refreshToken stored=${Boolean(app.refreshToken)} expiry=${app.tokenExpiry?.toISOString() ?? "none"}`);
  if (!process.argv.includes("--yes")) {
    console.log("dry: nothing changed. Add --yes to force the expiry and refresh.");
    return;
  }
  if (!app.refreshToken) throw new Error("no refresh token stored: a refresh cannot work");

  await prisma.connectedApp.update({ where: { id: app.id }, data: { tokenExpiry: new Date(Date.now() - 60_000) } });
  console.log("expiry forced one minute into the past");

  const token = await getAppToken(app.tenantId, "GOOGLE");
  console.log(`getAppToken returned a token: ${Boolean(token)}`);

  const after = await prisma.connectedApp.findFirst({ where, select: { tokenExpiry: true } });
  if (!after) {
    console.log("RESULT: connection was REMOVED (the provider answered with a permanent error)");
    return;
  }
  const minutes = after.tokenExpiry ? Math.round((after.tokenExpiry.getTime() - Date.now()) / 60_000) : null;
  console.log(`after: connection kept, new expiry in ${minutes} minutes`);
  console.log(token && minutes !== null && minutes > 30 ? "RESULT: refresh worked" : "RESULT: refresh did NOT work (connection kept, see server log)");
}

main()
  .catch((e: unknown) => console.error("failed:", e instanceof Error ? e.message : "error"))
  .finally(() => prisma.$disconnect());
