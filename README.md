# PlaceMatch

Plataforma que conecta pessoas compatíveis para dividir moradia, usando um algoritmo de compatibilidade baseado em hábitos, rotina, orçamento, localização e preferências de convivência — reduzindo o "achismo" na hora de encontrar um colega de apartamento.

Projeto desenvolvido para as disciplinas de **Fábrica de Software** e **Tópicos Avançados** — UNINASSAU, 2026.2.

## Sobre o projeto

Encontrar um colega de apartamento compatível hoje é um processo manual e pouco confiável, feito por grupos de WhatsApp, redes sociais ou indicação, sem nenhum critério estruturado de compatibilidade. O PlaceMatch calcula um **score de compatibilidade** entre usuários a partir de hábitos, rotina, orçamento e localização, aproximando pessoas antes mesmo do primeiro contato.

Há dois tipos de usuário comum — quem **procura uma vaga** e quem **oferece uma vaga** (com anúncio do imóvel) — e um **administrador**, que acompanha o sistema por um painel e faz a moderação.

## Funcionalidades por módulo

| Módulo | O que faz |
|---|---|
| **Usuários e autenticação** | Cadastro (nome completo com espaços e acentos, e-mail único sem diferenciar maiúsculas, senha validada), login por e-mail, JWT com renovação automática, consulta do usuário logado. O administrador só é criado por linha de comando. |
| **Perfis** | Um perfil por usuário: dados pessoais, orçamento (mínimo/máximo), tipo e tamanho do imóvel, fumante, pets, visitas, horário e quatro escalas de hábitos (1 a 5). Quem oferece vaga também preenche o **anúncio**: título, descrição, até 5 fotos do imóvel (por URL) e foto do proprietário. Criação em etapas, edição de todos os campos e exclusão com confirmação. |
| **Descoberta e compatibilidade** | Lista de perfis do tipo oposto ordenada pelo score, com busca por texto (nome, região, título) e filtros (região, tipo de imóvel, pets, fumante, faixa de orçamento, score mínimo, ordenação). Perfis já avaliados, já com match ou de contas suspensas não aparecem. O algoritmo tem 6 critérios ponderados — veja [`docs/algoritmo-compatibilidade.md`](./docs/algoritmo-compatibilidade.md). |
| **Curtidas e matches** | Curtir ou recusar um perfil. Quando as duas pessoas se curtem, o match é criado (com o score) e as duas veem a tela de "interesse mútuo". Lista de matches ordenada por score. |
| **Chat** | Conversa entre as duas pessoas de um match: mensagens de até 1000 caracteres, contagem de não lidas, busca de conversas e filtro "só não lidas", atualização automática (polling de 4 s). Menu do chat: ver perfil do outro participante e denunciar. |
| **Notificações** | Telas do aplicativo (sem endpoint próprio): novos matches desde a última visita à tela, e selo com a contagem no menu. |
| **Logs** | Registro automático de 15 tipos de operação (login, falha de login, cadastro, perfil, curtida, recusa, match, mensagem, exportação, denúncia, suspensão...). Mensagens e senhas nunca são gravadas. |
| **Painel, relatórios e exportação** | Dashboard (KPIs, atividade diária, top regiões, distribuição de score), **5 relatórios** com filtros e exportação CSV (matches, compatibilidade por região, atividade por dia, usuários, denúncias), lista de usuários, e histórico de logs com paginação e filtros — tudo exportável em CSV (UTF-8 com BOM, separador `;`). |
| **Moderação** | Qualquer usuário denuncia outro (spam, conteúdo ofensivo, perfil falso, outro) pelo chat ou pelo anúncio. O administrador analisa (procedente/improcedente), pode suspender a conta na mesma decisão e reativar depois. Conta suspensa não entra ("Conta suspensa. Procure o suporte."), some da descoberta, dos matches e do chat, e não recebe curtidas nem mensagens. |

## Perfis de acesso

| Perfil (`tipo`) | Como é criado | O que acessa |
|---|---|---|
| `buscando_vaga` | Cadastro pela tela "Criar conta" | Perfil próprio, Descoberta (vê perfis `oferecendo_vaga`), curtidas, matches, chat, notificações, denúncias |
| `oferecendo_vaga` | Cadastro pela tela "Criar conta" | Igual ao anterior, com o anúncio do imóvel; na Descoberta vê perfis `buscando_vaga` |
| `administrador` | Somente `python manage.py criar_admin` | Painel administrativo (`/api/admin/...`) e moderação. **Não participa** da Descoberta, curtidas, chat nem criação de perfil (HTTP 403) |

