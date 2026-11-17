import { test as base, expect, type Browser, type Locator, type Page, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

// PNG 1x1 servido para qualquer foto de teste (https://fotos.e2e.test/...), sem depender da internet.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
export const FOTO_OK = 'https://fotos.e2e.test/casa.png';

/** Só localhost é acessível; fotos de teste vêm de um PNG local (sem depender da internet). */
export async function isolarRede(context: BrowserContext) {
  await context.route(/^https?:\/\//, route => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return route.continue();
    if (u.hostname === 'fotos.e2e.test') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
    return route.abort();
  });
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await isolarRede(context);
    await use(context);
  },
});
export { expect };

export const PASTA_EVIDENCIAS = path.join(aqui, 'evidencias');

function lerEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const arq = path.join(aqui, '.env.e2e');
  if (fs.existsSync(arq)) {
    for (const linha of fs.readFileSync(arq, 'utf-8').split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return { ...out, ...(process.env as Record<string, string>) };
}
const env = lerEnv();

export const ADMIN = { email: env.E2E_ADMIN_EMAIL, senha: env.E2E_ADMIN_SENHA };
export const API = `http://127.0.0.1:${env.E2E_API_PORT || '8001'}`;
export const SENHA_PADRAO = 'Teste@12345';

let _seq = 0;
/** E-mail único por execução: e2e-<prefixo>-<timestamp><seq>@teste.com */
export function emailUnico(prefixo: string): string {
  _seq += 1;
  return `e2e-${prefixo}-${Date.now()}${_seq}@teste.com`;
}

/** Salva um print numerado em e2e/evidencias/ (ex.: N02-03-etapa2-erros.png). */
export async function print(page: Page, roteiro: string, n: number, descricao: string): Promise<string> {
  fs.mkdirSync(PASTA_EVIDENCIAS, { recursive: true });
  const nome = `${roteiro}-${String(n).padStart(2, '0')}-${descricao}.png`;
  await page.screenshot({ path: path.join(PASTA_EVIDENCIAS, nome) });
  return nome;
}

export type Perfil = {
  nome: string;
  email: string;
  senha: string;
  tipo: 'busca' | 'oferece';
  regiao: string;
  idade?: string;
  min?: string;
  max?: string;
  imovel?: string;
  pets?: boolean;
  fuma?: boolean;
  titulo?: string;
};

export function novoPerfil(prefixo: string, tipo: 'busca' | 'oferece', extra: Partial<Perfil> = {}): Perfil {
  return {
    nome: `Pessoa ${prefixo} ${tipo} ${Date.now() % 1_000_000}`,
    email: emailUnico(`${prefixo}-${tipo}`),
    senha: SENHA_PADRAO,
    tipo,
    regiao: 'Recife',
    ...(tipo === 'oferece' ? { titulo: `Anuncio ${prefixo} ${Date.now() % 1_000_000}` } : {}),
    ...extra,
  };
}

// ── Navegação básica ────────────────────────────────────────────────────────────

export async function irParaInicio(page: Page) {
  await page.goto('/');
  // O título "Boas-vindas!" só aparece em telas largas; os dois botões existem em qualquer largura.
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
}

/** Cadastro pela interface (tela "Criar conta"). Termina na criação de perfil. */
export async function cadastrar(page: Page, p: Pick<Perfil, 'nome' | 'email' | 'senha' | 'tipo'>) {
  await irParaInicio(page);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByPlaceholder('Seu nome', { exact: true }).fill(p.nome);
  await page.getByPlaceholder('seu@email.com').fill(p.email);
  await page.getByPlaceholder('Mínimo 8 caracteres').fill(p.senha);
  await page.getByPlaceholder('Repita a senha').fill(p.senha);
  await page.getByRole('button', { name: p.tipo === 'busca' ? /Procuro um lugar/ : /Tenho um lugar disponível/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  // cadastro + login + consulta ao perfil: o hash de senha torna esta etapa lenta nesta máquina
  await expect(page.getByText(/^Etapa 1 de/)).toBeVisible({ timeout: 60_000 });
}

export async function etapaAtual(page: Page): Promise<number> {
  const t = await page.getByText(/^Etapa \d de \d/).first().textContent();
  return Number(t?.match(/Etapa (\d)/)?.[1] ?? 0);
}

/** Bloco ("Você fuma?", "Aceita pets?") onde os botões Sim/Não vivem. */
function grupo(page: Page, titulo: string): Locator {
  return page.getByText(titulo, { exact: true }).locator('xpath=..');
}

export async function preencherEtapa1(page: Page, p: Perfil) {
  await page.getByPlaceholder('Seu nome completo').fill(p.nome);
  await page.getByPlaceholder('Sua idade').fill(p.idade ?? '28');
  await page.getByPlaceholder('Ex: Boa Viagem, Recife').fill(p.regiao);
}
export async function preencherEtapa2(page: Page, p: Perfil) {
  await page.getByPlaceholder('700').fill(p.min ?? '800');
  await page.getByPlaceholder('1500').fill(p.max ?? '1500');
  await page.getByRole('button', { name: p.imovel ?? 'Apartamento', exact: true }).click();
  await page.getByRole('button', { name: '2', exact: true }).click();
}
export async function preencherEtapa3(page: Page, p: Perfil) {
  await grupo(page, 'Você fuma?').getByRole('button', { name: p.fuma ? 'Sim' : 'Não', exact: true }).click();
  await grupo(page, 'Aceita pets?').getByRole('button', { name: p.pets === false ? 'Não' : 'Sim', exact: true }).click();
  await page.getByRole('button', { name: 'Às vezes', exact: true }).click();
  await page.getByRole('button', { name: /Flexível/ }).click();
}
export async function preencherEtapa4(page: Page) {
  for (const rotulo of ['Organização', 'Tolerância à bagunça', 'Tolerância a barulho', 'Perfil social']) {
    await page.getByRole('button', { name: `${rotulo}: 3 de 5` }).click();
  }
}
export async function proxima(page: Page) {
  await page.getByRole('button', { name: 'Próxima etapa' }).click();
}

/** Completa a criação de perfil (etapas 1–4, e a 5 só se for oferecendo vaga). */
export async function criarPerfilCompleto(page: Page, p: Perfil) {
  await expect(page.getByText(/^Etapa 1 de/)).toBeVisible();
  await preencherEtapa1(page, p);
  await proxima(page);
  await preencherEtapa2(page, p);
  await proxima(page);
  await preencherEtapa3(page, p);
  await proxima(page);
  await preencherEtapa4(page);
  if (p.tipo === 'oferece') {
    await proxima(page);
    await expect(page.getByText(/^Etapa 5 de 5/)).toBeVisible();
    if (p.titulo) await page.getByPlaceholder('Ex: Quarto amplo próximo ao metrô').fill(p.titulo);
  }
  await page.getByRole('button', { name: 'Concluir perfil' }).click();
}

export function tituloDescoberta(p: Pick<Perfil, 'tipo'>): string {
  return p.tipo === 'busca' ? 'Vagas para você' : 'Interessados na sua vaga';
}

export async function cadastrarComPerfil(page: Page, p: Perfil) {
  await cadastrar(page, p);
  await criarPerfilCompleto(page, p);
  // O título é "Descoberta" quando ainda não há perfis do tipo oposto.
  await expect(page.getByRole('heading', { name: new RegExp(`^(Descoberta|${tituloDescoberta(p)})$`) })).toBeVisible({ timeout: 30_000 });
}

export async function entrar(page: Page, email: string, senha: string) {
  await irParaInicio(page);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByPlaceholder('seu@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** Item do menu (sidebar no desktop, barra inferior no mobile). */
export function menu(page: Page, nome: 'Descoberta' | 'Notificações' | 'Matches' | 'Perfil'): Locator {
  const visivel = page.viewportSize() && page.viewportSize()!.width >= 1024;
  return visivel
    ? page.locator('aside nav').getByRole('button', { name: nome, exact: true })
    : page.locator('div.lg\\:hidden').getByRole('button', { name: nome, exact: true });
}

export async function sair(page: Page) {
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024;
  if (desktop) {
    await page.getByRole('button', { name: 'Sair da conta' }).first().click();
  } else {
    await menu(page, 'Perfil').click();
    await page.getByRole('button', { name: 'Sair da conta' }).last().click();
  }
}

/** Sessão (tokens) guardada na aba. */
export async function tokens(page: Page): Promise<{ access: string | null; refresh: string | null }> {
  return page.evaluate(() => ({
    access: sessionStorage.getItem('pm_access'),
    refresh: sessionStorage.getItem('pm_refresh'),
  }));
}

/** Contexto isolado (outra "pessoa" no navegador). */
export async function novaSessao(context: BrowserContext): Promise<Page> {
  return context.newPage();
}

/** Mensagem curta de apoio quando o teste precisa saber a largura útil da tela. */
export async function semEstouroHorizontal(page: Page): Promise<{ ok: boolean; scroll: number; largura: number }> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return { ok: d.scrollWidth <= d.clientWidth + 1, scroll: d.scrollWidth, largura: d.clientWidth };
  });
}

/** Abre uma sessão isolada (contexto próprio = sessionStorage/cookies próprios) já com a rede isolada. */
export async function abrirSessao(browser: Browser, viewport?: { width: number; height: number }): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: viewport ?? { width: 1366, height: 768 }, locale: 'pt-BR', acceptDownloads: true });
  await isolarRede(context);
  const page = await context.newPage();
  return { context, page };
}

