import { cadastrarComPerfil, entrar, expect, menu, novoPerfil, print, sair, test, tokens } from './apoio';

test.describe('N12 Sessão', () => {
  test('access inválido/expirado: a próxima ação renova a sessão sem deslogar', async ({ page }) => {
    await cadastrarComPerfil(page, novoPerfil('n12a', 'busca'));
    const original = await tokens(page);
    expect(original.access).toBeTruthy();
    expect(original.refresh).toBeTruthy();

    await test.step('1. com o access inválido, a próxima ação (abrir Matches) renova e continua', async () => {
      await page.evaluate(() => sessionStorage.setItem('pm_access', 'token.invalido.simulado'));
      const renovacoes: number[] = [];
      page.on('response', r => { if (r.url().includes('/api/auth/login/refresh/')) renovacoes.push(r.status()); });
      await menu(page, 'Matches').click();
      await expect(page.getByRole('heading', { name: 'Seus Matches' })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('heading', { name: 'Boas-vindas de volta!' })).toHaveCount(0);
      // o título aparece antes da chamada terminar: espera a renovação e a lista carregar
      await expect.poll(async () => (await tokens(page)).access, { timeout: 20_000, message: 'o access deveria ter sido renovado' })
        .not.toBe('token.invalido.simulado');
      await expect(page.getByText('Você ainda não tem matches')).toBeVisible({ timeout: 20_000 });
      expect((await tokens(page)).access).toBeTruthy();
      expect(renovacoes, 'uma única renovação').toEqual([200]);
      await print(page, 'N12', 1, 'renovou-e-continuou');
    });

    await test.step('2. várias ações seguidas com access inválido usam UMA renovação', async () => {
      await page.evaluate(() => sessionStorage.setItem('pm_access', 'outro.token.invalido'));
      const renovacoes: number[] = [];
      page.on('response', r => { if (r.url().includes('/api/auth/login/refresh/')) renovacoes.push(r.status()); });
      await menu(page, 'Notificações').click();
      await expect(page.getByRole('heading', { name: 'Notificações' })).toBeVisible({ timeout: 20_000 });
      await menu(page, 'Descoberta').click();
      await expect(page.getByRole('heading', { name: /^(Descoberta|Vagas para você)$/ })).toBeVisible();
      await expect.poll(async () => (await tokens(page)).access, { timeout: 20_000 }).not.toBe('outro.token.invalido');
      expect(renovacoes.length).toBe(1);
    });
  });

  test('refresh inválido: vai ao login com "Sua sessão expirou. Entre novamente."', async ({ page }) => {
    await cadastrarComPerfil(page, novoPerfil('n12b', 'busca'));

    await test.step('1. access e refresh inválidos → login com a mensagem', async () => {
      await page.evaluate(() => {
        sessionStorage.setItem('pm_access', 'token.invalido.simulado');
        sessionStorage.setItem('pm_refresh', 'refresh.invalido.simulado');
      });
      await menu(page, 'Matches').click();
      await expect(page.getByRole('heading', { name: 'Boas-vindas de volta!' })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('Sua sessão expirou. Entre novamente.')).toBeVisible();
      const t = await tokens(page);
      expect(t.access).toBeNull();
      expect(t.refresh).toBeNull();
      await print(page, 'N12', 2, 'sessao-expirada');
    });

    await test.step('2. sem laço: depois do login a navegação segue normal', async () => {
      await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
    });
  });

  test('login com falha ao carregar a conta: avisa, não manda para "Criar perfil" e dá para tentar de novo (AUD-F07)', async ({ page }) => {
    const u = novoPerfil('n12c', 'busca');
    await cadastrarComPerfil(page, u);
    await sair(page);

    await page.route('**/api/auth/me/', route => route.abort());
    await entrar(page, u.email, u.senha);
    await expect(page.getByText('Não foi possível carregar sua conta. Verifique sua conexão e tente novamente.')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Boas-vindas de volta!' })).toBeVisible();
    await expect(page.getByText(/^Etapa \d de/), 'quem já tem perfil não pode cair na criação de perfil').toHaveCount(0);
    const t = await tokens(page);
    expect(t.access).toBeNull();
    await print(page, 'N12', 3, 'login-falha-ao-carregar-conta');

    await page.unroute('**/api/auth/me/');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: /^(Descoberta|Vagas para você)$/ })).toBeVisible({ timeout: 60_000 });
  });
});
