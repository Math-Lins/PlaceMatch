import { ADMIN, abrirSessao, entrar, expect, menu, prepararMatch, print, sair, test } from './apoio';

test('N11 Moderação ponta a ponta: denúncia → análise com suspensão → "Conta suspensa" → reativação → entrada', async ({ browser }) => {
  const { A, B } = await prepararMatch(browser, 'n11');
  const admin = await abrirSessao(browser);
  try {
    await test.step('1. B manda uma mensagem e A a abre no chat', async () => {
      await B.page.getByRole('button', { name: 'Enviar mensagem' }).click();
      await B.page.getByPlaceholder('Digite uma mensagem...').fill('Mensagem inconveniente para a denúncia.');
      await B.page.getByRole('button', { name: 'Enviar mensagem' }).click();
      await expect(B.page.getByText('Mensagem inconveniente para a denúncia.')).toBeVisible();
      await menu(A.page, 'Matches').click();
      await A.page.getByRole('button').filter({ hasText: 'Mensagem inconveniente' }).first().click();
      await expect(A.page.getByText('Mensagem inconveniente para a denúncia.')).toBeVisible();
    });

    await test.step('2. A denuncia B pelo menu do chat', async () => {
      await A.page.getByRole('button', { name: 'Mais opções' }).click();
      await A.page.getByRole('button', { name: 'Denunciar', exact: true }).click();
      const modal = A.page.getByRole('dialog', { name: 'Denunciar usuário' });
      await expect(modal).toBeVisible();
      await modal.getByRole('button', { name: 'Spam', exact: true }).click();
      await modal.getByPlaceholder('Descreva o ocorrido com mais detalhes...').fill('Conteúdo de teste e2e.');
      await print(A.page, 'N11', 1, 'denuncia-modal');
      await modal.getByRole('button', { name: 'Enviar denúncia' }).click();
      await expect(A.page.getByText('Denúncia enviada!')).toBeVisible({ timeout: 20_000 });
      await print(A.page, 'N11', 2, 'denuncia-enviada');
    });

    await test.step('3. o administrador vê a denúncia em Moderação', async () => {
      await entrar(admin.page, ADMIN.email, ADMIN.senha);
      await expect(admin.page.getByRole('heading', { name: 'Painel Admin' })).toBeVisible({ timeout: 60_000 });
      await admin.page.getByRole('button', { name: /^Moderação( \d+)?$/ }).click();
      const linha = admin.page.locator('tbody tr', { hasText: B.perfil.email });
      await expect(linha.first()).toBeVisible({ timeout: 30_000 });
      await expect(linha.first()).toContainText('Spam');
      await print(admin.page, 'N11', 3, 'admin-ve-denuncia');
    });

    await test.step('4. o filtro de datas da Moderação filtra a lista (e não só a exportação)', async () => {
      const amanha = new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
      await admin.page.locator('input[type="date"]').first().fill(amanha);
      await admin.page.getByRole('button', { name: 'Buscar', exact: true }).click();
      await expect(admin.page.locator('tbody tr', { hasText: B.perfil.email }), 'denúncia de hoje não deveria aparecer com "De" = amanhã')
        .toHaveCount(0, { timeout: 10_000 });
      await print(admin.page, 'N11', 4, 'filtro-data-moderacao');
      await admin.page.locator('input[type="date"]').first().fill('');
      await admin.page.getByRole('button', { name: 'Buscar', exact: true }).click();
      await expect(admin.page.locator('tbody tr', { hasText: B.perfil.email }).first()).toBeVisible({ timeout: 15_000 });
    });

    await test.step('5. resolver como procedente com suspensão da conta', async () => {
      const linha = admin.page.locator('tbody tr', { hasText: B.perfil.email }).first();
      await linha.getByRole('button', { name: 'Analisar' }).click();
      const modal = admin.page.getByRole('dialog', { name: 'Analisar denúncia' });
      await expect(modal).toBeVisible();
      await modal.getByRole('button', { name: 'Procedente', exact: true }).click();
      await modal.getByText('Suspender a conta do denunciado').click();
      await print(admin.page, 'N11', 5, 'analisar-procedente-suspender');
      await modal.getByRole('button', { name: 'Confirmar' }).click();
      await expect(modal).toBeHidden({ timeout: 30_000 });
      await expect(admin.page.locator('tbody tr', { hasText: B.perfil.email })).toHaveCount(0, { timeout: 15_000 });
    });

    await test.step('6. o usuário suspenso tenta entrar e vê "Conta suspensa"', async () => {
      await sair(B.page);
      await B.page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await B.page.getByPlaceholder('seu@email.com').fill(B.perfil.email);
      await B.page.getByPlaceholder('••••••••').fill(B.perfil.senha);
      await B.page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(B.page.getByText('Conta suspensa. Procure o suporte.')).toBeVisible({ timeout: 60_000 });
      await print(B.page, 'N11', 6, 'conta-suspensa');
    });

    await test.step('7. o administrador reativa a conta em Usuários', async () => {
      await admin.page.getByRole('button', { name: /^Usuários$/ }).click();
      await admin.page.getByPlaceholder('Pesquisar...').fill(B.perfil.email);
      await admin.page.getByRole('button', { name: 'Buscar', exact: true }).click();
      const linha = admin.page.locator('tbody tr', { hasText: B.perfil.email });
      await expect(linha).toBeVisible({ timeout: 30_000 });
      await expect(linha).toContainText('Suspenso');
      await linha.getByRole('button', { name: 'Reativar' }).click();
      await expect(linha.getByRole('button', { name: 'Suspender' })).toBeVisible({ timeout: 20_000 });
      await print(admin.page, 'N11', 7, 'usuario-reativado');
    });

    await test.step('8. o usuário reativado entra normalmente', async () => {
      await B.page.getByPlaceholder('seu@email.com').fill(B.perfil.email);
      await B.page.getByPlaceholder('••••••••').fill(B.perfil.senha);
      await B.page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(B.page.getByRole('heading', { name: /^(Descoberta|Interessados na sua vaga)$/ })).toBeVisible({ timeout: 60_000 });
      await print(B.page, 'N11', 8, 'usuario-entrou');
    });
  } finally {
    await A.context.close();
    await B.context.close();
    await admin.context.close();
  }
});
