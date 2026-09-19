import { defineConfig } from 'vitest/config';

// Config dedicada de teste (não herda o root do renderer do vite.config).
export default defineConfig({
  test: {
    root: '.',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
