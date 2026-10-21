import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: [
      './src/entities/network/**',
      './src/entities/warehouse/**',
      './src/features/create-warehouse/**',
      './src/features/reset-demo/**',
      './src/features/switch-persona/**',
      './src/features/switch-theme/**',
    ],
    rules: { 'fsd/insignificant-slice': 'off' },
  },
]);