/** Cria usuário + perfil completo em uma sessão descartável (via interface) e a fecha. */
export async function criarUsuarioPelaInterface(browser: Browser, p: Perfil) {
  const { context, page } = await abrirSessao(browser);
  try {
    await cadastrarComPerfil(page, p);
  } finally {
    await context.close();
  }
}

/** Chip/botão visível entre elementos duplicados por breakpoint (desktop/mobile). */
export function visiveis(l: Locator): Locator {
  return l.filter({ visible: true });
}

/** Filtra a Descoberta pela busca e curte o único perfil que sobrar (alvo identificado por `texto`). */
export async function curtirPorBusca(page: Page, texto: string) {
  const busca = page.getByPlaceholder('Buscar por nome, região...');
  await busca.fill(texto);
  await expect(visiveis(page.getByText(texto)).first()).toBeVisible({ timeout: 20_000 });
  // espera a busca (com debounce) terminar: só o alvo deve restar, senão o clique iria a outro perfil
  await expect(visiveis(page.getByRole('button', { name: 'Curtir perfil' }))).toHaveCount(1, { timeout: 20_000 });
  await visiveis(page.getByRole('button', { name: 'Curtir perfil' })).first().click();
}

export type SessaoUsuario = { context: BrowserContext; page: Page; perfil: Perfil };

/**
 * Duas sessões isoladas: A (buscando vaga) e B (oferecendo vaga), cada uma com conta e perfil
 * criados pela interface. A curte B; depois B curte A e cai na tela de interesse mútuo.
 * Devolve as sessões ABERTAS (quem chamar fecha).
 */
export async function prepararMatch(browser: Browser, prefixo: string, viewport?: { width: number; height: number }) {
  const pa = novoPerfil(prefixo, 'busca');
  const pb = novoPerfil(prefixo, 'oferece');
  const a = await abrirSessao(browser, viewport);
  const b = await abrirSessao(browser, viewport);
  await cadastrarComPerfil(a.page, pa);
  await cadastrarComPerfil(b.page, pb);
  await curtirPorBusca(a.page, pb.titulo!);
  await expect(visiveis(a.page.getByText(pb.titulo!))).toHaveCount(0, { timeout: 20_000 });
  await curtirPorBusca(b.page, pa.nome);
  await expect(b.page.getByText('Interesse mútuo confirmado')).toBeVisible({ timeout: 20_000 });
  return {
    A: { ...a, perfil: pa } as SessaoUsuario,
    B: { ...b, perfil: pb } as SessaoUsuario,
  };
}
