import {
  defineConfig,
  devices,
} from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

import {
  DEV_HTTPS_CERT_FILE_VARIABLE,
  DEV_HTTPS_ENV_PREFIX,
  DEV_HTTPS_KEY_FILE_VARIABLE,
} from './build-dev-https/resolveDevHttps.ts';
import {
  createPreviewUrl,
  PERF_PREVIEW_CACHE_CONTROL,
  PERF_PREVIEW_CACHE_CONTROL_ENV_NAME,
  PERF_PREVIEW_PORT,
  readPreviewProtocol,
} from './perf/perfPreview.ts';
import {
  buildSpkiTrustArgument,
  resolvePerfTls,
} from './perf/perfTls.ts';

const PERF_TEST_TIMEOUT_MS = 60 * 60_000;

const PERF_TLS_DIRECTORY = resolve(import.meta.dirname, 'test-results', 'perf-tls');

const isExternalTarget = (process.env.PERF_BASE_URL ?? '').trim() !== '';

const previewProtocol = readPreviewProtocol(process.env);

const previewTls = !isExternalTarget && previewProtocol === 'h2'
  ? resolvePerfTls({
      directory: PERF_TLS_DIRECTORY,
      env: loadEnv('development', import.meta.dirname, DEV_HTTPS_ENV_PREFIX),
    })
  : undefined;

const previewHttpsEnv: Record<string, string> = previewTls === undefined
  ? { [DEV_HTTPS_CERT_FILE_VARIABLE]: '', [DEV_HTTPS_KEY_FILE_VARIABLE]: '' }
  : { [DEV_HTTPS_CERT_FILE_VARIABLE]: previewTls.certFile, [DEV_HTTPS_KEY_FILE_VARIABLE]: previewTls.keyFile };

const previewTrustArgs: string[] = previewTls === undefined ? [] : [buildSpkiTrustArgument(readFileSync(previewTls.certFile))];

export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  outputDir: './test-results/perf',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            ...previewTrustArgs,
          ],
        },
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
          ...previewHttpsEnv,
          [PERF_PREVIEW_CACHE_CONTROL_ENV_NAME]: PERF_PREVIEW_CACHE_CONTROL,
        },
        ignoreHTTPSErrors: true,
        reuseExistingServer: false,
        timeout: 60_000,
        url: createPreviewUrl(previewProtocol),
      },
  workers: 1,
});
