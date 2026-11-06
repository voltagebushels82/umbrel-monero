import {defineConfig} from '@playwright/test';

// Runs against the production UI and real daemon in an isolated Compose project.
// No webServer or request interception: Docker must already be running.
export default defineConfig({
  testDir: './test/docker',
  outputDir: './test-results/docker',
  workers: 1,
  timeout: 600000,
  expect: {timeout: 15000},
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:8889',
    viewport: {width: 1440, height: 1000},
    headless: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
