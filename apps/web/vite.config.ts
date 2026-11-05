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
import { extractPackageName } from './build-budget/extractPackageName.ts';
import { hasEntryModule } from './build-budget/isEntryModule.ts';
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

const HUD_SHARED_MODULES = [
  'src/shared/api/query/organizationQueryScope.ts',
  'src/shared/routing/address/formatAddressPath.ts',
  'src/shared/routing/react/useNavigate.ts',
  'src/shared/theme/useThemePreference.ts',
  'src/shared/ui/chunk-load-notice/ChunkLoadNotice.tsx',
  'src/shared/ui/empty-state/EmptyState.tsx',
  'src/shared/ui/tabs/Tabs.tsx',
  'src/entities/organization/api/organizationKeys.ts',
  'src/entities/organization/config/sideBadges.ts',
  'src/widgets/object-inspector/ui/ObjectInspector.tsx',
];

const TOOLTIP_SHARED_MODULES = [
  'src/shared/ui/action-button/AccessButton.tsx',
  'src/shared/ui/action-button/ActionButton.tsx',
  'src/shared/ui/action-button/CommandErrorNotice.tsx',
  'src/shared/ui/tooltip/formatShortcut.ts',
  'src/shared/ui/tooltip/Tooltip.tsx',
  'src/shared/ui/tooltip/TooltipGroup.tsx',
  'src/shared/ui/tooltip/TooltipGroupContext.ts',
  'src/shared/ui/tooltip/tooltipStyles.ts',
  'src/shared/ui/tooltip/tooltipTiming.ts',
];

const TOOLTIP_SHARED_PACKAGES = new Set([
  '@floating-ui/core',
  '@floating-ui/dom',
  '@floating-ui/react-dom',
  '@floating-ui/utils',
  '@radix-ui/primitive',
  '@radix-ui/react-compose-refs',
  '@radix-ui/react-context',
  '@radix-ui/react-dismissable-layer',
  '@radix-ui/react-id',
  '@radix-ui/react-popper',
  '@radix-ui/react-portal',
  '@radix-ui/react-presence',
  '@radix-ui/react-primitive',
  '@radix-ui/react-slot',
  '@radix-ui/react-tooltip',
  '@radix-ui/react-use-callback-ref',
  '@radix-ui/react-use-controllable-state',
  '@radix-ui/react-use-effect-event',
  '@radix-ui/react-use-layout-effect',
  '@radix-ui/react-use-size',
  '@radix-ui/react-visually-hidden',
]);

const SIDE_SHAPE_MODULES = [
  'src/entities/organization/config/sideShapes.ts',
  'src/entities/organization/ui/SideShape.tsx',
];

const LIST_HELPER_MODULES = [
  'src/entities/warehouse/api/warehouseKeys.ts',
  'src/shared/lib/scroll/resolveScrollBehavior.ts',
];

const MAX_INITIAL_GZIP_KILOBYTES = 90;

const MAX_SCENE_GZIP_KILOBYTES = 300;

const MAX_STARTUP_GZIP_KILOBYTES = 95;

const MAX_CREATE_WAREHOUSE_FORM_GZIP_KILOBYTES = 46.2;

const MAX_NETWORK_INSPECTOR_GZIP_KILOBYTES = 26;

const MAX_NETWORK_ORGANIZATION_CARD_GZIP_KILOBYTES = 10;

const MAX_NETWORK_MINI_MAP_GZIP_KILOBYTES = 3;

const MAX_NETWORK_SITES_GZIP_KILOBYTES = 4.5;

const MAX_NETWORK_COMPANIES_GZIP_KILOBYTES = 12.5;

const MAX_ORGANIZATION_TABLE_GZIP_KILOBYTES = 12;

const MAX_MY_PROFILE_GZIP_KILOBYTES = 66.4;

const MAX_WORLD_MODELS_KILOBYTES = 300;

const MAX_ORGANIZATION_LOGOS_KILOBYTES = 40;

const MAX_ASSISTANT_PORTRAITS_KILOBYTES = 6;

const MAX_NOTIFICATION_CENTER_GZIP_KILOBYTES = 33.7;

const MAX_NOTIFICATION_CENTER_TEXTS_GZIP_KILOBYTES = 1.5;

const MAX_NOTIFICATION_UNREAD_REPORTER_GZIP_KILOBYTES = 3.5;

const MAX_ASSISTANT_HOST_GZIP_KILOBYTES = 13.5;

const MAX_ASSISTANT_TEXTS_GZIP_KILOBYTES = 2;

const MAX_ASSISTANT_TEXTS_INFORMAL_GZIP_KILOBYTES = 3;

const MAX_SUPPORT_CHAT_GZIP_KILOBYTES = 36.9;

const MAX_SUPPORT_CHAT_TEXTS_GZIP_KILOBYTES = 3;

const MAX_REQUISITES_FORM_GZIP_KILOBYTES = 55.9;

const MAX_REQUISITES_TEXTS_GZIP_KILOBYTES = 1.6;

const MAX_CATALOG_PAGE_GZIP_KILOBYTES = 27.7;

const MAX_CATALOG_OWN_GZIP_KILOBYTES = 31;

const MAX_CATALOG_TEXTS_GZIP_KILOBYTES = 2.8;

const MAX_LISTING_EDITOR_GZIP_KILOBYTES = 75.8;

const MAX_CATALOG_EDITOR_TEXTS_GZIP_KILOBYTES = 2.5;

const MAX_SALES_TERMS_FORM_GZIP_KILOBYTES = 75.8;

const MAX_GLOBAL_SEARCH_GZIP_KILOBYTES = 19.4;

const MAX_GLOBAL_SEARCH_TEXTS_GZIP_KILOBYTES = 1.4;

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

const CATALOG_FORBIDDEN_PACKAGES = ['@react-three/*', 'three', 'maska', 'react-hook-form'];

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
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/ui/CatalogPage.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_CATALOG_PAGE_GZIP_KILOBYTES,
    name: 'catalog-page',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/ui/own/OwnCatalogPanel.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_CATALOG_OWN_GZIP_KILOBYTES,
    name: 'catalog-own',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/ui/listing-editor/ListingEditor.tsx'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_LISTING_EDITOR_GZIP_KILOBYTES,
    name: 'listing-editor',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/ui/sales-terms/SalesTermsForm.tsx'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_SALES_TERMS_FORM_GZIP_KILOBYTES,
    name: 'sales-terms-form',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/i18n/editor/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_CATALOG_EDITOR_TEXTS_GZIP_KILOBYTES,
    name: 'catalog-editor-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/i18n/catalogs/ru.ts', 'src/entities/listing/i18n/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_CATALOG_TEXTS_GZIP_KILOBYTES,
    name: 'catalog-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/global-search/ui/panel/searchPanelEntry.ts'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_GLOBAL_SEARCH_GZIP_KILOBYTES,
    name: 'global-search',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/global-search/i18n/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_GLOBAL_SEARCH_TEXTS_GZIP_KILOBYTES,
    name: 'global-search-texts',
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
            {
              includeDependenciesRecursively: false,
              name: 'hud-shared',
              test: (moduleId: string): boolean => HUD_SHARED_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'tooltip',
              test: (moduleId: string): boolean => TOOLTIP_SHARED_PACKAGES.has(extractPackageName(moduleId) ?? '')
                || TOOLTIP_SHARED_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'side-shape',
              test: (moduleId: string): boolean => SIDE_SHAPE_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'list-helpers',
              test: (moduleId: string): boolean => LIST_HELPER_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
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