Telas e rotas sem login levam ao login; o painel admin só abre para o administrador. A matriz completa de permissões por rota pode ser gerada com `python manage.py matriz_permissoes` (veja [Testes](#testes)).

## Tecnologias e versões

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React + TypeScript (SPA) | React 19.3 · TypeScript 5.9 |
| Build/dev do frontend | Vite + Tailwind CSS 4 | Vite 8.3 · Tailwind 4.3 |
| Backend | Django + Django REST Framework | Django 6.1.1 · DRF 3.18.1 |
| Autenticação | JWT (`djangorestframework-simplejwt`) | 5.5.1 — access 1 h, refresh 7 dias com rotação |
| CORS | `django-cors-headers` | 4.9.0 |
| Banco de dados | PostgreSQL (Docker) | 16 |
| Processamento de compatibilidade | Python + NumPy (cálculo em lote) | NumPy 2.5 |
| Testes | `manage.py test` (SQLite em memória) · Playwright (e2e) | Playwright 1.65 |
| Contêineres | Docker + docker-compose | Docker 29 |
| Linguagens | Python 3.13 (imagem Docker; testado também com 3.14) · Node 22 (imagem Docker; testado também com 24) | — |

Dependências exatas: [`backend/requirements.txt`](./backend/requirements.txt) e [`frontend/package.json`](./frontend/package.json).

## Arquitetura

Frontend desacoplado: uma SPA em **React** consome a **API REST** em **Django REST Framework**, que concentra as regras de negócio e o cálculo de compatibilidade, trocando JSON com autenticação por **JWT**.

- O frontend guarda os tokens em `sessionStorage` (**uma sessão por aba**), renova o access automaticamente quando ele expira (uma única renovação por vez) e, se a renovação falhar, leva ao login com "Sua sessão expirou. Entre novamente.".
- A tela atual fica na URL (`?screen=...`) e no histórico do navegador: o botão voltar e o recarregar funcionam, e a sessão é restaurada a partir de `/api/auth/me/`. O chat guarda o id do match (`?screen=chat&match=<id>`) e reabre a mesma conversa ao recarregar.
- Documentação detalhada: [`docs/`](./docs) (veja [Documentação](#documentação)).

## Estrutura do projeto

```
PlaceMatch/
├── backend/                     # API Django REST Framework
│   ├── placematch/              # settings, urls, mensagens padrão em português, validação, utilitários de teste
│   ├── usuarios/                # modelo de usuário, cadastro, login, /me, comandos criar_admin e matriz_permissoes
│   ├── perfis/                  # perfil e anúncio (CRUD), comando seed_perfis
│   ├── matches/                 # compatibilidade (algoritmo/), curtidas, matches, descoberta, seeds e benchmark
│   ├── chat/                    # mensagens e conversas, comando seed_mensagens
│   ├── logs/                    # histórico de operações (modelo, serviço de registro, listagem e CSV)
│   ├── painel/                  # dashboard, relatórios, lista de usuários, filtros, exportação CSV e comando verificar_banco
│   ├── moderacao/               # denúncias, suspensão e reativação de contas
│   ├── seed.py                  # script de dados de demonstração completos (apenas desenvolvimento)
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── docker-compose.yml       # PostgreSQL 16 + backend
│   └── .env.example
├── frontend/                    # SPA React
│   ├── src/
│   │   ├── App.tsx              # telas do usuário, navegação por ?screen=, guarda de rotas, sessão
│   │   ├── api.ts               # acesso à API, renovação de token, erros em português
│   │   └── admin/               # painel administrativo (Painel, Relatórios, Logs, Usuários, Moderação)
│   ├── e2e/                     # testes de navegação (Playwright) e evidências (prints)
│   ├── Dockerfile
│   ├── docker-compose.yml       # servidor Vite
│   └── .env.example
├── docs/                        # documentação técnica (api, algoritmo, chat, runbook, testes)
└── README.md
```

## Como rodar o projeto

### Pré-requisitos

- **Git**.
- **Docker Desktop** (banco PostgreSQL e, opcionalmente, backend e frontend).
- Para rodar **sem Docker** o backend e o frontend: **Python 3.12 ou superior** (exigência do Django 6.1) e **Node.js 20.19+ ou 22.12+** (exigência do Vite 8; use 22 LTS).

Os comandos abaixo estão em PowerShell (Windows); em Linux/Mac, troque `Copy-Item` por `cp` e `venv\Scripts\activate` por `source venv/bin/activate`.

### 1. Clonar

```bash
git clone https://github.com/seu-usuario/PlaceMatch.git
cd PlaceMatch
```

### 2. Backend

#### Opção A — tudo no Docker (banco + API)

```powershell
cd backend
Copy-Item .env.example .env      # edite SECRET_KEY e DB_PASSWORD (veja a tabela de variáveis)
docker compose up --build
```

Sobe o PostgreSQL 16 e a API em `http://localhost:8000`; as migrações rodam sozinhas ao iniciar. Para comandos de gerenciamento, use `docker exec placematch_backend python manage.py <comando>`.

#### Opção B — banco no Docker, backend na sua máquina

```powershell
cd backend
Copy-Item .env.example .env      # DB_HOST=localhost e DB_PORT=5433 (padrão do exemplo)
docker compose up -d db          # só o PostgreSQL

python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver       # http://127.0.0.1:8000
```

### 3. Frontend

#### Opção A — Docker

```powershell
cd frontend
Copy-Item .env.example .env
docker compose up --build        # http://localhost:5173 (hot-reload)
```

A primeira construção leva alguns minutos (`npm ci` dentro da imagem).

#### Opção B — Node na sua máquina

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev                      # http://localhost:5173
```

O backend libera por CORS apenas `http://localhost:5173` e `http://127.0.0.1:5173`.

### 4. Variáveis de ambiente

`backend/.env` (modelo em [`backend/.env.example`](./backend/.env.example)):

| Variável | Descrição | Padrão do exemplo |
|---|---|---|
| `SECRET_KEY` | Chave do Django e de assinatura do JWT. **Mínimo de 32 caracteres.** Com `DEBUG=False` a aplicação não sobe sem ela. | (definir) |
| `DEBUG` | `True` em desenvolvimento | `True` |
| `ALLOWED_HOSTS` | Hosts permitidos | `localhost,127.0.0.1` |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Credenciais do PostgreSQL | `placematch` / `placematch_user` / (definir) |
| `DB_HOST` / `DB_PORT` | Fora do Docker: `localhost` e a porta publicada no host. No Docker o compose usa `db:5432` | `localhost` / `5433` |
| `ADMIN_EMAIL` / `ADMIN_SENHA` | Usados pelo comando `criar_admin` | `admin@placematch.com` / (gerada se vazia) |

`frontend/.env` (modelo em [`frontend/.env.example`](./frontend/.env.example)): `VITE_API_URL` — URL da API (padrão `http://localhost:8000`).

Gere uma `SECRET_KEY` com: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

### 5. Administrador e dados de demonstração

Com o backend configurado (e as migrações aplicadas):

```powershell
# Administrador (idempotente). Com ADMIN_SENHA no .env a senha não é exibida; sem ela, é gerada e mostrada uma única vez.
python manage.py criar_admin
# Docker: docker exec placematch_backend python manage.py criar_admin

# Dados de exemplo: 21 perfis, 15 matches e mensagens (idempotentes; senha de todos: Test@1234)
python manage.py seed_perfis
python manage.py seed_matches
python manage.py seed_mensagens
python manage.py recalcular_compatibilidades   # opcional: recalcula todos os scores
```

Logins de exemplo dos seeds: `ana@seed.pm` e `mariana@seed.pm` (buscando vaga), `beatriz@seed.pm` (oferecendo vaga) — senha `Test@1234`.

Há também um script alternativo de demonstração mais completa (20 usuários, 170 curtidas, 65 matches, mensagens e 5 denúncias): `python seed.py` (dentro de `backend/`). Ele imprime as credenciais ao final. **Use apenas em desenvolvimento:** cria contas com senhas fracas.

Depois de subir backend e frontend, abra `http://localhost:5173`, crie uma conta pela tela "Criar conta" ou entre com um dos logins acima. O administrador entra pela mesma tela de login e cai direto no painel.

> Se o container do backend ficar reiniciando com `password authentication failed`, veja o [runbook](./docs/runbook-docker.md#password-authentication-failed-for-user-placematch_user).

### 6. Testes

**Backend** (não precisa de Docker nem de PostgreSQL: usa SQLite em memória):

```powershell
cd backend
python manage.py test --settings=placematch.test_settings           # 560 testes
python manage.py matriz_permissoes --settings=placematch.test_settings   # matriz rota x perfil (anônimo, buscando, oferecendo, admin)
python manage.py makemigrations --check --dry-run --settings=placematch.test_settings   # deve dizer "No changes detected"
```

**Consistência dos dados** (somente leitura; use no banco que quiser conferir — no Docker: `docker exec placematch_backend python manage.py verificar_banco`):

```powershell
python manage.py verificar_banco               # relatório com contagens (órfãos, matches sem curtida mútua, pares duplicados/invertidos, compatibilidade faltando, mensagens de não participantes, perfis x tipo de usuário)
python manage.py verificar_banco --detalhes    # lista também os ids afetados
python manage.py verificar_banco --falhar      # termina com erro se houver problema de gravidade ERRO
```

**Frontend** (verificação de tipos e build):

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

**Navegação (e2e, Playwright)** — abre o sistema no Chromium e percorre 13 roteiros (desktop 1366x768 e mobile 375x812). Usa um **banco descartável** próprio (container `placematch_e2e_db`, porta 5433) e uma conta de administrador de teste; não toca no seu banco de desenvolvimento.

```powershell
cd frontend
npm install
npx playwright install chromium
Copy-Item e2e\.env.e2e.example e2e\.env.e2e   # edite as senhas; este arquivo NÃO é versionado
npm run e2e:db                                 # sobe o banco do e2e
npm run e2e                                    # todos os roteiros (~16 min) — ou: npm run e2e -- n06
npm run e2e:db:parar                           # apaga o banco do e2e
```

O Playwright sobe sozinho a API (porta 8001) e o frontend (porta 5173), então **pare o frontend de desenvolvimento antes**. Cada execução grava os prints em `frontend/e2e/evidencias/` (versionada) — descarte as mudanças se não quiser atualizá-las. Detalhes em [`frontend/e2e/README.md`](./frontend/e2e/README.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/api.md`](./docs/api.md) | Todos os endpoints: método, rota, permissão, parâmetros, respostas e erros |
| [`docs/algoritmo-compatibilidade.md`](./docs/algoritmo-compatibilidade.md) | Fórmulas, pesos, tabelas de similaridade e benchmark do score |
| [`docs/modulo-chat.md`](./docs/modulo-chat.md) | Chat: modelo, endpoints, regras de acesso e polling |
| [`docs/runbook-docker.md`](./docs/runbook-docker.md) | Operação com Docker e solução de problemas |
| [`docs/banco-de-dados.md`](./docs/banco-de-dados.md) | Dicionário de dados final (tabelas, colunas, tipos, restrições, índices) e as regras protegidas no banco |
| [`docs/esquema.sql`](./docs/esquema.sql) | Esquema real extraído do PostgreSQL (`pg_dump --schema-only`) |
| [`docs/testes-sprint9.md`](./docs/testes-sprint9.md) | Campanha de testes funcionais, de validação e de navegação, e bugs corrigidos |

## Desempenho

O cálculo de compatibilidade usa NumPy em lote, reduzindo as consultas ao banco de N+1 para 2, independentemente do número de perfis. Com 5.000 perfis, a versão em lote é **~61x mais rápida** que a versão em loop. Para repetir o benchmark:

```powershell
cd backend
python manage.py benchmark_compatibilidade --sem-banco   # só memória (~1 min)
python manage.py benchmark_compatibilidade               # completo (usa o banco)
```

> O benchmark **sobrescreve** os arquivos de resultado em `docs/benchmark/` com os números da sua máquina; restaure com `git checkout -- docs/benchmark` se não quiser trocá-los.

## Equipe

| Nome | Matrícula |
|---|---|
| Matheus de Oliveira Lins Mendes Simes | 01618966 |
| Laryssa Rayanne Souza Martins | 01612424 |
| Rafael Ferreira dos Anjos | 01579531 |
| Pedro Arthur Rodrigues | 01522993 |
| Elizeu Leôncio Ferreira Junior | 01576238 |

**Turma:** 8 NA — Ciência da Computação

## Histórico do projeto

| Sprint | Entrega |
|---|---|
| 2 e 3 | Banco conectado, autenticação JWT, cadastro, controle de perfis e CRUD |
| 4 | Validações de regra de negócio no backend e no frontend; erros da API junto ao campo |
| 5 | Algoritmo de compatibilidade, descoberta (curtir/recusar), matches e chat |
| 6 | Perfil expandido (horário, ruído, social, visitas, tipo de imóvel, moradores), algoritmo com 6 critérios, matches ordenados por score, seeds |
| D1 | Painel administrativo: dashboard, relatórios e registro automático de logs |
| D2 | Logs e usuários no painel, busca e filtros na descoberta, busca de conversas, anúncio do imóvel |
| Moderação | Denúncias, suspensão/reativação de contas e relatório de denúncias |
| 10 | Release candidate: restrições de integridade no banco (28 `CHECK` e e-mail único sem diferenciar maiúsculas), comando `verificar_banco`, dicionário de dados e esquema, filtro de datas das denúncias no backend, limite da descrição do imóvel, chat restaurado pela URL e remoção de dados fictícios das telas — veja [`docs/banco-de-dados.md`](./docs/banco-de-dados.md) |
| 9 | Campanha de testes (funcionais, validação e navegação), correção de 21 bugs do backend e dos defeitos de navegação do frontend, renovação de sessão, edição completa de perfil, formulário de anúncio e documentação atualizada — veja [`docs/testes-sprint9.md`](./docs/testes-sprint9.md) |
