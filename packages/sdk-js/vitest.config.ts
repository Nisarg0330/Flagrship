import { defineConfig } from 'vitest/config';

// gate-a.test.ts boots the API in-process and needs its DATABASE_URL.
try {
  process.loadEnvFile('../api/.env');
} catch {
  // CI provides it.
}

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
