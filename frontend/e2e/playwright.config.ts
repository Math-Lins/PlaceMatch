import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** Lê e2e/.env.e2e (NÃO versionado). Variáveis já definidas no ambiente têm prioridade. */
function lerEnvE2E(): Record<string, string> {
  const arq = path.join(aqui, '.env.e2e');
  const out: Record<string, string> = {};
  if (fs.existsSync(arq)) {
    for (const linha of fs.readFileSync(arq, 'utf-8').split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

const env = lerEnvE2E();
for (const k of ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_SENHA', 'E2E_DB_PASSWORD']) {
  if (!env[k]) throw new Error(`Faltou ${k}. Crie frontend/e2e/.env.e2e (veja e2e/README.md).`);
}

const WEB = env.E2E_WEB_PORT || '5173';
const API = env.E2E_API_PORT || '8001';
const PY = env.E2E_PYTHON || 'python';

// Variáveis repassadas ao Django (banco descartável do e2e; nunca o banco de desenvolvimento).
const envBackend = {
  DB_NAME: env.E2E_DB_NAME || 'pm_e2e',
  DB_USER: env.E2E_DB_USER || 'pm_e2e',
  DB_PASSWORD: env.E2E_DB_PASSWORD,
  DB_HOST: '127.0.0.1',
  DB_PORT: env.E2E_DB_PORT || '5433',
  SECRET_KEY: env.E2E_SECRET_KEY || 'chave-e2e-somente-para-testes-0123456789',
  DEBUG: 'True',
  ALLOWED_HOSTS: 'localhost,127.0.0.1',
  ADMIN_EMAIL: env.E2E_ADMIN_EMAIL,
  ADMIN_SENHA: env.E2E_ADMIN_SENHA,
};

export default defineConfig({
  testDir: aqui,
  testMatch: /n\d\d-.*\.spec\.ts/,
  outputDir: path.join(aqui, 'resultados'),
  // Os roteiros compartilham o mesmo banco e criam usuários próprios: rodar em série evita ruído.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(aqui, 'resultados', 'resultado.json') }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${WEB}`,
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'off',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /n13-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'mobile',
      testMatch: /n13-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: [
    {
      command: `${PY} manage.py migrate --noinput && ${PY} manage.py criar_admin && ${PY} manage.py runserver 127.0.0.1:${API} --noreload`,
      cwd: path.join(aqui, '..', '..', 'backend'),
      url: `http://127.0.0.1:${API}/api/auth/me/`,
      // /api/auth/me/ responde 401 sem token: basta o servidor responder.
      ignoreHTTPSErrors: true,
      reuseExistingServer: true,
      timeout: 120_000,
      env: envBackend,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${WEB} --strictPort`,
      cwd: path.join(aqui, '..'),
      url: `http://127.0.0.1:${WEB}`,
      reuseExistingServer: true,
      timeout: 60_000,
      env: { VITE_API_URL: `http://127.0.0.1:${API}` },
    },
  ],
});
