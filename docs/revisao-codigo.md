# Revisão final do código — Sprint 11

Revisão feita em **20/11/2026** sobre a versão **v1.0.0-rc2** (branch `main`, commit `b3122a9`). Objetivo: deixar o código e o repositório organizados para a entrega, **sem mudar comportamento, contrato da API nem regra de negócio**. Esta revisão complementa as duas rodadas de auditoria da Release Candidate em [`auditoria-rc.md`](./auditoria-rc.md) (itens AUD-01 a AUD-20), que tratam de defeitos funcionais e de segurança. Aqui o foco é a qualidade do código e a organização do repositório.

## 1. Ferramentas usadas

| Ferramenta | Uso | Resultado final |
|---|---|---|
| **ruff 0.17.6** (`backend/requirements-dev.txt`, configuração em `backend/ruff.toml`) | Análise estática do backend: regras E4/E7/E9 + F (pyflakes: imports e variáveis não usados, nomes indefinidos), E722 (`except` sem tipo), BLE001 (`except Exception` genérico) e T20 (`print` esquecido). Ordenação de imports e regras de estilo ficaram **fora de propósito**: aplicá-las seria reformatação em massa. | `All checks passed!` (antes: 36 avisos) |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters` | Tipos e código não usado no frontend (`src/`) | 0 erros |
| `tsc` (modo estrito) sobre `frontend/e2e/*.ts` | Os roteiros e2e ficam fora do `tsconfig.json`; checados à parte | 0 erros |
| `git grep` | TODO/FIXME, `print(`, `console.log`, `debugger`, código comentado, URLs e credenciais fixas, `catch` vazio, `any` | Ver seção 3 |
| `git log -p --all` | Dados sensíveis no histórico (senhas, tokens, chaves, e-mails, matrículas) | Ver seção 7 |
| `manage.py test`, `makemigrations --check`, `spectacular --validate --fail-on-warn`, `npm run build`, Playwright (`e2e:tour`) | Verificação final | Ver seção 8 |

## 2. Checklist por módulo

| Módulo | O que foi verificado | Resultado |
|---|---|---|
| `backend/usuarios` | Cadastro, login (limite de tentativas), logout com blacklist, `/me`, recuperação de senha; senha `write_only`; mensagens dos validadores do Django traduzidas; rotas públicas com `AllowAny` explícito | OK. `except Exception` em `senha.py` é intencional (falha de SMTP nunca vira 500 nem revela se o e-mail existe) e registra o erro no logger |
| `backend/perfis` | CRUD do perfil e do anúncio; permissões `IsOwner` e `NaoAdministradorNaCriacao`; validação de URLs das fotos; mensagens em português | OK |
| `backend/matches` | Algoritmo (escalar e vetorial), curtidas, matches, descoberta; signals de recálculo; comandos de seed e benchmark | 2 imports não usados removidos; `;` em linha única separado; `except` do benchmark documentados (erro exibido com traceback / informação opcional do ambiente) |
| `backend/chat` | Conversas e mensagens só entre as duas pessoas do match; limite de 1000 caracteres | 1 import não usado removido (`seed_mensagens`) |
| `backend/moderacao` | Denúncias, decisão do administrador, suspensão/reativação | 3 imports não usados removidos (testes). `ValidationError` para tipo inválido em `servicos.py` é proposital (vira 400) |
| `backend/painel` | Dashboard, relatórios, usuários, CSV, `verificar_banco`; `AdminPermission` em todas as views | **3 `except Exception` trocados por `ObjectDoesNotExist`** (tratavam "usuário sem perfil" mas escondiam qualquer outra falha) |
| `backend/logs` | Registro de 17 ações; detalhes nunca guardam senha, token, link ou texto de mensagem; falha ao gravar log não derruba a operação (vai para o logger) | OK. 1 import não usado e 1 variável `l` ambígua corrigidos nos testes |
| `backend/placematch` | Settings (DEBUG seguro por padrão, `SECRET_KEY` ≥ 32 com `DEBUG=False`, CORS, e-mail, limites), handler de exceções em português, parser que recusa `\0`, documentação OpenAPI | OK. `testutils_sprint9.py`: `except Exception` → `except (ValueError, TypeError)` (só "corpo não é JSON" ou resposta 204 sem `Content-Type`) |
| `backend/scripts` | Geradores de `exemplos_api.py` e `docs/api.md` | `gerar_docs_markdown.py` tinha a versão (`1.0.0-rc1`) e as contagens (28 operações / 23 rotas) fixas no texto: agora lê `SPECTACULAR_SETTINGS['VERSION']` e conta as operações (31 / 26). `docs/api.md` regenerado (só essa linha mudou) |
| `frontend/src` | `api.ts` (renovação de token, mensagens de erro em português, `ApiError`), `App.tsx`, `ui.tsx`; nenhum `any`, nenhum `console.log`/`debugger`; `catch` vazios todos comentados | Comentário `/* silent */` em inglês trocado por explicação em português. Tokens em `sessionStorage` (escolha consciente: somem ao fechar a aba) |
| `frontend/src/admin` | Abas do painel, gráficos, error boundary (`console.error` intencional no `componentDidCatch`) | OK |
| `frontend/e2e` | 14 roteiros + tour; banco descartável próprio; `.env.e2e` fora do git; `console.log` só de progresso | OK |

## 3. Problemas encontrados e corrigidos

| Arquivo | Correção |
|---|---|
| `backend/chat/management/commands/seed_mensagens.py`, `logs/tests.py`, `matches/tests.py`, `moderacao/tests/test_fluxo_completo.py` (2), `moderacao/tests/test_funcionais_sprint9.py`, `painel/tests_painel.py`, `placematch/test_auditoria_rc.py`, `placematch/test_auditoria_rc2.py`, `usuarios/test_recuperacao_senha.py`, `seed.py` | 11 imports não usados removidos (`ruff --fix`, F401) |
| `backend/painel/views.py` | 3 × `except Exception` → `except ObjectDoesNotExist` (usuário sem perfil). O caso esperado continua igual; um erro inesperado deixa de ser mascarado como "sem perfil" |
| `backend/placematch/testutils_sprint9.py` | 2 × `except Exception` → `except (ValueError, TypeError)` |
| `backend/matches/management/commands/benchmark_compatibilidade.py` | 2 linhas com `;` separadas (E702); 2 `except Exception` intencionais marcados com `# noqa: BLE001` e o motivo |
| `backend/logs/tests.py`, `backend/painel/tests_painel.py` | Variável `l` (ambígua, E741) renomeada para `linha` |
| `backend/scripts/gerar_docs_markdown.py` + `docs/api.md` | Versão e contagens calculadas em vez de fixas (estavam desatualizadas) |
| `frontend/src/App.tsx` | Comentário `/* silent */` → explicação em português (sem mudança de código) |
| `backend/requirements.txt` | `numpy>=2.0,<3` → `numpy==2.5.4` (única dependência sem versão fixa) |
| `backend/requirements-dev.txt`, `backend/ruff.toml` | Novos: ferramenta de análise estática e configuração mínima |
| `backend/.env.example` | Documentadas `EMAIL_BACKEND` e `EMAIL_FILE_PATH` (usadas pelo código/e2e e ausentes do modelo); `ADMIN_EMAIL` de exemplo trocado de `admin@placematch.com` (domínio real de terceiros) para `admin@exemplo.com` |
| `.gitignore` | Acrescentados `.ruff_cache/` e `.claude/settings.local.json` |
| `README.md` | Bloco de identificação no topo, limite de tentativas de login nas funcionalidades, instruções para Git Bash, seção do ruff, links para `docs/README.md`, manuais, auditoria e esta revisão |
| `docs/README.md` | Novo: índice de toda a documentação |
| `frontend/e2e/evidencias-rc/RC-29`, `RC-30` | Prints do Swagger refeitas com a versão `1.0.0-rc2` (as outras 40 prints e o `INDICE.md` foram restaurados) |

