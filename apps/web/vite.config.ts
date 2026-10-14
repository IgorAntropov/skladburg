import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import {
  defineConfig,
  loadEnv,
} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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

const MAX_PRECACHED_FILE_BYTES = 2 * 1024 * 1024;

const PRECACHE_GLOB_PATTERNS = ['**/*.{js,css,html,woff2,svg,png}'];

const FORBIDDEN_PACKAGES = ['stats-gl', 'stats.js'];

const LAZY_ENTRY_BUDGETS = [
  {
    entries: ['src/widgets/scene-viewport/scene/SceneRoot.tsx', 'src/pages/network/scene/NetworkWorldScene.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_SCENE_GZIP_KILOBYTES,
    name: 'scene',
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
  'three',
  'workbox-window',
  'zustand',
];

const APP_NAME_MESSAGE_KEY = 'app.productName';

const profile = loadBuildProfile({
  appRoot: import.meta.dirname,
  profileName: process.env.BUILD_PROFILE ?? DEFAULT_PROFILE_NAME,
});

const profileMessages = await loadProfileMessages({
  appRoot: import.meta.dirname,
  keys: [APP_NAME_MESSAGE_KEY],
  profile,
});

const appName = profileMessages[APP_NAME_MESSAGE_KEY];

const devHttps = resolveDevHttps(loadEnv('development', import.meta.dirname, DEV_HTTPS_ENV_PREFIX), readFileSync);

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', priority: 2, test: /[\\/]node_modules[\\/]react[\\/]/ },
            { name: 'zustand', priority: 1, test: /[\\/]node_modules[\\/]zustand[\\/]/ },
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
      },
    }),
    bundleBudgetPlugin({
      forbiddenInitialPackages: FORBIDDEN_INITIAL_PACKAGES,
      forbiddenPackages: FORBIDDEN_PACKAGES,
      lazyEntryBudgets: LAZY_ENTRY_BUDGETS,
      maxInitialGzipKiloBytes: MAX_INITIAL_GZIP_KILOBYTES,
    }),
  ],
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
  },
});
