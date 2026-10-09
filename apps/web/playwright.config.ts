import {
  defineConfig,
  devices,
} from '@playwright/test';

const PREVIEW_PORT = '4174';
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}/`;

export default defineConfig({
  expect: {
    timeout: 15_000,
  },
  forbidOnly: true,
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      testIgnore: /long-tasks\.spec\.ts$/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
  retries: 0,
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: PREVIEW_URL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm exec vite preview --port ${PREVIEW_PORT} --strictPort`,
    reuseExistingServer: false,
    timeout: 60_000,
    url: PREVIEW_URL,
  },
});