## 4. Problemas mantidos (com justificativa)

| Item | Onde | Por que fica |
|---|---|---|
| `print` em testes | `matches/tests.py`, `moderacao/tests/test_fluxo_completo.py`, `placematch/testutils_sprint9.py` | Saída de progresso/evidência proposital (registrada em `docs/execucoes-rc/testes-backend.txt`). Liberado no `ruff.toml` só para esses arquivos |
| `print` em comandos e scripts | `*/management/commands/*`, `scripts/*`, `seed.py` | São ferramentas de terminal |
| E402 em `seed.py` | `backend/seed.py` | Precisa chamar `django.setup()` antes de importar os modelos |
| `except Exception` em `logs/servicos.py` e `usuarios/senha.py` | — | Proposital: falha ao gravar log ou ao enviar e-mail não pode derrubar a operação principal; o erro vai para o logger com traceback |
| `catch` vazios no frontend | `App.tsx` (sessionStorage, `URL`, contador de notificações, restauração de sessão), `api.ts` (falha de rede → `ApiError`) | Todos têm comentário ou tratamento equivalente; nenhum esconde erro que o usuário precise ver |
| URLs de desenvolvimento como padrão | `settings.py` (`FRONTEND_URL`, CORS `localhost:5173`, servidor do Swagger), `api.ts` (`127.0.0.1:8000`) | Padrões de desenvolvimento, todos sobrescritos por variável de ambiente (`FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `VITE_API_URL`) |
| Senhas fixas de demonstração | `seed.py`, `seed_perfis.py`, `matriz_permissoes.py`, `gerar_exemplos_api.py`, `tour-rc.spec.ts` | Já registrado como **AUD-20**: só para banco local/descartável; o README proíbe seeds em produção |
| Padrão `admin@placematch.com` no código | `usuarios/management/commands/criar_admin.py:18` | Mudar o padrão mudaria comportamento; o `.env.example` agora sugere `admin@exemplo.com`. Recomendação: sempre definir `ADMIN_EMAIL` |
| Avisos do conjunto padrão do ruff 0.17 (fora da configuração) | 261 avisos: `C408` (80, `dict()` em vez de `{}`), `RUF012` (73, atributos mutáveis de classe — padrão do Django/DRF em `Meta`, `list_display` etc.), `I001` (69, ordem de imports), `RUF100` (10), `RUF059` (7, variáveis desempacotadas não usadas em seeds/testes), `SIM115` (5, `open` sem `with` em scripts de execução única), `TRY004` (2, `ValidationError` proposital para devolver 400), `PLW1510` (2, `subprocess.run` em testes que conferem o `returncode`) e outros 13 | Estilo ou falso positivo. Corrigir seria reformatação em massa, fora do escopo desta revisão |
| Descrição do grupo "Autenticação" no Swagger | `settings.py` (`SPECTACULAR_SETTINGS['TAGS']`) | Diz "Cadastro, login por e-mail, renovação do token e usuário logado", sem citar logout e recuperação de senha (as rotas estão documentadas). Mudar exigiria regravar `openapi.yaml` e refazer a RC-29; fica para a próxima versão |
| `version` do `frontend/package.json` | `1.0.0` | Não é usado em tempo de execução; a versão oficial está no README e no OpenAPI (`1.0.0-rc2`) |
| Faixas `^` no `package.json` | `frontend/package.json` | As versões exatas estão fixadas no `package-lock.json` (instale com `npm ci` para reproduzir) |
| `App.tsx` com 3.695 linhas | `frontend/src/App.tsx` | Ver recomendação abaixo. Não foi refatorado agora para não mexer em comportamento às vésperas da entrega |

### Recomendação de divisão futura (sem refatorar agora)

O `App.tsx` concentra componentes básicos, 12 telas, 3 modais e o roteador. Proposta para a próxima versão, sem mudar comportamento (os e2e N01–N14 servem de rede de segurança):

| Novo arquivo | Conteúdo hoje em `App.tsx` (linhas aprox.) |
|---|---|
| `src/componentes/` | `Btn`, `Input`, `Tag`, `CompatBadge`, `ImagemComFallback`, `ScaleBar`, `CartaoSecao`, contadores, `ChipFiltro` (200–400) |
| `src/layout/AppShell.tsx` | `BottomNav`, `AppShell`, `BrandPanel` (400–650) |
| `src/telas/auth/` | `WelcomeScreen`, `LoginScreen`, `EsqueciSenhaScreen`, `RedefinirSenhaScreen`, `RegisterScreen` (650–1090) |
| `src/telas/perfil/` | Formulário em etapas (`Etapa*`, `Campo*`) e `ProfileCreateScreen`, `MyProfileScreen`, `DeleteProfileModal` (1090–1670, 3057–3275) |
| `src/telas/descoberta/` | `DiscoveryScreen`, `FiltersModal`, `ProfileDetailScreen`, `ReportModal` (1670–2410, 3275–3355) |
| `src/telas/matches/` | `NotificationsScreen`, `MatchScreen`, `MatchesScreen`, `ChatScreen` (2410–3057) |
| `src/App.tsx` | Só o roteamento de telas e o estado de sessão (≈ 300 linhas) |

`api.ts` (742 linhas) pode ser dividido por recurso (`api/auth.ts`, `api/perfis.ts`, `api/admin.ts`…) mantendo `fetchComAuth` num núcleo comum.

## 5. Métricas

### Linhas por módulo (arquivos `.py`, `.ts`, `.tsx` e `.css` versionados; sem migrações)

| Módulo | Arquivos | Linhas (sem testes) | Não vazias | Arq. de teste | Linhas de teste | Total com testes |
|---|---:|---:|---:|---:|---:|---:|
| `backend/usuarios` | 12 | 837 | 702 | 2 | 559 | 1.396 |
| `backend/perfis` | 11 | 949 | 852 | 2 | 365 | 1.314 |
| `backend/matches` | 19 | 1.634 | 1.361 | 3 | 1.252 | 2.886 |
| `backend/chat` | 10 | 407 | 337 | 3 | 766 | 1.173 |
| `backend/moderacao` | 7 | 449 | 374 | 4 | 1.091 | 1.540 |
| `backend/painel` | 10 | 1.191 | 998 | 4 | 1.291 | 2.482 |
| `backend/logs` | 7 | 277 | 235 | 2 | 391 | 668 |
| `backend/placematch` ¹ | 13 | 2.972 | 2.810 | 7 | 1.469 | 4.441 |
| `backend/scripts` | 3 | 615 | 545 | 0 | 0 | 615 |
| `backend` (raiz: `manage.py`, `seed.py`) | 2 | 320 | 261 | 0 | 0 | 320 |
| **Backend (total)** | **94** | **9.651** | **8.475** | **27** | **7.184** | **16.835** |
| `frontend/src` | 6 | 5.008 | 4.560 | 0 | 0 | 5.008 |
| `frontend/src/admin` | 7 | 1.613 | 1.449 | 0 | 0 | 1.613 |
| `frontend/e2e` | 0 | 0 | 0 | 18 | 2.456 | 2.456 |
| `frontend` (config: `vite.config.ts`) | 1 | 21 | 20 | 0 | 0 | 21 |
| **Frontend (total)** | **14** | **6.642** | **6.029** | **18** | **2.456** | **9.098** |

¹ Inclui `exemplos_api.py` (1.719 linhas **geradas** com as respostas reais da API) e `api_docs.py` (612 linhas de anotações do OpenAPI).

Maiores arquivos do frontend: `App.tsx` 3.695 · `api.ts` 742 · `ui.tsx` 486 · `admin/ModeracaoTab.tsx` 311 · `admin/RelatoriosTab.tsx` 286. Usos de `any`: **0**.

### Testes e migrações

| App | Testes (backend) | Migrações |
|---|---:|---:|
| `usuarios` | 68 | 4 |
| `perfis` | 46 | 6 |
| `matches` | 99 | 2 |
| `chat` | 60 | 3 |
| `moderacao` | 72 | 2 |
| `painel` | 161 | — |
| `logs` | 41 | 4 |
| `placematch` (testes transversais: auditorias, docs da API, correções) | 138 | — |
| **Total** | **685** | **21** |

Frontend: 14 roteiros e2e (30 testes, desktop e mobile) + o tour de prints da RC.

## 6. Organização do repositório

### Estrutura (até 3 níveis, sem `node_modules`, `venv`, `.venv`, `dist`)

```
PlaceMatch/
├── README.md                 # visão geral, execução, testes, equipe
├── .gitignore
├── backend/                  # API Django REST Framework
│   ├── placematch/           # projeto: settings, urls, exceções, validação, documentação OpenAPI
│   ├── usuarios/             # cadastro, login, logout, recuperação de senha; criar_admin, matriz_permissoes
│   ├── perfis/               # perfil e anúncio; seed_perfis, seed_demo
│   ├── matches/              # algoritmo/ (escalar e vetorial), curtidas, matches, descoberta; benchmark
│   ├── chat/                 # conversas e mensagens
│   ├── moderacao/            # denúncias e suspensão (tests/)
│   ├── painel/               # dashboard, relatórios, CSV, verificar_banco (tests/)
│   ├── logs/                 # histórico de operações
│   ├── scripts/              # geradores de exemplos reais e de docs/api.md
│   ├── seed.py, manage.py, requirements*.txt, ruff.toml, Dockerfile, docker-compose.yml, .env.example
├── frontend/                 # SPA React + TypeScript (Vite, Tailwind)
│   ├── src/                  # App.tsx, api.ts, ui.tsx, admin/, assets/
│   ├── public/               # favicon
│   ├── e2e/                  # Playwright: n01–n14, tour-rc, evidencias/, evidencias-rc/, fotos-demo/
│   ├── package.json, package-lock.json, vite.config.ts, tsconfig.json, Dockerfile, docker-compose.yml
└── docs/                     # documentação (índice em docs/README.md)
    ├── benchmark/            # dados brutos do benchmark do algoritmo
    └── execucoes-rc/         # saídas das verificações finais da rc2
```

Cada pasta tem propósito claro. `frontend/e2e/fotos-demo/` guarda as fotos usadas pelo `seed_demo` (o seed não depende de serviços externos).

### Arquivos versionados

`git ls-files` (400 arquivos): **nenhum** cache, build, `.pyc`, zip, log, resultado de teste, arquivo temporário ou `.env` versionado (só os modelos `.env.example`, `frontend/.env.example` e `frontend/e2e/.env.e2e.example`). Nenhum arquivo passa de 1 MB (o maior é `RC-33-mobile-detalhe.png`, 652 KB). As 143 imagens em `frontend/e2e/evidencias*/` são evidências de entrega e são versionadas de propósito. **Nenhum `git rm --cached` é necessário.**

### Branches e commits

- Remota: só `origin/main` (em dia com a `main` local). Tags: `v1.0.0-rc1`, `v1.0.0-rc2`.
- Branches **locais** de backup (não estão no GitHub): `backup/antes-do-anuncio` e `backup/antes-sprint7` já estão contidas na `main` (obsoletas); `backup/antes-da-rodada-numpy` tem 1 commit que não está na `main` (05/10/2026, "Ajustes em matches, algoritmo e UI de compatibilidade") — conferir antes de apagar.
- 65 commits na `main`:

| Tipo | Commits |
|---|---:|
| `feat` | 27 |
| `fix` | 10 |
| `docs` | 6 |
| `test` | 5 |
| `perf` | 3 |
| `chore` | 2 |
| `refactor` | 1 |
| `build` | 1 |
| merge de PR | 1 |
| fora do padrão Conventional Commits (Sprints 1–4) | 9 |

## 7. Dados sensíveis (código atual e histórico)

| # | Achado | Onde / commit | Situação | Recomendação |
|---|---|---|---|---|
| 1 | **Matrículas dos 5 integrantes** numa tabela "Nome / Matrícula" do README | Adicionadas em `cb29d58` (05/09/2026); removidas em `7658abd` (16/11/2026) | Fora do código atual, **mas continuam no histórico** público do GitHub | Avaliar com a equipe. Remover de vez exigiria reescrever o histórico (`git filter-repo`) e forçar push, o que invalida as tags e os clones de todos; não foi feito |
| 2 | E-mails pessoais dos autores nos metadados dos commits | Campo autor de 62 commits com 3 endereços pessoais (os outros 3 usam o `noreply` do GitHub) | Inerente ao git | Para os próximos commits, ativar "Keep my email addresses private" no GitHub e usar o endereço `noreply` em `git config user.email` |
| 3 | Credencial fraca de demonstração `admin@admin.com.br` / `123456` impressa pelo `seed.py` | Adicionada em `28166d8`; removida em `26f7b25` | Fora do código atual | Se algum ambiente ainda tiver um administrador com essa senha, trocá-la |
| 4 | Senhas fixas de demonstração (`seed_perfis`, `seed.py`, testes) | Código atual | Conhecido (AUD-20) | Nunca rodar seeds fora de banco local/descartável |
| 5 | Tokens JWT completos na saída dos testes | `docs/execucoes-rc/testes-backend.txt` (commits `76e1b6a`, `0f7f347`, `26f7b25`, `b3122a9`) | Assinados com a `SECRET_KEY` de teste num banco SQLite em memória, já destruído | Nenhuma ação: não valem em nenhum ambiente real |
| 6 | Chaves de exemplo/teste (`chave-somente-para-testes-…`, `chave-local-insegura-…`, `troque-por-…`) | `test_settings.py`, `settings.py`, `.env.example` | Valores fictícios; com `DEBUG=False` a aplicação recusa subir sem `SECRET_KEY` própria | Nenhuma ação |
| 7 | Domínio real de terceiros no e-mail de exemplo do administrador | `.env.example` (`admin@placematch.com`) | **Corrigido** para `admin@exemplo.com` | Sempre definir `ADMIN_EMAIL` real no `.env` |

Nenhuma senha real, token de serviço, chave de API, chave privada ou `.env` foi encontrado no código atual nem no histórico.

## 8. Verificação final

| Verificação | Resultado |
|---|---|
| `manage.py test --settings=placematch.test_settings` | **685 testes, OK** |
| `makemigrations --check --dry-run` | No changes detected |
| `spectacular --validate --fail-on-warn` | Sem erros nem avisos; `docs/openapi.yaml` sem alteração |
| `ruff check .` (backend) | All checks passed! |
| `tsc --noEmit` / `--noUnusedLocals --noUnusedParameters` | 0 erros |
| `npm run build` | OK (JS 395 kB, 109 kB gzip) |
| `npm run e2e:tour` | 1 teste OK; RC-29/RC-30 atualizadas |
| e2e N01–N14 | Não rodados: a única mudança no frontend é um comentário em `App.tsx` (nenhum roteiro afetado) |
