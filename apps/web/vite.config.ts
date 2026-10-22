import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import {
  defineConfig,
  loadEnv,
} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import type { CriticalPreloadEntryValue } from './build-preload/criticalPreloadTypes.ts';

import { APP_BASE_PATH } from './build-base/appBasePath.ts';
import { bootFallbackPlugin } from './build-boot-fallback/bootFallbackPlugin.ts';
import { bundleBudgetPlugin } from './build-budget/bundleBudgetPlugin.ts';
import {
  DEV_HTTPS_ENV_PREFIX,
  resolveDevHttps,
} from './build-dev-https/resolveDevHttps.ts';
import {
  APP_ICONS,
  getIconSizes,
  isManifestIcon,
} from './build-icons/appIcons.ts';
import { ALLOWED_BUNDLE_LICENSES } from './build-licenses/allowedBundleLicenses.ts';
import { createThirdPartyLicenses } from './build-licenses/createThirdPartyLicenses.ts';
import { createCriticalPreload } from './build-preload/createCriticalPreload.ts';
import { DEFAULT_PROFILE_NAME } from './build-profile/buildProfilePaths.ts';
import { buildProfilePlugin } from './build-profile/buildProfilePlugin.ts';
import { loadBuildProfile } from './build-profile/loadBuildProfile.ts';
import { loadProfileMessages } from './build-profile/loadProfileMessages.ts';
import { themeBootScriptPlugin } from './build-theme/themeBootScriptPlugin.ts';
import {
  MANIFEST_BACKGROUND_COLOR,
  THEME_COLOR_BY_THEME,
} from './src/shared/theme/themeConstants.ts';

const MAX_INITIAL_GZIP_KILOBYTES = 90;

const MAX_SCENE_GZIP_KILOBYTES = 300;

const MAX_STARTUP_GZIP_KILOBYTES = 100;

const MAX_CREATE_WAREHOUSE_FORM_GZIP_KILOBYTES = 125;

const MAX_NETWORK_INSPECTOR_GZIP_KILOBYTES = 107;

const MAX_NETWORK_ORGANIZATION_CARD_GZIP_KILOBYTES = 94.3;

const MAX_NETWORK_MINI_MAP_GZIP_KILOBYTES = 69;

const MAX_NETWORK_SITES_GZIP_KILOBYTES = 95;

const MAX_NETWORK_COMPANIES_GZIP_KILOBYTES = 95.5;

const MAX_ORGANIZATION_TABLE_GZIP_KILOBYTES = 97.5;

const MAX_MY_PROFILE_GZIP_KILOBYTES = 129.5;

const MAX_PRECACHED_FILE_BYTES = 2 * 1024 * 1024;

const PRECACHE_GLOB_PATTERNS = ['**/*.{js,css,html,woff2,svg,png}'];

const NAVIGATE_FALLBACK_DENYLIST = [/^[^?]*\/[^/?]*\.(?!html(?:\?|$))[^/.?]+(?:\?|$)/];

const FORBIDDEN_PACKAGES = ['stats-gl', 'stats.js'];

const FORBIDDEN_SCENE_PACKAGES = [
  '@bufbuild/protobuf',
  '@connectrpc/*',
  '@radix-ui/*',
  '@tanstack/*',
  'framer-motion',
  'motion',
  'motion-dom',
  'motion-utils',
  'react-hook-form',
];

const CRITICAL_PATH_ENTRIES: readonly CriticalPreloadEntryValue[] = [
  { entry: 'src/app/bootstrap/mountApp.tsx', isRequired: true },
  { entry: 'src/shared/api/transport/demo/index.ts', isDemoOnly: true, isRequired: true },
];

const PREWARMED_SECTION_ENTRY = 'src/pages/network/index.ts';

const ENGINE_WORKER_ENTRIES = ['packages/demo-engine/src/host/worker.ts'];

const ENGINE_WORKER_DYNAMIC_ENTRIES = ['packages/demo-engine/src/core/engine/index.ts'];

const DEFERRED_PRELOAD_ENTRIES = [...ENGINE_WORKER_ENTRIES, ...ENGINE_WORKER_DYNAMIC_ENTRIES];

