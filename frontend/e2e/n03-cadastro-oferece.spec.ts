import { FOTO_OK, cadastrar, criarUsuarioPelaInterface, criarPerfilCompleto, expect, menu, novoPerfil, preencherEtapa1, preencherEtapa2, preencherEtapa3, preencherEtapa4, print, proxima, test } from './apoio';

test('N03 Cadastro oferecendo vaga → etapas + anúncio com foto → Descoberta "Interessados na sua vaga"', async ({ page, browser }) => {
  const p = novoPerfil('n03', 'oferece', { regiao: 'Boa Viagem' });
  // Pré-condição: existe um interessado (buscando vaga), para a Descoberta mostrar "Interessados na sua vaga".
  await criarUsuarioPelaInterface(browser, novoPerfil('n03-interessado', 'busca', { regiao: 'Boa Viagem' }));

  await test.step('1. cadastro como oferecendo vaga: o perfil tem 5 etapas', async () => {
    await cadastrar(page, p);
    await expect(page.getByText('Etapa 1 de 5')).toBeVisible();
    await print(page, 'N03', 1, 'etapa1-de-5');
  });

  await test.step('2. etapas 1 a 4', async () => {
    await preencherEtapa1(page, p);
    await proxima(page);
    await preencherEtapa2(page, p);
    await proxima(page);
    await preencherEtapa3(page, p);
    await proxima(page);
    await preencherEtapa4(page);
    await proxima(page);
    await expect(page.getByText('Etapa 5 de 5')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Anúncio do imóvel' })).toBeVisible();
    await print(page, 'N03', 2, 'etapa5-anuncio');
  });

  await test.step('3. título e descrição com contador e limite', async () => {
    await page.getByPlaceholder('Ex: Quarto amplo próximo ao metrô').fill('Quarto amplo em Boa Viagem');
    await page.getByPlaceholder('Descreva o imóvel, a vaga e as regras da casa...').fill('Apartamento reformado, 2 quartos, varanda.');
    await expect(page.getByText('26/120')).toBeVisible();
    await expect(page.getByText(/^\d+\/1000$/)).toBeVisible();
    await page.getByPlaceholder('Ex: Quarto amplo próximo ao metrô').fill('t'.repeat(150));
    await expect(page.getByText('120/120')).toBeVisible();
    await page.getByPlaceholder('Ex: Quarto amplo próximo ao metrô').fill('Quarto amplo em Boa Viagem');
  });

  await test.step('4. foto do imóvel por URL: inválida mostra erro, válida mostra pré-visualização', async () => {
    await page.getByRole('button', { name: '+ Adicionar foto' }).click();
    const foto1 = page.getByPlaceholder('https://...').first();
    await foto1.fill('foto-invalida');
    await expect(page.getByText('Informe um link http:// ou https:// válido.')).toBeVisible();
    await foto1.fill(FOTO_OK);
    await expect(page.getByText('Informe um link http:// ou https:// válido.')).toBeHidden();
    const img = page.getByAltText('Pré-visualização da foto 1');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByText('1/5', { exact: true })).toBeVisible();
    await print(page, 'N03', 3, 'foto-com-previa');
  });

  await test.step('5. limite de 5 fotos: o botão de adicionar some', async () => {
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '+ Adicionar foto' }).click();
    await expect(page.getByText('5/5', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Adicionar foto' })).toHaveCount(0);
    for (let i = 5; i >= 2; i--) await page.getByRole('button', { name: `Remover foto ${i}` }).click();
    await expect(page.getByText('1/5', { exact: true })).toBeVisible();
  });

  await test.step('6. foto do proprietário também tem pré-visualização', async () => {
    await page.getByPlaceholder('https://...').last().fill(FOTO_OK);
    await expect(page.getByAltText('Pré-visualização da sua foto')).toBeVisible();
  });

  await test.step('7. concluir leva a "Interessados na sua vaga"', async () => {
    await page.getByRole('button', { name: 'Concluir perfil' }).click();
    await expect(page.getByRole('heading', { name: 'Interessados na sua vaga' })).toBeVisible({ timeout: 20_000 });
    await print(page, 'N03', 4, 'descoberta-interessados');
  });

  await test.step('8. Meu Perfil mostra o anúncio salvo', async () => {
    await menu(page, 'Perfil').click();
    await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Meu anúncio' })).toBeVisible();
    await expect(page.getByText('Quarto amplo em Boa Viagem')).toBeVisible();
    await expect(page.getByAltText('Foto 1 do imóvel')).toBeVisible();
    await print(page, 'N03', 5, 'meu-perfil-anuncio');
  });

  await test.step('9. recarregar a página (sessão restaurada) mantém o anúncio e a seção de edição do anúncio', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Meu anúncio' })).toBeVisible();
    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('heading', { name: 'Anúncio do imóvel' }), 'o tipo do usuário deve ser obtido de /api/auth/me/ ao restaurar a sessão').toBeVisible();
    await print(page, 'N03', 6, 'edicao-anuncio-apos-recarregar');
  });
});

// Garante que o helper de perfil completo (usado nos demais roteiros) também cobre a etapa 5.
test('N03b criarPerfilCompleto (helper) cobre as 5 etapas', async ({ page }) => {
  const p = novoPerfil('n03b', 'oferece', { titulo: 'Vaga helper' });
  await cadastrar(page, p);
  await criarPerfilCompleto(page, p);
  await expect(page.getByRole('heading', { name: 'Interessados na sua vaga' })).toBeVisible({ timeout: 20_000 });
});
