import {
  defineConfig,
  devices,
} from '@playwright/test';

import {
  PERF_PREVIEW_CACHE_CONTROL,
  PERF_PREVIEW_CACHE_CONTROL_ENV_NAME,
  PERF_PREVIEW_PORT,
  PERF_PREVIEW_URL,
} from './perf/perfPreview.ts';

const PERF_TEST_TIMEOUT_MS = 60 * 60_000;

const isExternalTarget = (process.env.PERF_BASE_URL ?? '').trim() !== '';

export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  outputDir: './test-results/perf',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  reporter: [['list']],
  retries: 0,
  testDir: './perf',
  testMatch: '**/*.perf.ts',
  timeout: PERF_TEST_TIMEOUT_MS,
  use: {
    serviceWorkers: 'allow',
  },
  webServer: isExternalTarget
    ? undefined
    : {
        command: `pnpm exec vite preview --port ${PERF_PREVIEW_PORT} --strictPort`,
        env: {
          DEV_HTTPS_CERT_FILE: '',
          DEV_HTTPS_KEY_FILE: '',
          [PERF_PREVIEW_CACHE_CONTROL_ENV_NAME]: PERF_PREVIEW_CACHE_CONTROL,
        },
        reuseExistingServer: false,
        timeout: 60_000,
        url: PERF_PREVIEW_URL,
      },
  workers: 1,
});
