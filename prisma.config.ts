// prisma.config.ts
// Prisma v7 — replaces datasource.url in schema.prisma
import path from "node:path";
import { defineConfig } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
