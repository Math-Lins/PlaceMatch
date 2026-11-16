import { cadastrarComPerfil, expect, menu, novoPerfil, print, test, tokens } from './apoio';

test('N04 Menu lateral, item ativo, botão voltar do navegador e recarregar mantém sessão e tela', async ({ page }) => {
  const p = novoPerfil('n04', 'busca');
  await cadastrarComPerfil(page, p);

  const telas: { item: 'Descoberta' | 'Notificações' | 'Matches' | 'Perfil'; titulo: string }[] = [
    { item: 'Descoberta', titulo: 'Descoberta' },
    { item: 'Notificações', titulo: 'Notificações' },
    { item: 'Matches', titulo: 'Seus Matches' },
    { item: 'Perfil', titulo: 'Meu Perfil' },
  ];

  await test.step('1. cada item do menu abre a sua tela e fica destacado', async () => {
    let n = 1;
    for (const t of telas) {
      await menu(page, t.item).click();
      await expect(page.getByRole('heading', { name: new RegExp(`^(${t.titulo}|Vagas para você)$`) })).toBeVisible();
      // item ativo: fundo preenchido; os demais: transparente
      await expect(menu(page, t.item)).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      for (const outro of telas.filter(x => x.item !== t.item)) {
        await expect(menu(page, outro.item)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      }
      await print(page, 'N04', n++, `menu-${t.item.toLowerCase()}`);
    }
  });

  await test.step('2. botão voltar do navegador volta para a tela anterior do app', async () => {
    await menu(page, 'Descoberta').click();
    await menu(page, 'Notificações').click();
    await menu(page, 'Matches').click();
    await expect(page.getByRole('heading', { name: 'Seus Matches' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Notificações' }), 'voltar do navegador deveria ir a Notificações').toBeVisible({ timeout: 5_000 });
    await print(page, 'N04', 5, 'voltar-notificacoes');
    await page.goBack();
    await expect(page.getByRole('heading', { name: /^(Descoberta|Vagas para você)$/ }), 'voltar do navegador deveria ir à Descoberta').toBeVisible({ timeout: 5_000 });
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Notificações' })).toBeVisible({ timeout: 5_000 });
  });

  await test.step('3. recarregar a página mantém a sessão e a tela', async () => {
    await menu(page, 'Matches').click();
    await expect(page.getByRole('heading', { name: 'Seus Matches' })).toBeVisible();
    const antes = await tokens(page);
    expect(antes.access).toBeTruthy();
    await page.reload();
    const depois = await tokens(page);
    expect(depois.access, 'a sessão (token) deve sobreviver ao recarregar').toBeTruthy();
    await expect(page.getByRole('heading', { name: 'Seus Matches' }), 'deveria continuar em Matches após recarregar').toBeVisible({ timeout: 15_000 });
    await print(page, 'N04', 6, 'recarregou-em-matches');
  });

  await test.step('4. recarregar em Meu Perfil mantém os dados do perfil', async () => {
    await menu(page, 'Perfil').click();
    await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: p.nome }), 'o perfil real deveria ser recarregado de /api/perfis/').toBeVisible({ timeout: 15_000 });
    await print(page, 'N04', 7, 'recarregou-em-perfil');
  });
});
