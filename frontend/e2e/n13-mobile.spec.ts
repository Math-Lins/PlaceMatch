import { cadastrar, criarUsuarioPelaInterface, expect, menu, novoPerfil, preencherEtapa1, preencherEtapa2, preencherEtapa3, preencherEtapa4, prepararMatch, print, proxima, semEstouroHorizontal, test } from './apoio';

const MOBILE = { width: 375, height: 812 };

async function semEstouro(page: import('@playwright/test').Page, onde: string) {
  const r = await semEstouroHorizontal(page);
  expect(r.ok, `${onde}: a página estoura a largura (scrollWidth ${r.scroll} > ${r.largura})`).toBe(true);
}

test('N13 Mobile (375 px): cadastro resumido, Descoberta, menu e chat sem estourar a largura', async ({ page, browser }) => {
  expect(page.viewportSize()?.width).toBe(375);
  const p = novoPerfil('n13', 'busca');
  await criarUsuarioPelaInterface(browser, novoPerfil('n13-anuncio', 'oferece'));

  await test.step('1. cadastro e perfil em etapas (resumido)', async () => {
    await page.goto('/');
    await semEstouro(page, 'tela inicial');
    await print(page, 'N13', 1, 'inicio-mobile');
    await cadastrar(page, p);
    await semEstouro(page, 'cadastro/etapa 1');
    await expect(page.getByPlaceholder('Seu nome completo')).toHaveValue(p.nome);
    await page.getByPlaceholder('Seu nome completo').fill('');
    await proxima(page);
    await expect(page.getByText('Nome deve ter pelo menos 2 caracteres.')).toBeVisible();
    await semEstouro(page, 'etapa 1 com erros');
    await print(page, 'N13', 2, 'etapa1-erros-mobile');
    await preencherEtapa1(page, p);
    await proxima(page);
    await preencherEtapa2(page, p);
    await semEstouro(page, 'etapa 2');
    await proxima(page);
    await preencherEtapa3(page, p);
    await semEstouro(page, 'etapa 3');
    await proxima(page);
    await preencherEtapa4(page);
    await semEstouro(page, 'etapa 4');
    await print(page, 'N13', 3, 'etapa4-mobile');
    await page.getByRole('button', { name: 'Concluir perfil' }).click();
    await expect(page.getByRole('heading', { name: /^(Descoberta|Vagas para você)$/ })).toBeVisible({ timeout: 60_000 });
  });

  await test.step('2. Descoberta e menu inferior', async () => {
    await semEstouro(page, 'Descoberta');
    await print(page, 'N13', 4, 'descoberta-mobile');
    for (const item of ['Notificações', 'Matches', 'Perfil', 'Descoberta'] as const) {
      await menu(page, item).click();
      await semEstouro(page, `menu ${item}`);
    }
    await menu(page, 'Perfil').click();
    await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible();
    await print(page, 'N13', 5, 'perfil-mobile');
    await page.getByRole('button', { name: 'Editar' }).click();
    await semEstouro(page, 'edição de perfil');
    await print(page, 'N13', 6, 'edicao-mobile');
    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  await test.step('3. filtros em tela cheia sem estourar', async () => {
    await menu(page, 'Descoberta').click();
    await page.getByRole('button', { name: 'Abrir filtros de busca' }).click();
    await expect(page.getByRole('dialog', { name: 'Filtros de busca' })).toBeVisible();
    await semEstouro(page, 'filtros');
    await print(page, 'N13', 7, 'filtros-mobile');
    await page.getByRole('button', { name: 'Fechar filtros' }).click();
  });

});

test('N13b Mobile: match e chat sem estourar a largura', async ({ browser }) => {
  const { A, B } = await prepararMatch(browser, 'n13m', MOBILE);
  try {
    await semEstouro(B.page, 'interesse mútuo');
    await print(B.page, 'N13', 8, 'interesse-mutuo-mobile');
    await B.page.getByRole('button', { name: 'Enviar mensagem' }).click();
    await B.page.getByPlaceholder('Digite uma mensagem...').fill('Mensagem longa '.repeat(20));
    await B.page.getByRole('button', { name: 'Enviar mensagem' }).click();
    await expect(B.page.getByText(/Mensagem longa/).first()).toBeVisible();
    await semEstouro(B.page, 'chat com mensagem longa');
    await print(B.page, 'N13', 9, 'chat-mobile');
    await menu(A.page, 'Matches').click();
    await expect(A.page.getByRole('button').filter({ hasText: 'Mensagem longa' }).first()).toBeVisible({ timeout: 20_000 });
    await semEstouro(A.page, 'lista de matches');
    await print(A.page, 'N13', 10, 'matches-mobile');
  } finally {
    await A.context.close();
    await B.context.close();
  }
});

test('N13c Mobile (375 px): recuperação de senha sem estourar a largura', async ({ page }) => {
  expect(page.viewportSize()?.width).toBe(375);
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await semEstouro(page, 'login com o link "Esqueci minha senha"');
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await expect(page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible();
  await semEstouro(page, 'esqueci minha senha');
  await print(page, 'N13', 11, 'esqueci-senha-mobile');
  await page.getByPlaceholder('seu@email.com').fill(`ninguem-${Date.now()}@teste.com`);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible({ timeout: 30_000 });
  await semEstouro(page, 'confirmação de envio');
  await page.goto('/?screen=redefinir-senha&uid=MQ&token=abc-123');
  await expect(page.getByRole('heading', { name: 'Nova senha' })).toBeVisible();
  await page.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(page.getByText('Informe uma senha.')).toBeVisible();
  await semEstouro(page, 'nova senha com erro');
  await print(page, 'N13', 12, 'nova-senha-mobile');
  await page.goto('/?screen=redefinir-senha');
  await expect(page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible();
  await semEstouro(page, 'link inválido');
});
