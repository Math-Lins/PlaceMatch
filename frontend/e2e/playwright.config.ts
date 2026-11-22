import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
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

export const WEB = env.E2E_WEB_PORT || '5173';
export const API = env.E2E_API_PORT || '8001';
export const PY = env.E2E_PYTHON || 'python';
/** Pasta onde o backend grava os e-mails no e2e (backend de arquivo do Django). Os roteiros leem o link daqui. */
export const PASTA_EMAILS = path.join(os.tmpdir(), 'placematch-e2e-emails');

// Variáveis repassadas ao Django (banco descartável do e2e; nunca o banco de desenvolvimento).
export const envBackend = {
  DB_NAME: env.E2E_DB_NAME || 'pm_e2e',
  DB_USER: env.E2E_DB_USER || 'pm_e2e',
  DB_PASSWORD: env.E2E_DB_PASSWORD,
  DB_HOST: '127.0.0.1',
  DB_PORT: env.E2E_DB_PORT || '5433',
  SECRET_KEY: env.E2E_SECRET_KEY || 'chave-e2e-somente-para-testes-0123456789',
  DEBUG: 'True',
  // Todos os roteiros entram do mesmo IP: sem isso o limite de tentativas de login (padrão 5/min) bloquearia o e2e.
  LOGIN_LIMITE_IP: 'off',
  LOGIN_LIMITE_EMAIL: 'off',
  // Recuperação de senha: e-mails em arquivo (nada é enviado), link apontando para o Vite do e2e e sem limite de pedidos.
  EMAIL_BACKEND: 'django.core.mail.backends.filebased.EmailBackend',
  EMAIL_FILE_PATH: PASTA_EMAILS,
  FRONTEND_URL: `http://127.0.0.1:${WEB}`,
  SENHA_LIMITE_EMAIL: 'off',
  SENHA_LIMITE_IP: 'off',
  ALLOWED_HOSTS: 'localhost,127.0.0.1',
  ADMIN_EMAIL: env.E2E_ADMIN_EMAIL,
  ADMIN_SENHA: env.E2E_ADMIN_SENHA,
};

export default defineConfig({
  testDir: aqui,
  // Só os roteiros nXX (n01 a n15). O roteiro de prints (tour-rc) tem configuração própria: playwright.tour.config.ts.
  testMatch: /n\d\d-.*\.spec\.ts/,
  outputDir: path.join(aqui, 'resultados'),
  // Os roteiros compartilham o mesmo banco e criam usuários próprios: rodar em série evita ruído.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
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
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: envBackend,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${WEB} --strictPort`,
      cwd: path.join(aqui, '..'),
      url: `http://127.0.0.1:${WEB}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { VITE_API_URL: `http://127.0.0.1:${API}` },
    },
  ],
});
