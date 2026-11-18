# Auditoria da Release Candidate (v1.0.0-rc1)

Auditoria de defeitos que passaram despercebidos, feita sobre o código da tag `v1.0.0-rc1` (18/11/2026).
Regras: só correção de defeito; sem funcionalidade nova, sem mudança de regra de negócio e sem mudança de
rotas, nomes de campos ou formatos da API. Itens que pedem decisão de produto ou mexem na API ficaram
**pendentes** (seção 4).

Como a auditoria foi feita: leitura do código de todos os módulos (backend e frontend), sondagens reais da API
(script de requisições em banco descartável e consultas somente de leitura ao PostgreSQL para confirmar o
comportamento do banco), execução da suíte do backend e dos 13 roteiros e2e, e um percurso extra pelas telas em
1920 × 1080 e 375 × 812 registrando erros do console (seção 6).

Convenção dos IDs: `AUD-nn` = backend/geral; `AUD-Fnn` = frontend; `AUD-Dnn` = documentação; `AUD-Tnn` = testes.

## 1. Tabela da auditoria

Gravidade: crítica / alta / média / baixa. Risco da correção: baixo / médio / alto.

| ID | Área | Problema | Evidência | Gravidade | Risco da correção | Situação / proposta |
|---|---|---|---|---|---|---|
| AUD-01 | Segurança (CSV) | **Injeção de fórmula** nas exportações CSV: texto do usuário que começa com `=`, `+`, `-` ou `@` abre como fórmula no Excel/LibreOffice (nome do usuário, nome do perfil, região, e-mail). | `painel/exportacao.py` (`celula_br` devolvia o texto cru). Reprodução: usuário com nome `=HYPERLINK("http://evil","x")` → linha do CSV `4;"=HYPERLINK(""http://evil"",""x"")";…`. Afeta `usuarios`, relatórios e `logs`. | **alta** | baixo | **Corrigido** |
| AUD-02 | API (paginação) | Página gigante nas listas admin derruba a API (500): `?page=99999999999999999999` gera `OFFSET` maior que o `bigint`. | `painel/views.py` (`AdminUsuariosView`) e `logs/views.py` (`LogListView`). Confirmado no PostgreSQL: `SELECT 1 OFFSET 99999999999999999999` → "bigint fora do intervalo"; no SQLite o teste também dava erro. | média | baixo | **Corrigido** |
| AUD-03 | Regra de negócio (corrida) | **Curtir duas vezes rápido**: duas requisições simultâneas passam juntas pela checagem `exists()` e a segunda quebra na restrição única → 500 (em vez de "Você já avaliou este perfil"). | `matches/views.py` (`CurtidaView.post`: `exists()` + `create()` sem tratar `IntegrityError`); restrição em `matches/models.py` (`unique_together`). | média | baixo | **Corrigido** |
| AUD-04 | API (entrada) | **Caractere nulo (U+0000)** em texto: o PostgreSQL não aceita, a API respondia 500 (mensagem do chat, descrição da denúncia, motivo da suspensão, `fotos_imovel`, `?q=` da Descoberta/Conversas/admin). | `chat/views.py`, `moderacao/servicos.py` (`validacao.texto`), `perfis/serializers.py` (`validate_fotos_imovel`), filtros `q`. Confirmado no driver: `ValueError: A string literal cannot contain NUL (0x00) characters`. O login já era protegido pelo serializer do SimpleJWT. | média | baixo | **Corrigido** |
| AUD-05 | Segurança (privacidade) | O detalhe `GET /api/perfis/{id}/` mostrava o perfil de uma **conta suspensa** a qualquer usuário do tipo oposto (a Descoberta e a lista de matches já escondiam). | `perfis/views.py` (`get_object` não olhava `is_active`). Reprodução: suspender o dono, consultar o id com outro usuário → 200 com bio, região e fotos. | média | baixo | **Corrigido** (404; o administrador continua vendo) |
| AUD-06 | Fuso horário | O período padrão do painel (últimos 30 dias) usava a data **UTC**: entre 21h e 24h (Brasília) o "hoje" já era amanhã e a série ficava deslocada um dia. | `painel/views.py` (`DashboardView`: `timezone.now()` → `agora.day`). Reprodução com relógio em 22h de Brasília: último dia da série = dia seguinte. | média | baixo | **Corrigido** |
| AUD-07 | Auditoria (logs) | Cabeçalho `X-Forwarded-For` inválido faz a gravação do log falhar em silêncio no PostgreSQL (`inet`): quem envia o cabeçalho com lixo **apaga o próprio rastro** (login, curtida, exportação…). | `logs/servicos.py` (`_extrair_ip` usava o cabeçalho sem validar) + `logs/models.py` (`GenericIPAddressField`). Confirmado: `SELECT 'nao-e-ip'::inet` → erro de sintaxe. | média | baixo | **Corrigido** |
| AUD-08 | Desempenho (N+1) | Descoberta fazia **1 consulta de compatibilidade por candidato** (20 consultas para 16 perfis) e a lista de Matches fazia 2 consultas extras por match (5 consultas para 1 match). | `matches/views.py` (`DescobertaView`: `Compatibilidade.objects.get` dentro do laço; `MatchListView`: `select_related` sem `usuario`). Medido com `CaptureQueriesContext`. | média | baixo | **Corrigido** (número de consultas passou a ser fixo) |
| AUD-09 | Segurança (login) | **Sem limite de tentativas no login** (força bruta). 30 senhas erradas seguidas → 30 × `401`, sem bloqueio nem atraso. | `usuarios/views.py` (`LoginView`); sondagem: 30 tentativas inválidas, todas `401`. | **alta** | médio | **Pendente** — exige regra nova (resposta `429`/bloqueio) e decisão do mecanismo. Ver seção 4. |
| AUD-10 | Regra de negócio | Denúncias sem limite nem deduplicação: o mesmo usuário pode denunciar a mesma pessoa quantas vezes quiser (enche a fila da moderação). | `moderacao/servicos.py` (`criar_denuncia`). | média | médio | **Pendente** (regra de negócio) |
| AUD-11 | Configuração | Com `.env` ausente: `DEBUG` padrão `True` e `SECRET_KEY` padrão fraca (o `DEBUG=False` já exige chave ≥ 32). Sem `SECURE_*`/HSTS/cookies seguros; a imagem Docker sobe com `runserver`. | `placematch/settings.py:12-14`, `backend/Dockerfile`. `ALLOWED_HOSTS`, CORS e Swagger (só admin com `DEBUG=False`) estão corretos. | média | médio | **Pendente** (decisão de implantação) |
| AUD-12 | Desempenho / DoS (admin) | Período muito grande no painel gera série diária gigante: `data_inicio=1900-01-01` → 4,4 MB e 3,9 s; `data_inicio=0001-01-01` passa de 100 s de CPU. | `painel/views.py` (`DashboardView` + `_gerar_serie_datas`). Medido com o cliente de teste. | média | médio | **Pendente** (limitar o período muda a regra) |
| AUD-13 | Segurança | `X-Forwarded-For` é aceito de qualquer cliente: o IP gravado nos logs pode ser forjado se não houver proxy confiável na frente. | `logs/servicos.py`. | baixa | médio | **Pendente** (depende da infraestrutura de implantação) |
| AUD-14 | Segurança | Cadastro revela se um e-mail já existe ("Este e-mail já está cadastrado"). | `usuarios/serializers.py:82-86`. | baixa | médio | **Pendente** (comportamento esperado em cadastro; só muda com decisão de produto) |
| AUD-15 | Segurança | Logout não invalida o refresh token (sem *blacklist*): um refresh copiado vale até 7 dias. | `placematch/settings.py` (`SIMPLE_JWT`), `frontend/src/api.ts` (`logout`). | baixa | médio | **Pendente** (exige app `token_blacklist` + migração) |
| AUD-16 | Fuso horário | `data_fim` vira `23:59:59`: registros nos últimos 999 999 µs do dia ficam de fora dos filtros de período. | `painel/filtros.py:69-74`. | baixa | baixo | **Pendente** (gravidade baixa) |
| AUD-17 | Desempenho | Lista de conversas faz 2 consultas por match; relatório "Compatibilidade por região" faz ~4 consultas por região (a região é texto livre). | `chat/views.py:59-60`, `painel/views.py` (`_dados_relatorio_compatibilidade_regiao`). | baixa | médio | **Pendente** |
| AUD-18 | Dados | `LogOperacao.entidade_id` é `PositiveIntegerField` (32 bits) e os ids são `BigAutoField`: ids acima de 2 147 483 647 não são registrados (falha silenciosa). | `logs/models.py:33`. | baixa | médio | **Pendente** (exige migração) |
| AUD-19 | Corrida | Mensagem enviada no instante em que o match é apagado (exclusão de perfil) pode falhar na chave estrangeira (500). | `chat/views.py` (`Mensagem.objects.create` após `Match.objects.get`). | baixa | médio | **Pendente** |
| AUD-20 | Segurança (seeds) | Seeds com senha fixa no código (`seed.py`, `seed_perfis.py`, `matriz_permissoes.py`, `tour-rc.spec.ts`). Só para desenvolvimento/demonstração. | `backend/seed.py:85`, `perfis/management/commands/seed_perfis.py:353`. | baixa | baixo | **Pendente** (não rodar seeds em produção; já documentado) |
| AUD-F01 | Frontend (dados) | **Orçamento no formato brasileiro**: `"1.500"` era lido como R$ 1,50 (e `"1.500,50"` dava erro). Valor errado salvo no perfil e nos filtros. | `frontend/src/App.tsx` (`numBR`: só trocava `,` por `.`). Verificado: `numBR("1.500")` = `1.5`. | **alta** | baixo | **Corrigido** |
| AUD-F02 | Frontend (estado) | Sair da conta ou perder a sessão **não limpava** a busca/filtros da Descoberta nem o marco das notificações: a próxima pessoa da mesma aba herdava o estado (e notificações novas podiam ser tratadas como já vistas). | `frontend/src/api.ts` (`logout` só apagava os tokens); chaves `pm_disc_q`, `pm_disc_filters`, `pm_notif_last_visit`. | média | baixo | **Corrigido** |
| AUD-F03 | Frontend (erro de rede) | **Curtir/recusar engolia o erro**: com a API fora do ar o card sumia como se a ação tivesse funcionado (e ao recarregar voltava). Na tela de detalhe, idem. | `frontend/src/App.tsx` (`handleLike`/`handleDislike` com `catch` vazio e "Remove o card mesmo em caso de erro de rede"; `onLike`/`onRecusar` do detalhe). | média | baixo | **Corrigido** (o card fica, a tela avisa e permite tentar de novo; 400/404 continuam removendo o card) |
| AUD-F04 | Frontend (concorrência) | Digitação rápida na busca da Descoberta: a resposta **antiga** (mais lenta) chegava depois e sobrescrevia a lista da busca atual. | `frontend/src/App.tsx` (`doFetch` sem controle de requisição mais recente). | média | baixo | **Corrigido** |
| AUD-F05 | Frontend (teclado) | Login e cadastro não eram `<form>`: **Enter não enviava**; sem `autocomplete` para gerenciadores de senha. | `LoginScreen`/`RegisterScreen`. | média | baixo | **Corrigido** (`<form noValidate>` + `autocomplete`) |
| AUD-F06 | Frontend (acessibilidade) | **Modais sem gestão de foco**: o foco não ia para o diálogo, o Tab escapava para a tela de trás e o foco não voltava ao botão ao fechar. | `frontend/src/ui.tsx` (`Modal`). | média | baixo | **Corrigido** |
| AUD-F07 | Frontend (erro de rede) | Falha ao carregar `/api/auth/me/` ou a lista de perfis logo após o login mandava **quem já tem perfil para "Criar perfil"**, sem aviso. | `frontend/src/App.tsx` (`handleLoginSuccess`: `catch { nav('profile-create') }`). | média | baixo | **Corrigido** (desfaz o login e avisa na tela de entrada) |
| AUD-F08 | Frontend (chat) | Se o polling (4 s) coincidir com o envio, a mensagem enviada pode aparecer **duplicada** até recarregar (sem deduplicação por `id`). | `ChatScreen` (`send` e `poll`). Janela estreita; não reproduzível de forma determinística no e2e. | baixa | baixo | **Pendente** |
| AUD-F09 | Frontend (moderação) | "Procedente + suspender a conta" faz **duas chamadas** (resolver e suspender). Se a 2ª falhar, a denúncia já está resolvida, o modal mostra erro e o "tentar de novo" recebe "Apenas denúncias pendentes…". | `frontend/src/admin/ModeracaoTab.tsx:56-59`. | média | médio | **Pendente** (decisão de UX: mensagem específica ou rota única na API) |
| AUD-F10 | Frontend (notificações) | O contador de notificações **não é carregado no login/recarga** (`atualizarNotifsCount` nunca é chamada): só soma matches ocorridos na sessão. | `frontend/src/App.tsx:3187` (função morta). | média | médio | **Pendente** (decisão de produto; o roteiro N06 valida o indicador atual) |
| AUD-F11 | Frontend (código morto) | `CompatMeter`, `atualizarNotifsCount` e parâmetros não usados (`tsc --noUnusedLocals --noUnusedParameters`). | `App.tsx:263,277,2431,2825,3187`. | baixa | baixo | **Pendente** |
| AUD-F12 | Frontend (cadastro) | Se o login automático falhar depois de criar a conta, tentar de novo mostra "e-mail já cadastrado". | `RegisterScreen.handleContinuar`. | baixa | baixo | **Pendente** |
| AUD-F13 | Frontend (admin) | A aba Usuários refaz a consulta a cada tecla digitada (dependências do `useCallback`), sem debounce; o botão "Buscar" é redundante. | `frontend/src/admin/UsuariosTab.tsx:80-97`. | baixa | baixo | **Pendente** |
| AUD-F14 | Frontend (download) | `downloadCsv` revoga a URL logo após o clique e usa âncora fora do DOM (pode falhar em navegadores antigos). | `frontend/src/api.ts` (`downloadCsv`). | baixa | baixo | **Pendente** |
| AUD-F15 | Frontend (chat) | Falhas do polling são silenciosas (sem aviso de "sem conexão"). | `ChatScreen` (`catch { /* falha silenciosa */ }`). | baixa | baixo | **Pendente** |
| AUD-F16 | Frontend (segurança) | Tokens JWT em `sessionStorage` (legíveis por XSS). Mitigado: não há `dangerouslySetInnerHTML`, links de usuário nem `javascript:`; URLs de foto são validadas no backend (`http`/`https`). | `frontend/src/api.ts`. | baixa | alto | **Sem ação** (decisão de arquitetura) |
| AUD-F17 | Frontend (acessibilidade) | Mensagens de erro de campo não ligadas ao campo (`aria-describedby`); `ReportModal` não cancela o `setTimeout(onClose)`. | `Input`, `ReportModal`. | baixa | baixo | **Pendente** |
| AUD-D01 | Documentação | `docs/testes-sprint9.md` termina em 574 testes; a suíte da RC tinha 589 e, com esta auditoria, 616. | `docs/testes-sprint9.md:143-144`. | baixa | baixo | **Pendente** (os totais atuais estão nesta página e em `docs/execucoes-rc/`) |
| AUD-D02 | Documentação | O README diz que o padrão de `VITE_API_URL` é `http://localhost:8000`; o código usa `http://127.0.0.1:8000` quando a variável não existe. | `README.md:74`, `frontend/src/api.ts:1`. | baixa | baixo | **Pendente** |
| AUD-T01 | Testes | Asserções fracas em permissões, match e chat: 9 testes aceitavam dois códigos (`403` ou `404`, `400` ou `403`…), então uma troca de comportamento passaria despercebida. | `chat/tests.py`, `chat/tests_integracao.py`, `chat/test_funcionais_sprint9.py` (CT-V85, CT-V87), `matches/test_funcionais_sprint9.py` (CT-V67), `perfis/test_funcionais_sprint9.py` (CT-V54), `usuarios/test_funcionais_sprint9.py` (CT-V17). | média | baixo | **Corrigido** (cada teste agora exige o código exato, conferido contra o comportamento real) |

