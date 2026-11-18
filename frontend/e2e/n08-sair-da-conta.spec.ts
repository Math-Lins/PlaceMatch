import { API, cadastrarComPerfil, expect, menu, novoPerfil, print, sair, test, tokens } from './apoio';

test('N08 Sair da conta: volta ao início, voltar do navegador não reabre tela interna, segunda aba mantém a sessão', async ({ page }) => {
  const u1 = novoPerfil('n08a', 'busca');
  const u2 = novoPerfil('n08b', 'oferece');
  await cadastrarComPerfil(page, u1);
  await menu(page, 'Matches').click();
  await expect(page.getByRole('heading', { name: 'Seus Matches' })).toBeVisible();

  // Segunda aba do MESMO navegador (sessionStorage é por aba) com OUTRA conta.
  const aba2 = { context: page.context(), page: await page.context().newPage() };
  try {
    await cadastrarComPerfil(aba2.page, u2);

    await test.step('0. a pessoa deixa estado na aba: busca da Descoberta e marco das notificações (AUD-F02)', async () => {
      await menu(page, 'Descoberta').click();
      await page.getByPlaceholder('Buscar por nome, região...').fill('estado-da-pessoa-1');
      await menu(page, 'Notificações').click();
      await expect(page.getByRole('heading', { name: 'Notificações' })).toBeVisible();
      await expect.poll(() => page.evaluate(() => sessionStorage.getItem('pm_notif_last_visit'))).not.toBeNull();
      expect(await page.evaluate(() => sessionStorage.getItem('pm_disc_q'))).toBe('estado-da-pessoa-1');
    });

    await test.step('1. Sair da conta leva à tela inicial e apaga a sessão', async () => {
      const refreshAntigo = (await tokens(page)).refresh!;
      const logout = page.waitForResponse(r => r.url().includes('/api/auth/logout/'));
      await sair(page);
      expect((await logout).status(), 'o logout deve avisar a API (204)').toBe(204);
      const renovar = await page.request.post(`${API}/api/auth/login/refresh/`, { data: { refresh: refreshAntigo } });
      expect(renovar.status(), 'o refresh usado no logout não pode mais renovar (AUD-15)').toBe(401);
      await expect(page.getByRole('heading', { name: 'Boas-vindas!' })).toBeVisible();
      const t = await tokens(page);
      expect(t.access).toBeNull();
      expect(t.refresh).toBeNull();
      const resto = await page.evaluate(() => ['pm_disc_q', 'pm_disc_filters', 'pm_notif_last_visit'].map(k => sessionStorage.getItem(k)));
      expect(resto, 'busca, filtros e marco de notificações da pessoa anterior não podem sobrar').toEqual([null, null, null]);
      await print(page, 'N08', 1, 'saiu');
    });

    await test.step('2. botão voltar do navegador não reabre tela interna', async () => {
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Seus Matches' }), 'tela interna não pode reabrir sem sessão').toHaveCount(0);
      await expect(page.getByRole('navigation')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /^(Boas-vindas!|Boas-vindas de volta!)$/ })).toBeVisible({ timeout: 5_000 });
      await print(page, 'N08', 2, 'voltar-apos-sair');
    });

    await test.step('3. recarregar depois de sair continua deslogado', async () => {
      await page.reload();
      await expect(page.getByRole('heading', { name: /^(Boas-vindas!|Boas-vindas de volta!)$/ })).toBeVisible({ timeout: 10_000 });
    });

    await test.step('4. a segunda aba continua com a própria sessão', async () => {
      await expect(aba2.page.getByRole('heading', { name: /^(Descoberta|Interessados na sua vaga)$/ })).toBeVisible();
      await menu(aba2.page, 'Perfil').click();
      await expect(aba2.page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible();
      const t2 = await tokens(aba2.page);
      expect(t2.access).toBeTruthy();
      await print(aba2.page, 'N08', 3, 'segunda-aba-segue-logada');
    });
  } finally {
    await aba2.page.close();
  }
});
