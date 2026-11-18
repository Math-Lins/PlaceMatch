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

    await test.step('4b. recarregar a página mostra o contador de notificações (AUD-F10)', async () => {
      await menu(A.page, 'Descoberta').click();
      await A.page.evaluate(() => sessionStorage.removeItem('pm_notif_last_visit'));
      await A.page.reload();
      await expect(A.page.getByRole('heading', { name: /^(Descoberta|Vagas para você)$/ })).toBeVisible({ timeout: 30_000 });
      await expect(A.page.getByText(/notificaç(ão|ões) não lidas?/).first(), 'o contador deve aparecer sem precisar de um match novo na sessão')
        .toBeAttached({ timeout: 15_000 });
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

    await test.step('6b. polling que coincide com o envio não duplica a mensagem (AUD-F08)', async () => {
      let pollsRetidos = 0;
      let liberar: () => void = () => {};
      const portao = new Promise<void>(r => { liberar = r; });
      await B.page.route(/\/mensagens\/\?apos=/, async route => { pollsRetidos++; await portao; await route.continue(); });
      await expect.poll(() => pollsRetidos, { timeout: 15_000 }).toBeGreaterThan(0); // um poll fica parado antes de chegar ao servidor
      const texto = 'Mensagem enviada durante o polling.';
      await B.page.getByPlaceholder('Digite uma mensagem...').fill(texto);
      await B.page.getByRole('button', { name: 'Enviar mensagem' }).click();
      await expect(B.page.getByText(texto)).toHaveCount(1);
      liberar(); // o poll antigo segue para o servidor e devolve a mensagem que o envio já mostrou
      await B.page.waitForTimeout(2500);
      await expect(B.page.getByText(texto), 'a mensagem não pode aparecer duas vezes').toHaveCount(1);
      await B.page.unroute(/\/mensagens\/\?apos=/);
    });

    await test.step('6c. sem conexão: aviso discreto no chat que some ao voltar (AUD-F15)', async () => {
      await B.page.route(/\/mensagens\/\?apos=/, route => route.abort());
      await expect(B.page.getByText('Sem conexão, tentando novamente…')).toBeVisible({ timeout: 15_000 });
      await B.page.unroute(/\/mensagens\/\?apos=/);
      await expect(B.page.getByText('Sem conexão, tentando novamente…')).toBeHidden({ timeout: 15_000 });
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
      await B.page.getByRole('button').filter({ hasText: 'Mensagem enviada durante o polling.' }).first().click();
      await B.page.getByRole('button', { name: 'Mais opções' }).click();
      await B.page.getByRole('button', { name: 'Ver perfil', exact: true }).click();
      await expect(B.page.getByPlaceholder('Digite uma mensagem...'), '"Ver perfil" deveria sair do chat e abrir o perfil do outro usuário')
        .toBeHidden({ timeout: 5_000 });
      await expect(B.page.getByRole('heading', { name: new RegExp(A.perfil.nome.split(' ').slice(0, 3).join(' ')) }).first()).toBeVisible();
      await expect(B.page.getByText(/R\$\s*800/), 'o perfil aberto pelo chat deve mostrar o orçamento real').toBeVisible();
      // a capa usa imagem de reserva: sem foto, nada de imagem quebrada com texto alternativo
      await expect(B.page.locator(`img[alt="${A.perfil.nome}"]`), 'sem foto, a capa deve mostrar a reserva (iniciais), não uma imagem quebrada').toHaveCount(0);
      await print(B.page, 'N06', 7, 'ver-perfil');
      await B.page.getByRole('button', { name: 'Voltar' }).click();
      await expect(B.page.getByPlaceholder('Digite uma mensagem...'), 'voltar do perfil deveria retornar ao chat').toBeVisible();
    });

    await test.step('9. recarregar a página no chat reabre a mesma conversa (id do match na URL)', async () => {
      await expect(B.page).toHaveURL(/screen=chat&match=\d+/);
      await B.page.reload();
      await expect(B.page.getByPlaceholder('Digite uma mensagem...'), 'o chat deveria reabrir após recarregar').toBeVisible({ timeout: 20_000 });
      await expect(B.page.getByText('Oi! Podemos conversar, sim.')).toBeVisible();
      await expect(B.page.getByText('Olá! Tenho interesse em conversar sobre a vaga.')).toBeVisible();
      await print(B.page, 'N06', 8, 'chat-recarregado');
      // conversa que não existe (ou de outra pessoa): cai em Matches, sem erro
      await B.page.goto('/?screen=chat&match=999999');
      await expect(B.page.getByRole('heading', { name: 'Seus Matches' })).toBeVisible({ timeout: 20_000 });
      await expect(B.page).not.toHaveURL(/match=/);
    });
  } finally {
    await A.context.close();
    await B.context.close();
  }
});