## 2. Correções feitas

| ID | Arquivos alterados | Teste de regressão (falhava antes, passa depois) |
|---|---|---|
| AUD-01 | `backend/painel/exportacao.py` | `placematch.test_auditoria_rc.AUD01InjecaoDeFormulaNoCsvTest` (6 testes: `celula_br`, exportação de usuários, relatórios de usuários e de matches, exportação de logs) |
| AUD-02 | `backend/painel/filtros.py` (`ler_paginacao`), `backend/painel/views.py`, `backend/logs/views.py` | `AUD02PaginacaoAlemDoFimTest` (3 testes) |
| AUD-03 | `backend/matches/views.py` | `AUD03CurtidaDuplicadaConcorrenteTest` (simula a corrida: a checagem passa e a gravação bate na restrição única) |
| AUD-04 | `backend/placematch/nulos.py` (novo), `backend/placematch/settings.py` (parser JSON e *middleware*) | `AUD04CaracterNuloTest` (6 testes: mensagem, `fotos_imovel`, login, denúncia, `?q=`, e texto com emoji/acento continua válido) |
| AUD-05 | `backend/perfis/views.py`, `backend/placematch/api_docs.py`, `backend/scripts/gerar_docs_markdown.py`, `docs/api.md`, `docs/openapi.yaml` (só texto de descrição) | `AUD05PerfilDeContaSuspensaTest` (3 testes) |
| AUD-06 | `backend/painel/views.py` | `AUD06PeriodoPadraoDoPainelUsaFusoLocalTest` |
| AUD-07 | `backend/logs/servicos.py` | `AUD07IpInvalidoNoCabecalhoNaoApagaOLogTest` (4 testes) |
| AUD-08 | `backend/matches/views.py` | `AUD08ConsultasNasListasTest` (3 testes: número fixo de consultas na Descoberta e em Matches; score e ordem preservados) |
| AUD-T01 | 6 arquivos de teste (lista na tabela) | os próprios testes tornaram-se exatos (suíte completa passa) |
| AUD-F01 | `frontend/src/App.tsx` (`numBR`) | `n07-perfil.spec.ts`, passo 3/4: digita `1.000` e `2.000,50` e confere `R$ 1.000 – R$ 2.000,50` |
| AUD-F02 | `frontend/src/api.ts` (`logout`) | `n08-sair-da-conta.spec.ts`, passos 0 e 1: grava busca e marco de notificações, sai e confere que as três chaves sumiram |
| AUD-F03 | `frontend/src/api.ts` (`ApiError.status`, `perfilIndisponivel`), `frontend/src/App.tsx` | `n05-descoberta.spec.ts`, passo 10: bloqueia `POST /api/curtidas/`, confere aviso e card mantido; libera e confere que o card sai |
| AUD-F04 | `frontend/src/App.tsx` (`doFetch`) | `n05-descoberta.spec.ts`, passo 9: atrasa a 1ª busca em 2,5 s e confere que ela não sobrescreve a 2ª |
| AUD-F05 | `frontend/src/App.tsx` (login/cadastro em `<form>`) | `n01-visitante.spec.ts`, passo 5b: Enter no campo de senha envia o login |
| AUD-F06 | `frontend/src/ui.tsx` (`Modal`) | `n07-perfil.spec.ts`, passo 6b: foco entra no modal, Tab preso, Esc devolve o foco ao botão |
| AUD-F07 | `frontend/src/App.tsx` (`handleLoginSuccess`) | `n12-sessao.spec.ts`, teste novo: bloqueia `/api/auth/me/`, confere aviso na tela de login (sem cair em "Criar perfil") e que tentar de novo entra |

