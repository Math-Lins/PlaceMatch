/**
 * Roteiro de PRINTS da Release Candidate (não é teste de regressão; fica fora do `npm run e2e`).
 *
 *   npm run e2e:db          # banco descartável (recrie com e2e:db:parar + e2e:db para partir do zero)
 *   npm run e2e:tour        # prepara os dados de demonstração, percorre o sistema e salva os prints
 *
 * Saída: e2e/evidencias-rc/RC-XX-*.png + INDICE.md, e o pacote frontend/evidencias-rc.zip.
 * Dados: `manage.py seed_demo --remover-outros` (perfis do Recife com fotos, matches, conversas,
 * 3 denúncias e 1 conta suspensa). As fotos dos seeds (Unsplash e randomuser.me) são servidas a
 * partir de cópias locais em e2e/fotos-demo/, então os prints não dependem da internet para as imagens.
 */
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { envBackend, PY, API } from './playwright.config';
import { ADMIN } from './apoio';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.join(aqui, 'evidencias-rc');
const ZIP = path.join(aqui, '..', 'evidencias-rc.zip');
// Saídas das verificações finais (testes, verificar_banco, build, e2e...), incluídas no mesmo pacote.
const EXECUCOES = path.join(aqui, '..', '..', 'docs', 'execucoes-rc');
const FOTOS = path.join(aqui, 'fotos-demo');
const BACKEND = path.join(aqui, '..', '..', 'backend');
const URL_API = `http://127.0.0.1:${API}`;

const DESKTOP = { width: 1366, height: 768 };
const MOBILE = { width: 375, height: 812 };
const SENHA_SEED = 'Test@1234';
const ANA = { email: 'ana@seed.pm', nome: 'Ana Luísa' };        // procura vaga
const SUSPENSO = 'guilherme@seed.pm';