const isDemoTransport = loadEnv('production', import.meta.dirname, 'VITE_').VITE_API_TRANSPORT !== 'connect';

const STARTUP_BUDGET_ENTRIES = [
  ...CRITICAL_PATH_ENTRIES
    .filter(({ isDemoOnly }) => isDemoTransport || isDemoOnly !== true)
    .map(({ entry }) => entry),
  PREWARMED_SECTION_ENTRY,
];

const LAZY_ENTRY_BUDGETS = [
  {
    entries: ['src/widgets/scene-viewport/scene/SceneRoot.tsx', 'src/pages/network/scene/NetworkWorldScene.tsx'],
    forbiddenPackages: FORBIDDEN_SCENE_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_SCENE_GZIP_KILOBYTES,
    name: 'scene',
  },
  {
    entries: STARTUP_BUDGET_ENTRIES,
    isRequired: true,
    maxGzipKiloBytes: MAX_STARTUP_GZIP_KILOBYTES,
    name: 'startup',
  },
  {
    entries: ['src/features/create-warehouse/ui/form/CreateWarehouseForm.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_CREATE_WAREHOUSE_FORM_GZIP_KILOBYTES,
    name: 'create-warehouse-form',
  },
  {
    entries: ['src/pages/network/ui/inspector/NetworkInspectorBody.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_INSPECTOR_GZIP_KILOBYTES,
    name: 'network-inspector',
  },
  {
    entries: ['src/pages/network/ui/organization-card/OrganizationInspector.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_ORGANIZATION_CARD_GZIP_KILOBYTES,
    name: 'network-organization-card',
  },
  {
    entries: ['src/pages/network/ui/mini-map/NetworkMiniMap.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_MINI_MAP_GZIP_KILOBYTES,
    name: 'network-mini-map',
  },
  {
    entries: ['src/pages/network/ui/sites/NetworkSitesPanel.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_SITES_GZIP_KILOBYTES,
    name: 'network-sites',
  },
  {
    entries: ['src/pages/network/ui/companies/NetworkCompaniesPanel.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_COMPANIES_GZIP_KILOBYTES,
    name: 'network-companies',
  },
  {
    entries: ['src/pages/network/ui/directory/OrganizationDirectoryPanel.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_ORGANIZATION_TABLE_GZIP_KILOBYTES,
    name: 'organization-table',
  },
  {
    entries: ['src/widgets/profile-menu/ui/my-profile/ProfileMyProfile.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_MY_PROFILE_GZIP_KILOBYTES,
    name: 'my-profile',
  },
];

const FORBIDDEN_INITIAL_PACKAGES = [
  '@bufbuild/protobuf',
  '@connectrpc/*',
  '@radix-ui/*',
  '@react-three/*',
  '@tanstack/*',
  'camera-controls',
  'framer-motion',
  'motion',
  'motion-dom',
  'motion-utils',
  'react-hook-form',
  'three',
  'workbox-window',
  'zustand',
];

const THIRD_PARTY_LICENSES_FILE_NAME = 'third-party-licenses.txt';

const WORKBOX_RESOLVE_CHAIN = ['vite-plugin-pwa', 'workbox-build'];

const EXTRA_LICENSE_PACKAGES = [
  { name: '@fontsource-variable/manrope', resolveFrom: [] },
  { name: 'tailwindcss', resolveFrom: [] },
  { name: 'vite', resolveFrom: [] },
  { name: 'rolldown', resolveFrom: ['vite'] },
  { name: 'workbox-core', resolveFrom: WORKBOX_RESOLVE_CHAIN },
  { name: 'workbox-precaching', resolveFrom: WORKBOX_RESOLVE_CHAIN },
  { name: 'workbox-routing', resolveFrom: WORKBOX_RESOLVE_CHAIN },
  { name: 'workbox-strategies', resolveFrom: WORKBOX_RESOLVE_CHAIN },
];

const APP_NAME_MESSAGE_KEY = 'app.productName';

const START_ERROR_MESSAGE_KEY = 'app.startError.message';

const RELOAD_MESSAGE_KEY = 'routing.chunkError.reload';

const profile = loadBuildProfile({
  appRoot: import.meta.dirname,
  profileName: process.env.BUILD_PROFILE ?? DEFAULT_PROFILE_NAME,
});

const profileMessages = await loadProfileMessages({
  appRoot: import.meta.dirname,
  keys: [APP_NAME_MESSAGE_KEY, START_ERROR_MESSAGE_KEY, RELOAD_MESSAGE_KEY],
  profile,
});

const appName = profileMessages[APP_NAME_MESSAGE_KEY];

const thirdPartyLicenses = createThirdPartyLicenses({
  allowedLicenses: ALLOWED_BUNDLE_LICENSES,
  appRoot: import.meta.dirname,
  extraPackages: EXTRA_LICENSE_PACKAGES,
  fileName: THIRD_PARTY_LICENSES_FILE_NAME,
});

const criticalPreload = createCriticalPreload({
  deferredEntries: DEFERRED_PRELOAD_ENTRIES,
  entries: CRITICAL_PATH_ENTRIES,
  isDemoTransport,
  workerDynamicEntries: ENGINE_WORKER_DYNAMIC_ENTRIES,
  workerEntries: ENGINE_WORKER_ENTRIES,
});

const previewCacheControl = process.env.PERF_PREVIEW_CACHE_CONTROL;

const devHttps = resolveDevHttps(loadEnv('development', import.meta.dirname, DEV_HTTPS_ENV_PREFIX), readFileSync);

export default defineConfig({
  base: APP_BASE_PATH,
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', priority: 2, test: /[\\/]node_modules[\\/]react[\\/]/ },
            { name: 'zustand', priority: 1, test: /[\\/]node_modules[\\/]zustand[\\/]esm[\\/](?:index|vanilla|react)\.mjs$/ },
          ],
        },
      },
      treeshake: {
        manualPureFunctions: ['console.log', 'console.info', 'console.debug'],
      },
    },
  },
  plugins: [
    buildProfilePlugin({ appName, profile }),
    themeBootScriptPlugin(),
    bootFallbackPlugin({
      messages: { message: profileMessages[START_ERROR_MESSAGE_KEY], reload: profileMessages[RELOAD_MESSAGE_KEY] },
    }),
    react(),
    tailwindcss(),
    VitePWA({
      devOptions: { enabled: false },
      includeManifestIcons: false,
      injectRegister: false,
      manifest: {
        background_color: MANIFEST_BACKGROUND_COLOR,
        display: 'standalone',
        icons: APP_ICONS.filter(isManifestIcon).map(icon => ({
          purpose: icon.purpose,
          sizes: getIconSizes(icon),
          src: icon.fileName,
          type: 'image/png',
        })),
        id: APP_BASE_PATH,
        lang: profile.defaultTenant.defaultLocale,
        name: appName,
        short_name: appName,
        theme_color: THEME_COLOR_BY_THEME.light,
      },
      registerType: 'prompt',
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: PRECACHE_GLOB_PATTERNS,
        maximumFileSizeToCacheInBytes: MAX_PRECACHED_FILE_BYTES,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: NAVIGATE_FALLBACK_DENYLIST,
      },
    }),
    bundleBudgetPlugin({
      forbiddenInitialPackages: FORBIDDEN_INITIAL_PACKAGES,
      forbiddenPackages: FORBIDDEN_PACKAGES,
      lazyEntryBudgets: LAZY_ENTRY_BUDGETS,
      maxInitialGzipKiloBytes: MAX_INITIAL_GZIP_KILOBYTES,
    }),
    thirdPartyLicenses.plugin,
    criticalPreload.plugin,
  ],
  preview: previewCacheControl === undefined || previewCacheControl === ''
    ? {}
    : { headers: { 'Cache-Control': previewCacheControl } },
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    ...devHttps === undefined ? {} : { host: true, https: devHttps },
    port: 5173,
    strictPort: true,
  },
  worker: {
    format: 'es',
    plugins: () => [thirdPartyLicenses.workerPlugin(), criticalPreload.workerPlugin()],
  },
});
