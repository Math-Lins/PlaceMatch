import { expect, irParaInicio, print, test } from './apoio';

test.describe('N01 Visitante', () => {
  test('tela inicial → Entrar → voltar → Criar conta', async ({ page }) => {
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
      await print(page, 'N01', 2, 'login');
    });

    await test.step('3. Voltar leva à tela inicial', async () => {
      await page.getByRole('button', { name: 'Voltar' }).click();
      await expect(page.getByRole('heading', { name: 'Bem-vindo!' })).toBeVisible();
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
