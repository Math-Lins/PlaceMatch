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
    await expect(page.getByRole('button', { name: 'Remover filtro Casa', exact: true })).toBeVisible();
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
    await expect(page.getByRole('button', { name: 'Remover filtro Casa', exact: true }), 'o chip do filtro deveria continuar após voltar do detalhe').toBeVisible();
    await expect(visiveis(page.getByText('Anuncio BoaViagem N05'))).toHaveCount(0);
    await expect(a2()).toBeVisible();
  });

  await test.step('6. remover o chip limpa o filtro', async () => {
    await page.getByRole('button', { name: 'Remover filtro Casa', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remover filtro Casa', exact: true })).toHaveCount(0);
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
    await expect(page.getByRole('button', { name: 'Remover filtro Aceita pets: Sim', exact: true })).toBeVisible();
    await expect(a1(), 'só o anúncio que aceita pets deveria restar').toBeVisible();
    await expect(visiveis(page.getByText('Anuncio CasaForte N05'))).toHaveCount(0);
    await print(page, 'N05', 6, 'filtro-pets-ordenar');
    await page.getByRole('button', { name: 'Remover filtro Aceita pets: Sim', exact: true }).click();
    await page.getByRole('button', { name: 'Remover filtro Menor preço', exact: true }).click();
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

  await test.step('9. busca rápida: a resposta antiga (lenta) não sobrescreve a busca mais recente (AUD-F04)', async () => {
    // A 1ª busca ("Casa Forte") responde só depois de 2,5 s; a 2ª ("Boa Viagem") responde na hora.
    await page.route('**/api/descoberta/**', async route => {
      if (route.request().url().includes('q=Casa')) await new Promise(r => setTimeout(r, 2500));
      await route.continue();
    });
    await busca.fill('Casa Forte');
    await page.waitForTimeout(700); // passa o debounce de 400 ms: a 1ª requisição sai e fica pendente
    await busca.fill('Boa Viagem');
    await expect(a1()).toBeVisible();
    await page.waitForTimeout(3500); // dá tempo para a resposta antiga chegar
    await expect(a1(), 'a lista deve continuar sendo a da busca mais recente').toBeVisible();
    await expect(visiveis(page.getByText('Anuncio CasaForte N05')), 'a resposta antiga sobrescreveu a lista').toHaveCount(0);
    await page.unroute('**/api/descoberta/**');
    await busca.fill('');
    await expect(a2()).toBeVisible();
  });

  await test.step('10. falha de rede ao curtir: o card fica, a tela avisa e dá para tentar de novo (AUD-F03)', async () => {
    await busca.fill('Casa Forte');
    await expect(a2()).toBeVisible();
    await expect(visiveis(page.getByRole('button', { name: 'Curtir perfil' }))).toHaveCount(1, { timeout: 20_000 });
    await page.route('**/api/curtidas/', route => route.abort());
    await visiveis(page.getByRole('button', { name: 'Curtir perfil' })).first().click();
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível concluir a operação.' })).toBeVisible();
    await expect(a2(), 'o card não pode sumir se a curtida não foi gravada').toBeVisible();
    await print(page, 'N05', 9, 'falha-ao-curtir');
    await page.unroute('**/api/curtidas/');
    await visiveis(page.getByRole('button', { name: 'Curtir perfil' })).first().click();
    await expect(visiveis(page.getByText('Anuncio CasaForte N05'))).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível concluir a operação.' })).toHaveCount(0);
  });
});
