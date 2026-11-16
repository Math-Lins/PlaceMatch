# Evidências dos testes de navegação (Playwright)

Prints da **rodada final da Sprint 10** (16/11/2026), numerados como `Nxx-yy-descricao.png`
(`Nxx` = roteiro, `yy` = ordem do passo). Total: **90 prints**. Desktop: 1366×768; mobile (somente N13): 375×812.

## Roteiros

- **N01** Visitante
- **N02** Cadastro com nome completo e acento (buscando vaga)
- **N03** Cadastro oferecendo vaga com anúncio
- **N04** Menu, botão voltar e recarregar a página
- **N05** Descoberta: busca, filtros e detalhe
- **N06** Match e chat com duas sessões
- **N07** Meu Perfil: editar, cancelar, excluir
- **N08** Sair da conta
- **N09** Permissões na navegação
- **N10** Painel admin
- **N11** Moderação ponta a ponta
- **N12** Sessão (renovação e expiração)
- **N13** Mobile (375 px)

## Prints

| Arquivo | Roteiro | Passo | O que a tela mostra | Viewport |
|---|---|---|---|---|
| N01-01-tela-inicial.png | N01 | 1 | Tela inicial com os botões "Entrar" e "Criar conta". | desktop 1366×768 |
| N01-02-login.png | N01 | 2 | Tela de login ("Boas-vindas de volta!") aberta por "Entrar". | desktop 1366×768 |
| N01-03-voltou-inicio.png | N01 | 3 | Tela inicial de novo, depois de "Voltar" no login. | desktop 1366×768 |
| N01-04-cadastro.png | N01 | 4 | Tela "Criar conta" com nome, e-mail, senhas e o tipo de conta. | desktop 1366×768 |
| N01-10-sem-login-discovery.png | N01 | 10 | Abrir ?screen=discovery sem login: cai na tela de login. | desktop 1366×768 |
| N01-11-sem-login-notifications.png | N01 | 11 | Abrir ?screen=notifications sem login: cai na tela de login. | desktop 1366×768 |
| N01-12-sem-login-matches.png | N01 | 12 | Abrir ?screen=matches sem login: cai na tela de login. | desktop 1366×768 |
| N01-13-sem-login-profile.png | N01 | 13 | Abrir ?screen=profile sem login: cai na tela de login. | desktop 1366×768 |
| N01-14-sem-login-profile-create.png | N01 | 14 | Abrir ?screen=profile-create sem login: cai na tela de login. | desktop 1366×768 |
| N01-15-sem-login-profile-detail.png | N01 | 15 | Abrir ?screen=profile-detail sem login: cai na tela de login. | desktop 1366×768 |
| N01-16-sem-login-match.png | N01 | 16 | Abrir ?screen=match sem login: cai na tela de login. | desktop 1366×768 |
| N01-17-sem-login-chat.png | N01 | 17 | Abrir ?screen=chat sem login: cai na tela de login. | desktop 1366×768 |
| N02-01-cadastro-concluido-etapa1.png | N02 | 1 | Cadastro de "Maria José da Silva" concluído; criação de perfil na etapa 1 de 4. | desktop 1366×768 |
| N02-02-etapa1-erros.png | N02 | 2 | Etapa 1 vazia: mensagens de nome, idade e região; não avança. | desktop 1366×768 |
| N02-03-etapa2.png | N02 | 3 | Etapa 2 de 4 (preferências de moradia: orçamento, tipo de imóvel, moradores). | desktop 1366×768 |
| N02-04-etapa2-erros.png | N02 | 4 | Etapa 2 com erros (valores obrigatórios; mínimo maior que o máximo). | desktop 1366×768 |
| N02-05-etapa3-erros.png | N02 | 5 | Etapa 3 sem respostas: erros de fuma, pets, visitas e horário. | desktop 1366×768 |
| N02-06-voltou-dados-mantidos.png | N02 | 6 | Voltou à etapa 1 pelo botão "Voltar": os dados digitados continuam. | desktop 1366×768 |
| N02-07-etapa4-erros.png | N02 | 7 | Etapa 4 sem escolhas: erros das quatro escalas de hábitos. | desktop 1366×768 |
| N02-08-descoberta.png | N02 | 8 | Descoberta "Vagas para você" ao concluir o perfil, com a região do usuário no subtítulo e o anúncio criado no roteiro. | desktop 1366×768 |
| N03-01-etapa1-de-5.png | N03 | 1 | Oferecendo vaga: o perfil tem 5 etapas ("Etapa 1 de 5"). | desktop 1366×768 |
| N03-02-etapa5-anuncio.png | N03 | 2 | Etapa 5 "Anúncio do imóvel": título, descrição, fotos e foto do proprietário. | desktop 1366×768 |
| N03-03-foto-com-previa.png | N03 | 3 | Foto do imóvel por URL com pré-visualização e contador 1/5. | desktop 1366×768 |
| N03-04-descoberta-interessados.png | N03 | 4 | Descoberta "Interessados na sua vaga" ao concluir o perfil, com o interessado criado no roteiro. | desktop 1366×768 |
| N03-05-meu-perfil-anuncio.png | N03 | 5 | Meu Perfil com o card "Meu anúncio" (título, descrição e foto salvos). | desktop 1366×768 |
| N03-06-edicao-anuncio-apos-recarregar.png | N03 | 6 | Depois de recarregar a página: edição do perfil com a seção "Anúncio do imóvel" (tipo do usuário vindo de /api/auth/me/). | desktop 1366×768 |
| N04-01-menu-descoberta.png | N04 | 1 | Menu lateral: Descoberta aberta, item destacado. | desktop 1366×768 |
| N04-02-menu-notificações.png | N04 | 2 | Menu lateral: Notificações aberta, item destacado. | desktop 1366×768 |
| N04-03-menu-matches.png | N04 | 3 | Menu lateral: "Seus Matches" aberta (sem matches), item destacado. | desktop 1366×768 |
| N04-04-menu-perfil.png | N04 | 4 | Menu lateral: "Meu Perfil" aberta, item destacado. | desktop 1366×768 |
| N04-05-voltar-notificacoes.png | N04 | 5 | Botão voltar do navegador devolve a tela Notificações. | desktop 1366×768 |
| N04-06-recarregou-em-matches.png | N04 | 6 | Depois de recarregar a página: continua logado em "Seus Matches". | desktop 1366×768 |
| N04-07-recarregou-em-perfil.png | N04 | 7 | Depois de recarregar a página: continua logado em "Meu Perfil" com os dados do perfil. | desktop 1366×768 |
| N05-01-lista-completa.png | N05 | 1 | Descoberta com os dois anúncios do roteiro (Boa Viagem e Casa Forte). | desktop 1366×768 |
| N05-02-busca-casa-forte.png | N05 | 2 | Busca por "Casa Forte": a lista é filtrada. | desktop 1366×768 |
| N05-03-filtros-abertos.png | N05 | 3 | Painel "Filtros de busca" aberto. | desktop 1366×768 |
| N05-04-filtro-casa-com-chip.png | N05 | 4 | Filtro "Casa" aplicado: painel fechado e chip "Casa ✕" visível. | desktop 1366×768 |
| N05-05-detalhe-do-anuncio.png | N05 | 5 | Detalhe do anúncio aberto a partir do card ("Anunciado por"). | desktop 1366×768 |
| N05-06-filtro-pets-ordenar.png | N05 | 6 | Filtros "Pets: Sim" e "Menor preço" aplicados, sem erro da API. | desktop 1366×768 |
| N05-07-estado-vazio.png | N05 | 7 | Estado vazio "Nenhum perfil com esses filtros." com o botão "Limpar filtros". | desktop 1366×768 |
| N05-08-limpou.png | N05 | 8 | Depois de "Limpar filtros": lista completa de novo e busca vazia. | desktop 1366×768 |
| N06-01-interesse-mutuo-B.png | N06 | 1 | Sessão B: tela "Interesse mútuo confirmado" com "Enviar mensagem" e "Ver meus matches". | desktop 1366×768 |
| N06-02-chat-B-enviou.png | N06 | 2 | Sessão B: chat com a primeira mensagem enviada. | desktop 1366×768 |
| N06-03-matches-A-com-indicador.png | N06 | 3 | Sessão A: lista de matches com a conversa e o indicador "1 nova". | desktop 1366×768 |
| N06-04-notificacoes-A.png | N06 | 4 | Sessão A: Notificações mostra o novo match. | desktop 1366×768 |
| N06-05-chat-A-respondeu.png | N06 | 5 | Sessão A: conversa aberta e resposta enviada. | desktop 1366×768 |
| N06-06-chat-B-recebeu.png | N06 | 6 | Sessão B: a resposta de A chega ao chat (atualização automática). | desktop 1366×768 |
| N06-07-ver-perfil.png | N06 | 7 | Menu do chat > "Ver perfil": perfil real do outro participante (orçamento, convivência e hábitos); sem foto, a capa usa a imagem de reserva. | desktop 1366×768 |
| N06-08-chat-recarregado.png | N06 | 8 | Depois de recarregar a página no chat: a mesma conversa reabre (id do match na URL), com as mensagens. | desktop 1366×768 |
| N07-01-editando.png | N07 | 1 | Meu Perfil em edição com todos os campos do perfil. | desktop 1366×768 |
| N07-02-edicao-erros.png | N07 | 2 | Edição com idade 17 e mínimo maior que o máximo: mensagens junto aos campos. | desktop 1366×768 |
| N07-03-dados-atualizados.png | N07 | 3 | Perfil depois de salvar: nome, idade, região, orçamento, moradores, visitas e hábitos atualizados. | desktop 1366×768 |
| N07-04-cancelou.png | N07 | 4 | Depois de "Cancelar": o nome digitado foi descartado e os dados salvos continuam. | desktop 1366×768 |
| N07-05-modal-excluir.png | N07 | 5 | Modal "Excluir perfil?" aberto. | desktop 1366×768 |
| N07-06-criacao-de-perfil.png | N07 | 6 | Depois de confirmar a exclusão: volta à criação de perfil (etapa 1). | desktop 1366×768 |
| N08-01-saiu.png | N08 | 1 | Depois de "Sair da conta": tela inicial. | desktop 1366×768 |
| N08-02-voltar-apos-sair.png | N08 | 2 | Botão voltar do navegador depois de sair: cai no login, não reabre tela interna. | desktop 1366×768 |
| N08-03-segunda-aba-segue-logada.png | N08 | 3 | Segunda aba (outra conta) continua logada em "Meu Perfil". | desktop 1366×768 |
| N09-01-usuario-comum-sem-admin.png | N09 | 1 | Usuário comum: menu e Descoberta sem item de administração. | desktop 1366×768 |
| N09-02-url-admin-bloqueada.png | N09 | 2 | Usuário comum abre ?screen=admin: depois do carregamento, cai na Descoberta dele; o painel admin não aparece. | desktop 1366×768 |
| N09-03-admin-no-painel.png | N09 | 3 | Administrador logado: abre direto o Painel Admin (abas Painel, Relatórios, Logs, Usuários e Moderação). | desktop 1366×768 |
| N09-04-admin-url-descoberta.png | N09 | 4 | Administrador abre ?screen=discovery: continua no painel, sem a Descoberta. | desktop 1366×768 |
| N10-01-aba-painel.png | N10 | 1 | Painel Admin, aba Painel: indicadores e gráfico de atividade (aba Moderação com selo "1"). | desktop 1366×768 |
| N10-02-painel-periodo-invertido.png | N10 | 2 | Aba Painel com período invertido: mensagem de data junto aos campos. | desktop 1366×768 |
| N10-03-relatorio-periodo-invertido.png | N10 | 3 | Aba Relatórios com período invertido: mensagem de data junto aos campos. | desktop 1366×768 |
| N10-04-relatorio-gerado.png | N10 | 4 | Aba Relatórios: relatório gerado em tabela. | desktop 1366×768 |
| N10-05-logs-periodo-invertido.png | N10 | 5 | Aba Logs com período invertido: mensagem de data junto aos campos. | desktop 1366×768 |
| N10-06-logs-linha-expandida.png | N10 | 6 | Aba Logs: paginação e linha de log expandida com os detalhes. | desktop 1366×768 |
| N10-07-usuarios-periodo-invertido.png | N10 | 7 | Aba Usuários com período invertido: mensagem de data junto aos campos. | desktop 1366×768 |
| N10-08-moderacao-periodo-invertido.png | N10 | 8 | Aba Moderação com período invertido: mensagem de data junto aos campos. | desktop 1366×768 |
| N11-01-denuncia-modal.png | N11 | 1 | Chat: modal "Denunciar usuário" com motivo e descrição. | desktop 1366×768 |
| N11-02-denuncia-enviada.png | N11 | 2 | Chat: confirmação "Denúncia enviada!". | desktop 1366×768 |
| N11-03-admin-ve-denuncia.png | N11 | 3 | Admin, aba Moderação: a denúncia pendente aparece na lista. | desktop 1366×768 |
| N11-04-filtro-data-moderacao.png | N11 | 4 | Filtro "De" = amanhã: a lista de denúncias fica sem a denúncia de hoje. | desktop 1366×768 |
| N11-05-analisar-procedente-suspender.png | N11 | 5 | Modal "Analisar denúncia": Procedente + "Suspender a conta do denunciado". | desktop 1366×768 |
| N11-06-conta-suspensa.png | N11 | 6 | Usuário suspenso tenta entrar: "Conta suspensa. Procure o suporte.". | desktop 1366×768 |
| N11-07-usuario-reativado.png | N11 | 7 | Admin, aba Usuários: conta reativada (botão volta a "Suspender"). | desktop 1366×768 |
| N11-08-usuario-entrou.png | N11 | 8 | Usuário reativado entra normalmente e chega à Descoberta. | desktop 1366×768 |
| N12-01-renovou-e-continuou.png | N12 | 1 | Access inválido: a próxima ação renova a sessão e o usuário segue em "Seus Matches". | desktop 1366×768 |
| N12-02-sessao-expirada.png | N12 | 2 | Access e refresh inválidos: login com a mensagem "Sua sessão expirou. Entre novamente.". | desktop 1366×768 |
| N13-01-inicio-mobile.png | N13 | 1 | Tela inicial em 375 px. | mobile 375×812 |
| N13-02-etapa1-erros-mobile.png | N13 | 2 | Etapa 1 do perfil com erros em 375 px. | mobile 375×812 |
| N13-03-etapa4-mobile.png | N13 | 3 | Etapa 4 (hábitos) em 375 px. | mobile 375×812 |
| N13-04-descoberta-mobile.png | N13 | 4 | Descoberta em 375 px. | mobile 375×812 |
| N13-05-perfil-mobile.png | N13 | 5 | Meu Perfil em 375 px com o menu inferior. | mobile 375×812 |
| N13-06-edicao-mobile.png | N13 | 6 | Edição do perfil em 375 px. | mobile 375×812 |
| N13-07-filtros-mobile.png | N13 | 7 | Painel de filtros em 375 px. | mobile 375×812 |
| N13-08-interesse-mutuo-mobile.png | N13 | 8 | Tela de interesse mútuo em 375 px. | mobile 375×812 |
| N13-09-chat-mobile.png | N13 | 9 | Chat com mensagem longa em 375 px, sem estourar a largura. | mobile 375×812 |
| N13-10-matches-mobile.png | N13 | 10 | Lista de matches em 375 px, sem estourar a largura. | mobile 375×812 |

## Observações

1. **Resultado da rodada final (16/11/2026):** os 25 testes passaram (24 em desktop, 2 em mobile somando o N13/N13b — ver tabela do relatório),
   um roteiro por vez, com 1 worker, sem trace e sem vídeo. Os prints são desta rodada; nenhum print de rodada anterior foi mantido.
2. **Banco limpo:** N02, N03, N04 e N05 rodaram em banco de e2e recriado do zero antes de cada um, então a Descoberta mostra só os
   anúncios/interessados criados no próprio roteiro. Os demais roteiros rodaram em sequência no mesmo banco.
3. **Imagens externas bloqueadas:** os testes não acessam a internet. Os cards usam o ícone de casa no lugar da foto, as pré-visualizações
   usam uma imagem local de 1 pixel e, em telas de detalhe do perfil (N06-07), a foto de capa aparece como texto alternativo quebrado.
4. **Pendência conhecida (baixa):** a capa do detalhe de um perfil usa `<img>` sem imagem de reserva; com a foto fora do ar mostra o texto alternativo.
