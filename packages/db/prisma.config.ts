import "dotenv/config";
import { defineConfig } from "prisma/config";

const buildSafeDatabaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://build_user:build_password@localhost:5432/yatra_build";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma client generation does not connect to the database, but Prisma 7
    // still evaluates this config. Runtime DB creation in src/client.ts
    // continues to require the real DATABASE_URL and fails closed without it.
    url: buildSafeDatabaseUrl,
  },
});
