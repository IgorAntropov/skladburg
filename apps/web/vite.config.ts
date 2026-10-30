import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import {
  defineConfig,
  loadEnv,
} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import type { BundleBudgetPluginOptionsValue } from './build-budget/bundleBudgetPlugin.ts';
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
import { appVersionPlugin } from './build-version/appVersionPlugin.ts';
import { createGitHeadReader } from './build-version/readGitHead.ts';
import { resolveAppVersion } from './build-version/resolveAppVersion.ts';
import {
  MANIFEST_BACKGROUND_COLOR,
  THEME_COLOR_BY_THEME,
} from './src/shared/theme/themeConstants.ts';

const MAX_INITIAL_GZIP_KILOBYTES = 90;

const MAX_SCENE_GZIP_KILOBYTES = 300;

const MAX_STARTUP_GZIP_KILOBYTES = 95;

const MAX_CREATE_WAREHOUSE_FORM_GZIP_KILOBYTES = 45.7;

const MAX_NETWORK_INSPECTOR_GZIP_KILOBYTES = 26;

const MAX_NETWORK_ORGANIZATION_CARD_GZIP_KILOBYTES = 10;

const MAX_NETWORK_MINI_MAP_GZIP_KILOBYTES = 3;

const MAX_NETWORK_SITES_GZIP_KILOBYTES = 4.5;

const MAX_NETWORK_COMPANIES_GZIP_KILOBYTES = 12.5;

const MAX_ORGANIZATION_TABLE_GZIP_KILOBYTES = 12;

const MAX_MY_PROFILE_GZIP_KILOBYTES = 65.9;

const MAX_WORLD_MODELS_KILOBYTES = 300;

const MAX_ORGANIZATION_LOGOS_KILOBYTES = 40;

const MAX_ASSISTANT_PORTRAITS_KILOBYTES = 6;

const MAX_NOTIFICATION_CENTER_GZIP_KILOBYTES = 33.4;

const MAX_NOTIFICATION_CENTER_TEXTS_GZIP_KILOBYTES = 1.5;

const MAX_NOTIFICATION_UNREAD_REPORTER_GZIP_KILOBYTES = 3.5;

const MAX_ASSISTANT_HOST_GZIP_KILOBYTES = 13.5;

const MAX_ASSISTANT_TEXTS_GZIP_KILOBYTES = 2;

const MAX_ASSISTANT_TEXTS_INFORMAL_GZIP_KILOBYTES = 3;

const MAX_SUPPORT_CHAT_GZIP_KILOBYTES = 36.5;

const MAX_SUPPORT_CHAT_TEXTS_GZIP_KILOBYTES = 3;

const MAX_REQUISITES_FORM_GZIP_KILOBYTES = 54.3;

const MAX_REQUISITES_TEXTS_GZIP_KILOBYTES = 1.6;

const MAX_ENGINE_WORKER_GZIP_KILOBYTES = 40;

const MAX_ENGINE_GZIP_KILOBYTES = 180;

const MAX_PRECACHED_FILE_BYTES = 2 * 1024 * 1024;

const PRECACHE_GLOB_PATTERNS = ['**/*.{js,css,html,woff2,svg,png,bin}'];

const NAVIGATE_FALLBACK_DENYLIST = [/^[^?]*\/[^/?]*\.(?!html(?:\?|$))[^/.?]+(?:\?|$)/];

const ASSET_BUDGETS = [
  {
    directory: 'models',
    extensions: ['.bin'],
    isRequired: true,
    maxKiloBytes: MAX_WORLD_MODELS_KILOBYTES,
    name: 'world-models',
  },
  {
    directory: 'logos',
    extensions: ['.svg'],
    isRequired: true,
    maxKiloBytes: MAX_ORGANIZATION_LOGOS_KILOBYTES,
    name: 'organization-logos',
  },
  {
    directory: 'assistant',
    extensions: ['.svg'],
    isRequired: true,
    maxKiloBytes: MAX_ASSISTANT_PORTRAITS_KILOBYTES,
    name: 'assistant',
  },
];

const XLSX_READER_PACKAGES = ['read-excel-file'];

const FORBIDDEN_PACKAGES = [...XLSX_READER_PACKAGES, 'stats-gl', 'stats.js'];

const FORBIDDEN_SCENE_PACKAGES = [
  '@bufbuild/protobuf',
  '@connectrpc/*',
  '@radix-ui/*',
  '@tanstack/*',
  'framer-motion',
  'maska',
  'motion',
  'motion-dom',
  'motion-utils',
  'react-hook-form',
];

const FORBIDDEN_STARTUP_PACKAGES = [
  '@radix-ui/*',
  '@react-three/*',
  'camera-controls',
  'framer-motion',
  'maska',
  'motion',
  'motion-dom',
  'motion-utils',
  'react-hook-form',
  'three',
];

const STARTUP_BASELINE = 'startup';

