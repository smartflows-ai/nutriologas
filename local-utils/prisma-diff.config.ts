// Prisma config for read-only schema diffs against an arbitrary database (Prisma 7 removed --from-url).
// Usage: DIFF_URL=postgresql://... npx prisma migrate diff --config local-utils/prisma-diff.config.ts \
//   --from-config-datasource --to-schema prisma/schema.prisma --script
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("..", "prisma", "schema.prisma"),
  datasource: { url: process.env.DIFF_URL! },
});
