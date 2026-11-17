// Roteiro de prints da Release Candidate (tour-rc.spec.ts). FORA da execução padrão do e2e:
//   npm run e2e:tour
// Usa os mesmos servidores do e2e (API 8001 + Vite 5173) e o mesmo banco descartável.
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from './playwright.config';

const aqui = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...base,
  testMatch: /tour-rc\.spec\.ts/,
  outputDir: path.join(aqui, 'resultados-tour'),
  timeout: 15 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: { ...base.use, launchOptions: { args: ['--lang=pt-BR'] }, actionTimeout: 30_000, navigationTimeout: 60_000, screenshot: 'only-on-failure', trace: 'off', video: 'off' },
  projects: [{ name: 'tour', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } }],
});
