import {
  defineConfig,
  mergeConfig,
} from 'vitest/config';

import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            environment: 'node',
            include: ['src/**/*.test.ts', 'build-profile/**/*.test.ts', 'build-budget/**/*.test.ts'],
            name: 'node',
          },
        },
        {
          extends: true,
          test: {
            environment: 'jsdom',
            include: ['src/**/*.test.tsx'],
            name: 'jsdom',
          },
        },
      ],
      setupFiles: ['./vitest.setup.ts'],
    },
  }),
);
