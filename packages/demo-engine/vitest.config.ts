import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      TZ: 'Pacific/Kiritimati',
    },
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
