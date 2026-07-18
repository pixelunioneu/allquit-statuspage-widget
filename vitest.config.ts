import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
});
