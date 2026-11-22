# PlaceMatch

Plataforma web que conecta pessoas compatíveis para dividir moradia, usando um score de compatibilidade calculado a partir de hábitos, rotina, orçamento, localização e preferências de convivência.

| | |
|---|---|
| **Instituição** | UNINASSAU — Ciência da Computação, turma 8 NA |
| **Disciplinas** | Fábrica de Software e Tópicos Avançados (2026.2) |
| **Equipe** | Grupo 07 (integrantes e papéis em [Equipe](#equipe)) |
| **Versão** | v1.0.0 (versão final) |
| **Documentação** | Índice completo em [`docs/README.md`](./docs/README.md) |

## Objetivo da solução

Encontrar um colega de apartamento hoje é um processo manual e pouco confiável: grupos de WhatsApp, redes sociais e indicações, sem nenhum critério estruturado. O PlaceMatch reduz o "achismo": calcula um **score de compatibilidade** (0 a 100%) entre quem **procura uma vaga** e quem **oferece uma vaga**, aproxima as duas pessoas antes do primeiro contato e oferece chat, moderação e um painel administrativo para acompanhar o uso do sistema.

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Usuários e autenticação** | Cadastro (nome com espaços e acentos, e-mail único sem diferenciar maiúsculas, senha validada), login por e-mail com **limite de tentativas que falham** (5 por minuto por IP e 10 por hora por e-mail; `429` ao passar), JWT com renovação automática, logout que invalida o refresh e **recuperação de senha por e-mail** (link de 1 hora). O administrador só é criado por linha de comando. |
| **Perfis** | Um perfil por usuário: dados pessoais, orçamento, tipo de imóvel, fumante, pets, visitas, horário e escalas de hábitos. Quem oferece vaga preenche também o **anúncio** (título, descrição, até 5 fotos por URL). Criação, edição completa e exclusão. |
| **Descoberta** | Perfis do tipo oposto ordenados por score, com busca por texto e filtros (região, tipo de imóvel, pets, fumante, orçamento, score mínimo, ordenação). Algoritmo de 7 critérios: [`docs/algoritmo-compatibilidade.md`](./docs/algoritmo-compatibilidade.md). Cada card traz a afinidade entre as bios e os temas em comum; `GET /api/compatibilidade/{id}/` detalha o score critério a critério. |
| **Afinidade por IA: ThoLuk** | **ThoLuk, a IA de afinidade do PlaceMatch**: um modelo de linguagem **local** (multilíngue, 384 dimensões, sem PyTorch) que compara o significado das bios. O ThoLuk é o 7º critério do score (10%) e a fonte dos "temas em comum" (16 temas de convivência). Nenhum texto sai do servidor. Sem o modelo, o sistema segue com os 6 critérios. Veja [Afinidade por IA (ThoLuk)](#afinidade-por-ia-tholuk). |
| **Curtidas e matches** | Curtir ou recusar. Quando as duas pessoas se curtem, o match é criado com o score. |
| **Chat** | Conversa entre as duas pessoas de um match (até 1000 caracteres), não lidas, busca e atualização automática. |
| **Moderação** | Denúncias (spam, ofensivo, perfil falso, outro); o administrador resolve ou descarta e pode suspender/reativar contas. Conta suspensa não entra e some da descoberta, dos matches e do chat. |
| **Painel administrativo** | Dashboard (KPIs e séries), 5 relatórios com filtros, lista de usuários e exportação em CSV. |
| **Processamento em lote em paralelo** | O recálculo completo das compatibilidades divide a matriz de pares em blocos e usa vários núcleos (processos ou threads); `gerar_embeddings --workers` usa o paralelismo de dados do fastembed. Resultado idêntico ao sequencial, benchmark com speedup, eficiência e Lei de Amdahl. Veja [Processamento em paralelo](#processamento-em-paralelo). |
| **Logs** | Registro automático de 18 tipos de operação, com listagem filtrada e exportação. Senhas, textos de mensagens e textos testados no ThoLuk nunca são gravados. |

Perfis de acesso: `buscando_vaga`, `oferecendo_vaga` (cadastro pela tela "Criar conta") e `administrador` (somente pelo comando `criar_admin`; não participa de descoberta, curtidas nem chat).

## Tecnologias

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React + TypeScript | React 19.3 · TypeScript 5.9 |
| Build do frontend | Vite + Tailwind CSS | Vite 8.3 · Tailwind 4.3 |
| Backend | Django + Django REST Framework | Django 6.1.1 · DRF 3.18.1 |
| Autenticação | `djangorestframework-simplejwt` | 5.5.1 (access 1 h, refresh 7 dias) |
| Documentação da API | `drf-spectacular` (OpenAPI 3 + Swagger UI) | 0.30.0 |
| CORS | `django-cors-headers` | 4.9.0 |
| Banco de dados | PostgreSQL | 16 |
| Compatibilidade em lote | NumPy | 2.5 |
| Afinidade por IA (ThoLuk) | `fastembed` (ONNX Runtime) + modelo `paraphrase-multilingual-MiniLM-L12-v2` | fastembed 0.9.1 · onnxruntime 1.32 |
| Testes | `manage.py test` (SQLite em memória) · Playwright (e2e) | Playwright 1.65 |
| Contêineres | Docker + Docker Compose | — |
| Linguagens | Python 3.13 na imagem Docker (testado também com 3.14) · Node 22 na imagem Docker | — |

Versões exatas das dependências: [`backend/requirements.txt`](./backend/requirements.txt) e [`frontend/package.json`](./frontend/package.json).

## Requisitos para execução

- **Git**.
- **Docker Desktop** (PostgreSQL e, opcionalmente, backend e frontend).
- Sem Docker para o backend/frontend: **Python 3.12 ou superior** (exigência do Django 6.1) e **Node.js 20.19+ ou 22.12+** (exigência do Vite 8).

Os comandos estão em PowerShell (Windows). Em Linux/Mac, troque `Copy-Item` por `cp` e `venv\Scripts\activate` por `source venv/bin/activate`. No **Git Bash** (Windows), use `cp` e `source venv/Scripts/activate` (com barras normais: no Bash a `\` é caractere de escape).

## Instalação e configuração

```powershell
git clone <URL-do-repositório>
cd PlaceMatch

cd backend
Copy-Item .env.example .env        # edite SECRET_KEY e DB_PASSWORD
cd ..\frontend
Copy-Item .env.example .env
cd ..
```

`backend/.env` (modelo em [`backend/.env.example`](./backend/.env.example)):

| Variável | Descrição | Padrão do exemplo |
|---|---|---|
| `SECRET_KEY` | Chave do Django e do JWT. **Mínimo de 32 caracteres.** Com `DEBUG=False` a aplicação não sobe sem ela. | (definir) |
| `DEBUG` | **Padrão `False`** (se a variável não existir, a API sobe em modo seguro e exige `SECRET_KEY`). O desenvolvimento usa `DEBUG=True` no `backend/.env`, como no exemplo; o Docker e o e2e também definem `True`. | `True` |
| `ALLOWED_HOSTS` | Hosts permitidos | `localhost,127.0.0.1` |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Credenciais do PostgreSQL | `placematch` / `placematch_user` / (definir) |
| `DB_HOST` / `DB_PORT` | Fora do Docker: `localhost` e a porta publicada (5433). No Docker o compose usa `db:5432`. | `localhost` / `5433` |
| `ADMIN_EMAIL` / `ADMIN_SENHA` | Usados pelo comando `criar_admin` | (definir) |
| `LOGIN_LIMITE_IP` / `LOGIN_LIMITE_EMAIL` | Limite de tentativas de login **que falham** (`429` ao passar): por IP e por e-mail. Formato `N/min` ou `N/hour`; vazio ou `off` desliga. | `5/min` / `10/hour` |
| `PROXIES_CONFIAVEIS` | Quantos proxies confiáveis existem na frente da API (`0` = ignora o `X-Forwarded-For`). | `0` |
| `FRONTEND_URL` | Endereço do frontend usado no link do e-mail de recuperação de senha. | `http://localhost:5173` |
| `SENHA_LIMITE_EMAIL` / `SENHA_LIMITE_IP` | Pedidos de link de recuperação: por e-mail (`3/15min`) e por IP (`10/hour`). Acima do limite a API responde o mesmo `200`, sem enviar. Vazio ou `off` desliga. | `3/15min` / `10/hour` |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL` | SMTP para enviar o e-mail de recuperação. Sem `EMAIL_HOST`, o e-mail é impresso no console do servidor. | (vazio) / `587` / — / — / `True` / `PlaceMatch <nao-responda@placematch.local>` |
| `IA_HABILITADA` | Liga o 7º critério do score (Afinidade por IA). `False` = só os 6 critérios, com os pesos renormalizados. | `True` |
| `IA_MODELO_DIR` | Pasta do modelo de IA (baixado por `baixar_modelo_ia`). Vazio = `backend/.modelos/` (fora do git). | (vazio) |
| `IA_AQUECIMENTO` | Carrega o modelo em segundo plano quando o servidor (`runserver`/`gunicorn`) sobe, sem atrasar a subida; o status da IA mostra "Carregando" → "Disponível". Nunca roda em testes, `migrate` ou outros comandos. `False` = carrega no primeiro uso. | `True` |
| `PROCESSAMENTO_WORKERS` | Workers do `recalcular_compatibilidades` em paralelo (modos processos/threads). Vazio = `min(4, núcleos)`. Os workers não carregam o modelo do ThoLuk. | (vazio) |
| `PROCESSAMENTO_BENCHMARK_ARQUIVO` | Arquivo lido por `GET /api/admin/processamento/benchmark/`. Vazio = `docs/benchmark/paralelismo.json`. | (vazio) |
| `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_PROXY_SSL_HEADER`, `CORS_ALLOWED_ORIGINS` | Só para produção (veja "Implantação em produção"). | desligados |

`frontend/.env`: `VITE_API_URL`, a URL da API. Sem a variável, o frontend usa `http://127.0.0.1:8000` (o CORS do backend libera `localhost:5173` e `127.0.0.1:5173`).

Gere uma `SECRET_KEY` com `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## Configuração do banco de dados

O sistema usa **PostgreSQL 16**.

**Com Docker** (recomendado). O compose sobe o banco e a API, e as migrações rodam sozinhas:

```powershell
cd backend
docker compose up --build          # API em http://localhost:8000
# só o banco (para rodar o backend na sua máquina): docker compose up -d db
```

**Manual** (PostgreSQL já instalado): crie o banco e o usuário e ajuste `DB_*` no `.env`:

```sql
CREATE USER placematch_user WITH PASSWORD '<sua-senha>';
CREATE DATABASE placematch OWNER placematch_user;
```

Depois, com o ambiente Python pronto (veja [Como executar](#como-executar)):

```powershell
python manage.py migrate               # cria as tabelas e as restrições de integridade
python manage.py baixar_modelo_ia      # baixa (~230 MB, só na 1ª vez) e testa o modelo do ThoLuk
python manage.py gerar_embeddings      # embeddings das bios já existentes + recálculo dos scores
python manage.py verificar_banco       # confere a consistência dos dados (somente leitura)
```

`verificar_banco` aceita `--detalhes` (lista os ids afetados) e `--falhar` (termina com erro se houver problema grave). No Docker: `docker exec placematch_backend python manage.py verificar_banco`.

**Dados de demonstração** (opcionais). Use **somente em banco descartável ou local de desenvolvimento**, nunca em produção:

```powershell
python manage.py seed_demo                    # demonstração completa (idempotente)
python manage.py seed_demo --remover-outros   # apaga antes os usuários que não são seed nem administrador (ex.: contas do e2e)
```

O `seed_demo` cria, em um único comando:

1. perfis do Recife com fotos (`seed_perfis`), matches com score (`seed_matches`) e conversas (`seed_mensagens`);
2. datas espalhadas nos últimos 30 dias (cadastros, curtidas, matches e mensagens), para os gráficos do painel admin terem movimento;
3. uma curtida pendente, para demonstrar o interesse mútuo ao curtir de volta;
4. três denúncias (duas pendentes e uma procedente) e uma conta suspensa;
5. registros de log coerentes com esses dados;
6. os embeddings das bios (ThoLuk) e o recálculo dos scores. As 21 bios foram escritas para a demonstração: há pares com o mesmo interesse em palavras diferentes (Isabela × Henrique, culinária) e pares opostos (Mariana × Marcos, estudos × festas). Sem o modelo baixado, o seed avisa e segue com os 6 critérios.

Rodar de novo não duplica denúncias nem logs. Os comandos separados (`seed_perfis`, `seed_matches`, `seed_mensagens`) continuam disponíveis. Os usuários de demonstração usam e-mails do domínio fictício `@seed.pm`; a senha de demonstração está no código de `backend/perfis/management/commands/seed_perfis.py`. O `--remover-outros` **apaga contas reais**: use-o só no banco do e2e ou num banco local descartável.

Dicionário de dados e esquema: [`docs/banco-de-dados.md`](./docs/banco-de-dados.md) e [`docs/esquema.sql`](./docs/esquema.sql).

> Se o container do backend reiniciar com `password authentication failed`, veja o [runbook](./docs/runbook-docker.md#password-authentication-failed-for-user-placematch_user).

## Como executar

### Backend

**Tudo no Docker** (banco + API):

```powershell
cd backend
docker compose up --build          # http://localhost:8000
```

**Banco no Docker, backend na sua máquina:**

```powershell
cd backend
docker compose up -d db
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py baixar_modelo_ia  # modelo do ThoLuk (uma vez; depois funciona offline)
python manage.py runserver         # http://127.0.0.1:8000
```

No Docker, baixe o modelo uma vez com `docker exec placematch_backend python manage.py baixar_modelo_ia` (fica em `backend/.modelos/`, montado no container).

### Frontend

```powershell
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

Ou com Docker: `docker compose up --build` dentro de `frontend/`. O backend libera por CORS apenas `http://localhost:5173` e `http://127.0.0.1:5173`.

### Criar o administrador

```powershell
python manage.py criar_admin       # usa ADMIN_EMAIL / ADMIN_SENHA do .env; sem senha, gera uma e a exibe uma única vez
# Docker: docker exec placematch_backend python manage.py criar_admin
```

O administrador entra pela mesma tela de login e cai direto no painel.

## Testes

**Backend** (não precisa de Docker nem de PostgreSQL; usa SQLite em memória):

```powershell
cd backend
python manage.py test --settings=placematch.test_settings                     # suíte completa (use -v 2 para listar cada teste)
python manage.py makemigrations --check --dry-run --settings=placematch.test_settings   # "No changes detected"
python manage.py matriz_permissoes --settings=placematch.test_settings        # tabela rota × perfil de acesso (banco de teste efêmero)
python manage.py spectacular --validate --fail-on-warn --file ../docs/openapi.yaml --settings=placematch.test_settings
```

- `matriz_permissoes` cria um banco de teste temporário, chama as rotas da API como anônimo, `buscando_vaga`, `oferecendo_vaga` e `administrador` e imprime o status esperado e o obtido em cada combinação. O banco é destruído no final.
- `spectacular --validate` valida o schema OpenAPI e regrava `docs/openapi.yaml`. Se o arquivo mudar (`git diff docs/openapi.yaml`), versione a nova versão.

**Consistência do banco** (no banco configurado no `.env`; somente leitura):

```powershell
python manage.py verificar_banco               # relatório com as contagens de cada verificação (OK / AVISO / ERRO)
python manage.py verificar_banco --detalhes    # lista os ids afetados
python manage.py verificar_banco --falhar      # termina com código 1 se houver ERRO (útil em CI)
```

**Análise estática do backend** (ruff; configuração em `backend/ruff.toml`, revisão em [`docs/revisao-codigo.md`](./docs/revisao-codigo.md)):

```powershell
cd backend
pip install -r requirements-dev.txt            # requirements.txt + ruff (só desenvolvimento)
ruff check .                                   # "All checks passed!"
```

**Frontend** (testes dos gráficos, tipos e build; o projeto não tem script de lint):

```powershell
cd frontend
npm test
npx tsc --noEmit                                         # use também --noUnusedLocals --noUnusedParameters
npm run build
```

**Navegação (e2e, Playwright)** — 15 roteiros em desktop e mobile, com **banco descartável** próprio (container `placematch_e2e_db`, porta 5433); não toca no banco de desenvolvimento. Detalhes em [`frontend/e2e/README.md`](./frontend/e2e/README.md).

```powershell
cd frontend
npx playwright install chromium
Copy-Item e2e\.env.e2e.example e2e\.env.e2e    # edite as senhas; não é versionado
npm run e2e:db
npm run e2e                                    # ou: npm run e2e -- n06
npm run e2e:db:parar
```

Pare o frontend de desenvolvimento antes: o Playwright sobe a API (8001) e o frontend (5173). A campanha de testes está em [`docs/testes-sprint9.md`](./docs/testes-sprint9.md).

**CI no GitHub Actions:** backend, frontend e E2E isolados. Escopo, comandos e
limitações (modelo real de IA e deploy) em [`docs/ci.md`](./docs/ci.md).

**Prints da interface final** (`evidencias-rc`, fora do `npm run e2e`):

```powershell
cd frontend
npm run e2e:db                                 # banco descartável do e2e (recrie com e2e:db:parar + e2e:db para partir do zero)
npm run e2e:tour
```

O `e2e:tour` roda `seed_demo --remover-outros` **no banco descartável do e2e**, percorre o sistema em desktop (1366×768) e celular (375×812) e grava `frontend/e2e/evidencias-rc/` (`RC-01` a `RC-50` + `INDICE.md`; RC-43 a RC-50 mostram o ThoLuk e o processamento paralelo, com o modelo real; `TOUR_PRINTS=43-50 npm run e2e:tour` regera só essas). Depois gera `frontend/evidencias-rc.zip` com essa pasta e com `docs/execucoes-rc/` (saídas das verificações finais: testes do backend, `verificar_banco`, matriz de permissões, validação do OpenAPI, build e e2e).

## Afinidade por IA (ThoLuk)

**ThoLuk, a IA de afinidade do PlaceMatch.** Ele é a evolução prevista no documento de abertura ("similaridade vetorial usando embeddings de texto da biografia"). Na interface, aparece pelo nome: o critério "Afinidade de interesses (ThoLuk)", o selo "ThoLuk" e a aba "ThoLuk (IA)" do painel. No código, o app, as rotas, os campos JSON e as variáveis mantêm o nome técnico `ia` (`/api/admin/ia/...`, `afinidade_ia`, `IA_HABILITADA`). Detalhes, calibração e medições: [`docs/algoritmo-compatibilidade.md`, seção 11](./docs/algoritmo-compatibilidade.md#11-afinidade-por-ia-tholuk-7º-critério).

- **Modelo**: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384 dimensões, multilíngue), executado pelo `fastembed` com ONNX Runtime, **sem PyTorch e sem serviço externo**. O texto da bio nunca sai do servidor; a internet só é usada para baixar o modelo.
- **Embeddings**: ao criar ou editar o perfil, o texto "Sobre você" (+ título e descrição do anúncio, para quem oferece vaga) vira um vetor gravado em `ia_embeddingperfil`. Só é regerado quando o texto muda (hash). Textos com menos de 20 letras não geram embedding.
- **Score**: o 7º critério é o cosseno entre os dois vetores, calibrado para 0 a 1 (piso 0,20 e teto 0,65), com peso de 10%. Sem embedding em um dos perfis (ou com o ThoLuk desligado), o critério sai e os outros 6 pesos são renormalizados: **ninguém perde pontos por ter bio curta**.
- **Temas em comum**: 16 temas de convivência (culinária, estudos, música, festas, silêncio, pets...) que o ThoLuk identifica por classificação zero-shot.
- **Sem o modelo** (não baixado, sem internet na 1ª vez, arquivo corrompido): o erro vai para o log, o serviço fica "indisponível" e tudo continua funcionando com os 6 critérios. Nenhuma rota devolve 500; só o teste do painel responde 503.

Comandos (na ordem, dentro de `backend/`):

```powershell
python manage.py baixar_modelo_ia      # antes da apresentação: baixa, carrega e testa o modelo
python manage.py gerar_embeddings      # gera os que faltam e recalcula os scores (--forcar regera todos)
python manage.py verificar_banco       # avisa "perfis com bio suficiente sem embedding"
```

Rotas: `afinidade_ia` e `temas_em_comum` na Descoberta e no detalhe do perfil; `analise_ia` (temas do ThoLuk) no próprio perfil; `GET /api/compatibilidade/{perfil_id}/` (detalhamento dos 7 critérios); `GET /api/admin/ia/status/` e `POST /api/admin/ia/testar/` (administrador). Nos testes automatizados, um embedder falso e determinístico substitui o modelo (`IA_EMBEDDER=falso` em `placematch/test_settings.py`); só um teste usa o modelo real e é pulado se ele não estiver baixado.

## Processamento em paralelo

Os processamentos **em lote** usam vários núcleos; o uso normal (salvar perfil, Descoberta) não muda. Explicação (blocos, processos × threads, GIL, Lei de Amdahl) e resultados: [`docs/algoritmo-compatibilidade.md`, seção 12](./docs/algoritmo-compatibilidade.md#12-paralelismo).

- **Recálculo das compatibilidades**: carrega todos os perfis e embeddings uma vez em arrays NumPy, divide a matriz de pares em blocos de 256 × 256 e distribui entre workers (processos ou threads), que só fazem conta; o processo principal grava tudo em uma transação. Resultado **idêntico** ao sequencial com qualquer número de workers (testado). Se o pool falhar, refaz no sequencial com aviso no log.
- **Embeddings**: `gerar_embeddings --workers N` (padrão 2, máximo 3) usa o paralelismo de dados do fastembed. Cada worker carrega o modelo (~560 MB): com o processo principal, no máximo 4 processos com o modelo. Só é usado com 400+ textos pendentes e se houver memória livre.

```powershell
python manage.py recalcular_compatibilidades                          # --modo auto (padrão): threads a partir de 1 milhão de pares, senão sequencial
python manage.py recalcular_compatibilidades --modo processos --workers 2
python manage.py gerar_embeddings --workers 2
python manage.py benchmark_paralelismo                                # dados sintéticos em memória: não grava no banco
python manage.py benchmark_paralelismo --banco-descartavel            # + ponta a ponta (exige banco VAZIO)
```

O benchmark grava `docs/benchmark/paralelismo.json` (servido em `GET /api/admin/processamento/benchmark/`, administrador), `paralelismo.csv` e `paralelismo.png` (tempo × workers e speedup × workers). O gráfico precisa do `matplotlib` (`requirements-dev.txt`).

## Recuperação de senha

Fluxo: **login → "Esqueci minha senha" → e-mail → link → nova senha**.

1. Na tela de login, **Esqueci minha senha** (`?screen=esqueci-senha`) pede o e-mail. A API (`POST /api/auth/senha/solicitar/`) responde **sempre `200` com a mesma mensagem** ("Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha."), exista a conta ou não, para não revelar quais e-mails têm cadastro.
2. O e-mail (texto e HTML, em português) traz o link `{FRONTEND_URL}/?screen=redefinir-senha&uid=...&token=...`. O token usa o `default_token_generator` do Django: **vale por 1 hora** (`PASSWORD_RESET_TIMEOUT`) e **deixa de valer assim que a senha muda** (inclusive pelo próprio uso).
3. A tela **Nova senha** (`POST /api/auth/senha/redefinir/`) pede a senha duas vezes, com as mesmas regras do cadastro (mínimo de 8 caracteres, não só números, não muito comum, não parecida com os dados da conta). Senha fraca é recusada **sem gastar o link**. Link inválido, adulterado, expirado ou já usado mostra "Link inválido ou expirado" com atalho para pedir outro. O frontend tira `uid` e `token` da barra de endereço assim que os lê.
4. Ao redefinir, **todas as sessões abertas da conta são encerradas** (os refresh tokens vão para a lista de bloqueio) e o contador de tentativas de login do e-mail é zerado.

Decisões:

- **Conta suspensa** não recebe e-mail (a resposta continua igual) e um link antigo dela é recusado: a rota não contorna a suspensão. O pedido fica no log (`conta_suspensa`).
- **Administrador** ativo recupera a senha como qualquer usuário (a posse da caixa de e-mail é a prova de identidade); sem isso, só pela linha de comando.
- **Limites**: 3 pedidos por e-mail a cada 15 minutos e 10 por IP por hora, contando todos os pedidos (a conta existindo ou não). Acima disso a resposta é a mesma `200`, sem enviar.
- **Quem já está logado** e abre o link continua na tela de nova senha (as telas de recuperação são públicas, como login e cadastro); ao redefinir, a sessão daquela aba é encerrada junto com as demais.
- **Logs**: `SENHA_SOLICITADA` e `SENHA_REDEFINIDA` (rótulos em português no filtro da aba Logs). Nunca gravam senha, token, uid, e-mail digitado nem o link.

**Onde ver o link em desenvolvimento**: sem `EMAIL_HOST`, o Django imprime o e-mail no **console do servidor** (`runserver`) e, logo abaixo, uma linha `[DESENVOLVIMENTO] Link de redefinição de senha para ...` com o link inteiro, pronto para copiar (o corpo do e-mail sai com a codificação do MIME, com `=3D` e quebras de linha). No Docker: `docker compose logs -f backend`. No e2e, os e-mails ficam em arquivos na pasta temporária do sistema (`placematch-e2e-emails`).

**SMTP em produção** (valores só no `.env` do servidor, nunca no repositório): `EMAIL_HOST`, `EMAIL_PORT` (587), `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` (`True`) e `DEFAULT_FROM_EMAIL`; defina também `FRONTEND_URL` com o endereço público do frontend. Se o envio falhar, a API continua respondendo a mesma mensagem e o erro vai para o log do servidor.

## Implantação em produção

O `Dockerfile` e o `docker-compose.yml` do repositório são de **desenvolvimento** (`runserver`, código montado como volume). Para publicar:

1. **Variáveis**: `DEBUG=False` (ou omita: é o padrão), `SECRET_KEY` própria com 32+ caracteres, `ALLOWED_HOSTS` com o domínio, banco com senha forte e `CORS_ALLOWED_ORIGINS` com a URL do frontend (ex.: `https://app.exemplo.com`). Com `DEBUG=False` o Swagger (`/api/docs/`) fica restrito a administradores.
2. **Servidor de aplicação**: use `gunicorn` (ou outro servidor WSGI), nunca o `runserver`: `gunicorn placematch.wsgi:application --bind 0.0.0.0:8000 --workers 3` (inclua `gunicorn` nas dependências da imagem de produção). Rode `python manage.py migrate` na implantação (inclui as tabelas da lista de bloqueio dos tokens).
3. **HTTPS**: termine o TLS em um proxy reverso (nginx, Caddy, balanceador) e ative `SECURE_SSL_REDIRECT=True`, `SECURE_HSTS_SECONDS=31536000` (comece com um valor baixo), `SESSION_COOKIE_SECURE=True` e `CSRF_COOKIE_SECURE=True`. Se o proxy enviar `X-Forwarded-Proto: https`, defina `SECURE_PROXY_SSL_HEADER=True`.
4. **Proxy confiável e IP real (AUD-13)**: atrás de proxy, o IP do cliente só é confiável se o proxy sobrescrever o `X-Forwarded-For`. Informe em `PROXIES_CONFIAVEIS` quantos proxies existem (ex.: `1`); com `0` o cabeçalho é ignorado no limite de login. Os logs de auditoria (`logs/servicos.py`) gravam o primeiro IP do `X-Forwarded-For` quando ele é válido: faça o proxy descartar esse cabeçalho vindo do cliente, senão o IP registrado pode ser forjado.
5. **Limite de login com vários processos**: o contador usa o cache do Django (por padrão, memória de cada processo). Com mais de um processo ou servidor, configure um cache compartilhado (Redis ou banco) em `CACHES` para o limite valer para todos.
6. **Frontend**: `npm run build` e sirva `frontend/dist` por um servidor estático (com `VITE_API_URL` apontando para a API ao compilar).
7. **Sem seeds em produção**: `seed.py`, `seed_perfis` e `seed_demo` criam usuários de demonstração com senha conhecida.

## Estrutura do projeto

```
PlaceMatch/
├── backend/                 # API Django REST Framework
│   ├── placematch/          # settings, urls, validação, documentação da API (api_docs.py), exemplos reais
│   ├── usuarios/            # cadastro, login, /me, comandos criar_admin e matriz_permissoes
│   ├── perfis/              # perfil e anúncio, seed_perfis
│   ├── matches/             # compatibilidade (algoritmo/), curtidas, matches, descoberta
│   ├── chat/                # conversas e mensagens
│   ├── logs/                # histórico de operações
│   ├── painel/              # dashboard, relatórios, usuários, exportação CSV, verificar_banco
│   ├── moderacao/           # denúncias, suspensão e reativação
│   ├── ia/                  # Afinidade por IA (ThoLuk): modelo local, embeddings, temas, baixar_modelo_ia, gerar_embeddings
│   ├── scripts/             # geração dos exemplos reais e de docs/api.md
│   ├── Dockerfile, docker-compose.yml, requirements.txt, requirements-dev.txt, ruff.toml, .env.example
├── frontend/                # SPA React (src/App.tsx, src/api.ts, src/admin/), e2e/ (Playwright)
├── docs/                    # documentação técnica
└── README.md
```

## Documentação

Índice completo, com uma linha por arquivo: **[`docs/README.md`](./docs/README.md)**. Os principais:

| Documento | Conteúdo |
|---|---|
| [`docs/manual-usuario.md`](./docs/manual-usuario.md) · [`docs/manual-tecnico.md`](./docs/manual-tecnico.md) | Manual do usuário e manual técnico |
| [`docs/api.md`](./docs/api.md) | Referência de todos os endpoints, com exemplos reais |
| **[`/api/docs/`](http://localhost:8000/api/docs/)** | Swagger UI interativo (com botão **Authorize** para o token JWT). Fica aberto a todos só com `DEBUG=True`; com `DEBUG=False`, exige login de administrador |
| `/api/schema/` · [`docs/openapi.yaml`](./docs/openapi.yaml) | Schema OpenAPI 3 |
| [`docs/banco-de-dados.md`](./docs/banco-de-dados.md) | Dicionário de dados e regras protegidas no banco |
| [`docs/testes-sprint9.md`](./docs/testes-sprint9.md) | Campanha de testes e bugs corrigidos |
| [`docs/execucoes-rc/`](./docs/execucoes-rc/) | Saídas das verificações finais da v1.0.0 (833 testes, banco, permissões, OpenAPI, build, 15 roteiros e2e) |
| [`docs/auditoria-rc.md`](./docs/auditoria-rc.md) · [`docs/revisao-codigo.md`](./docs/revisao-codigo.md) | Auditorias da Release Candidate e revisão final do código (ruff, checklist por módulo, métricas) |
| [`docs/algoritmo-compatibilidade.md`](./docs/algoritmo-compatibilidade.md) | Fórmulas, pesos e benchmark do score; Afinidade por IA — ThoLuk (modelo, calibração, temas, desempenho, privacidade); paralelismo |
| [`docs/modulo-chat.md`](./docs/modulo-chat.md) · [`docs/runbook-docker.md`](./docs/runbook-docker.md) | Chat e operação com Docker |

## Versão

**v1.0.0 (versão final)**: inclui o ThoLuk, a IA de afinidade do PlaceMatch, visível na interface (painel "Por que vocês combinam", selo "ThoLuk" nos cards, temas no Meu Perfil e a aba "ThoLuk (IA)" do painel com status, laboratório e processamento paralelo). Versões anteriores: v1.0.0-rc1 e v1.0.0-rc2 (recuperação de senha por e-mail). As evidências estão em [`docs/execucoes-rc/`](./docs/execucoes-rc/) e em `frontend/evidencias-rc.zip`.

## EQUIPE

**Grupo 07** — turma 8 NA, Ciência da Computação, UNINASSAU. Disciplinas: Fábrica de Software e Tópicos Avançados (2026.2).

| Integrante | Papel |
|---|---|
| Laryssa Rayanne Souza Martins | Scrum Master |
| Matheus de Oliveira Lins Mendes Simes | Equipe de desenvolvimento |
| Rafael Ferreira dos Anjos | Equipe de desenvolvimento |
| Pedro Arthur Rodrigues | Equipe de desenvolvimento |
| Elizeu Leoncio Ferreira Junior | Equipe de desenvolvimento |
