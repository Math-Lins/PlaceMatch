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
│   └── requirements.txt
├── frontend/                  # aplicação React (SPA)
│   ├── src/
│   └── package.json
├── docs/                      # documentação técnica (diagramas, MER)
├── docker-compose.yml         # banco PostgreSQL local via Docker
├── .env.example               # variáveis de ambiente (copiar para .env)
├── .gitignore
└── README.md
```

## Como rodar o projeto localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.11+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/PlaceMatch.git
cd PlaceMatch
```

---

### 2. Variáveis de ambiente

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / Mac
cp .env.example .env
```

Abra o `.env` e ajuste a senha do banco se quiser.

---

### 3. Banco de dados (PostgreSQL via Docker)

```bash
docker compose up -d
```

Isso sobe um PostgreSQL 16 local em container. Só precisa rodar uma vez — nas próximas vezes o Docker já sobe automaticamente.

---

### 4. Backend (Django)

```powershell
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux / Mac

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

API disponível em `http://localhost:8000`.

---

### 5. Frontend (React)

```powershell
cd frontend
npm install
npm run dev
```

Abre em `http://localhost:5173`.

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

✅ Sprint 2 e 3 concluída — banco conectado, autenticação JWT, cadastro de usuários, controle de perfis e CRUD funcionando com deploy local.
