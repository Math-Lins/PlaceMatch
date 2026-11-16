import { ADMIN, abrirSessao, cadastrarComPerfil, entrar, expect, novoPerfil, print, test } from './apoio';

// Cada passo escreve seu nome no log: se o roteiro travar, o último "PASSO >" aponta o ponto exato.
const passo = (nome: string, fn: () => Promise<void>) =>
  test.step(nome, async () => {
    console.log('N10 PASSO >', nome);
    await fn();
  });

test('N10 Painel admin: abas, período invertido, relatório, CSV, paginação e linha de log', async ({ browser }) => {
  // Gera atividade (cadastros/logins) para haver logs e usuários a listar.
  const gerador = await abrirSessao(browser);
  await cadastrarComPerfil(gerador.page, novoPerfil('n10', 'busca'));
  await gerador.context.close();

  const { context, page } = await abrirSessao(browser);
  try {
    await entrar(page, ADMIN.email, ADMIN.senha);
    await expect(page.getByRole('heading', { name: 'Painel Admin' })).toBeVisible({ timeout: 60_000 });
    // a aba Moderação mostra a contagem de pendentes no nome (ex.: "Moderação 1")
    const aba = (nome: string) => page.getByRole('button', { name: new RegExp(`^${nome}( \\d+)?$`) });

    await passo('1. aba Painel mostra os indicadores', async () => {
      await aba('Painel').click();
      await expect(page.getByText('Carregando')).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByText(/Usuários|Matches|Curtidas/).first()).toBeVisible();
      await print(page, 'N10', 1, 'aba-painel');
    });

    await passo('2. Painel: período invertido mostra erro e não chama a API', async () => {
      const chamadas: string[] = [];
      page.on('request', r => { if (r.url().includes('/api/admin/dashboard/')) chamadas.push(r.url()); });
      await page.locator('input[type="date"]').first().fill('2025-12-31');
      await page.locator('input[type="date"]').nth(1).fill('2025-01-01');
      await expect(page.getByText('A data inicial não pode ser maior que a data final.')).toBeVisible();
      await page.getByRole('button', { name: 'Aplicar' }).click();
      await page.waitForTimeout(500);
      expect(chamadas, 'não deveria chamar o dashboard com período invertido').toHaveLength(0);
      await print(page, 'N10', 2, 'painel-periodo-invertido');
      await page.getByRole('button', { name: 'Limpar' }).click();
    });

    await passo('3. aba Relatórios: período invertido mostra erro; gerar relatório e exportar CSV', async () => {
      await aba('Relatórios').click();
      const radios = page.getByRole('radio');
      await expect(radios.first()).toBeVisible({ timeout: 15_000 });
      await radios.first().check();
      await page.locator('input[type="date"]').first().fill('2025-12-31');
      await page.locator('input[type="date"]').nth(1).fill('2025-01-01');
      await expect(page.getByText('A data inicial não pode ser maior que a data final.')).toBeVisible();
      await print(page, 'N10', 3, 'relatorio-periodo-invertido');
      await page.locator('input[type="date"]').first().fill('');
      await page.locator('input[type="date"]').nth(1).fill('');
      await expect(page.getByText('A data inicial não pode ser maior que a data final.')).toBeHidden();
      await page.getByRole('button', { name: 'Gerar relatório' }).click();
      await expect(page.locator('table')).toBeVisible({ timeout: 30_000 });
      await print(page, 'N10', 4, 'relatorio-gerado');
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Exportar CSV' }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
      const fs = await import('node:fs');
      const caminho = await download.path();
      const conteudo = fs.readFileSync(caminho!, 'utf-8');
      expect(conteudo.length).toBeGreaterThan(10);
      expect(conteudo.split('\n')[0]).toContain(';');
    });

    await passo('4. aba Logs: período invertido, paginação e expandir linha', async () => {
      await aba('Logs').click();
      await expect(page.locator('table')).toBeVisible({ timeout: 30_000 });
      await page.locator('input[type="date"]').first().fill('2025-12-31');
      await page.locator('input[type="date"]').nth(1).fill('2025-01-01');
      await expect(page.getByText('A data inicial não pode ser maior que a data final.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeVisible();
      await print(page, 'N10', 5, 'logs-periodo-invertido');
      await page.locator('input[type="date"]').first().fill('');
      await page.locator('input[type="date"]').nth(1).fill('');
      await expect(page.getByText('A data inicial não pode ser maior que a data final.')).toBeHidden();

      const total = page.getByText(/^Página \d+ de \d+$/);
      await expect(total).toBeVisible({ timeout: 15_000 });
      const antes = (await total.textContent()) ?? '';
      const paginas = Number(antes.match(/de (\d+)/)?.[1] ?? 1);
      if (paginas > 1) {
        await page.getByRole('button', { name: /Próxima/ }).click();
        await expect(total).toContainText('Página 2 de');
        await page.getByRole('button', { name: /Anterior/ }).click();
        await expect(total).toContainText('Página 1 de');
      }

      const linha = page.locator('tbody tr').first();
      await linha.click();
      await expect(page.locator('tbody tr')).not.toHaveCount(1);
      await expect(page.getByText('▲').first()).toBeVisible();
      await print(page, 'N10', 6, 'logs-linha-expandida');
    });

    await passo('5. aba Usuários: lista, filtro de período invertido e CSV', async () => {
      await aba('Usuários').click();
      await expect(page.locator('table')).toBeVisible({ timeout: 30_000 });
      await page.locator('input[type="date"]').first().fill('2025-12-31');
      await page.locator('input[type="date"]').nth(1).fill('2025-01-01');
      await expect(page.getByText('A data inicial não pode ser maior que a data final.')).toBeVisible();
      await print(page, 'N10', 7, 'usuarios-periodo-invertido');
      await page.locator('input[type="date"]').first().fill('');
      await page.locator('input[type="date"]').nth(1).fill('');
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Exportar CSV' }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/usuarios.*\.csv$/);
    });

    await passo('6. aba Moderação: lista de denúncias e período invertido', async () => {
      await aba('Moderação').click();
      await expect(page.getByText(/Nenhuma denúncia encontrada\.|Analisar|Denunciante/).first()).toBeVisible({ timeout: 30_000 });
      await page.locator('input[type="date"]').first().fill('2025-12-31');
      await page.locator('input[type="date"]').nth(1).fill('2025-01-01');
      await expect(page.getByText('A data inicial não pode ser maior que a data final.')).toBeVisible();
      await print(page, 'N10', 8, 'moderacao-periodo-invertido');
    });
  } finally {
    await context.close();
  }
});
