import { criarUsuarioPelaInterface, cadastrarComPerfil, expect, novoPerfil, print, test, visiveis } from './apoio';

test('N05 Descoberta: busca, filtros, chips, limpar, estado vazio e detalhe do anúncio', async ({ page, browser }) => {
  const o1 = novoPerfil('n05a', 'oferece', { regiao: 'Boa Viagem', imovel: 'Apartamento', pets: true, titulo: 'Anuncio BoaViagem N05' });
  const o2 = novoPerfil('n05b', 'oferece', { regiao: 'Casa Forte', imovel: 'Casa', pets: false, titulo: 'Anuncio CasaForte N05' });
  const b = novoPerfil('n05', 'busca');
  await criarUsuarioPelaInterface(browser, o1);
  await criarUsuarioPelaInterface(browser, o2);
  await cadastrarComPerfil(page, b);

  const a1 = () => visiveis(page.getByText('Anuncio BoaViagem N05')).first();
  const a2 = () => visiveis(page.getByText('Anuncio CasaForte N05')).first();
  const busca = page.getByPlaceholder('Buscar por nome, região...');

  await test.step('1. a Descoberta lista os dois anúncios', async () => {
    await expect(page.getByRole('heading', { name: 'Vagas para você' })).toBeVisible();
    await expect(a1()).toBeVisible();
    await expect(a2()).toBeVisible();
    await print(page, 'N05', 1, 'lista-completa');
  });

  await test.step('2. busca por texto filtra e limpar a busca restaura', async () => {
    await busca.fill('Casa Forte');
    await expect(a2()).toBeVisible();
    await expect(visiveis(page.getByText('Anuncio BoaViagem N05'))).toHaveCount(0);
    await print(page, 'N05', 2, 'busca-casa-forte');
    await busca.fill('');
    await expect(a1()).toBeVisible();
    await expect(a2()).toBeVisible();
  });

  await test.step('3. abrir e fechar o painel de filtros', async () => {
    await page.getByRole('button', { name: 'Abrir filtros de busca' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Filtros de busca' });
    await expect(dialogo).toBeVisible();
    await print(page, 'N05', 3, 'filtros-abertos');
    await page.getByRole('button', { name: 'Fechar filtros' }).click();
    await expect(dialogo).toBeHidden();
  });

  await test.step('4. aplicar filtro de tipo de imóvel mostra o chip e filtra a lista', async () => {
    await page.getByRole('button', { name: 'Abrir filtros de busca' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Filtros de busca' });
    await dialogo.getByRole('button', { name: 'Casa', exact: true }).click();
    await dialogo.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.locator('span', { hasText: /^Casa\s*✕$/ })).toBeVisible();
    await expect(a2()).toBeVisible();
    await expect(visiveis(page.getByText('Anuncio BoaViagem N05'))).toHaveCount(0);
    await print(page, 'N05', 4, 'filtro-casa-com-chip');
  });

  await test.step('5. abrir o detalhe do anúncio e voltar mantém os filtros', async () => {
    await a2().click();
    await expect(page.getByText('Anunciado por')).toBeVisible();
    await print(page, 'N05', 5, 'detalhe-do-anuncio');
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByRole('heading', { name: 'Vagas para você' })).toBeVisible();
    await expect(page.locator('span', { hasText: /^Casa\s*✕$/ }), 'o chip do filtro deveria continuar após voltar do detalhe').toBeVisible();
    await expect(visiveis(page.getByText('Anuncio BoaViagem N05'))).toHaveCount(0);
    await expect(a2()).toBeVisible();
  });

  await test.step('6. remover o chip limpa o filtro', async () => {
    await page.locator('span', { hasText: /^Casa\s*✕$/ }).getByRole('button').click();
    await expect(page.locator('span', { hasText: /^Casa\s*✕$/ })).toHaveCount(0);
    await expect(a1()).toBeVisible();
    await expect(a2()).toBeVisible();
  });

  await test.step('7. filtros de pets e ordenação funcionam (sem erro da API)', async () => {
    await page.getByRole('button', { name: 'Abrir filtros de busca' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Filtros de busca' });
    await dialogo.getByText('Aceita pets', { exact: true }).locator('xpath=..').getByRole('button', { name: 'Sim', exact: true }).click();
    await dialogo.getByRole('button', { name: 'Menor preço', exact: true }).click();
    await dialogo.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByText(/Valor inválido|inválido\. Use|Erro/)).toHaveCount(0);
    await expect(page.locator('span', { hasText: /^Pets: Sim\s*✕$/ })).toBeVisible();
    await expect(a1(), 'só o anúncio que aceita pets deveria restar').toBeVisible();
    await expect(visiveis(page.getByText('Anuncio CasaForte N05'))).toHaveCount(0);
    await print(page, 'N05', 6, 'filtro-pets-ordenar');
    await page.locator('span', { hasText: /^Pets: Sim\s*✕$/ }).getByRole('button').click();
    await page.locator('span', { hasText: /^Menor preço\s*✕$/ }).getByRole('button').click();
    await expect(a2()).toBeVisible();
  });

  await test.step('8. estado vazio com botão "Limpar filtros"', async () => {
    await busca.fill('zzzz-nao-existe');
    await expect(page.getByText('Nenhum perfil com esses filtros.')).toBeVisible();
    await print(page, 'N05', 7, 'estado-vazio');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.getByText('Nenhum perfil com esses filtros.')).toBeHidden();
    await expect(a1()).toBeVisible();
    await expect(busca).toHaveValue('');
    await print(page, 'N05', 8, 'limpou');
  });
});
