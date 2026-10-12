import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { bundleBudgetPlugin } from './build-budget/bundleBudgetPlugin.ts';
import { DEFAULT_PROFILE_NAME } from './build-profile/buildProfilePaths.ts';
import { buildProfilePlugin } from './build-profile/buildProfilePlugin.ts';
import { themeBootScriptPlugin } from './build-theme/themeBootScriptPlugin.ts';

const MAX_INITIAL_GZIP_KILOBYTES = 90;

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
