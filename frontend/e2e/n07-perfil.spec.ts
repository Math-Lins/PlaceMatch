import { FOTO_OK, cadastrarComPerfil, expect, menu, novoPerfil, print, test } from './apoio';

test('N07 Meu Perfil: editar todos os campos, cancelar descarta, excluir perfil', async ({ page }) => {
  const p = novoPerfil('n07', 'busca');
  await cadastrarComPerfil(page, p);
  await menu(page, 'Perfil').click();
  await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible();

  await test.step('1. Editar abre o formulário com TODOS os campos do perfil', async () => {
    await page.getByRole('button', { name: 'Editar' }).click();
    for (const ph of ['Seu nome completo', 'Sua idade', 'Ex: Boa Viagem, Recife', '700', '1500']) {
      await expect(page.getByPlaceholder(ph)).toBeVisible();
    }
    for (const t of ['Faixa de orçamento mensal', 'Tipo de imóvel preferido', 'Quantas pessoas no imóvel?', 'Você fuma?', 'Aceita pets?',
      'Com que frequência recebe visitas?', 'Qual é o seu perfil de horário?']) {
      await expect(page.getByText(t, { exact: true })).toBeVisible();
    }
    for (const h of ['Organização', 'Tolerância à bagunça', 'Tolerância a barulho', 'Perfil social']) {
      await expect(page.getByRole('button', { name: `${h}: 5 de 5` })).toBeVisible();
    }
    await expect(page.getByPlaceholder('Seu nome completo')).toHaveValue(p.nome);
    await expect(page.getByRole('textbox', { name: /^Link da sua foto/ }), 'quem procura vaga também edita a foto').toBeVisible();
    await print(page, 'N07', 1, 'editando');
  });

  await test.step('2. validação do formulário de edição (link da foto, idade inválida, mínimo > máximo)', async () => {
    await page.getByRole('textbox', { name: /^Link da sua foto/ }).fill('ftp://foto');
    await expect(page.getByText('A URL da foto de perfil deve começar com http:// ou https://.')).toBeVisible();
    await page.getByPlaceholder('Sua idade').fill('17');
    await page.getByPlaceholder('700').fill('5000');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Idade deve estar entre 18 e 100 anos.')).toBeVisible();
    await expect(page.getByText('O máximo deve ser maior ou igual ao mínimo.')).toBeVisible();
    await print(page, 'N07', 2, 'edicao-erros');
  });

  // Formato brasileiro: "1.000" é mil (e não 1,0) e "2.000,50" é dois mil e cinquenta centavos (AUD-F01).
  const novo = { nome: 'Nome Editado Completo', idade: '31', regiao: 'Olinda', min: '1.000', max: '2.000,50' };
  await test.step('3. editar todos os campos e salvar', async () => {
    await page.getByRole('textbox', { name: /^Link da sua foto/ }).fill(FOTO_OK);
    await page.getByPlaceholder('Seu nome completo').fill(novo.nome);
    await page.getByPlaceholder('Sua idade').fill(novo.idade);
    await page.getByPlaceholder('Ex: Boa Viagem, Recife').fill(novo.regiao);
    await page.getByPlaceholder('700').fill(novo.min);
    await page.getByPlaceholder('1500').fill(novo.max);
    await page.getByRole('button', { name: 'Casa', exact: true }).click();
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByText('Você fuma?', { exact: true }).locator('xpath=..').getByRole('button', { name: 'Sim', exact: true }).click();
    await page.getByText('Aceita pets?', { exact: true }).locator('xpath=..').getByRole('button', { name: 'Não', exact: true }).click();
    await page.getByRole('button', { name: 'Frequentemente', exact: true }).click();
    await page.getByRole('button', { name: /Noturno/ }).click();
    for (const h of ['Organização', 'Tolerância à bagunça', 'Tolerância a barulho', 'Perfil social']) {
      await page.getByRole('button', { name: `${h}: 2 de 5` }).click();
    }
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible({ timeout: 20_000 });
  });

  await test.step('4. os dados atualizados aparecem na tela e persistem ao reabrir a edição', async () => {
    await expect(page.getByRole('heading', { name: novo.nome })).toBeVisible();
    await expect(page.locator(`img[alt="${novo.nome}"]`), 'a foto do link aparece no Meu Perfil').toBeVisible();
    await expect(page.getByText(`${novo.idade} anos · ${novo.regiao}`)).toBeVisible();
    await expect(page.getByText('R$ 1.000 – R$ 2.000,50', { exact: true })).toBeVisible();
    await expect(page.getByText('Casa', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('3 pessoas')).toBeVisible();
    await expect(page.getByText('Recebe visitas', { exact: true })).toBeVisible();
    await expect(page.getByText('Noturno', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('2/5', { exact: true })).toHaveCount(4);
    await print(page, 'N07', 3, 'dados-atualizados');
  });

  await test.step('5. Cancelar descarta as alterações', async () => {
    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByPlaceholder('Seu nome completo').fill('Nome que será descartado');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(page.getByRole('heading', { name: novo.nome })).toBeVisible();
    await expect(page.getByText('Nome que será descartado')).toHaveCount(0);
    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByPlaceholder('Seu nome completo')).toHaveValue(novo.nome);
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await print(page, 'N07', 4, 'cancelou');
  });

  await test.step('6. Excluir perfil: o modal abre e Cancelar fecha', async () => {
    await page.getByRole('button', { name: 'Excluir perfil' }).click();
    const modal = page.getByRole('dialog', { name: 'Excluir perfil' });
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Excluir perfil?')).toBeVisible();
    await print(page, 'N07', 5, 'modal-excluir');
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(modal).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible();
  });

  await test.step('6b. teclado no modal: o foco entra, o Tab fica preso nele e o Esc devolve o foco (AUD-F06)', async () => {
    const abrir = page.getByRole('button', { name: 'Excluir perfil' });
    await abrir.click();
    const modal = page.getByRole('dialog', { name: 'Excluir perfil' });
    await expect(modal).toBeFocused();
    const dentro = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await dentro(), `Tab nº ${i + 1} saiu do modal`).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await dentro()).toBe(true);
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(abrir, 'o foco deve voltar ao botão que abriu o modal').toBeFocused();
  });

  await test.step('7. confirmar a exclusão leva à criação de perfil', async () => {
    await page.getByRole('button', { name: 'Excluir perfil' }).click();
    await page.getByRole('button', { name: 'Excluir definitivamente' }).click();
    await expect(page.getByText(/^Etapa 1 de 4/)).toBeVisible({ timeout: 20_000 });
    await print(page, 'N07', 6, 'criacao-de-perfil');
  });
});
