import { expect, irParaInicio, print, test } from './apoio';

test.describe('N01 Visitante', () => {
  test('tela inicial → Entrar → voltar → Criar conta', async ({ page }) => {
    // As fontes são locais (@fontsource): nenhuma requisição deve ir ao Google Fonts.
    const fontesExternas: string[] = [];
    page.on('request', r => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) fontesExternas.push(r.url()); });

    await test.step('1. tela inicial', async () => {
      await irParaInicio(page);
      await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
      await print(page, 'N01', 1, 'tela-inicial');
    });

    await test.step('2. Entrar abre a tela de login', async () => {
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Boas-vindas de volta!' })).toBeVisible();
      await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Esqueci minha senha' }), 'a v1.0.0-rc2 trouxe de volta o link (agora com fluxo de recuperação)').toBeVisible();
      await print(page, 'N01', 2, 'login');
    });

    await test.step('3. Voltar leva à tela inicial', async () => {
      await page.getByRole('button', { name: 'Voltar' }).click();
      await expect(page.getByRole('heading', { name: 'Boas-vindas!' })).toBeVisible();
      await print(page, 'N01', 3, 'voltou-inicio');
    });

    await test.step('4. Criar conta abre o cadastro', async () => {
      await page.getByRole('button', { name: 'Criar conta' }).click();
      await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
      await expect(page.getByPlaceholder('Mínimo 8 caracteres')).toBeVisible();
      await print(page, 'N01', 4, 'cadastro');
    });

    await test.step('5. do cadastro dá para ir ao login e voltar', async () => {
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Boas-vindas de volta!' })).toBeVisible();
      await page.getByRole('button', { name: 'Criar conta' }).click();
      await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
    });

    await test.step('5b. Enter no campo de senha envia o login (teclado) — AUD-F05', async () => {
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByPlaceholder('seu@email.com').fill('nao-existe@teste.com');
      await page.getByPlaceholder('••••••••').fill('SenhaErrada123');
      await page.getByPlaceholder('••••••••').press('Enter');
      await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Criar conta' }).click();
      await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
    });

    await test.step('5c. limite de tentativas (429): a tela de login mostra a mensagem da API (AUD-09)', async () => {
      await page.route('**/api/auth/login/', route => route.fulfill({
        status: 429, contentType: 'application/json', headers: { 'Retry-After': '60' },
        body: JSON.stringify({ detail: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }),
      }));
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByPlaceholder('seu@email.com').fill('qualquer@teste.com');
      await page.getByPlaceholder('••••••••').fill('SenhaQualquer1');
      await page.getByPlaceholder('••••••••').press('Enter');
      await expect(page.getByText('Muitas tentativas. Aguarde alguns minutos e tente de novo.')).toBeVisible();
      await page.unroute('**/api/auth/login/');
      await page.getByRole('button', { name: 'Voltar' }).click();
      await page.getByRole('button', { name: 'Criar conta' }).click();
      await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
    });

    await test.step('6. fontes Outfit e Nunito carregadas localmente', async () => {
      const carregadas = await page.evaluate(async () => {
        await Promise.all([document.fonts.load('700 16px Outfit'), document.fonts.load('400 16px Nunito')]);
        const nomes = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/['"]/g, ''));
        return nomes.includes('Outfit') && nomes.includes('Nunito');
      });
      expect(carregadas, 'Outfit e Nunito devem carregar dos arquivos locais').toBe(true);
      expect(fontesExternas, 'não deve haver requisição ao Google Fonts').toEqual([]);
    });
  });

  // Cada tela interna, aberta sem login (parâmetro ?screen= da URL), deve levar ao login.
  const internas = ['discovery', 'notifications', 'matches', 'profile', 'profile-create', 'profile-detail', 'match', 'chat'];
  for (const [i, tela] of internas.entries()) {
    test(`tela interna "${tela}" sem login leva ao login`, async ({ page }) => {
      await page.goto(`/?screen=${tela}`);
      await expect(page.getByRole('heading', { name: 'Boas-vindas de volta!' }), `?screen=${tela} deveria cair no login`)
        .toBeVisible({ timeout: 8_000 });
      await print(page, 'N01', 10 + i, `sem-login-${tela}`);
    });
  }
});
