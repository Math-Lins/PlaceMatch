import { expect, menu, prepararMatch, print, test } from './apoio';

test('N06 Match e chat com duas sessões isoladas', async ({ browser }) => {
  const { A, B } = await prepararMatch(browser, 'n06');
  try {
    await test.step('1. B curtiu A depois de A ter curtido B: tela de interesse mútuo', async () => {
      await expect(B.page.getByText('Interesse mútuo confirmado')).toBeVisible();
      await expect(B.page.getByRole('button', { name: 'Enviar mensagem' })).toBeVisible();
      await expect(B.page.getByRole('button', { name: 'Ver meus matches' })).toBeVisible();
      await print(B.page, 'N06', 1, 'interesse-mutuo-B');
    });

    await test.step('2. Enviar mensagem abre o chat e B envia a primeira mensagem', async () => {
      await B.page.getByRole('button', { name: 'Enviar mensagem' }).click();
      const campo = B.page.getByPlaceholder('Digite uma mensagem...');
      await expect(campo).toBeVisible();
      await campo.fill('Olá! Tenho interesse em conversar sobre a vaga.');
      await B.page.getByRole('button', { name: 'Enviar mensagem' }).click();
      await expect(B.page.getByText('Olá! Tenho interesse em conversar sobre a vaga.')).toBeVisible();
      await print(B.page, 'N06', 2, 'chat-B-enviou');
    });

    await test.step('3. A vê a conversa em Matches com indicador de nova mensagem', async () => {
      await menu(A.page, 'Matches').click();
      const linha = A.page.getByRole('button').filter({ hasText: 'Olá! Tenho interesse' });
      await expect(linha.first()).toBeVisible({ timeout: 20_000 });
      await expect(linha.first().getByText('1 nova', { exact: true }), 'a conversa deveria mostrar 1 mensagem não lida').toBeVisible();
      await print(A.page, 'N06', 3, 'matches-A-com-indicador');
    });

    await test.step('4. Notificações de A mostra o match', async () => {
      await menu(A.page, 'Notificações').click();
      await expect(A.page.getByRole('heading', { name: 'Notificações' })).toBeVisible();
      await expect(A.page.getByText(B.perfil.nome.split(' ')[0], { exact: false }).first()).toBeVisible({ timeout: 15_000 });
      await expect(A.page.getByText('Nenhuma novidade')).toHaveCount(0);
      await print(A.page, 'N06', 4, 'notificacoes-A');
    });

    await test.step('5. A abre a conversa, vê a mensagem e responde', async () => {
      await menu(A.page, 'Matches').click();
      await A.page.getByRole('button').filter({ hasText: 'Olá! Tenho interesse' }).first().click();
      await expect(A.page.getByText('Olá! Tenho interesse em conversar sobre a vaga.')).toBeVisible();
      const campo = A.page.getByPlaceholder('Digite uma mensagem...');
      await campo.fill('Oi! Podemos conversar, sim.');
      await A.page.getByRole('button', { name: 'Enviar mensagem' }).click();
      await expect(A.page.getByText('Oi! Podemos conversar, sim.')).toBeVisible();
      await print(A.page, 'N06', 5, 'chat-A-respondeu');
    });

    await test.step('6. B recebe a resposta de A (atualização automática do chat)', async () => {
      await expect(B.page.getByText('Oi! Podemos conversar, sim.')).toBeVisible({ timeout: 20_000 });
      await print(B.page, 'N06', 6, 'chat-B-recebeu');
    });

    await test.step('7. botões voltar funcionam: chat → Matches; Matches → Descoberta', async () => {
      await A.page.getByRole('button', { name: 'Voltar' }).click();
      await expect(A.page.getByRole('heading', { name: 'Seus Matches' })).toBeVisible();
      await menu(A.page, 'Descoberta').click();
      await expect(A.page.getByRole('heading', { name: /^(Descoberta|Vagas para você)$/ })).toBeVisible();
      await B.page.getByRole('button', { name: 'Voltar' }).click();
      await expect(B.page.getByRole('heading', { name: 'Seus Matches' })).toBeVisible();
    });

    await test.step('8. menu do chat: "Ver perfil" leva a alguma tela', async () => {
      await menu(B.page, 'Matches').click();
      await B.page.getByRole('button').filter({ hasText: 'Oi! Podemos conversar, sim.' }).first().click();
      await B.page.getByRole('button', { name: 'Mais opções' }).click();
      await B.page.getByRole('button', { name: 'Ver perfil', exact: true }).click();
      await expect(B.page.getByPlaceholder('Digite uma mensagem...'), '"Ver perfil" deveria sair do chat e abrir o perfil do outro usuário')
        .toBeHidden({ timeout: 5_000 });
      await expect(B.page.getByRole('heading', { name: new RegExp(A.perfil.nome.split(' ').slice(0, 3).join(' ')) }).first()).toBeVisible();
      await expect(B.page.getByText(/R\$\s*800/), 'o perfil aberto pelo chat deve mostrar o orçamento real').toBeVisible();
      await print(B.page, 'N06', 7, 'ver-perfil');
      await B.page.getByRole('button', { name: 'Voltar' }).click();
      await expect(B.page.getByPlaceholder('Digite uma mensagem...'), 'voltar do perfil deveria retornar ao chat').toBeVisible();
    });
  } finally {
    await A.context.close();
    await B.context.close();
  }
});

