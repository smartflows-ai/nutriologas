// Read-only check: which currency and Plus price a business gets at checkout.
// Run: npx tsx --env-file=.env local-utils/check-billing-currency.ts [slug]
import { prisma } from "../src/lib/db";
import { billingCurrencyForTenant, priceAmountPerMonth } from "../src/lib/billing-currency-server";

async function main() {
  const slug = process.argv[2] ?? "doctorg";
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) throw new Error(`tenant ${slug} not found`);
  const currency = await billingCurrencyForTenant(tenant.id);
  const plus = await priceAmountPerMonth("PLUS", "monthly", currency);
  const starter = await priceAmountPerMonth("STARTER", "monthly", currency);
  console.log(`${slug}: currency ${currency.toUpperCase()}, Start ${starter ?? "n/a"}, Plus ${plus ?? "n/a"} per month`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