Os testes novos do backend estão em `backend/placematch/test_auditoria_rc.py` (27 testes). Os nomes das classes
(`AUD01…AUD08`) e os comentários dos passos do e2e (`AUD-F01…AUD-F07`) usam os mesmos IDs desta tabela.

## 3. O que foi verificado e está correto

- **Acesso a dados de outros usuários**: perfil de mesmo tipo sem match → 403; `PATCH` no perfil alheio → 403;
  mensagens e envio em match de terceiros → 403; remetente forjado no corpo da mensagem é ignorado (usa o perfil do
  token); `perfil_destino` da curtida valida tipo oposto, conta ativa e perfil próprio.
- **Campos protegidos**: `PATCH` com `usuario`, `tipo`, `is_staff`, `id` é ignorado (`read_only`); `tipo` de cadastro só aceita
  `buscando_vaga`/`oferecendo_vaga`.
- **Suspensão**: token de acesso de conta suspensa → 401; refresh de conta suspensa → 401; login → 401 "Conta suspensa";
  Descoberta, Matches e Conversas escondem contas suspensas; mensagem para conta suspensa → 403.
- **Configuração**: `ALLOWED_HOSTS` e CORS restritos; Swagger/schema só para administrador com `DEBUG=False`;
  `DEBUG=False` exige `SECRET_KEY` ≥ 32 caracteres; logs nunca gravam senha, e-mail digitado no login falho nem texto de mensagem.
