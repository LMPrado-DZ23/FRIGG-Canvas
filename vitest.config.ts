import { defineConfig } from 'vitest/config';

// Config dedicada de teste (não herda o root do renderer do vite.config).
export default defineConfig({
  test: {
    root: '.',
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
      // Lógica testável por unidade. Componentes React (.tsx), o glue do Electron
      // (main.ts) e a ponte do preload são cobertos pela suíte E2E.
      include: ['src/core/**/*.ts', 'src/main/**/*.ts', 'src/renderer/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/main/main.ts', 'src/renderer/bridge.ts'],
      // Um pouco abaixo do medido (79/70/77/83): impede regressão sem travar ajustes.
      thresholds: { statements: 75, branches: 65, functions: 72, lines: 78 },
    },
  },
});
