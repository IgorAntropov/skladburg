import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      treeshake: {
        manualPureFunctions: ['console.log', 'console.info', 'console.debug'],
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