- **Exclusão de perfil**: apaga em cascata matches, mensagens, curtidas e compatibilidades; denúncias (ligadas ao usuário)
  e logs permanecem (`usuario` vira `NULL` nos logs); o usuário continua ativo e pode recriar o perfil.
- **Match duplicado**: `get_or_create` + restrição única; par sempre guardado como (menor, maior).
- **Frontend**: nenhum `dangerouslySetInnerHTML`, `innerHTML`, `href` com dado do usuário nem `javascript:`; URLs de foto só `http(s)`;
  polling do chat para ao sair da tela e quando a aba fica oculta; renovação do token com uma única chamada simultânea;
  duplo clique em enviar/salvar/curtir já era barrado por `disabled`/`loadingId`/`sending`.
- **Validação**: textos vazios ou só com espaços, números negativos, orçamento acima de R$ 99.999.999,99, datas inválidas e
  período invertido respondem 400 em português.
- **`verificar_banco`** no banco de desenvolvimento (somente leitura): 0 erros.

## 4. Itens NÃO corrigidos — para decidir

| ID | Por que não foi corrigido | Recomendação |
|---|---|---|
| AUD-09 (alta) | Limitar tentativas adiciona uma resposta nova (`429`) e um mecanismo (limitação por IP/e-mail, cache). Muda o contrato da API. | Usar o *throttling* do DRF (`ScopedRateThrottle`, escopo `login`, ex.: 10 tentativas/min por IP + por e-mail) com cache compartilhado se houver mais de um processo; documentar o `429` em `docs/api.md`/OpenAPI. É o item mais importante antes de expor a API. |
| AUD-10 | Regra de negócio (quantas denúncias por pessoa/dia). | Rejeitar nova denúncia pendente do mesmo denunciante contra o mesmo usuário (400) e/ou limite diário. |
| AUD-11 | Depende de onde será implantado. | Em produção: `DEBUG=False`, `SECRET_KEY` própria, servidor WSGI (gunicorn) em vez de `runserver`, HTTPS com `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, cookies seguros; considerar padrão `DEBUG=False` quando não houver `.env`. |
| AUD-12 | Limitar o período muda a regra do painel. | Aceitar no máximo 366 dias (400 com mensagem) ou agregar por mês acima disso. |
| AUD-13, 14, 15 | Dependem de infraestrutura/decisão de produto. | Configurar proxy confiável (ou ignorar `X-Forwarded-For`); manter a mensagem de e-mail duplicado (ou resposta genérica + e-mail); habilitar `token_blacklist` e invalidar o refresh no logout. |
| AUD-16, 17, 18, 19 | Gravidade baixa. | `data_fim` = 23:59:59.999999; agrupar consultas de conversas/relatório; migrar `entidade_id` para `BigIntegerField`; tratar `IntegrityError` ao enviar mensagem. |
| AUD-20 | Gravidade baixa (somente desenvolvimento). | Ler a senha dos seeds de variável de ambiente ou gerar aleatória. |
| AUD-F08, F11–F15, F17 | Gravidade baixa. | Deduplicar mensagens por `id`; remover código morto; debounce na aba Usuários; aviso de conexão no chat; `aria-describedby`. |
| AUD-F09 | Decisão de UX/API. | Mostrar "A denúncia foi registrada, mas a suspensão falhou; suspenda pela aba Usuários" ou criar rota única que faça as duas coisas em transação. |
| AUD-F10 | Decisão de produto. | Chamar `atualizarNotifsCount` no login/recarga para o contador refletir matches ocorridos fora da sessão. |
| AUD-F16 | Decisão de arquitetura. | Manter; migrar para cookie `HttpOnly` só se o risco de XSS mudar. |
| AUD-D01, D02 | Gravidade baixa. | Acrescentar 589 → 616 em `docs/testes-sprint9.md`; alinhar o padrão de `VITE_API_URL` no README. |

## 5. Verificação (totais)

| Verificação | Resultado |
|---|---|
| `manage.py test --settings=placematch.test_settings` | **616 testes, OK** (589 anteriores + 27 novos em `placematch/test_auditoria_rc.py`) |
| `makemigrations --check --dry-run` | No changes detected |
| `spectacular --validate --fail-on-warn` | sem avisos (saída 0); `docs/openapi.yaml` mudou só em um texto de descrição |
| `npx tsc --noEmit` | sem erros |
| `npm run build` | OK |
| `verificar_banco` (banco de desenvolvimento, somente leitura) | 14 verificações: 12 OK, 2 avisos esperados, 0 erros |
| e2e N01 a N09 (desktop, 1 worker, sem trace, um por vez) | **aprovados** (N01 9 testes; N02 a N09 saída 0) |
| e2e N10 (painel admin) | **aprovado** (1 teste) |
| e2e N11 (moderação) | **aprovado** (1 teste) |
| e2e N12 (sessão) | **aprovado** (3 testes, inclusive o novo do AUD-F07) |
| e2e N13 (mobile 375 px) | **aprovado** (2 testes) |

Os 13 roteiros passaram. Uma primeira tentativa do N10 caiu por memória da máquina (Chromium "Target crashed",
não foi defeito de código); foi repetida com o banco e2e recriado e passou. N10 a N13 rodaram sem nenhuma alteração
de código depois de N01 a N09, por isso estes não foram reexecutados.

## 6. Percurso extra: console, 375 px e 1920 px

Não executado nesta rodada (ficou como pendência opcional).
