import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { bundleBudgetPlugin } from './build-budget/bundleBudgetPlugin.ts';
import { DEFAULT_PROFILE_NAME } from './build-profile/buildProfilePaths.ts';
import { buildProfilePlugin } from './build-profile/buildProfilePlugin.ts';
import { themeBootScriptPlugin } from './build-theme/themeBootScriptPlugin.ts';

const MAX_INITIAL_GZIP_KILOBYTES = 90;

const MAX_SCENE_GZIP_KILOBYTES = 300;

const FORBIDDEN_PACKAGES = ['stats-gl', 'stats.js'];

const LAZY_ENTRY_BUDGETS = [
  {
    entries: ['src/widgets/scene-viewport/scene/SceneRoot.tsx', 'src/pages/network/scene/NetworkBoardScene.tsx'],
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
  'zustand',
];

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
    buildProfilePlugin({
      appRoot: import.meta.dirname,
      profileName: process.env.BUILD_PROFILE ?? DEFAULT_PROFILE_NAME,
    }),
    themeBootScriptPlugin(),
    react(),
    tailwindcss(),
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
    port: 5173,
    strictPort: true,
  },
  worker: {
    format: 'es',
  },
});
