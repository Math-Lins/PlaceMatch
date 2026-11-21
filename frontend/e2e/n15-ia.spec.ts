import { ADMIN, abrirSessao, cadastrarComPerfil, entrar, expect, menu, novoPerfil, print, test, visiveis } from './apoio';

// Afinidade por IA e paralelismo visíveis na interface. O backend do e2e usa o MODELO REAL (backend/.modelos);
// as bios abaixo falam do mesmo interesse (culinária) com palavras diferentes, e a terceira é curta demais.
const BIO_COZINHA_A = 'Adoro cozinhar para os amigos, testar receitas novas e preparar jantares caprichados no fim de semana.';
const BIO_COZINHA_B = 'Faço jantares em casa quase todo sábado e curto gastronomia: sempre testo uma receita diferente na cozinha.';

const passo = (nome: string, fn: () => Promise<void>) =>
  test.step(nome, async () => {
    console.log('N15 PASSO >', nome);
    await fn();
  });

test('N15 ThoLuk: por que vocês combinam, selo, temas do perfil, aba ThoLuk (status, laboratório, paralelismo) e log', async ({ browser }) => {
  const oCozinha = novoPerfil('n15', 'oferece', { bio: BIO_COZINHA_B, titulo: `Quarto da cozinha N15 ${Date.now() % 100000}` });
  // Quem oferece vaga tem o anúncio somado à bio: título curto também, para ficar abaixo de 20 letras e dígitos.
  const oCurta = novoPerfil('n15c', 'oferece', { bio: 'Oi!', titulo: `Vaga ${Date.now() % 100000}` });
  const b = novoPerfil('n15', 'busca', { bio: BIO_COZINHA_A });
  for (const p of [oCozinha, oCurta]) {
    const s = await abrirSessao(browser);
    await cadastrarComPerfil(s.page, p);
    await s.context.close();
  }

  const { context, page } = await abrirSessao(browser);
  try {
    await cadastrarComPerfil(page, b);

    await passo('1. card da Descoberta com o selo de interesses em comum', async () => {
      await page.getByPlaceholder('Buscar por nome, região...').fill(oCozinha.titulo!);
      const card = visiveis(page.getByText(oCozinha.titulo!)).first();
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(visiveis(page.getByText('ThoLuk: interesses em comum — Culinária')).first()).toBeVisible();
      await print(page, 'N15', 1, 'card-com-selo-ia');
    });

    await passo('2. detalhe: "Por que vocês combinam" com as 7 barras e os temas em comum', async () => {
      await visiveis(page.getByText(oCozinha.titulo!)).first().click();
      const painel = page.getByTestId('painel-por-que-combinam');
      await expect(painel.getByRole('heading', { name: 'Por que vocês combinam' })).toBeVisible();
      const barras = painel.getByRole('list', { name: 'Compatibilidade por critério' }).getByRole('listitem');
      await expect(barras).toHaveCount(7, { timeout: 20_000 });
      for (const nome of ['Orçamento', 'Hábitos', 'Região', 'Rotina', 'Moradia', 'Idade', 'Afinidade de interesses (ThoLuk)']) {
        await expect(painel.getByText(nome, { exact: true })).toBeVisible();
      }
      await expect(painel.getByText(/O ThoLuk identificou interesses em comum/)).toBeVisible();
      await expect(painel.getByRole('list', { name: 'Interesses em comum' }).getByText('Culinária')).toBeVisible();
      await painel.scrollIntoViewIfNeeded();
      await print(page, 'N15', 2, 'por-que-voces-combinam');

      await painel.getByRole('button', { name: /Como o ThoLuk funciona/ }).click();
      const dialogo = page.getByRole('dialog', { name: 'Como o ThoLuk funciona' });
      await expect(dialogo.getByText(/O ThoLuk é a IA do PlaceMatch/)).toBeVisible();
      await expect(dialogo.getByText(/nenhum texto sai do sistema/)).toBeVisible();
      await print(page, 'N15', 3, 'como-a-ia-funciona');
      await page.keyboard.press('Escape');
      await expect(dialogo).toBeHidden();
      await page.getByRole('button', { name: 'Voltar' }).click();
    });

    await passo('3. perfil com bio curta: 6 barras e o aviso, sem o critério do ThoLuk', async () => {
      await page.getByPlaceholder('Buscar por nome, região...').fill(oCurta.titulo!);
      await visiveis(page.getByText(oCurta.titulo!)).first().click();
      const painel = page.getByTestId('painel-por-que-combinam');
      await expect(painel.getByRole('list', { name: 'Compatibilidade por critério' }).getByRole('listitem')).toHaveCount(6, { timeout: 20_000 });
      await expect(painel.getByText(/Biografia curta demais para o ThoLuk analisar/)).toBeVisible();
      await expect(painel.getByText('Afinidade de interesses (ThoLuk)', { exact: true })).toHaveCount(0);
      await print(page, 'N15', 4, 'bio-curta-sem-ia');
      await page.getByRole('button', { name: 'Voltar' }).click();
    });

    await passo('4. Meu Perfil mostra os temas da própria bio', async () => {
      await menu(page, 'Perfil').click();
      const temas = page.getByTestId('temas-minha-bio');
      await expect(temas.getByRole('heading', { name: /Temas que o ThoLuk identificou na sua bio/ })).toBeVisible();
      await expect(temas.getByRole('list', { name: 'Temas identificados na sua bio' }).getByText('Culinária')).toBeVisible();
      await expect(temas.getByText(/Escreva sobre seus interesses para o ThoLuk/)).toBeVisible();
      await temas.scrollIntoViewIfNeeded();
      await print(page, 'N15', 5, 'meu-perfil-temas');
    });
  } finally {
    await context.close();
  }

  const adm = await abrirSessao(browser);
  try {
    const p = adm.page;
    await entrar(p, ADMIN.email, ADMIN.senha);
    await expect(p.getByRole('heading', { name: 'Painel Admin' })).toBeVisible({ timeout: 60_000 });
    await p.getByRole('button', { name: 'ThoLuk (IA)' }).click();

    await passo('5. aba ThoLuk (IA): situação do ThoLuk', async () => {
      await expect(p.getByRole('heading', { name: 'Situação do ThoLuk' })).toBeVisible();
      // o servidor aquece o modelo ao subir: "ThoLuk carregando" vira "ThoLuk disponível" sozinho (atualização automática)
      await expect(p.getByRole('status').filter({ hasText: /ThoLuk disponível|ThoLuk não carregado/ })).toBeVisible({ timeout: 60_000 });
      await expect(p.getByText('paraphrase-multilingual-MiniLM-L12-v2')).toBeVisible();
      await expect(p.getByText('Perfis com embedding')).toBeVisible();
      await print(p, 'N15', 6, 'admin-ia-status');
    });

    await passo('6. laboratório com o exemplo 1: medidores e temas em comum', async () => {
      await p.getByRole('button', { name: 'Laboratório' }).click();
      await p.getByRole('button', { name: 'Interesses parecidos, palavras diferentes' }).click();
      const resultado = p.getByTestId('resultado-laboratorio');
      await expect(resultado).toBeVisible({ timeout: 60_000 });
      await expect(resultado.getByRole('meter', { name: 'Similaridade (cosseno)' })).toBeVisible();
      await expect(resultado.getByRole('meter', { name: 'Afinidade calibrada' })).toBeVisible();
      await expect(resultado.getByText(/Temas em comum:/)).toBeVisible();
      await expect(resultado.getByText(/processado em .* ms/)).toBeVisible();
      await expect(p.getByLabel('Texto A')).toHaveValue('Adoro cozinhar para os amigos e testar receitas novas.');
      await expect(p.getByText('54/1.000')).toBeVisible();
      await print(p, 'N15', 7, 'admin-ia-laboratorio');
    });

    await passo('7. laboratório valida texto vazio sem chamar o ThoLuk', async () => {
      await p.getByLabel('Texto A').fill('');
      await p.getByRole('button', { name: /Comparar com o ThoLuk/ }).click();
      await expect(p.getByText('Escreva o primeiro texto.')).toBeVisible();
    });

    await passo('8. processamento paralelo: gráficos do benchmark (ou a instrução, sem benchmark)', async () => {
      await p.getByRole('button', { name: 'Processamento paralelo' }).click();
      const graficos = p.getByTestId('graficos-paralelismo');
      const semBenchmark = p.getByText(/benchmark de paralelismo ainda não foi executado/);
      await expect(graficos.or(semBenchmark)).toBeVisible({ timeout: 30_000 });
      if (await graficos.isVisible()) {
        await expect(graficos.getByRole('img', { name: /^Tempo × workers/ })).toBeVisible();
        await expect(graficos.getByRole('img', { name: /^Speedup × workers/ })).toBeVisible();
        await expect(p.getByRole('table')).toBeVisible();
        await expect(p.getByText('Lei de Amdahl:', { exact: true })).toBeVisible();
        await expect(p.getByText('Lei de Amdahl: threads')).toBeVisible();
      }
      await print(p, 'N15', 8, 'admin-ia-paralelismo');
    });

    await passo('9. aba Logs: filtro "Teste do ThoLuk (painel)" encontra o teste do laboratório', async () => {
      await p.getByRole('button', { name: /^Logs$/ }).click();
      await p.getByLabel('Ação').selectOption({ label: 'Teste do ThoLuk (painel)' });
      await p.getByRole('button', { name: 'Buscar' }).click();
      await expect(p.getByText('Teste do ThoLuk (painel)').nth(1)).toBeVisible({ timeout: 20_000 });
      await expect(p.getByRole('cell', { name: /^ThoLuk \(IA\)$/ }).first()).toBeVisible();
      await print(p, 'N15', 9, 'admin-logs-ia-teste');
    });
  } finally {
    await adm.context.close();
  }
});
