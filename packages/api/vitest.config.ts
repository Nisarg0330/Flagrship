import { defineConfig } from 'vitest/config';

// PrismaClient reads DATABASE_URL from process.env at construction time, and
// nothing in a vitest run loads .env for it. Node has done this natively since
// 21.7 - no dotenv dependency required.
try {
  process.loadEnvFile('.env');
} catch {
  // Already in the environment (CI), or no .env file. Prisma will complain if it
  // is genuinely missing, and its message is clearer than anything thrown here.
}

export default defineConfig({
  test: {
    // These tests share one Postgres database, so they must not run concurrently.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
