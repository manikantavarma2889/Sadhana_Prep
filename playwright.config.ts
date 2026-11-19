import { defineConfig } from '@playwright/test';

const port = process.env.FORGE_E2E_PORT ?? '4179';
const origin = 'http://localhost:' + port;
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 35_000,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: origin,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/local.mjs',
    url: origin + '/health/ready',
    env: { FORGE_LOCAL_PORT: port, FORGE_E2E: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 30_000,
  },
});
