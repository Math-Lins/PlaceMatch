# Campanha de testes — Sprint 9

Resumo da campanha de testes funcionais, de validação e de navegação, dos bugs encontrados e do que foi corrigido. Estado final: **todos os testes passam**. As pendências de navegação (N17 e N18) foram resolvidas na Sprint 10 (seção 6).

## 1. Números

| Verificação | Antes | Depois |
|---|---|---|
| Testes do backend (`manage.py test`) | 326 | **531** ao fim da Sprint 9 (+172 casos novos + 33 de regressão) e **560** ao fim da Sprint 10 (+29: restrições do banco, `verificar_banco`, filtro de datas e limite da descrição), 0 falhas |
| Casos funcionais (CT-F) | — | 38 (38 aprovados) |
| Casos de validação (CT-V) | — | 134 (98 aprovados na primeira execução; 36 reprovados, todos corrigidos) |
| Roteiros de navegação (Playwright) | — | 13 roteiros, 25 testes (23 desktop + 2 mobile), todos aprovados; 89 prints de evidência |
| `tsc --noEmit` e `npm run build` | ok | ok |

## 2. Como executar

```powershell
cd backend
python manage.py test --settings=placematch.test_settings
python manage.py matriz_permissoes --settings=placematch.test_settings
cd ..\frontend
npx tsc --noEmit ; npm run build
npm run e2e:db ; npm run e2e      # veja frontend/e2e/README.md
```

Arquivos de teste novos (backend):

| Arquivo | Conteúdo |
|---|---|
| `usuarios/test_funcionais_sprint9.py` | Cadastro, login, tokens, cadastro com nome completo |
| `perfis/test_funcionais_sprint9.py` | CRUD e validação de perfil |
| `matches/test_funcionais_sprint9.py` | Descoberta, filtros, curtidas, matches |
| `chat/test_funcionais_sprint9.py` | Conversas, mensagens, notificações (lado API) |
| `logs/test_funcionais_sprint9.py` | Logs, filtros e exportação |
| `painel/tests/test_funcionais_sprint9.py` | Dashboard, relatórios, usuários, CSV |
| `moderacao/tests/test_funcionais_sprint9.py` | Denúncias, suspensão, reativação |
| `placematch/test_correcoes_sprint9.py` | Regressão das correções (33 testes) |
| `placematch/testutils_sprint9.py` | Utilitários (fábricas e registro `[CT-Vxx]` com o resultado real) |

Para ver o status e a mensagem reais de cada caso de validação: `python manage.py test usuarios perfis matches chat logs painel moderacao --settings=placematch.test_settings -v 2` e filtrar as linhas `[CT-`.

## 3. Testes funcionais (CT-F01 a CT-F38)

Um caso por operação, com resultado esperado e teste que o prova:

| Módulo | Casos | Operações cobertas |
|---|---|---|
| Usuários e autenticação | F01–F04 | cadastro, login, renovação do token, consulta `/me` |
| Perfis | F05–F12 | criar, listar (só o próprio), consultar, atualizar (PUT e PATCH), excluir, bloqueio a não donos, perfil inexistente (404) |
| Descoberta | F13–F14 | listar o tipo oposto, filtro |
| Curtidas e matches | F15–F18 | curtir, recusar, match mútuo e lista, lista vazia |
| Chat e notificações | F19–F22 | conversas, enviar, consultar e marcar como lida, não lidas |
| Moderação | F23–F26 | denunciar, listar, resolver, suspender e reativar |
| Logs | F27–F31 | listar, filtrar, exportar, geração automática, bloqueio a não administrador |
| Painel e relatórios | F32–F38 | dashboard, catálogo, relatório JSON e CSV, usuários, exportação, bloqueio a não administrador |

Não existem no sistema (e portanto não têm caso): editar/excluir usuário, trocar senha, editar/excluir mensagem. "Notificações" não tem endpoint: o aplicativo as deriva de `/api/matches/` e de `/api/conversas/`.

## 4. Testes de validação (CT-V01 a CT-V134)

| Grupo | Casos | Entradas inválidas |
|---|---|---|
| Cadastro | V01–V12, V131–V133 | e-mail vazio/inválido/duplicado (inclusive em maiúsculas), senha curta/vazia/numérica, tipo inválido, campos ausentes, corpo que não é objeto, **nome completo com espaço/acento e homônimos** |
| Login | V13–V20 | campos vazios, senha errada, usuário inexistente, conta suspensa, e-mail em maiúsculas, corpo que não é objeto |
| Tokens | V21–V27 | ausente, malformado, expirado, refresh inválido/ausente, usuário suspenso |
| Perfil | V28–V55 | nome, idade (<18, 200, negativa, texto, decimal), orçamento (negativo, texto, mínimo>máximo, dígitos demais), escalas fora de 1–5, bio longa, URL inválida, segundo perfil, administrador criando perfil |
| Curtida | V56–V67 | perfil inexistente, sem corpo, ação inválida, próprio perfil, duplicada, mesmo tipo, conta suspensa |
| Filtros da descoberta | V68–V77 | `score_min` fora de 0–100, orçamento texto/NaN/infinito/negativo, ordenação e booleano inválidos |
| Mensagem | V78–V88 | vazia, só espaços, >1000, match inexistente, não texto, não participante, `apos` inválido, outro lado suspenso |
| Denúncia e moderação | V89–V107 | motivo inválido, descrição >500, usuário inexistente/texto/lista, autodenúncia, status inválido, textos longos, filtros inválidos |
| Filtros de logs, usuários e relatórios | V108–V130, V134 | datas inválidas, período invertido, ação/tipo/ativo/formato inválidos, páginas inexistentes, filtro de usuário por e-mail |

