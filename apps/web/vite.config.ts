import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { bundleBudgetPlugin } from './build-budget/bundleBudgetPlugin.ts';
import { DEFAULT_PROFILE_NAME } from './build-profile/buildProfilePaths.ts';
import { buildProfilePlugin } from './build-profile/buildProfilePlugin.ts';

const MAX_INITIAL_GZIP_KILOBYTES = 140;

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
    react(),
    tailwindcss(),
    bundleBudgetPlugin({ maxInitialGzipKiloBytes: MAX_INITIAL_GZIP_KILOBYTES }),
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
