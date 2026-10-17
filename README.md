# PlaceMatch

Plataforma que conecta pessoas compatíveis para dividir moradia, usando um algoritmo de compatibilidade baseado em hábitos, orçamento, localização e preferências de convivência — reduzindo o "achismo" na hora de encontrar um colega de apartamento.

Projeto desenvolvido para as disciplinas de **Fábrica de Software** e **Tópicos Avançados** — UNINASSAU, 2026.2.

## Sobre o projeto

Encontrar um colega de apartamento compatível hoje é um processo manual e pouco confiável, feito por grupos de WhatsApp, redes sociais ou indicação, sem nenhum critério estruturado de compatibilidade. O PlaceMatch propõe resolver isso calculando um **score de compatibilidade** entre usuários a partir de hábitos, rotina, orçamento e localização, aproximando pessoas antes mesmo do primeiro contato.

## Arquitetura

Frontend desacoplado: uma SPA em **React** consome uma **API REST** construída em **Django REST Framework**, que concentra toda a lógica de negócio e o núcleo de IA/processamento (módulo de compatibilidade). A comunicação acontece via HTTP, trocando dados em JSON, com autenticação por token.

Documentação completa da arquitetura, diagrama de classes, MER e modelo relacional: [`/docs`](./docs).

## Funcionalidades principais

- Cadastro e autenticação com diferentes perfis (buscando vaga, oferecendo vaga, administrador)
- Criação de perfil detalhado (hábitos, rotina, orçamento, preferências)
- **Algoritmo de compatibilidade** — núcleo de IA/processamento do projeto
- Descoberta de perfis no estilo "curtir/recusar", com match mútuo
- Chat entre usuários com match
- Filtros por região, orçamento e preferências
- Painel administrativo de moderação (denúncias e bloqueios)

## Tecnologias utilizadas

| Camada | Tecnologia |
|---|---|
| Frontend | React (SPA) |
| Backend | Django + Django REST Framework |
| Autenticação | Token / JWT (djangorestframework-simplejwt) |
| Banco de dados | PostgreSQL (via Docker) |
| IA / Processamento | Python puro (score ponderado) + NumPy (otimização) |
| Ambiente de banco | Docker + docker-compose |
| Versionamento | Git + GitHub |

## Estrutura do projeto

```
PlaceMatch/
├── backend/                   # API Django REST Framework
│   ├── placematch/            # configurações do projeto (settings, urls)
│   ├── usuarios/              # app: autenticação e controle de usuários
│   ├── perfis/                # app: perfis, CRUD principal
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── docker-compose.yml     # banco PostgreSQL + backend via Docker
│   └── .env.example           # variáveis de ambiente do backend
├── frontend/                  # aplicação React (SPA)
│   ├── src/
│   ├── package.json
│   ├── Dockerfile
│   ├── docker-compose.yml     # servidor Vite via Docker
│   └── .env.example           # variáveis de ambiente do frontend
├── docs/                      # documentação técnica (diagramas, MER)
├── .gitignore
└── README.md
```

## Como rodar o projeto localmente

> Runbook completo de operação com Docker (comandos, variáveis e troubleshooting): [`/docs/runbook-docker.md`](./docs/runbook-docker.md)

### Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

Para rodar sem Docker (modo manual), também é necessário:

- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.11+)

---

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/PlaceMatch.git
cd PlaceMatch
```

---

### 2. Backend (Django + PostgreSQL via Docker)

```bash
cd backend

# Windows (PowerShell)
Copy-Item .env.example .env
# Linux / Mac
# cp .env.example .env

docker compose up --build
```

Isso sobe o PostgreSQL 16 e a API Django (migrações aplicadas automaticamente).
API disponível em `http://localhost:8000`.

---

### 3. Frontend (React via Docker)

Em outro terminal:

```bash
cd frontend

# Windows (PowerShell)
Copy-Item .env.example .env
# Linux / Mac
# cp .env.example .env

docker compose up --build
```

Abre em `http://localhost:5173`. O dev server do Vite roda com hot-reload.

---

### Alternativa: rodar sem Docker

Com o banco subindo via Docker (`cd backend && docker compose up db`), rode o backend e o frontend manualmente:

**Backend:**

