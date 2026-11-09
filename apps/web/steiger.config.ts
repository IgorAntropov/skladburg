import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: [
      './src/entities/document/**',
      './src/entities/listing/**',
      './src/entities/network/**',
      './src/entities/support-ticket/**',
      './src/features/call-support/**',
      './src/features/change-avatar/**',
      './src/features/create-warehouse/**',
      './src/features/global-search/**',
      './src/features/reset-demo/**',
      './src/features/switch-persona/**',
      './src/features/switch-theme/**',
    ],
    rules: { 'fsd/insignificant-slice': 'off' },
  },
]);