Critério de reprovação: resposta 500, mensagem em inglês, mensagem genérica que não diz o campo, ou dado inválido aceito. Na primeira execução 36 casos reprovaram; todos foram corrigidos.

## 5. Bugs encontrados e corrigidos

### Backend (BUG-01 a BUG-24)

| Bug | Gravidade | Problema | Correção |
|---|---|---|---|
| 01 | alta | Cadastro rejeitava nome completo com espaço e homônimos (o nome ia para o `username`, único e sem espaços) | Nome vai para `first_name`; `username` gerado do e-mail; migration de dados |
| 02 | alta | Segundo perfil do mesmo usuário dava 500 (`IntegrityError`) | 400 "Você já possui um perfil." |
| 03 | alta | Login com e-mail em maiúsculas falhava e dizia "Conta suspensa" para conta ativa | Login sem diferenciar maiúsculas; "suspensa" só quando a conta existe, a senha confere e `is_active=false` |
| 04–05 | média | Login com corpo inválido dava 500; campos vazios davam 401 genérico | 400 indicando o campo |
| 06–07 | média/baixa | Filtros de orçamento com NaN/Infinity davam 500; negativos eram aceitos | 400 |
| 08–09 | média | Curtir/mandar mensagem a conta suspensa era possível | 404 na curtida; 403 no chat |
| 10 | média | Administrador criava perfil | 403 |
| 11–12 | média/baixa | Descrição, resolução e motivo de suspensão sem limite | Limite de 500 caracteres (400) |
| 13–15 | média | Tipos errados e filtros inválidos na moderação davam 500 ou mensagem em inglês | 400 em português |
| 16–18 | média/baixa | Filtros inválidos em logs/usuários/relatórios eram ignorados | 400, reaproveitando `painel/filtros.py` |
| 17 | média | Filtro "usuário" dos logs ignorava nome/e-mail | Aceita ID, e-mail ou nome |
| 19 | baixa | `conteudo` não textual e `?apos` inválido eram aceitos | 400 |
| 21 | baixa | Mensagens padrão com erros de português ("pode não estar em branco", "Certifque-se") | `placematch/mensagens.py` |
| 24 | baixa | Chave JWT com menos de 32 bytes | Chave de teste com 32+ bytes; produção exige `SECRET_KEY` de 32+ caracteres |
| 20, 22, 23 | — | Frontend (mensagem de erro 5xx, renovação de token, formulários de perfil/anúncio) | Corrigidos na etapa do frontend (abaixo) |

Efeito adicional: IDs gigantes na URL passaram a responder 404 (antes, 500).

### Frontend

Mensagem amigável para erros 5xx e falha de rede; renovação automática do access com o refresh (uma renovação por vez, sem laço); erro de `tipo` no cadastro junto ao campo; edição de todos os campos do perfil; formulário de anúncio (título, descrição, até 5 fotos por URL com pré-visualização, foto do proprietário); limites e contadores (nome 150, região 200, observação e motivo 500); validação de período invertido nos filtros de data do admin; criação de perfil em etapas volta à etapa do campo com erro.

### Navegação (BUG-N01 a BUG-N19)

