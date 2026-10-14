import {
  defineConfig,
  devices,
} from '@playwright/test';

const PREVIEW_PORT = '4174';
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}/`;
const SCENE_SPECS = /(?:scene-budget|scene-world-edge)\.spec\.ts$/;
const OFFLINE_SPEC = /app-offline\.spec\.ts$/;

export default defineConfig({
  expect: {
    timeout: 15_000,
  },
  forbidOnly: true,
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      testIgnore: SCENE_SPECS,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-scene',
      testIgnore: OFFLINE_SPEC,
      testMatch: SCENE_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
    {
      name: 'webkit',
      testIgnore: [/accessibility\.spec\.ts$/, OFFLINE_SPEC, SCENE_SPECS],
      use: { ...devices['Desktop Safari'] },
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
  retries: 0,
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: PREVIEW_URL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm exec vite preview --port ${PREVIEW_PORT} --strictPort`,
    env: {
      DEV_HTTPS_CERT_FILE: '',
      DEV_HTTPS_KEY_FILE: '',
    },
    reuseExistingServer: false,
    timeout: 60_000,
    url: PREVIEW_URL,
  },
});