const CRITICAL_PATH_ENTRIES: readonly CriticalPreloadEntryValue[] = [
  { entry: 'src/app/bootstrap/mountApp.tsx', isRequired: true },
  { entry: 'src/shared/api/transport/demo/index.ts', isDemoOnly: true, isRequired: true },
];

const PREWARMED_SECTION_ENTRY = 'src/pages/network/index.ts';

const ENGINE_WORKER_ENTRIES = ['packages/demo-engine/src/host/worker.ts'];

const ENGINE_WORKER_DYNAMIC_ENTRIES = ['packages/demo-engine/src/core/engine/index.ts'];

const DEFERRED_PRELOAD_ENTRIES = [...ENGINE_WORKER_ENTRIES, ...ENGINE_WORKER_DYNAMIC_ENTRIES];

const ENGINE_WORKER_BUDGET = {
  forbiddenInitialPackages: XLSX_READER_PACKAGES,
  lazyEntryBudgets: [
    {
      entries: ENGINE_WORKER_DYNAMIC_ENTRIES,
      forbiddenPackages: XLSX_READER_PACKAGES,
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_GZIP_KILOBYTES,
      name: 'engine',
    },
  ],
  maxInitialGzipKiloBytes: MAX_ENGINE_WORKER_GZIP_KILOBYTES,
  targetEntries: ENGINE_WORKER_ENTRIES,
} satisfies BundleBudgetPluginOptionsValue;

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
    forbiddenPackages: FORBIDDEN_STARTUP_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_STARTUP_GZIP_KILOBYTES,
    name: STARTUP_BASELINE,
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/create-warehouse/ui/form/CreateWarehouseForm.tsx'],
    forbiddenPackages: ['maska'],
    isRequired: true,
    maxGzipKiloBytes: MAX_CREATE_WAREHOUSE_FORM_GZIP_KILOBYTES,
    name: 'create-warehouse-form',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/inspector/NetworkInspectorBody.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_INSPECTOR_GZIP_KILOBYTES,
    name: 'network-inspector',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/organization-card/OrganizationInspector.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_ORGANIZATION_CARD_GZIP_KILOBYTES,
    name: 'network-organization-card',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/mini-map/NetworkMiniMap.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_MINI_MAP_GZIP_KILOBYTES,
    name: 'network-mini-map',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/sites/NetworkSitesPanel.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_SITES_GZIP_KILOBYTES,
    name: 'network-sites',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/companies/NetworkCompaniesPanel.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_COMPANIES_GZIP_KILOBYTES,
    name: 'network-companies',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/directory/OrganizationDirectoryPanel.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_ORGANIZATION_TABLE_GZIP_KILOBYTES,
    name: 'organization-table',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/profile-menu/ui/my-profile/ProfileMyProfile.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_MY_PROFILE_GZIP_KILOBYTES,
    name: 'my-profile',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/notification-center/ui/panel/NotificationCenterPanel.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NOTIFICATION_CENTER_GZIP_KILOBYTES,
    name: 'notification-center',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/notification-center/ui/reporter/UnreadCountReporterBody.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NOTIFICATION_UNREAD_REPORTER_GZIP_KILOBYTES,
    name: 'notification-unread-reporter',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/notification-center/i18n/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NOTIFICATION_CENTER_TEXTS_GZIP_KILOBYTES,
    name: 'notification-center-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/assistant/ui/host/AssistantHost.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_ASSISTANT_HOST_GZIP_KILOBYTES,
    name: 'assistant',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/assistant/i18n/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_ASSISTANT_TEXTS_GZIP_KILOBYTES,
    name: 'assistant-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/assistant/i18n/catalogs/ru.informal.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_ASSISTANT_TEXTS_INFORMAL_GZIP_KILOBYTES,
    name: 'assistant-texts-informal',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/support-chat/ui/chat/SupportChat.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_SUPPORT_CHAT_GZIP_KILOBYTES,
    name: 'support-chat',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/support-chat/i18n/catalogs/ru.ts', 'src/widgets/support-chat/i18n/catalogs/ru.informal.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_SUPPORT_CHAT_TEXTS_GZIP_KILOBYTES,
    name: 'support-chat-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/edit-requisites/ui/panel/RequisitesPanel.tsx'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_REQUISITES_FORM_GZIP_KILOBYTES,
    name: 'requisites-form',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/edit-requisites/i18n/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_REQUISITES_TEXTS_GZIP_KILOBYTES,
    name: 'requisites-texts',
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

const appVersion = resolveAppVersion({ readGitHead: createGitHeadReader(import.meta.dirname) });

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
    appVersionPlugin({ appVersion }),
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
      assetBudgets: ASSET_BUDGETS,
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
    plugins: () => [thirdPartyLicenses.workerPlugin(), criticalPreload.workerPlugin(), bundleBudgetPlugin(ENGINE_WORKER_BUDGET)],
  },
});