| Bug | Problema | Situação |
|---|---|---|
| N01 | Telas internas (`profile`, `profile-create`, `profile-detail`, `match`) abriam sem login | Corrigido (guarda de rotas) |
| N02 | Botão voltar do navegador saía do app e recarregar perdia a tela | Corrigido (tela na URL, `popstate`, restauração da sessão) |
| N03 | Sessão restaurada sem tipo do usuário nem perfil (anúncio não aparecia) | Corrigido (`/api/auth/me/` e `/api/perfis/`) |
| N04 | Usuário comum alcançava o painel admin por `?screen=admin`; admin via telas de usuário | Corrigido |
| N05 | "Sair" do painel admin não encerrava a sessão | Corrigido |
| N06 | "Aplicar filtros" não fechava o painel | Corrigido |
| N07 | Filtros de pets/fumante e a ordenação davam 400 (valores `sim`/`menor_preco` x contrato da API) | Corrigido (tradução em `api.ts`) |
| N08 | Lista de matches estourava a largura no mobile | Corrigido (`min-w-0`) |
| N09 | Filtro de datas da Moderação só valia na exportação | Corrigido (filtra a lista) |
| N10 | Botões só com ícone sem nome acessível | Corrigido (`aria-label`) |
| N11–N13 | "Ver perfil" e "Bloquear" do chat não faziam nada; "Recusar" no detalhe não registrava a recusa | Corrigido ("Ver perfil" abre o perfil real; "Bloquear" removido; "Recusar" envia à API) |
| N14 | Subtítulo fixo "São Paulo · SP"; título da Descoberta dependia da lista | Corrigido |
| N15 | Notificações vazia de forma intermitente em desenvolvimento (efeito duplicado do `StrictMode`) | Corrigido |
| N16 | Perfil aberto pelo chat usava dados padrão inventados | Corrigido (perfil real do match) |
| N17 | Capa do detalhe usa `<img>` sem imagem de reserva | Corrigido na Sprint 10 (`ImagemComFallback` em todas as imagens) |
| N18 | Chat aberto direto pela URL volta para Matches (conversa só em memória) | Corrigido na Sprint 10 (`?screen=chat&match=<id>`) |
| N19 | N10 travou uma vez com o banco cheio de dados acumulados | Não reproduzido em banco limpo |

## 6. Pendências resolvidas na Sprint 10

- N17: imagem de reserva na capa do detalhe (e em todas as imagens do aplicativo).
- N18: o chat reabre a mesma conversa ao recarregar (id do match na URL). O detalhe do perfil continua sem restauração pela URL, porque o endpoint de perfis não traz o score de compatibilidade.
- O filtro de datas da Moderação passou a ser aplicado pelo backend (`data_inicio` e `data_fim` em `GET /api/admin/moderacao/denuncias/`).

## 7. Observação sobre os prints

Os 89 prints de `frontend/e2e/evidencias/` (com `INDICE.md`) mostram a execução final. As imagens externas são bloqueadas nos testes, então os cards usam o ícone de casa no lugar da foto.

## 8. Totais por etapa (Sprint 9 e Sprint 10)

Esta seção só acrescenta os números por etapa; os registros acima ficam como foram escritos.

| Etapa | Backend (`manage.py test`) | Navegação (Playwright) | Observação |
|---|---|---|---|
| Sprint 9 (fim) | **531** | 13 roteiros, 25 testes | Campanha descrita nas seções 1 a 7 |
| Sprint 10, etapa 1 (restrições do banco, `verificar_banco`, datas) | **560** (+29 em `placematch/test_sprint10.py`) | 13 roteiros, 25 testes | |
| Sprint 10, etapa 2 (documentação OpenAPI/Swagger) | **574** (+14 em `placematch/test_api_docs.py`) | 13 roteiros, 25 testes | |
| Sprint 10, etapa 3 (interface final e evidências da RC) | **574** (nenhum teste novo; 1 asserção ajustada em `painel/tests_painel.py`, `'sim'` → `'Sim'`) | 13 roteiros, 25 testes, todos aprovados | 2 roteiros ajustados ao texto novo (n06, n07) e seletores atualizados nos demais |
| RC: correção da taxa de match e seeds (v1.0.0-rc1) | **589** | 13 roteiros, 25 testes | |
| Auditoria da RC, 1ª rodada | **616** (+27 em `placematch/test_auditoria_rc.py`; 9 asserções de permissões/chat tornadas exatas) | 13 roteiros | Detalhes em [`auditoria-rc.md`](./auditoria-rc.md) |
| Auditoria da RC, 2ª rodada | **651** (+35 em `placematch/test_auditoria_rc2.py`) | 13 roteiros (passos novos em N01, N02, N06, N08, N10, N11 e N12) | Limite de login, logout/blacklist, período máximo etc. |
| v1.0.0-rc2 (recuperação de senha por e-mail) | **685** (+34 em `usuarios/test_recuperacao_senha.py`) | **14 roteiros, 30 testes** (novo `n14`; N13c no mobile; passos em N01 e N08) | Evidências em [`execucoes-rc/`](./execucoes-rc/) |

Verificações da etapa 3: `tsc --noEmit` e `npm run build` sem erros; `spectacular --validate` sem avisos; `matriz_permissoes` sem divergências; `verificar_banco --falhar` sobre os dados de demonstração: 13 verificações OK, 1 aviso esperado (matches de uma conta suspensa) e 0 erros.

Os roteiros de navegação seguem em `frontend/e2e/` (`npm run e2e`). O roteiro de prints da Release Candidate, `e2e/tour-rc.spec.ts` (`npm run e2e:tour`), não faz parte da execução padrão: ele prepara os dados de demonstração (`manage.py seed_demo --remover-outros`) e salva 37 prints, com `INDICE.md`, em `frontend/e2e/evidencias-rc/` e no pacote `frontend/evidencias-rc.zip` (não versionado).