const foto = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&h=600&fit=crop`;
const CAROLINA = {
  nome: 'Carolina Ribeiro', email: 'carolina.ribeiro@exemplo.com.br', senha: 'Moradia@2026',
  idade: '26', regiao: 'Torre',
  bio: 'Analista de sistemas, trabalho em casa três dias por semana. Gosto de casa organizada, plantas e silêncio à noite.',
  titulo: 'Quarto com varanda na Torre, perto da UFPE',
  descricao: 'Apartamento de 2 quartos com varanda, cozinha equipada e área de serviço. Prédio com portaria, a 5 minutos do ponto de ônibus para a UNINASSAU. Contas divididas igualmente.',
  fotos: [foto('1540518614846-7eded433c457'), foto('1502672260266-1c1ef2d93688')],
  fotoPerfil: 'https://randomuser.me/api/portraits/women/33.jpg',
};

type Linha = { arquivo: string; tela: string; perfil: string; viewport: string };
const indice: Linha[] = [];

// ── Rede: localhost liberado; fotos dos seeds vêm das cópias locais; Swagger UI (jsdelivr) passa.
//    As fontes são locais (@fontsource), então o Google Fonts não é liberado. ──
async function prepararRede(context: BrowserContext) {
  await context.route(/^https?:\/\//, async route => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return route.continue();
    let arquivo = '';
    if (u.hostname === 'images.unsplash.com') {
      const m = u.pathname.match(/photo-([\w-]+)/);
      if (m) arquivo = `unsplash-${m[1]}.jpg`;
    } else if (u.hostname === 'randomuser.me') {
      const m = u.pathname.match(/portraits\/(women|men)\/(\d+)\.jpg/);
      if (m) arquivo = `avatar-${m[1]}-${m[2]}.jpg`;
    }
    if (arquivo && fs.existsSync(path.join(FOTOS, arquivo))) {
      return route.fulfill({ status: 200, contentType: 'image/jpeg', path: path.join(FOTOS, arquivo) });
    }
    if (['cdn.jsdelivr.net', 'images.unsplash.com', 'randomuser.me'].includes(u.hostname)) {
      return route.continue();
    }
    return route.abort();
  });
}

async function sessao(browser: Browser, viewport = DESKTOP): Promise<{ context: BrowserContext; page: Page }> {
  const mobile = viewport.width < 600;
  const context = await browser.newContext({
    viewport, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo',
    ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  await prepararRede(context);
  const page = await context.newPage();
  return { context, page };
}

/** Espera a tela "assentar" (sem Carregando, imagens e fontes prontas) e salva o print. */
async function print(page: Page, n: number, slug: string, tela: string, perfil: string, opts: { semCarregando?: boolean; paginaInteira?: boolean } = {}) {
  if (opts.semCarregando !== false) {
    await expect(page.getByText(/^(Carregando|Gerando)/)).toHaveCount(0, { timeout: 30_000 });
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => Array.from(document.images).every(i => i.complete), null, { timeout: 30_000 });
  const quebradas = await page.evaluate(() => Array.from(document.images)
    .filter(i => { const r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0 && i.naturalWidth === 0; })
    .map(i => i.src));
  expect(quebradas, `imagens quebradas em ${slug}`).toEqual([]);
  await page.waitForTimeout(400); // transições e rolagem suave
  const arquivo = `RC-${String(n).padStart(2, '0')}-${slug}.png`;
  await page.screenshot({ path: path.join(PASTA, arquivo), fullPage: !!opts.paginaInteira });
  const vp = page.viewportSize()!;
  indice.push({ arquivo, tela: opts.paginaInteira ? `${tela} — página inteira` : tela, perfil, viewport: `${vp.width}×${vp.height}${vp.width < 600 ? ' (celular, escala 2x)' : ' (desktop)'}` });
}

async function entrar(page: Page, email: string, senha: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByPlaceholder('seu@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

const visiveis = (p: Page, nome: string | RegExp) => p.getByText(nome).filter({ visible: true });
/** Item do menu lateral/inferior; o nome pode vir com o contador ("Notificações 1"). */
const menu = (p: Page, nome: string) => p.locator('aside nav, div.lg\\:hidden').getByRole('button', { name: new RegExp(`^${nome}( \\d+\\+?)?$`) }).filter({ visible: true });

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  fs.rmSync(PASTA, { recursive: true, force: true });
  fs.mkdirSync(PASTA, { recursive: true });
  // Dados de demonstração no banco descartável do e2e.
  const saida = execFileSync(PY, ['manage.py', 'seed_demo', '--remover-outros'], {
    cwd: BACKEND, env: { ...process.env, ...envBackend, PYTHONIOENCODING: 'utf-8' }, encoding: 'utf-8',
  });
  console.log(saida.split('\n').filter(l => /Demonstração pronta|Removidos/.test(l)).join('\n'));
});

test.afterAll(() => {
  const linhas = [
    '# Evidências da Release Candidate — interface final',
    '',
    `Gerado por \`e2e/tour-rc.spec.ts\` (\`npm run e2e:tour\`) em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}, `
      + 'com os dados de demonstração de `manage.py seed_demo` (banco descartável do e2e).',
    '',
    '| Arquivo | Tela | Perfil de acesso | Viewport |',
    '|---|---|---|---|',
    ...indice.map(l => `| ${l.arquivo} | ${l.tela} | ${l.perfil} | ${l.viewport} |`),
    '',
  ];
  fs.writeFileSync(path.join(PASTA, 'INDICE.md'), linhas.join('\n'), 'utf-8');
  // Pacote: evidencias-rc/ (prints + INDICE.md) e, se existir, execucoes-rc/ (saídas das verificações).
  fs.rmSync(ZIP, { force: true });
  const pastas = [PASTA, ...(fs.existsSync(EXECUCOES) ? [EXECUCOES] : [])];
  if (process.platform === 'win32') {
    execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path ${pastas.map(p => `'${p}'`).join(',')} -DestinationPath '${ZIP}' -Force`]);
  } else {
    for (const p of pastas) execFileSync('zip', ['-r', '-q', ZIP, path.basename(p)], { cwd: path.dirname(p) });
  }
});

test('tour da Release Candidate (desktop 1366×768 e celular 375×812)', async ({ browser }) => {
  // ── Visitante e cadastro (desktop) ───────────────────────────────────────────
  const v = await sessao(browser);
  await test.step('início, login e cadastro', async () => {
    await v.page.goto('/');
    await expect(v.page.getByRole('heading', { name: 'Boas-vindas!' })).toBeVisible();
    await print(v.page, 1, 'inicio', 'Tela inicial', 'Visitante');

    await v.page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await v.page.getByPlaceholder('seu@email.com').fill(ANA.email);
    await v.page.getByPlaceholder('••••••••').fill(SENHA_SEED);
    await print(v.page, 2, 'login', 'Login (dados preenchidos)', 'Visitante');

    await v.page.getByRole('button', { name: 'Voltar' }).click();
    await v.page.getByRole('button', { name: 'Criar conta' }).click();
    await v.page.getByPlaceholder('Seu nome', { exact: true }).fill(CAROLINA.nome);
    await v.page.getByPlaceholder('seu@email.com').fill(CAROLINA.email);
    await v.page.getByPlaceholder('Mínimo 8 caracteres').fill(CAROLINA.senha);
    await v.page.getByPlaceholder('Repita a senha').fill(CAROLINA.senha);
    await v.page.getByRole('button', { name: /Tenho um lugar disponível/ }).click();
    await print(v.page, 3, 'cadastro', 'Cadastro (tipo: tenho um lugar)', 'Visitante');
    await v.page.getByRole('button', { name: 'Continuar' }).click();
    await expect(v.page.getByText(/^Etapa 1 de 5/)).toBeVisible({ timeout: 60_000 });
  });

  await test.step('criação de perfil (5 etapas, com anúncio)', async () => {
    const p = v.page;
    const proxima = () => p.getByRole('button', { name: 'Próxima etapa' }).click();
    const grupo = (t: string) => p.getByText(t, { exact: true }).locator('xpath=..');
    await p.getByPlaceholder('Seu nome completo').fill(CAROLINA.nome);
    await p.getByPlaceholder('Sua idade').fill(CAROLINA.idade);
    await p.getByPlaceholder('Ex: Boa Viagem, Recife').fill(CAROLINA.regiao);
    await p.getByPlaceholder(/Conte um pouco sobre você/).fill(CAROLINA.bio);
    await p.getByRole('textbox', { name: /^Link da sua foto/ }).fill(CAROLINA.fotoPerfil);
    await expect(p.getByAltText('Pré-visualização da sua foto')).toBeVisible();
    await print(p, 4, 'perfil-etapa1-sobre-voce', 'Criação de perfil — etapa 1 (sobre você)', 'Oferece vaga (nova conta)');
    await proxima();
    await p.getByPlaceholder('700').fill('900');
    await p.getByPlaceholder('1500').fill('1500');
    await p.getByRole('button', { name: 'Apartamento', exact: true }).click();
    await p.getByRole('button', { name: '2', exact: true }).click();
    await print(p, 5, 'perfil-etapa2-moradia', 'Criação de perfil — etapa 2 (moradia)', 'Oferece vaga (nova conta)');
    await proxima();
    await grupo('Você fuma?').getByRole('button', { name: 'Não', exact: true }).click();
    await grupo('Aceita pets?').getByRole('button', { name: 'Sim', exact: true }).click();
    await p.getByRole('button', { name: 'Às vezes', exact: true }).click();
    await p.getByRole('button', { name: /Madrugador/ }).click();
    await print(p, 6, 'perfil-etapa3-convivencia', 'Criação de perfil — etapa 3 (convivência)', 'Oferece vaga (nova conta)');
    await proxima();
    for (const [rotulo, nota] of [['Organização', 5], ['Tolerância à bagunça', 2], ['Tolerância a barulho', 2], ['Perfil social', 3]] as const) {
      await p.getByRole('button', { name: `${rotulo}: ${nota} de 5` }).click();
    }
    await print(p, 7, 'perfil-etapa4-habitos', 'Criação de perfil — etapa 4 (hábitos)', 'Oferece vaga (nova conta)');
    await proxima();
    await p.getByPlaceholder('Ex: Quarto amplo próximo ao metrô').fill(CAROLINA.titulo);
    await p.getByPlaceholder(/Descreva o imóvel/).fill(CAROLINA.descricao);
    for (let i = 0; i < CAROLINA.fotos.length; i++) {
      await p.getByRole('button', { name: '+ Adicionar foto' }).click();
      await p.getByPlaceholder('https://...').nth(i).fill(CAROLINA.fotos[i]);
    }
    await print(p, 8, 'perfil-etapa5-anuncio', 'Criação de perfil — etapa 5 (anúncio do imóvel, com fotos)', 'Oferece vaga (nova conta)', { paginaInteira: true });
    await p.getByRole('button', { name: 'Concluir perfil' }).click();
    await expect(p.getByRole('heading', { name: 'Interessados na sua vaga' })).toBeVisible({ timeout: 60_000 });
    await expect(visiveis(p, 'Mariana Oliveira, 22').first()).toBeVisible();
    await print(p, 10, 'descoberta-quem-oferece-vaga', 'Descoberta de quem oferece vaga (perfis interessados)', 'Oferece vaga');
  });
  await v.context.close();

  // ── Quem procura vaga (Ana) ──────────────────────────────────────────────────
  const a = await sessao(browser);
  const pa = a.page;
  await test.step('descoberta, filtros, detalhe e interesse mútuo', async () => {
    await entrar(pa, ANA.email, SENHA_SEED);
    await expect(pa.getByRole('heading', { name: 'Vagas para você' })).toBeVisible({ timeout: 60_000 });
    await expect(visiveis(pa, 'Quarto em casa com cozinha gourmet em Casa Forte')).toBeVisible();
    await print(pa, 9, 'descoberta-quem-procura-vaga', 'Descoberta de quem procura vaga (anúncios)', 'Procura vaga');

    await pa.getByRole('button', { name: 'Abrir filtros de busca' }).click();
    const dlg = pa.getByRole('dialog', { name: 'Filtros de busca' });
    await dlg.getByRole('button', { name: 'Casa', exact: true }).click();
    await dlg.getByText('Aceita pets', { exact: true }).locator('xpath=..').getByRole('button', { name: 'Sim', exact: true }).click();
    await print(pa, 11, 'filtros', 'Filtros da Descoberta (modal)', 'Procura vaga');
    await dlg.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(pa.getByRole('button', { name: 'Remover filtro Casa', exact: true })).toBeVisible();
    await print(pa, 12, 'filtros-aplicados', 'Descoberta com filtros aplicados (chips)', 'Procura vaga');

    await visiveis(pa, 'Quarto em casa com cozinha gourmet em Casa Forte').click();
    await expect(pa.getByRole('heading', { name: 'Quarto em casa com cozinha gourmet em Casa Forte' })).toBeVisible();
    await print(pa, 13, 'detalhe-do-anuncio', 'Detalhe do anúncio', 'Procura vaga');

    await pa.getByRole('button', { name: /Tenho interesse/ }).click();
    await expect(pa.getByText('Interesse mútuo confirmado')).toBeVisible({ timeout: 30_000 });
    await print(pa, 14, 'interesse-mutuo', 'Interesse mútuo confirmado (match)', 'Procura vaga');
  });

  await test.step('matches, chat e notificações', async () => {
    await pa.getByRole('button', { name: 'Ver meus matches' }).click();
    await expect(pa.getByRole('heading', { name: 'Seus Matches' })).toBeVisible();
    await expect(visiveis(pa, 'João Vitor').first()).toBeVisible();
    await print(pa, 15, 'matches', 'Matches (conversas)', 'Procura vaga');

    await visiveis(pa, 'João Vitor').first().click();
    await expect(pa.getByText(/Que tal quinta de manhã/)).toBeVisible();
    await print(pa, 16, 'chat', 'Chat com conversa', 'Procura vaga');

    await menu(pa, 'Notificações').click();
    await expect(pa.getByRole('heading', { name: 'Notificações' })).toBeVisible();
    await expect(visiveis(pa, /Novo match com/).first()).toBeVisible();
    await print(pa, 17, 'notificacoes', 'Notificações', 'Procura vaga');
  });

  await test.step('meu perfil, edição, exclusão e denúncia', async () => {
    await menu(pa, 'Perfil').click();
    await expect(pa.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible();
    await print(pa, 18, 'meu-perfil', 'Meu Perfil', 'Procura vaga');

    await pa.getByRole('button', { name: 'Editar' }).click();
    await expect(pa.getByPlaceholder('Seu nome completo')).toHaveValue(ANA.nome);
    await print(pa, 19, 'edicao-do-perfil', 'Edição do perfil', 'Procura vaga');
    await pa.getByRole('button', { name: 'Cancelar' }).click();

    await pa.getByRole('button', { name: 'Excluir perfil' }).click();
    await expect(pa.getByRole('dialog', { name: 'Excluir perfil' })).toBeVisible();
    await print(pa, 20, 'modal-de-exclusao', 'Modal de exclusão do perfil', 'Procura vaga');
    await pa.getByRole('dialog', { name: 'Excluir perfil' }).getByRole('button', { name: 'Cancelar' }).click();

    await menu(pa, 'Descoberta').click();
    await visiveis(pa, /Vaga em casa compartilhada em Boa Viagem/).click();
    await pa.getByRole('button', { name: 'Denunciar este anúncio' }).click();
    const modal = pa.getByRole('dialog', { name: 'Denunciar usuário' });
    await modal.getByRole('button', { name: 'Conteúdo ofensivo', exact: true }).click();
    await modal.getByPlaceholder('Descreva o ocorrido com mais detalhes...').fill('O anunciante respondeu de forma agressiva quando perguntei sobre as regras da casa.');
    await print(pa, 21, 'modal-de-denuncia', 'Modal de denúncia', 'Procura vaga');
    await modal.getByRole('button', { name: 'Cancelar' }).click();
  });
  await a.context.close();

  // ── Painel admin ─────────────────────────────────────────────────────────────
  const ad = await sessao(browser);
  const pad = ad.page;
  await test.step('painel admin', async () => {
    await entrar(pad, ADMIN.email, ADMIN.senha);
    await expect(pad.getByRole('heading', { name: 'Painel Admin' })).toBeVisible({ timeout: 60_000 });
    await expect(pad.getByRole('img', { name: /Atividade diária/ })).toBeVisible();
    await print(pad, 22, 'admin-painel', 'Painel admin — indicadores e gráficos', 'Administrador', { paginaInteira: true });

    const aba = (nome: string) => pad.getByRole('button', { name: new RegExp(`^${nome}( \\d+)?$`) });
    await aba('Relatórios').click();
    await pad.getByRole('radio', { name: /^Matches/ }).check();
    await pad.getByRole('button', { name: 'Gerar relatório' }).click();
    await expect(pad.locator('table')).toBeVisible();
    await print(pad, 23, 'admin-relatorio-gerado', 'Relatórios — relatório de matches gerado', 'Administrador', { paginaInteira: true });

    await aba('Logs').click();
    await pad.getByLabel('Ação').selectOption('MATCH_CRIADO');
    await pad.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(pad.locator('tbody tr').first()).toContainText('Match criado');
    await pad.locator('tbody tr').first().click();
    await expect(pad.getByText('Compatibilidade', { exact: true })).toBeVisible();
    await print(pad, 24, 'admin-logs', 'Logs (filtro por ação, linha expandida)', 'Administrador');

    await aba('Usuários').click();
    await expect(pad.locator('tbody tr').first()).toBeVisible();
    await print(pad, 25, 'admin-usuarios', 'Usuários (com conta suspensa)', 'Administrador', { paginaInteira: true });

    await aba('Moderação').click();
    await expect(pad.locator('tbody tr', { hasText: 'marcos@seed.pm' })).toBeVisible();
    await print(pad, 26, 'admin-moderacao', 'Moderação — denúncias pendentes', 'Administrador');

    await pad.locator('tbody tr', { hasText: 'marcos@seed.pm' }).getByRole('button', { name: 'Analisar' }).click();
    const dlg = pad.getByRole('dialog', { name: 'Analisar denúncia' });
    await dlg.getByRole('button', { name: 'Procedente', exact: true }).click();
    await dlg.getByPlaceholder('Observação interna sobre a decisão...').fill('Mensagens desrespeitosas confirmadas pelo histórico da conversa.');
    await print(pad, 27, 'admin-analise-de-denuncia', 'Moderação — análise de denúncia', 'Administrador');
    await dlg.getByRole('button', { name: 'Cancelar' }).click();
  });
  await ad.context.close();

  // ── Conta suspensa ───────────────────────────────────────────────────────────
  const s = await sessao(browser);
  await test.step('login de conta suspensa', async () => {
    await entrar(s.page, SUSPENSO, SENHA_SEED);
    await expect(s.page.getByText('Conta suspensa. Procure o suporte.')).toBeVisible({ timeout: 60_000 });
    await print(s.page, 28, 'login-conta-suspensa', 'Login de conta suspensa', 'Usuário suspenso');
  });

  // ── Documentação da API (Swagger) ────────────────────────────────────────────
  await test.step('documentação da API (/api/docs/)', async () => {
    const p = s.page;
    await p.goto(`${URL_API}/api/docs/`);
    await expect(p.locator('.opblock-tag').first()).toBeVisible({ timeout: 60_000 });
    await expect(p.locator('.opblock').first()).toBeVisible();
    // Recolhe os grupos para a tela mostrar todos de uma vez.
    await p.evaluate(() => document.querySelectorAll<HTMLElement>('.opblock-tag[data-is-open="true"]').forEach(g => g.click()));
    // A seção "Schemas" também é recolhida: o print mostra os grupos de endpoints, não os modelos.
    await p.evaluate(() => document.querySelectorAll<HTMLElement>('.models.is-open .models-control').forEach(g => g.click()));
    await expect(p.locator('.opblock')).toHaveCount(0);
    await print(p, 29, 'swagger-grupos', 'Documentação da API (Swagger) — grupos de endpoints', 'Público', { semCarregando: false, paginaInteira: true });
    await p.locator('.opblock-tag[data-tag="Descoberta e Matches"]').click();
    const op = p.locator('.opblock-get', { has: p.locator('[data-path="/api/descoberta/"]') }).first();
    await op.locator('.opblock-summary').click();
    await expect(op.locator('.parameters').first()).toBeVisible();
    await expect(op.locator('.responses-wrapper')).toBeVisible();
    await print(p, 30, 'swagger-endpoint-aberto', 'Swagger — GET /api/descoberta/ aberto (parâmetros e exemplo)', 'Público', { semCarregando: false, paginaInteira: true });
  });
  await s.context.close();

  // ── Celular 375×812 ──────────────────────────────────────────────────────────
  const m = await sessao(browser, MOBILE);
  const pm = m.page;
  await test.step('celular', async () => {
    await pm.goto('/');
    await expect(pm.getByRole('button', { name: 'Criar conta' })).toBeVisible();
    await print(pm, 31, 'mobile-inicio', 'Tela inicial', 'Visitante');

    await entrar(pm, ANA.email, SENHA_SEED);
    await expect(pm.getByRole('heading', { name: 'Vagas para você' })).toBeVisible({ timeout: 60_000 });
    await expect(pm.getByRole('button', { name: 'Curtir perfil' }).filter({ visible: true })).toBeVisible();
    await print(pm, 32, 'mobile-descoberta', 'Descoberta', 'Procura vaga');

    await pm.getByRole('button', { name: 'Ver detalhes' }).click();
    await expect(pm.getByRole('button', { name: /Tenho interesse/ })).toBeVisible();
    await print(pm, 33, 'mobile-detalhe', 'Detalhe do anúncio', 'Procura vaga');
    await pm.getByRole('button', { name: 'Voltar' }).click();

    await menu(pm, 'Matches').click();
    await expect(pm.getByRole('heading', { name: 'Seus Matches' })).toBeVisible();
    await expect(visiveis(pm, 'João Vitor').first()).toBeVisible();
    await print(pm, 34, 'mobile-matches', 'Matches', 'Procura vaga');

    await visiveis(pm, 'João Vitor').first().click();
    await expect(pm.getByText(/Que tal quinta de manhã/)).toBeVisible();
    await print(pm, 35, 'mobile-chat', 'Chat', 'Procura vaga');
    await pm.getByRole('button', { name: 'Voltar' }).click();

    await menu(pm, 'Perfil').click();
    await expect(pm.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible();
    await print(pm, 36, 'mobile-meu-perfil', 'Meu Perfil', 'Procura vaga');

    await menu(pm, 'Notificações').click();
    await expect(pm.getByRole('heading', { name: 'Notificações' })).toBeVisible();
    await print(pm, 37, 'mobile-menu', 'Menu inferior (aba Notificações ativa)', 'Procura vaga');
  });
  await m.context.close();
});
