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
| `SECRET_KEY` | Chave do Django e de assinatura do JWT. **Mínimo de 32 caracteres**; com `DEBUG=False` a aplicação não sobe sem ela | (definir) |
| `DEBUG` | Modo debug | `True` |
| `ALLOWED_HOSTS` | Hosts permitidos | `localhost,127.0.0.1` |
| `DB_NAME` | Nome do banco | `placematch` |
| `DB_USER` | Usuário do banco | `placematch_user` |
| `DB_PASSWORD` | Senha do banco | (definir) |
| `DB_HOST` | Host do banco **fora do Docker** | `localhost` |
| `DB_PORT` | Porta do banco publicada no host (`${DB_PORT}:5432`) e usada pelo Django fora do Docker | `5433` |
| `ADMIN_EMAIL` | E-mail do administrador criado por `criar_admin` | `admin@placematch.com` |
| `ADMIN_SENHA` | Senha do administrador (se vazia, o comando gera e mostra uma) | (opcional) |

> Dentro do Docker, o compose sobrescreve `DB_HOST=db` e `DB_PORT=5432` automaticamente.

### `frontend/.env`

| Variável | Descrição | Padrão |
|---|---|---|
| `VITE_API_URL` | URL da API consumida pelo frontend | `http://localhost:8000` |

> Após alterar variáveis `VITE_*`, reinicie o frontend: `docker compose restart`.

## Problemas comuns

### `password authentication failed for user "placematch_user"`

Sintoma: o container `placematch_backend` reinicia em loop (e consome CPU) com esse erro. O Postgres só lê `POSTGRES_PASSWORD` na **primeira** criação do volume; se a senha do `.env` mudou depois (ou o volume foi criado com outra), o banco continua com a senha antiga.

**Solução sem perder dados** — alinhe a senha do banco à do `.env`:

```bash
# na raiz do projeto (Git Bash)
PW=$(grep '^DB_PASSWORD=' backend/.env | cut -d= -f2- | tr -d '')
docker exec placematch_db psql -U placematch_user -d placematch -c "ALTER USER placematch_user PASSWORD '$PW'"
docker restart placematch_backend
```

O `psql` dentro do container usa `trust` em `127.0.0.1`, então esse comando funciona mesmo com a senha divergente. Para **testar** a senha de verdade, conecte por outro container na mesma rede (`docker run --rm --network backend_default -e PGPASSWORD=<senha> postgres:16 psql -h db -U placematch_user -d placematch -c "select 1"`).

**Alternativa que apaga os dados** — recriar o volume:

```bash
cd backend
docker compose down -v
docker compose up
```

> **Atenção:** isso apaga todos os dados do banco local.

### Migrações novas depois de um `git pull`

O container do backend roda `migrate` ao iniciar. Se ele já estava no ar: `docker exec placematch_backend python manage.py migrate`. Para conferir se falta migration nos modelos: `docker exec placematch_backend python manage.py makemigrations --check --dry-run` (esperado: "No changes detected").

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
# Backend respondendo (esperado: 400 {"email":["Informe o e-mail."],"password":["Informe a senha."]})
curl -X POST http://localhost:8000/api/auth/login/ -H "Content-Type: application/json" -d "{}"

# Frontend respondendo (esperado: 200)
curl http://localhost:5173
```

## Containers dos testes e2e

Os testes de navegação (`npm run e2e`, veja o README da raiz) usam o container **`placematch_e2e_db`** (PostgreSQL 16 em memória, porta `5433`), separado do banco de desenvolvimento. Subir: `npm run e2e:db`; apagar: `npm run e2e:db:parar` (ambos em `frontend/`). Como ele publica a porta `5433`, **não rode ao mesmo tempo** o banco de desenvolvimento com `DB_PORT=5433`: use `5432` no `backend/.env` ou pare o e2e antes.
