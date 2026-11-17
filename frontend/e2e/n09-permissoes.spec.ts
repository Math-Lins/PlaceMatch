import { ADMIN, API, abrirSessao, cadastrarComPerfil, entrar, expect, menu, novoPerfil, print, test, tokens } from './apoio';

test.describe('N09 Permissões na navegação', () => {
  test('usuário comum não vê nem alcança o painel admin', async ({ page }) => {
    const p = novoPerfil('n09', 'busca');
    await cadastrarComPerfil(page, p);

    await test.step('1. o menu do usuário comum não tem item de administração', async () => {
      await expect(page.getByRole('button', { name: /admin|painel/i })).toHaveCount(0);
      await expect(page.getByText('Painel Admin')).toHaveCount(0);
      await print(page, 'N09', 1, 'usuario-comum-sem-admin');
    });

    await test.step('2. abrir o painel pela URL (?screen=admin) não mostra o painel', async () => {
      await page.goto('/?screen=admin');
      await expect(page.getByText('Painel Admin'), 'o painel admin não pode aparecer para usuário comum').toHaveCount(0, { timeout: 10_000 });
      await expect(page.getByRole('button', { name: 'Logs' })).toHaveCount(0);
      // espera a restauração da sessão terminar: o usuário comum deve parar numa tela dele, nunca no painel
      await expect(page.getByText(/^Carregando/)).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByRole('heading', { name: /^(Descoberta|Vagas para você|Interessados na sua vaga)$/ })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Painel Admin')).toHaveCount(0);
      await print(page, 'N09', 2, 'url-admin-bloqueada');
    });

    await test.step('3. as rotas administrativas da API respondem 403 ao usuário comum', async () => {
      const { access } = await tokens(page);
      for (const rota of ['/api/admin/dashboard/', '/api/admin/usuarios/', '/api/admin/logs/', '/api/admin/moderacao/denuncias/']) {
        const r = await page.request.get(`${API}${rota}`, { headers: { Authorization: `Bearer ${access}` } });
        expect(r.status(), rota).toBe(403);
      }
    });
  });

  test('administrador entra direto no painel e não vê a Descoberta', async ({ browser }) => {
    const { context, page } = await abrirSessao(browser);
    try {
      await test.step('1. login do administrador abre o painel admin', async () => {
        await entrar(page, ADMIN.email, ADMIN.senha);
        await expect(page.getByRole('heading', { name: 'Painel Admin' })).toBeVisible({ timeout: 60_000 });
        for (const aba of ['Painel', 'Relatórios', 'Logs', 'Usuários', 'Moderação']) {
          await expect(page.getByRole('button', { name: new RegExp(`^${aba}( \\d+)?$`) })).toBeVisible();
        }
        await print(page, 'N09', 3, 'admin-no-painel');
      });

      await test.step('2. o administrador não vê o menu nem a Descoberta', async () => {
        await expect(menu(page, 'Descoberta')).toHaveCount(0);
        await expect(page.getByPlaceholder('Buscar por nome, região...')).toHaveCount(0);
      });

      await test.step('3. abrir a Descoberta pela URL não mostra a Descoberta ao administrador', async () => {
        await page.goto('/?screen=discovery');
        await expect(page.getByPlaceholder('Buscar por nome, região...'), 'administrador não participa da Descoberta')
          .toHaveCount(0, { timeout: 10_000 });
        await print(page, 'N09', 4, 'admin-url-descoberta');
      });
    } finally {
      await context.close();
    }
  });
});
