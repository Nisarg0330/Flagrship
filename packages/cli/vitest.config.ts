import { defineConfig } from 'vitest/config';

// The test boots the API in-process, so it needs the API's DATABASE_URL.
try {
  process.loadEnvFile('../api/.env');
} catch {
  // CI provides it in the environment.
}

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