```powershell
cd backend
Copy-Item .env.example .env
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux / Mac

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**Frontend:**

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

---

### Endpoints disponíveis

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/auth/registrar/` | Cadastro de usuário |
| POST | `/api/auth/login/` | Login (retorna JWT) |
| POST | `/api/auth/login/refresh/` | Renovar token |
| GET | `/api/auth/me/` | Dados do usuário logado |
| GET | `/api/perfis/` | Listar perfis |
| POST | `/api/perfis/` | Criar perfil |
| GET | `/api/perfis/{id}/` | Detalhe de um perfil |
| PATCH | `/api/perfis/{id}/` | Atualizar perfil (só o dono) |
| DELETE | `/api/perfis/{id}/` | Excluir perfil (só o dono) |
| GET | `/api/descoberta/` | Perfis compatíveis ordenados por score |
| POST | `/api/curtidas/` | Curtir ou recusar um perfil |
| GET | `/api/matches/` | Listar matches do usuário logado |

### Dados de teste (seed)

Após rodar as migrações, popule o banco com perfis e matches de exemplo:

```bash
# Criar 21 perfis variados (15 buscando vaga + 6 oferecendo vaga)
docker exec placematch_backend python manage.py seed_perfis

# Criar 15 matches pré-populados entre pares de alta compatibilidade
docker exec placematch_backend python manage.py seed_matches
```

Senha de todos os seeds: `Test@1234`

Exemplos de login para teste:

| E-mail | Tipo | Melhores matches |
|---|---|---|
| `ana@seed.pm` | buscando vaga | Beatriz 96%, João 67% |
| `mariana@seed.pm` | buscando vaga | Beatriz 95%, Júlia 87% |
| `fernanda@seed.pm` | buscando vaga | Clara 90% |
| `beatriz@seed.pm` | oferecendo vaga | Ana 96%, Mariana 95% |

## Equipe

| Nome | Matrícula |
|---|---|
| Matheus de Oliveira Lins Mendes Simes | 01618966 |
| Laryssa Rayanne Souza Martins | 01612424 |
| Rafael Ferreira dos Anjos | 01579531 |
| Pedro Arthur Rodrigues | 01522993 |
| Elizeu Leôncio Ferreira Junior | 01576238 |

**Turma:** 8 NA — Ciência da Computação

## Status do projeto

✅ Sprint 2 e 3 concluídas — banco conectado, autenticação JWT, cadastro de usuários, controle de perfis e CRUD funcionando com deploy local.

✅ Sprint 4 concluída — validações de regra de negócio no backend e frontend:

**Backend:**
- Perfil: nome (mín. 2 chars), idade (18–100 anos), região (mín. 2 chars), bio (máx. 500 chars), orçamento mínimo e máximo maiores que zero, orçamento mínimo ≤ máximo (validação cruzada), tolerância à bagunça e nível de organização entre 1 e 5
- Usuário: `AUTH_PASSWORD_VALIDATORS` do Django efetivamente aplicados no cadastro (senha numérica, senha comum, comprimento mínimo), mensagem específica para e-mail duplicado

**Frontend:**
- Validação por campo antes do envio (formato de e-mail, comprimento mínimo de senha, orçamento, etc.)
- Erros da API (400) exibidos embaixo do campo correspondente, não como alerta genérico
- Tratamento de erro de rede com mensagem amigável ("Não foi possível conectar ao servidor...")

✅ Sprint 5 concluída — algoritmo de compatibilidade, descoberta e matches:

- Algoritmo de score ponderado (orçamento, região, hábitos, rotina, faixa etária)
- Tela de descoberta com curtir/recusar e match mútuo
- Tela de matches e chat entre usuários

✅ Sprint 6 concluída — matches funcionais, algoritmo expandido e UI de compatibilidade:

**Backend:**
- 6 novos campos no perfil: horário (madrugador/noturno/flexível), nível de ruído, nível social, frequência de visitas, tipo de imóvel e quantidade de moradores
- Algoritmo reescrito com 6 dimensões e pesos calibrados: orçamento 20%, região 10%, rotina 15%, hábitos 25%, estilo de moradia 10%, faixa etária 20%
- Matches ordenados por score decrescente na API
- Comandos de seed: `seed_perfis` (21 perfis) e `seed_matches` (15 matches pré-populados)

**Frontend:**
- Métrica de compatibilidade em 5 níveis a cada 20% (Baixa → Combinação perfeita), com barras coloridas e label em cada card de match
- Aba de matches atualiza automaticamente após novo match ou ao navegar para ela
- Tela de celebração com atalhos: iniciar conversa, ver matches ou continuar procurando
- Botão "Curtir perfil" no detalhe chama a API e redireciona corretamente
