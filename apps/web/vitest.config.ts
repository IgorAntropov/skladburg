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
            include: ['src/**/*.test.ts'],
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
    },
  }),
);
