import { API, cadastrar, criarUsuarioPelaInterface, etapaAtual, expect, novoPerfil, preencherEtapa1, preencherEtapa2, preencherEtapa3, preencherEtapa4, print, proxima, test, tokens } from './apoio';

test('N02 Cadastro "Maria José da Silva" (buscando vaga) → perfil em etapas → Descoberta', async ({ page, browser }) => {
  const p = novoPerfil('n02', 'busca', { nome: 'Maria José da Silva' });
  // Pré-condição: existe um anúncio (oferecendo vaga), para a Descoberta ter perfis e o título "Vagas para você".
  await criarUsuarioPelaInterface(browser, novoPerfil('n02-anuncio', 'oferece', { regiao: 'Recife' }));

  await test.step('1. cadastro com nome completo e acento chega à criação de perfil', async () => {
    await cadastrar(page, p);
    await expect(page.getByText('Etapa 1 de 4')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sobre você' })).toBeVisible();
    await print(page, 'N02', 1, 'cadastro-concluido-etapa1');
  });

  await test.step('2. o nome com acento e espaços foi guardado em /api/auth/me/', async () => {
    const { access } = await tokens(page);
    const res = await page.request.get(`${API}/api/auth/me/`, { headers: { Authorization: `Bearer ${access}` } });
    expect(res.status()).toBe(200);
    const me = await res.json();
    expect(me.username).toBe('Maria José da Silva');
    expect(me.nome).toBe('Maria José da Silva');
    expect(me.tipo).toBe('buscando_vaga');
  });

  await test.step('3. etapa 1 vazia mostra os erros e não avança', async () => {
    await proxima(page);
    await expect(page.getByText('Nome deve ter pelo menos 2 caracteres.')).toBeVisible();
    await expect(page.getByText('Idade deve estar entre 18 e 100 anos.')).toBeVisible();
    await expect(page.getByText('Região deve ter pelo menos 2 caracteres.')).toBeVisible();
    expect(await etapaAtual(page)).toBe(1);
    await print(page, 'N02', 2, 'etapa1-erros');
  });

  await test.step('4. limites com contador (link da foto 500, nome 150, região 200, bio 500)', async () => {
    await expect(page.getByText('0/150')).toBeVisible();
    await expect(page.getByText('0/200')).toBeVisible();
    // Dois contadores de 500: o link da foto (etapa 1 desde a RC) e a bio.
    await expect(page.getByText('0/500', { exact: true })).toHaveCount(2);
    await page.getByPlaceholder('Seu nome completo').fill('x'.repeat(200));
    await expect(page.getByPlaceholder('Seu nome completo')).toHaveValue('x'.repeat(150));
    await expect(page.getByText('150/150')).toBeVisible();
    const bio = page.getByPlaceholder(/Conte um pouco sobre você/);
    await bio.fill('b'.repeat(510));
    await expect(bio).toHaveValue('b'.repeat(500));
    await expect(page.getByText('500/500', { exact: true })).toHaveCount(1);
    await bio.fill('');
  });

  await test.step('5. etapa 1 preenchida avança para a etapa 2', async () => {
    await preencherEtapa1(page, p);
    await proxima(page);
    await expect(page.getByText('Etapa 2 de 4')).toBeVisible();
    await print(page, 'N02', 3, 'etapa2');
  });

  await test.step('6. etapa 2: vazia e mínimo > máximo mostram erros', async () => {
    await proxima(page);
    await expect(page.getByText('Informe um valor maior que zero.').first()).toBeVisible();
    await page.getByPlaceholder('700').fill('3000');
    await page.getByPlaceholder('1500').fill('1000');
    await proxima(page);
    await expect(page.getByText('O máximo deve ser maior ou igual ao mínimo.')).toBeVisible();
    expect(await etapaAtual(page)).toBe(2);
    await print(page, 'N02', 4, 'etapa2-erros');
  });

  await test.step('7. etapa 2 válida → etapa 3; etapa 3 vazia mostra os erros', async () => {
    await preencherEtapa2(page, p);
    await proxima(page);
    await expect(page.getByText('Etapa 3 de 4')).toBeVisible();
    await proxima(page);
    await expect(page.getByText('Responda se você fuma.')).toBeVisible();
    await expect(page.getByText('Responda sobre pets.')).toBeVisible();
    await expect(page.getByText('Selecione sua preferência.')).toBeVisible();
    await expect(page.getByText('Selecione seu perfil de horário.')).toBeVisible();
    await print(page, 'N02', 5, 'etapa3-erros');
  });

  await test.step('8. voltar não perde os dados já digitados', async () => {
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByText('Etapa 2 de 4')).toBeVisible();
    await expect(page.getByPlaceholder('700')).toHaveValue('800');
    await expect(page.getByPlaceholder('1500')).toHaveValue('1500');
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByText('Etapa 1 de 4')).toBeVisible();
    await expect(page.getByPlaceholder('Seu nome completo')).toHaveValue(p.nome);
    await expect(page.getByPlaceholder('Sua idade')).toHaveValue('28');
    await expect(page.getByPlaceholder('Ex: Boa Viagem, Recife')).toHaveValue('Recife');
    await print(page, 'N02', 6, 'voltou-dados-mantidos');
  });

  await test.step('9. avançar de novo e concluir etapas 3 e 4 (com erros da etapa 4)', async () => {
    await proxima(page);
    await proxima(page);
    await expect(page.getByText('Etapa 3 de 4')).toBeVisible();
    await preencherEtapa3(page, p);
    await proxima(page);
    await expect(page.getByText('Etapa 4 de 4')).toBeVisible();
    await page.getByRole('button', { name: 'Concluir perfil' }).click();
    await expect(page.getByText('Selecione sua tolerância à bagunça.')).toBeVisible();
    await expect(page.getByText('Selecione seu nível de organização.')).toBeVisible();
    await expect(page.getByText('Selecione sua tolerância a barulho.')).toBeVisible();
    await expect(page.getByText('Selecione seu nível social.')).toBeVisible();
    await print(page, 'N02', 7, 'etapa4-erros');
  });

  await test.step('10. concluir leva à Descoberta', async () => {
    await preencherEtapa4(page);
    await page.getByRole('button', { name: 'Concluir perfil' }).click();
    await expect(page.getByRole('heading', { name: 'Vagas para você' })).toBeVisible({ timeout: 20_000 });
    await print(page, 'N02', 8, 'descoberta');
  });
});
