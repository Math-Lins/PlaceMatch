# Runbook — Rodando o PlaceMatch com Docker

Guia operacional para subir, parar e diagnosticar o backend (Django + PostgreSQL) e o frontend (Vite/React) via Docker.

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução
- Nenhuma outra dependência local — Python, Node e PostgreSQL rodam dentro dos containers

## Estrutura

```
PlaceMatch/
├── backend/
│   ├── Dockerfile
│   ├── docker-compose.yml    # serviços: db (Postgres 16) + backend (Django)
│   └── .env.example
└── frontend/
    ├── Dockerfile
    ├── docker-compose.yml    # serviço: frontend (Vite dev server)
    └── .env.example
```

## Primeira execução

### 1. Backend (sobe banco + API juntos)

```bash
cd backend

# Windows (PowerShell)
Copy-Item .env.example .env
# Linux / Mac
# cp .env.example .env

docker compose up --build
```

- API disponível em `http://localhost:8000`
- Migrações do Django são aplicadas automaticamente na subida
- O Postgres fica acessível externamente em `localhost:5433` (útil para conectar com clientes SQL ou rodar o Django fora do Docker)

### 2. Frontend (em outro terminal)

```bash
cd frontend

# Windows (PowerShell)
Copy-Item .env.example .env
# Linux / Mac
# cp .env.example .env

docker compose up --build
```

- Aplicação disponível em `http://localhost:5173`
- Hot-reload ativo: alterações em `frontend/src` refletem automaticamente

## Operações do dia a dia

| Ação | Comando (na pasta do serviço) |
|---|---|
| Subir em segundo plano | `docker compose up -d` |
| Subir com logs no terminal | `docker compose up` |
| Parar | `docker compose down` |
| Reiniciar um serviço | `docker compose restart backend` |
| Ver logs | `docker compose logs -f backend` |
| Rebuild após mudar dependências | `docker compose up --build` |
| Status dos containers | `docker compose ps` |

## Comandos úteis do Django (dentro do container)

```bash
cd backend

# Criar superusuário (admin)
docker compose exec backend python manage.py createsuperuser

# Rodar migrações manualmente
docker compose exec backend python manage.py migrate

# Criar novas migrações após alterar models
docker compose exec backend python manage.py makemigrations

# Shell do Django
docker compose exec backend python manage.py shell
```

## Variáveis de ambiente

### `backend/.env`

| Variável | Descrição | Padrão |
|---|---|---|
| `SECRET_KEY` | Chave secreta do Django | (definir) |
| `DEBUG` | Modo debug | `True` |
| `ALLOWED_HOSTS` | Hosts permitidos | `localhost,127.0.0.1` |
| `DB_NAME` | Nome do banco | `placematch` |
| `DB_USER` | Usuário do banco | `placematch_user` |
| `DB_PASSWORD` | Senha do banco | (definir) |
| `DB_HOST` | Host do banco **fora do Docker** | `localhost` |
| `DB_PORT` | Porta externa do banco | `5433` |

> Dentro do Docker, o compose sobrescreve `DB_HOST=db` e `DB_PORT=5432` automaticamente.

### `frontend/.env`

| Variável | Descrição | Padrão |
|---|---|---|
| `VITE_API_URL` | URL da API consumida pelo frontend | `http://localhost:8000` |

> Após alterar variáveis `VITE_*`, reinicie o frontend: `docker compose restart`.

## Problemas comuns

### `password authentication failed for user "placematch_user"`

O volume do Postgres guarda as credenciais da **primeira** criação. Se a senha do `.env` mudou, recrie o volume:

```bash
cd backend
docker compose down -v
docker compose up
```

> ⚠️ Isso apaga todos os dados do banco local.

### Porta já em uso (`port is already allocated`)

Outro processo está usando a porta 8000, 5173 ou 5433. Pare o processo conflitante ou ajuste a porta no `docker-compose.yml` / `.env`.

### Backend sobe antes do banco estar pronto

O compose já usa `depends_on` com `condition: service_healthy` — se ainda assim ocorrer erro de conexão, basta `docker compose restart backend`.

### Hot-reload do frontend não funciona no Windows

Verifique se o volume está montado corretamente (`docker compose ps`). Se persistir, adicione polling no `frontend/.env` e reinicie:

```env
CHOKIDAR_USEPOLLING=true
```

### Mudou `package.json` ou `requirements.txt`

Rebuild obrigatório:

```bash
docker compose up --build
```

## Verificação rápida de saúde

```bash
# Backend respondendo (esperado: 400 com erros de validação)
curl -X POST http://localhost:8000/api/auth/login/ -H "Content-Type: application/json" -d "{}"

# Frontend respondendo (esperado: 200)
curl http://localhost:5173
```
