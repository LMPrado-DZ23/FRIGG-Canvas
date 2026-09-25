import { defineConfig } from '@playwright/test';

// E2E do app Electron empacotado em dist/ (rode `npm run build` antes).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
