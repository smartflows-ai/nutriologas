// Read-only check: which CRM tools each tenant can use, from its real plan and flags.
// Run: npx tsx --env-file=.env local-utils/check-plan-locks.ts [slug]
import { prisma } from "../src/lib/db";
import { capabilityContextForTenant } from "../src/lib/capability-guard";
import { CAPABILITIES, isCapabilityVisible, isPlanLocked } from "../src/lib/capabilities";

async function main() {
  const slugFilter = process.argv[2];
  const tenants = await prisma.tenant.findMany({
    where: slugFilter ? { slug: slugFilter } : {},
    select: { id: true, slug: true },
  });
  for (const t of tenants) {
    const ctx = await capabilityContextForTenant(t.id);
    if (!ctx) continue;
    console.log(`\n${t.slug} (plan ${ctx.plan}, vertical ${ctx.vertical})`);
    for (const c of CAPABILITIES) {
      const state = isCapabilityVisible(c, ctx) ? "visible" : isPlanLocked(c, ctx) ? "LOCKED (plan)" : "hidden (flags)";
      console.log(`  ${c.id.padEnd(18)} ${state}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
