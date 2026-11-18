# API REST — PlaceMatch

> Documento **gerado** por `backend/scripts/gerar_docs_api.py markdown` a partir das anotações do código (`backend/placematch/api_docs.py`) e de respostas **reais** da API. Não edite à mão: regenere (veja o final).

## Visão geral

API REST em JSON (Django REST Framework), versão **1.0.0-rc1**, com 28 operações em 23 rotas, organizadas em 7 grupos: Autenticação, Perfis, Descoberta e Matches, Chat, Moderação, Painel administrativo e Logs.

| Recurso | Onde |
|---|---|
| Documentação interativa (Swagger UI, com botão **Authorize**) | `<BASE>/api/docs/` |
| Schema OpenAPI 3 | `<BASE>/api/schema/` e [`docs/openapi.yaml`](./openapi.yaml) |
| Esta referência | `docs/api.md` |

**Acesso à documentação interativa:** com `DEBUG=True` (desenvolvimento) as páginas `/api/docs/` e `/api/schema/` são abertas; com `DEBUG=False` (produção) só um **administrador** logado as vê (sessão do Django em `/admin/` ou token JWT de administrador).

## URL base

Em desenvolvimento: `http://localhost:8000` (nos exemplos, `<BASE>`). Todas as rotas da API começam com `/api/`.

## Autenticação

1. **Obter o token:** `POST /api/auth/login/` com `email` e `password` devolve `access` e `refresh` (JWT).
2. **Enviar o token:** em toda chamada autenticada, cabeçalho `Authorization: Bearer <TOKEN>` (nos exemplos, `<TOKEN>` é o `access`).
3. **Validade:** o `access` dura **1 hora**; o `refresh`, **7 dias**.
4. **Renovar:** `POST /api/auth/login/refresh/` com o `refresh` devolve um novo `access` **e um novo `refresh`** (rotação): guarde o novo.
5. **Token ausente, inválido ou expirado** → `401`. Conta suspensa não consegue entrar (`401`, "Conta suspensa. Procure o suporte.") e seus tokens deixam de valer.

Somente `registrar`, `login` e `login/refresh` são públicos. O frontend guarda os tokens em `sessionStorage` (uma sessão por aba) e renova o `access` sozinho ao receber `401`.

**Perfis de acesso** (campo `tipo` do usuário): `buscando_vaga` e `oferecendo_vaga` ("usuário comum") e `administrador`. O administrador só é criado por `python manage.py criar_admin` e **não participa** de Descoberta, curtidas, chat nem criação de perfil (recebe `403`).

## Convenções

- **Formato:** JSON (`Content-Type: application/json`); as exportações devolvem CSV (UTF-8 com BOM, separador `;`).
- **Datas e horas:** filtros em `AAAA-MM-DD`; respostas em ISO 8601 com fuso (ex.: `2026-11-16T14:03:21.123456-03:00` ou `...Z`). Período inválido ou invertido → `400`.
- **Números:** valores monetários (`orcamento_*`) são decimais; nas respostas de perfil vêm como texto (`"800.00"`). O `score` de compatibilidade vai de `0` a `1`.
- **Ids:** `perfil_destino` (curtidas) e `{id}` de `/api/perfis/{id}/` são ids de **perfil**; `denunciado` e `{usuario_id}` (moderação) são ids de **usuário** (veja `usuario_id` e `usuario` nas respostas).
- **Paginação** (usuários e logs do painel): `?page=` (padrão 1) e `?page_size=` (padrão 20, máximo 100). Resposta: `{"count", "page", "results"}`. Valor inválido volta ao padrão; página além do fim devolve `results: []`.
- **Erros:** sempre em português. Dois formatos: `{"detail": "mensagem"}` (regra de negócio, permissão, filtro) e `{"campo": ["mensagem", ...]}` (validação por campo).
- **Listas longas** nos exemplos abaixo foram abreviadas (3 itens); tokens e senhas aparecem como `<TOKEN>`, `<REFRESH>` e `<SENHA>`.

## Códigos de resposta

| Código | Significado | Quando |
|---|---|---|
| `200` OK | Sucesso | Consultas e atualizações |
| `201` Created | Recurso criado | Cadastro, perfil, curtida, mensagem, denúncia |
| `204` No Content | Sucesso sem corpo | Exclusão de perfil |
| `400` Bad Request | Dados inválidos | Campo ausente/inválido, filtro inválido, regra de negócio, texto com caractere nulo (U+0000, no corpo JSON ou na query string) |
| `401` Unauthorized | Não autenticado | Sem token, token inválido/expirado, credenciais erradas, conta suspensa |
| `403` Forbidden | Sem permissão | Administrador em recurso de usuário, usuário comum em `/api/admin/`, perfil/match de outra pessoa |
| `404` Not Found | Não encontrado | Perfil, match, denúncia, usuário ou relatório inexistente; perfil de conta suspensa na consulta e na curtida |
| `500` | Erro interno | Não esperado: nenhuma entrada inválida deve gerar `500` |

## Índice de endpoints

| Grupo | Método | Rota | Quem pode | Função |
|---|---|---|---|---|
| Autenticação | `POST` | `/api/auth/registrar/` | Público (sem login) | Cadastrar usuário |
| Autenticação | `POST` | `/api/auth/login/` | Público (sem login) | Entrar (login por e-mail) |
| Autenticação | `POST` | `/api/auth/logout/` | Público (sem login) | Sair (encerrar a sessão) |
| Autenticação | `POST` | `/api/auth/login/refresh/` | Público (sem login) | Renovar o token de acesso |
| Autenticação | `POST` | `/api/auth/senha/solicitar/` | Público (sem login) | Pedir o link de redefinição de senha |
| Autenticação | `POST` | `/api/auth/senha/redefinir/` | Público (sem login) | Redefinir a senha com o link do e-mail |
| Autenticação | `GET` | `/api/auth/me/` | Qualquer usuário logado | Dados do usuário logado |
| Perfis | `GET` | `/api/perfis/` | Qualquer usuário logado | Listar o próprio perfil |
| Perfis | `POST` | `/api/perfis/` | Usuário comum (`buscando_vaga` ou `oferecendo_vaga`) | Criar o perfil |
| Perfis | `GET` | `/api/perfis/{id}/` | Qualquer usuário logado | Consultar um perfil |
| Perfis | `PUT` | `/api/perfis/{id}/` | Dono do perfil | Atualizar o perfil (completo) |
| Perfis | `PATCH` | `/api/perfis/{id}/` | Dono do perfil | Atualizar o perfil (parcial) |
| Perfis | `DELETE` | `/api/perfis/{id}/` | Dono do perfil | Excluir o perfil |
| Descoberta e Matches | `GET` | `/api/descoberta/` | Usuário comum (`buscando_vaga` ou `oferecendo_vaga`) | Descobrir perfis compatíveis |
| Descoberta e Matches | `POST` | `/api/curtidas/` | Usuário comum (`buscando_vaga` ou `oferecendo_vaga`) | Curtir ou recusar um perfil |
| Descoberta e Matches | `GET` | `/api/matches/` | Qualquer usuário logado | Listar os matches |
| Chat | `GET` | `/api/conversas/` | Usuário comum (`buscando_vaga` ou `oferecendo_vaga`) | Listar conversas |
| Chat | `GET` | `/api/matches/{match_id}/mensagens/` | Participante do match | Listar mensagens de um match |
| Chat | `POST` | `/api/matches/{match_id}/mensagens/` | Participante do match | Enviar mensagem |
| Moderação | `POST` | `/api/moderacao/denuncias/` | Usuário comum (`buscando_vaga` ou `oferecendo_vaga`) | Denunciar um usuário |
| Moderação | `GET` | `/api/admin/moderacao/denuncias/` | Somente administrador | Listar denúncias |
| Moderação | `PATCH` | `/api/admin/moderacao/denuncias/{denuncia_id}/` | Somente administrador | Resolver ou descartar uma denúncia |
| Moderação | `POST` | `/api/admin/moderacao/usuarios/{usuario_id}/suspender/` | Somente administrador | Suspender uma conta |
| Moderação | `POST` | `/api/admin/moderacao/usuarios/{usuario_id}/reativar/` | Somente administrador | Reativar uma conta |
| Painel administrativo | `GET` | `/api/admin/dashboard/` | Somente administrador | Dashboard |
| Painel administrativo | `GET` | `/api/admin/relatorios/` | Somente administrador | Catálogo de relatórios |
| Painel administrativo | `GET` | `/api/admin/relatorios/{rel_id}/` | Somente administrador | Gerar um relatório (JSON ou CSV) |
| Painel administrativo | `GET` | `/api/admin/usuarios/` | Somente administrador | Listar usuários |
| Painel administrativo | `GET` | `/api/admin/usuarios/exportar/` | Somente administrador | Exportar usuários (CSV) |
| Logs | `GET` | `/api/admin/logs/` | Somente administrador | Listar logs de operações |
| Logs | `GET` | `/api/admin/logs/exportar/` | Somente administrador | Exportar logs (CSV) |

## Autenticação

### `POST /api/auth/registrar/` — Cadastrar usuário

**Quem pode:** Público (sem login).  
**Operação (OpenAPI):** `auth_registrar`

Cria uma conta de usuário comum. O campo `username` recebe o **nome da pessoa** (2 a 150 caracteres; aceita espaços e acentos). O e-mail é gravado em minúsculas e é único sem diferenciar maiúsculas. A senha segue os validadores do Django (mínimo 8 caracteres, não só números, não muito comum). `administrador` não pode ser escolhido aqui (use `python manage.py criar_admin`). Depois do cadastro, faça o login e crie o perfil.

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `username` | texto | sim | Nome da pessoa: 2 a 150 caracteres, aceita espaços e acentos (gravado em `first_name`). |
| `email` | texto | sim | Formato de e-mail; único, sem diferenciar maiúsculas (gravado em minúsculas). |
| `password` | texto | sim | Mínimo 8 caracteres; não pode ser só números nem uma senha comum. |
| `tipo` | texto (opções) | sim | Tipo de conta. Valores: `buscando_vaga`, `oferecendo_vaga`. |

**Resposta de sucesso:** `201` — Usuário criado (a senha nunca é devolvida).

**Exemplo**

```bash
curl -X POST "<BASE>/api/auth/registrar/" \
  -H "Content-Type: application/json" \
  -d '{"username": "Ana Souza", "email": "ana.souza@exemplo.com", "password": "<SENHA>", "tipo": "buscando_vaga"}'
```

```json
HTTP 201
{
  "username": "Ana Souza",
  "email": "ana.souza@exemplo.com",
  "tipo": "buscando_vaga"
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | E-mail já cadastrado (sem diferenciar maiúsculas) | `{"email": ["Este e-mail já está cadastrado."]}` |
| `400` | Vários campos inválidos | `{"username": ["O nome deve ter pelo menos 2 caracteres."], "email": ["Informe um e-mail válido."], "password": ["A senha deve ter no mínimo 8 caracteres."], "tipo": ["Tipo de conta inválido. Use \"buscando_vaga\" ou \"oferecendo_vaga\"."]}` |
| `400` | Corpo vazio: campos obrigatórios | `{"username": ["O nome é obrigatório."], "email": ["O e-mail é obrigatório."], "password": ["A senha é obrigatória."], "tipo": ["O tipo de conta é obrigatório."]}` |

---

### `POST /api/auth/login/` — Entrar (login por e-mail)

**Quem pode:** Público (sem login).  
**Operação (OpenAPI):** `auth_login`

Autentica por e-mail e senha (e-mail sem diferenciar maiúsculas) e devolve os tokens JWT. Envie o `access` no cabeçalho `Authorization: Bearer <access>` das demais chamadas. Contas suspensas recebem 401 com a mensagem "Conta suspensa. Procure o suporte.". **Limite de tentativas:** só as tentativas que falham contam. Passando de 5 por minuto (mesmo IP) ou de 10 por hora (mesmo e-mail, sem diferenciar maiúsculas, exista a conta ou não), a resposta é `429` com o cabeçalho `Retry-After`. As taxas são configuráveis (`LOGIN_LIMITE_IP`, `LOGIN_LIMITE_EMAIL`). Login correto zera o contador do e-mail.

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `email` | texto | sim | E-mail do usuário (sem diferenciar maiúsculas). |
| `password` | texto | sim | Senha. |

**Resposta de sucesso:** `200` — Tokens de acesso e de renovação.

**Exemplo**

```bash
curl -X POST "<BASE>/api/auth/login/" \
  -H "Content-Type: application/json" \
  -d '{"email": "Ana.Souza@exemplo.com", "password": "<SENHA>"}'
```

```json
HTTP 200
{
  "refresh": "<REFRESH>",
  "access": "<TOKEN>"
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | E-mail e senha ausentes | `{"email": ["Informe o e-mail."], "password": ["Informe a senha."]}` |
| `401` | Senha incorreta ou usuário inexistente | `{"detail": "E-mail ou senha incorretos."}` |
| `401` | Conta suspensa | `{"detail": "Conta suspensa. Procure o suporte."}` |
| `429` | Tentativas demais (com `Retry-After`) | `{"detail": "Muitas tentativas. Aguarde alguns minutos e tente de novo."}` |

---

### `POST /api/auth/logout/` — Sair (encerrar a sessão)

**Quem pode:** Público (sem login).  
**Operação (OpenAPI):** `auth_logout`

Coloca o `refresh` na lista de bloqueio: ele deixa de servir para renovar o token. O `access` já emitido vale até expirar (1 hora). Não precisa de cabeçalho de autorização; a credencial é o próprio `refresh`. Chame ao sair; se falhar, o cliente pode sair mesmo assim.

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `refresh` | texto | sim | Token de renovação recebido no login. |

**Resposta de sucesso:** `204` — Sessão encerrada (sem corpo).

**Exemplo**

```bash
curl -X POST "<BASE>/api/auth/logout/" \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<REFRESH>"}'
```

```json
HTTP 204
(sem corpo)
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Refresh ausente | `{"refresh": ["Informe o refresh."]}` |
| `401` | Refresh inválido ou já encerrado | `{"detail": "O token é inválido ou já foi encerrado."}` |

---

### `POST /api/auth/login/refresh/` — Renovar o token de acesso

**Quem pode:** Público (sem login).  
**Operação (OpenAPI):** `auth_refresh`

Troca um `refresh` válido por um novo `access` e por um **novo `refresh`** (o refresh é rotacionado: guarde o novo). O refresh antigo é bloqueado ao ser trocado e também após o logout. O `access` dura 1 hora; o `refresh`, 7 dias.

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `refresh` | texto | sim | Token de renovação recebido no login. |

**Resposta de sucesso:** `200` — Novo access e novo refresh.

**Exemplo**

```bash
curl -X POST "<BASE>/api/auth/login/refresh/" \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<REFRESH>"}'
```

```json
HTTP 200
{
  "access": "<TOKEN>",
  "refresh": "<REFRESH>"
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `401` | Refresh inválido, expirado ou de conta suspensa | `{"detail": "O token é inválido", "code": "token_not_valid"}` |

---

### `POST /api/auth/senha/solicitar/` — Pedir o link de redefinição de senha

**Quem pode:** Público (sem login).  
**Operação (OpenAPI):** `auth_senha_solicitar`

Envia por e-mail um link para criar uma nova senha. A resposta é **sempre** `200` com a mesma mensagem, exista a conta ou não, esteja ela ativa ou suspensa e mesmo quando o limite de pedidos foi passado (assim a rota não revela quais e-mails têm conta). O e-mail só é enviado para **conta ativa** (o administrador ativo também pode recuperar a senha; conta suspensa não recebe). **Limites** (por pedido, exista a conta ou não): 3 por e-mail a cada 15 minutos e 10 por IP por hora; acima disso a resposta continua `200`, sem enviar (`SENHA_LIMITE_EMAIL` e `SENHA_LIMITE_IP`). O link é `{FRONTEND_URL}/?screen=redefinir-senha&uid=...&token=...`, vale por 1 hora e deixa de valer quando a senha muda. Em desenvolvimento o e-mail aparece no console do servidor.

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `email` | texto | sim | E-mail da conta (sem diferenciar maiúsculas). |

**Resposta de sucesso:** `200` — Mensagem neutra (igual para qualquer e-mail).

**Exemplo**

```bash
curl -X POST "<BASE>/api/auth/senha/solicitar/" \
  -H "Content-Type: application/json" \
  -d '{"email": "eva.martins@exemplo.com"}'
```

```json
HTTP 200
{
  "detail": "Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha."
}
```

**E-mail sem conta: mesma resposta**

```bash
curl -X POST "<BASE>/api/auth/senha/solicitar/" \
  -H "Content-Type: application/json" \
  -d '{"email": "ninguem@exemplo.com"}'
```

```json
HTTP 200
{
  "detail": "Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha."
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | E-mail ausente | `{"email": ["Informe o e-mail."]}` |
| `400` | E-mail mal formado | `{"email": ["Informe um e-mail válido."]}` |

---

### `POST /api/auth/senha/redefinir/` — Redefinir a senha com o link do e-mail

**Quem pode:** Público (sem login).  
**Operação (OpenAPI):** `auth_senha_redefinir`

Troca a senha usando o `uid` e o `token` do link. A nova senha segue as regras do cadastro. Link inválido, adulterado, expirado ou já usado (ou de conta suspensa) → `400` com a mesma mensagem. Se a senha for fraca, o `400` não gasta o link. No sucesso, **todas as sessões abertas do usuário são encerradas** (os refresh tokens vão para a lista de bloqueio) e o contador de tentativas de login do e-mail é zerado; é preciso entrar de novo com a nova senha.

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `uid` | texto | sim | Código do usuário recebido no link do e-mail (parâmetro `uid`). |
| `token` | texto | sim | Token recebido no link do e-mail (parâmetro `token`). |
| `nova_senha` | texto | sim | Nova senha (mesmas regras do cadastro: mínimo 8 caracteres, não só números, não muito comum). |

**Resposta de sucesso:** `200` — Senha redefinida.

**Exemplo**

```bash
curl -X POST "<BASE>/api/auth/senha/redefinir/" \
  -H "Content-Type: application/json" \
  -d '{"uid": "<UID>", "token": "<TOKEN_DO_LINK>", "nova_senha": "<SENHA>"}'
```

```json
HTTP 200
{
  "detail": "Senha redefinida. Entre com a nova senha."
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Link inválido, expirado ou já usado | `{"detail": "Link inválido ou expirado. Peça um novo link."}` |
| `400` | Senha fraca | `{"nova_senha": ["A senha deve ter no mínimo 8 caracteres."]}` |
| `400` | Campos ausentes | `{"uid": ["Informe o uid do link."], "token": ["Informe o token do link."], "nova_senha": ["Informe a nova senha."]}` |

---

### `GET /api/auth/me/` — Dados do usuário logado

**Quem pode:** Qualquer usuário logado.  
**Operação (OpenAPI):** `auth_me`

Devolve o usuário do token. `username` e `nome` trazem o nome de exibição (o nome informado no cadastro).

**Resposta de sucesso:** `200` — Usuário logado.

**Exemplo**

```bash
curl -X GET "<BASE>/api/auth/me/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
{
  "id": 2,
  "username": "Ana Souza",
  "nome": "Ana Souza",
  "email": "ana.souza@exemplo.com",
  "tipo": "buscando_vaga"
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |

---

## Perfis

### `GET /api/perfis/` — Listar o próprio perfil

**Quem pode:** Qualquer usuário logado.  
**Operação (OpenAPI):** `perfis_listar`

Devolve uma lista com o **próprio** perfil do usuário (vazia se ainda não criou). O administrador recebe todos os perfis.

**Resposta de sucesso:** `200` — Lista de perfis.

**Exemplo**

```bash
curl -X GET "<BASE>/api/perfis/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "id": 1,
    "usuario": 2,
    "nome": "Ana Souza",
    "idade": 24,
    "regiao": "Boa Viagem",
    "bio": "Estudante de Computação, rotina tranquila.",
    "orcamento_min": "700.00",
    "orcamento_max": "1200.00",
    "fumante": false,
    "aceita_pets": true,
    "tolerancia_bagunca": 2,
    "nivel_organizacao": 4,
    "perfil_horario": "flexivel",
    "nivel_ruido": 2,
    "nivel_social": 3,
    "aceita_visitas": "as_vezes",
    "tipo_imovel": "apartamento",
    "qtd_moradores": 2,
    "titulo_anuncio": "",
    "descricao_imovel": "",
    "fotos_imovel": [],
    "foto_perfil_url": ""
  }
]
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |

---

### `POST /api/perfis/` — Criar o perfil

**Quem pode:** Usuário comum (`buscando_vaga` ou `oferecendo_vaga`); o administrador recebe 403.  
**Operação (OpenAPI):** `perfis_criar`

Cria o perfil do usuário logado (um por usuário). Quem oferece vaga pode enviar também os campos do anúncio (`titulo_anuncio`, `descricao_imovel`, `fotos_imovel`, `foto_perfil_url`). Ao salvar, as compatibilidades com os perfis do tipo oposto são recalculadas.

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `nome` | texto | sim | 2 a 150 caracteres. |
| `idade` | inteiro | sim | 18 a 100. |
| `regiao` | texto | sim | 2 a 200 caracteres. |
| `bio` | texto | não | Até 500 caracteres. |
| `orcamento_min` | decimal | sim | Maior que 0, até 99999999.99; não pode passar de `orcamento_max`. |
| `orcamento_max` | decimal | sim | Maior ou igual a `orcamento_min`. |
| `fumante` | booleano | não | Padrão `false`. |
| `aceita_pets` | booleano | não | Padrão `false`. |
| `tolerancia_bagunca` | inteiro | não | 1 a 5 (padrão 3). |
| `nivel_organizacao` | inteiro | não | 1 a 5 (padrão 3). |
| `perfil_horario` | texto (opções) | não | `madrugador`, `noturno` ou `flexivel` (padrão). Valores: `madrugador`, `noturno`, `flexivel`. |
| `nivel_ruido` | inteiro | não | 1 a 5 (padrão 3). |
| `nivel_social` | inteiro | não | 1 a 5 (padrão 3). |
| `aceita_visitas` | texto (opções) | não | `raramente`, `as_vezes` (padrão) ou `frequentemente`. Valores: `raramente`, `as_vezes`, `frequentemente`. |
| `tipo_imovel` | texto (opções) | não | `apartamento`, `casa`, `republica` ou `indiferente` (padrão). Valores: `apartamento`, `casa`, `republica`, `indiferente`. |
| `qtd_moradores` | inteiro | não | 1 a 4 (padrão 2). |
| `titulo_anuncio` | texto | não | Até 120 caracteres (anúncio). |
| `descricao_imovel` | texto | não | Até 1000 caracteres (anúncio). |
| `fotos_imovel` | lista/objeto | não | Lista de até 5 URLs `http://` ou `https://` (até 500 caracteres cada). |
| `foto_perfil_url` | texto | não | URL `http://` ou `https://` (até 500 caracteres). |

**Resposta de sucesso:** `201` — Perfil criado.

**Exemplo**

```bash
curl -X POST "<BASE>/api/perfis/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"nome": "Ana Souza", "idade": 24, "regiao": "Boa Viagem", "bio": "Estudante de Computação, rotina tranquila.", "orcamento_min": 700, "orcamento_max": 1200, "fumante": false, "aceita_pets": true, "tolerancia_bagunca": 2, "nivel_organizacao": 4, "perfil_horario": "flexivel", "nivel_ruido": 2, "nivel_social": 3, "aceita_visitas": "as_vezes", "tipo_imovel": "apartamento", "qtd_moradores": 2}'
```

```json
HTTP 201
{
  "id": 1,
  "usuario": 2,
  "nome": "Ana Souza",
  "idade": 24,
  "regiao": "Boa Viagem",
  "bio": "Estudante de Computação, rotina tranquila.",
  "orcamento_min": "700.00",
  "orcamento_max": "1200.00",
  "fumante": false,
  "aceita_pets": true,
  "tolerancia_bagunca": 2,
  "nivel_organizacao": 4,
  "perfil_horario": "flexivel",
  "nivel_ruido": 2,
  "nivel_social": 3,
  "aceita_visitas": "as_vezes",
  "tipo_imovel": "apartamento",
  "qtd_moradores": 2,
  "titulo_anuncio": "",
  "descricao_imovel": "",
  "fotos_imovel": [],
  "foto_perfil_url": ""
}
```

**Perfil com anúncio**

```bash
curl -X POST "<BASE>/api/perfis/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"nome": "Bruno Lima", "idade": 29, "regiao": "Boa Viagem", "bio": "Dono do apartamento, trabalho em home office.", "orcamento_min": 800, "orcamento_max": 1300, "fumante": false, "aceita_pets": true, "tolerancia_bagunca": 2, "nivel_organizacao": 4, "perfil_horario": "flexivel", "nivel_ruido": 2, "nivel_social": 3, "aceita_visitas": "as_vezes", "tipo_imovel": "apartamento", "qtd_moradores": 2, "titulo_anuncio": "Quarto amplo a 5 minutos da praia", "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.", "fotos_imovel": ["https://exemplo.com/fotos/quarto.jpg", "https://exemplo.com/fotos/sala.jpg"], "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg"}'
```

```json
HTTP 201
{
  "id": 2,
  "usuario": 3,
  "nome": "Bruno Lima",
  "idade": 29,
  "regiao": "Boa Viagem",
  "bio": "Dono do apartamento, trabalho em home office.",
  "orcamento_min": "800.00",
  "orcamento_max": "1300.00",
  "fumante": false,
  "aceita_pets": true,
  "tolerancia_bagunca": 2,
  "nivel_organizacao": 4,
  "perfil_horario": "flexivel",
  "nivel_ruido": 2,
  "nivel_social": 3,
  "aceita_visitas": "as_vezes",
  "tipo_imovel": "apartamento",
  "qtd_moradores": 2,
  "titulo_anuncio": "Quarto amplo a 5 minutos da praia",
  "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
  "fotos_imovel": [
    "https://exemplo.com/fotos/quarto.jpg",
    "https://exemplo.com/fotos/sala.jpg"
  ],
  "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg"
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Campos inválidos | `{"idade": ["A idade mínima permitida é 18 anos."], "bio": ["A bio deve ter no máximo 500 caracteres (enviados: 501)."], "nivel_ruido": ["Certifique-se de que este valor seja inferior ou igual a 5."]}` |
| `400` | Usuário já tem perfil | `{"detail": "Você já possui um perfil."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Administrador não cria perfil | `{"detail": "O administrador não participa deste recurso."}` |

---

### `GET /api/perfis/{id}/` — Consultar um perfil

**Quem pode:** Qualquer usuário logado.  
**Operação (OpenAPI):** `perfis_consultar`

Permitido para: o próprio perfil, perfis do **tipo oposto** (os da Descoberta), perfis de quem tem match com você e o administrador. Qualquer outro caso → 403. Perfil de conta suspensa (de outra pessoa) → 404; só o administrador o enxerga.

**Parâmetros de rota**

| Parâmetro | Descrição |
|---|---|
| `id` | Id do **perfil**. |

**Resposta de sucesso:** `200` — Perfil.

**Exemplo** — Ana (buscando vaga) consulta o anúncio de Bruno (tipo oposto).

```bash
curl -X GET "<BASE>/api/perfis/2/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
{
  "id": 2,
  "usuario": 3,
  "nome": "Bruno Lima",
  "idade": 29,
  "regiao": "Boa Viagem",
  "bio": "Dono do apartamento, trabalho em home office.",
  "orcamento_min": "800.00",
  "orcamento_max": "1300.00",
  "fumante": false,
  "aceita_pets": true,
  "tolerancia_bagunca": 2,
  "nivel_organizacao": 4,
  "perfil_horario": "flexivel",
  "nivel_ruido": 2,
  "nivel_social": 3,
  "aceita_visitas": "as_vezes",
  "tipo_imovel": "apartamento",
  "qtd_moradores": 2,
  "titulo_anuncio": "Quarto amplo a 5 minutos da praia",
  "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
  "fotos_imovel": [
    "https://exemplo.com/fotos/quarto.jpg",
    "https://exemplo.com/fotos/sala.jpg"
  ],
  "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg"
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Perfil do mesmo tipo, sem match | `{"detail": "Você não tem permissão para acessar este perfil."}` |
| `404` | Perfil inexistente | `{"detail": "Perfil não encontrado."}` |

---

### `PUT /api/perfis/{id}/` — Atualizar o perfil (completo)

**Quem pode:** Dono do perfil.  
**Operação (OpenAPI):** `perfis_atualizar`

Substitui todos os campos do perfil. Somente o dono (outro usuário recebe 403).

**Parâmetros de rota**

| Parâmetro | Descrição |
|---|---|
| `id` | Id do **perfil**. |

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `nome` | texto | sim | 2 a 150 caracteres. |
| `idade` | inteiro | sim | 18 a 100. |
| `regiao` | texto | sim | 2 a 200 caracteres. |
| `bio` | texto | não | Até 500 caracteres. |
| `orcamento_min` | decimal | sim | Maior que 0, até 99999999.99; não pode passar de `orcamento_max`. |
| `orcamento_max` | decimal | sim | Maior ou igual a `orcamento_min`. |
| `fumante` | booleano | não | Padrão `false`. |
| `aceita_pets` | booleano | não | Padrão `false`. |
| `tolerancia_bagunca` | inteiro | não | 1 a 5 (padrão 3). |
| `nivel_organizacao` | inteiro | não | 1 a 5 (padrão 3). |
| `perfil_horario` | texto (opções) | não | `madrugador`, `noturno` ou `flexivel` (padrão). Valores: `madrugador`, `noturno`, `flexivel`. |
| `nivel_ruido` | inteiro | não | 1 a 5 (padrão 3). |
| `nivel_social` | inteiro | não | 1 a 5 (padrão 3). |
| `aceita_visitas` | texto (opções) | não | `raramente`, `as_vezes` (padrão) ou `frequentemente`. Valores: `raramente`, `as_vezes`, `frequentemente`. |
| `tipo_imovel` | texto (opções) | não | `apartamento`, `casa`, `republica` ou `indiferente` (padrão). Valores: `apartamento`, `casa`, `republica`, `indiferente`. |
| `qtd_moradores` | inteiro | não | 1 a 4 (padrão 2). |
| `titulo_anuncio` | texto | não | Até 120 caracteres (anúncio). |
| `descricao_imovel` | texto | não | Até 1000 caracteres (anúncio). |
| `fotos_imovel` | lista/objeto | não | Lista de até 5 URLs `http://` ou `https://` (até 500 caracteres cada). |
| `foto_perfil_url` | texto | não | URL `http://` ou `https://` (até 500 caracteres). |

**Resposta de sucesso:** `200` — Perfil atualizado.

**Exemplo**

```bash
curl -X PUT "<BASE>/api/perfis/1/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"nome": "Ana Souza", "idade": 24, "regiao": "Boa Viagem", "bio": "Estudante de Computação, rotina tranquila e gosta de cozinhar.", "orcamento_min": 700, "orcamento_max": 1250, "fumante": false, "aceita_pets": true, "tolerancia_bagunca": 2, "nivel_organizacao": 4, "perfil_horario": "flexivel", "nivel_ruido": 2, "nivel_social": 3, "aceita_visitas": "as_vezes", "tipo_imovel": "apartamento", "qtd_moradores": 2}'
```

```json
HTTP 200
{
  "id": 1,
  "usuario": 2,
  "nome": "Ana Souza",
  "idade": 24,
  "regiao": "Boa Viagem",
  "bio": "Estudante de Computação, rotina tranquila e gosta de cozinhar.",
  "orcamento_min": "700.00",
  "orcamento_max": "1250.00",
  "fumante": false,
  "aceita_pets": true,
  "tolerancia_bagunca": 2,
  "nivel_organizacao": 4,
  "perfil_horario": "flexivel",
  "nivel_ruido": 2,
  "nivel_social": 3,
  "aceita_visitas": "as_vezes",
  "tipo_imovel": "apartamento",
  "qtd_moradores": 2,
  "titulo_anuncio": "",
  "descricao_imovel": "",
  "fotos_imovel": [],
  "foto_perfil_url": ""
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Campo inválido | `{"idade": ["A idade mínima permitida é 18 anos."]}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Perfil de outra pessoa | `{"detail": "Você não tem permissão para executar essa ação."}` |
| `404` | Perfil inexistente | `{"detail": "Perfil não encontrado."}` |

---

### `PATCH /api/perfis/{id}/` — Atualizar o perfil (parcial)

**Quem pode:** Dono do perfil.  
**Operação (OpenAPI):** `perfis_atualizar_parcial`

Altera só os campos enviados. As regras cruzadas valem com os dados atuais (ex.: `orcamento_min` não pode passar de `orcamento_max`).

**Parâmetros de rota**

| Parâmetro | Descrição |
|---|---|
| `id` | Id do **perfil**. |

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `nome` | texto | sim | 2 a 150 caracteres. |
| `idade` | inteiro | sim | 18 a 100. |
| `regiao` | texto | sim | 2 a 200 caracteres. |
| `bio` | texto | não | Até 500 caracteres. |
| `orcamento_min` | decimal | sim | Maior que 0, até 99999999.99; não pode passar de `orcamento_max`. |
| `orcamento_max` | decimal | sim | Maior ou igual a `orcamento_min`. |
| `fumante` | booleano | não | Padrão `false`. |
| `aceita_pets` | booleano | não | Padrão `false`. |
| `tolerancia_bagunca` | inteiro | não | 1 a 5 (padrão 3). |
| `nivel_organizacao` | inteiro | não | 1 a 5 (padrão 3). |
| `perfil_horario` | texto (opções) | não | `madrugador`, `noturno` ou `flexivel` (padrão). Valores: `madrugador`, `noturno`, `flexivel`. |
| `nivel_ruido` | inteiro | não | 1 a 5 (padrão 3). |
| `nivel_social` | inteiro | não | 1 a 5 (padrão 3). |
| `aceita_visitas` | texto (opções) | não | `raramente`, `as_vezes` (padrão) ou `frequentemente`. Valores: `raramente`, `as_vezes`, `frequentemente`. |
| `tipo_imovel` | texto (opções) | não | `apartamento`, `casa`, `republica` ou `indiferente` (padrão). Valores: `apartamento`, `casa`, `republica`, `indiferente`. |
| `qtd_moradores` | inteiro | não | 1 a 4 (padrão 2). |
| `titulo_anuncio` | texto | não | Até 120 caracteres (anúncio). |
| `descricao_imovel` | texto | não | Até 1000 caracteres (anúncio). |
| `fotos_imovel` | lista/objeto | não | Lista de até 5 URLs `http://` ou `https://` (até 500 caracteres cada). |
| `foto_perfil_url` | texto | não | URL `http://` ou `https://` (até 500 caracteres). |

**Resposta de sucesso:** `200` — Perfil atualizado.

**Exemplo**

```bash
curl -X PATCH "<BASE>/api/perfis/1/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"bio": "Estudante de Computação, rotina tranquila e gosta de cozinhar.", "orcamento_max": 1250}'
```

```json
HTTP 200
{
  "id": 1,
  "usuario": 2,
  "nome": "Ana Souza",
  "idade": 24,
  "regiao": "Boa Viagem",
  "bio": "Estudante de Computação, rotina tranquila e gosta de cozinhar.",
  "orcamento_min": "700.00",
  "orcamento_max": "1250.00",
  "fumante": false,
  "aceita_pets": true,
  "tolerancia_bagunca": 2,
  "nivel_organizacao": 4,
  "perfil_horario": "flexivel",
  "nivel_ruido": 2,
  "nivel_social": 3,
  "aceita_visitas": "as_vezes",
  "tipo_imovel": "apartamento",
  "qtd_moradores": 2,
  "titulo_anuncio": "",
  "descricao_imovel": "",
  "fotos_imovel": [],
  "foto_perfil_url": ""
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Campo inválido | `{"idade": ["A idade mínima permitida é 18 anos."]}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Perfil de outra pessoa | `{"detail": "Você não tem permissão para executar essa ação."}` |
| `404` | Perfil inexistente | `{"detail": "Perfil não encontrado."}` |

---

### `DELETE /api/perfis/{id}/` — Excluir o perfil

**Quem pode:** Dono do perfil.  
**Operação (OpenAPI):** `perfis_excluir`

Exclui o perfil e, em cascata, suas curtidas, compatibilidades, matches e mensagens. Não há desfazer.

**Parâmetros de rota**

| Parâmetro | Descrição |
|---|---|
| `id` | Id do **perfil**. |

**Resposta de sucesso:** `204` — Perfil excluído (sem corpo).

**Exemplo**

```bash
curl -X DELETE "<BASE>/api/perfis/3/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 204
(sem corpo)
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Perfil de outra pessoa | `{"detail": "Você não tem permissão para executar essa ação."}` |
| `404` | Perfil inexistente | `{"detail": "Perfil não encontrado."}` |

---

## Descoberta e Matches

### `GET /api/descoberta/` — Descobrir perfis compatíveis

**Quem pode:** Usuário comum (`buscando_vaga` ou `oferecendo_vaga`); o administrador recebe 403.  
**Operação (OpenAPI):** `descoberta_listar`

Lista os perfis do **tipo oposto** com o score de compatibilidade (0 a 1), por score decrescente. Exige perfil criado. Não aparecem: o próprio perfil, perfis já avaliados, perfis já em match e contas suspensas.

**Parâmetros de consulta** (todos opcionais)

| Parâmetro | Tipo | Valores aceitos / descrição |
|---|---|---|
| `q` | texto | Texto: nome, região ou título do anúncio. |
| `regiao` | texto | Região exata. Repetível: `?regiao=A&regiao=B`. |
| `tipo_imovel` | texto | Valores: `apartamento`, `casa`, `republica`, `indiferente`. Tipo de imóvel. |
| `aceita_pets` | texto | Valores: `true`, `false`. Só perfis que aceitam (`true`) ou não (`false`) pets. |
| `fumante` | texto | Valores: `true`, `false`. Só perfis fumantes (`true`) ou não (`false`). |
| `orcamento_min` | decimal | Orçamento mínimo (0 a 99999999.99; NaN, infinito e negativos → 400). Filtra por interseção de faixas. |
| `orcamento_max` | decimal | Orçamento máximo (mesmas regras). |
| `score_min` | número | Compatibilidade mínima em % (0 a 100). |
| `ordenar` | texto | Valores: `score`, `orcamento_asc`, `orcamento_desc`. Ordenação. |

**Resposta de sucesso:** `200` — Perfis compatíveis (`score` de 0 a 1).

**Exemplo**

```bash
curl -X GET "<BASE>/api/descoberta/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "id": 2,
    "nome": "Bruno Lima",
    "idade": 29,
    "regiao": "Boa Viagem",
    "bio": "Dono do apartamento, trabalho em home office.",
    "orcamento_min": "800.00",
    "orcamento_max": "1300.00",
    "fumante": false,
    "aceita_pets": true,
    "tolerancia_bagunca": 2,
    "nivel_organizacao": 4,
    "perfil_horario": "flexivel",
    "nivel_ruido": 2,
    "nivel_social": 3,
    "aceita_visitas": "as_vezes",
    "tipo_imovel": "apartamento",
    "qtd_moradores": 2,
    "titulo_anuncio": "Quarto amplo a 5 minutos da praia",
    "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
    "fotos_imovel": [
      "https://exemplo.com/fotos/quarto.jpg",
      "https://exemplo.com/fotos/sala.jpg"
    ],
    "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg",
    "tipo": "oferecendo_vaga",
    "score": 0.9295,
    "usuario_id": 3
  },
  {
    "id": 3,
    "nome": "Carla Dias",
    "idade": 29,
    "regiao": "Casa Forte",
    "bio": "Dono do apartamento, trabalho em home office.",
    "orcamento_min": "800.00",
    "orcamento_max": "1300.00",
    "fumante": false,
    "aceita_pets": true,
    "tolerancia_bagunca": 2,
    "nivel_organizacao": 4,
    "perfil_horario": "flexivel",
    "nivel_ruido": 2,
    "nivel_social": 3,
    "aceita_visitas": "as_vezes",
    "tipo_imovel": "casa",
    "qtd_moradores": 2,
    "titulo_anuncio": "Casa com quintal",
    "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
    "fotos_imovel": [],
    "foto_perfil_url": "",
    "tipo": "oferecendo_vaga",
    "score": 0.7295,
    "usuario_id": 4
  }
]
```

**Com filtros**

```bash
curl -X GET "<BASE>/api/descoberta/?q=praia&regiao=Boa%20Viagem&aceita_pets=true&orcamento_max=1500&score_min=50&ordenar=orcamento_asc" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "id": 2,
    "nome": "Bruno Lima",
    "idade": 29,
    "regiao": "Boa Viagem",
    "bio": "Dono do apartamento, trabalho em home office.",
    "orcamento_min": "800.00",
    "orcamento_max": "1300.00",
    "fumante": false,
    "aceita_pets": true,
    "tolerancia_bagunca": 2,
    "nivel_organizacao": 4,
    "perfil_horario": "flexivel",
    "nivel_ruido": 2,
    "nivel_social": 3,
    "aceita_visitas": "as_vezes",
    "tipo_imovel": "apartamento",
    "qtd_moradores": 2,
    "titulo_anuncio": "Quarto amplo a 5 minutos da praia",
    "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
    "fotos_imovel": [
      "https://exemplo.com/fotos/quarto.jpg",
      "https://exemplo.com/fotos/sala.jpg"
    ],
    "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg",
    "tipo": "oferecendo_vaga",
    "score": 0.9295,
    "usuario_id": 3
  }
]
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Usuário ainda sem perfil | `{"detail": "Você precisa criar um perfil antes de acessar a descoberta."}` |
| `400` | Filtro inválido | `{"detail": "Valor inválido para aceita_pets. Use true ou false."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Administrador | `{"detail": "O administrador não participa deste recurso."}` |

---

### `POST /api/curtidas/` — Curtir ou recusar um perfil

**Quem pode:** Usuário comum (`buscando_vaga` ou `oferecendo_vaga`); o administrador recebe 403.  
**Operação (OpenAPI):** `curtidas_criar`

Registra a avaliação. Se a outra pessoa já tinha curtido você, o **match é criado** e a resposta traz `match: true` com `match_data`. Só vale para perfis do tipo oposto, uma vez por perfil. Perfil de conta suspensa → 404.

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `perfil_destino` | inteiro | sim | Id do PERFIL (não do usuário) a avaliar. |
| `tipo` | texto (opções) | sim | Ação. Valores: `curtir`, `recusar`. |

**Resposta de sucesso:** `201` — Avaliação registrada (sem match ainda).

**Exemplo**

```bash
curl -X POST "<BASE>/api/curtidas/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"perfil_destino": 2, "tipo": "curtir"}'
```

```json
HTTP 201
{
  "match": false
}
```

**Curtida mútua: match criado**

```bash
curl -X POST "<BASE>/api/curtidas/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"perfil_destino": 1, "tipo": "curtir"}'
```

```json
HTTP 201
{
  "match": true,
  "match_data": {
    "id": 1,
    "perfil_a": {
      "id": 1,
      "nome": "Ana Souza",
      "idade": 24,
      "regiao": "Boa Viagem",
      "bio": "Estudante de Computação, rotina tranquila e gosta de cozinhar.",
      "fumante": false,
      "aceita_pets": true,
      "tolerancia_bagunca": 2,
      "nivel_organizacao": 4,
      "orcamento_min": "700.00",
      "orcamento_max": "1250.00",
      "perfil_horario": "flexivel",
      "nivel_ruido": 2,
      "nivel_social": 3,
      "aceita_visitas": "as_vezes",
      "tipo_imovel": "apartamento",
      "qtd_moradores": 2,
      "titulo_anuncio": "",
      "descricao_imovel": "",
      "fotos_imovel": [],
      "foto_perfil_url": "",
      "tipo": "buscando_vaga",
      "usuario_id": 2
    },
    "perfil_b": {
      "id": 2,
      "nome": "Bruno Lima",
      "idade": 29,
      "regiao": "Boa Viagem",
      "bio": "Dono do apartamento, trabalho em home office.",
      "fumante": false,
      "aceita_pets": true,
      "tolerancia_bagunca": 2,
      "nivel_organizacao": 4,
      "orcamento_min": "800.00",
      "orcamento_max": "1300.00",
      "perfil_horario": "flexivel",
      "nivel_ruido": 2,
      "nivel_social": 3,
      "aceita_visitas": "as_vezes",
      "tipo_imovel": "apartamento",
      "qtd_moradores": 2,
      "titulo_anuncio": "Quarto amplo a 5 minutos da praia",
      "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
      "fotos_imovel": [
        "https://exemplo.com/fotos/quarto.jpg",
        "https://exemplo.com/fotos/sala.jpg"
      ],
      "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg",
      "tipo": "oferecendo_vaga",
      "usuario_id": 3
    },
    "score": 0.9295,
    "data_match": "2026-11-18T09:36:15.179370-03:00"
  }
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Perfil inexistente | `{"perfil_destino": ["O identificador \"999999\" não existe."]}` |
| `400` | Próprio perfil | `{"detail": "Você não pode curtir o seu próprio perfil."}` |
| `400` | Já avaliado | `{"detail": "Você já avaliou este perfil."}` |
| `400` | Campos ausentes | `{"perfil_destino": ["Este campo é obrigatório."], "tipo": ["Este campo é obrigatório."]}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Administrador | `{"detail": "Administradores não podem avaliar perfis."}` |
| `404` | Perfil de conta suspensa | `{"detail": "Perfil não encontrado."}` |

---

### `GET /api/matches/` — Listar os matches

**Quem pode:** Qualquer usuário logado.  
**Operação (OpenAPI):** `matches_listar`

Matches do usuário logado, por score decrescente. Matches com conta suspensa não aparecem. Sem perfil → lista vazia.

**Resposta de sucesso:** `200` — Matches (cada perfil traz os campos públicos).

**Exemplo**

```bash
curl -X GET "<BASE>/api/matches/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "id": 1,
    "perfil_a": {
      "id": 1,
      "nome": "Ana Souza",
      "idade": 24,
      "regiao": "Boa Viagem",
      "bio": "Estudante de Computação, rotina tranquila e gosta de cozinhar.",
      "fumante": false,
      "aceita_pets": true,
      "tolerancia_bagunca": 2,
      "nivel_organizacao": 4,
      "orcamento_min": "700.00",
      "orcamento_max": "1250.00",
      "perfil_horario": "flexivel",
      "nivel_ruido": 2,
      "nivel_social": 3,
      "aceita_visitas": "as_vezes",
      "tipo_imovel": "apartamento",
      "qtd_moradores": 2,
      "titulo_anuncio": "",
      "descricao_imovel": "",
      "fotos_imovel": [],
      "foto_perfil_url": "",
      "tipo": "buscando_vaga",
      "usuario_id": 2
    },
    "perfil_b": {
      "id": 2,
      "nome": "Bruno Lima",
      "idade": 29,
      "regiao": "Boa Viagem",
      "bio": "Dono do apartamento, trabalho em home office.",
      "fumante": false,
      "aceita_pets": true,
      "tolerancia_bagunca": 2,
      "nivel_organizacao": 4,
      "orcamento_min": "800.00",
      "orcamento_max": "1300.00",
      "perfil_horario": "flexivel",
      "nivel_ruido": 2,
      "nivel_social": 3,
      "aceita_visitas": "as_vezes",
      "tipo_imovel": "apartamento",
      "qtd_moradores": 2,
      "titulo_anuncio": "Quarto amplo a 5 minutos da praia",
      "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
      "fotos_imovel": [
        "https://exemplo.com/fotos/quarto.jpg",
        "https://exemplo.com/fotos/sala.jpg"
      ],
      "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg",
      "tipo": "oferecendo_vaga",
      "usuario_id": 3
    },
    "score": 0.9295,
    "data_match": "2026-11-18T09:36:15.179370-03:00"
  }
]
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |

---

## Chat

### `GET /api/conversas/` — Listar conversas

**Quem pode:** Usuário comum (`buscando_vaga` ou `oferecendo_vaga`); o administrador recebe 403.  
**Operação (OpenAPI):** `chat_conversas`

Uma conversa por match, da atividade mais recente para a mais antiga, com a última mensagem e a contagem de não lidas.

**Parâmetros de consulta** (todos opcionais)

| Parâmetro | Tipo | Valores aceitos / descrição |
|---|---|---|
| `q` | texto | Nome ou título do anúncio do outro perfil (sem diferenciar maiúsculas). |
| `nao_lidas` | texto | Valores: `true`, `false`. Com `true`, só conversas com mensagens não lidas. |

**Resposta de sucesso:** `200` — Conversas.

**Exemplo**

```bash
curl -X GET "<BASE>/api/conversas/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "match_id": 1,
    "outro_perfil": {
      "id": 2,
      "usuario_id": 3,
      "nome": "Bruno Lima",
      "idade": 29,
      "regiao": "Boa Viagem",
      "tipo": "oferecendo_vaga",
      "titulo_anuncio": "Quarto amplo a 5 minutos da praia",
      "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
      "fotos_imovel": [
        "https://exemplo.com/fotos/quarto.jpg",
        "https://exemplo.com/fotos/sala.jpg"
      ],
      "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg",
      "tipo_imovel": "apartamento",
      "qtd_moradores": 2,
      "orcamento_min": "800.00",
      "orcamento_max": "1300.00",
      "aceita_pets": true,
      "fumante": false
    },
    "score": 0.9295,
    "ultima_mensagem": {
      "conteudo": "Oi, Ana! Está sim. Quer visitar amanhã?",
      "data_envio": "2026-11-18T12:36:15.803928Z",
      "remetente_id": 2
    },
    "nao_lidas": 1
  }
]
```

**Com filtros**

```bash
curl -X GET "<BASE>/api/conversas/?q=bruno&nao_lidas=true" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "match_id": 1,
    "outro_perfil": {
      "id": 2,
      "usuario_id": 3,
      "nome": "Bruno Lima",
      "idade": 29,
      "regiao": "Boa Viagem",
      "tipo": "oferecendo_vaga",
      "titulo_anuncio": "Quarto amplo a 5 minutos da praia",
      "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
      "fotos_imovel": [
        "https://exemplo.com/fotos/quarto.jpg",
        "https://exemplo.com/fotos/sala.jpg"
      ],
      "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg",
      "tipo_imovel": "apartamento",
      "qtd_moradores": 2,
      "orcamento_min": "800.00",
      "orcamento_max": "1300.00",
      "aceita_pets": true,
      "fumante": false
    },
    "score": 0.9295,
    "ultima_mensagem": {
      "conteudo": "Oi, Ana! Está sim. Quer visitar amanhã?",
      "data_envio": "2026-11-18T12:36:15.803928Z",
      "remetente_id": 2
    },
    "nao_lidas": 1
  }
]
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Administrador | `{"detail": "O administrador não participa deste recurso."}` |

---

### `GET /api/matches/{match_id}/mensagens/` — Listar mensagens de um match

**Quem pode:** Participante do match.  
**Operação (OpenAPI):** `chat_mensagens_listar`

Mensagens em ordem cronológica. As mensagens do **outro** participante passam a `lida: true`. Contas suspensas continuam legíveis.

**Parâmetros de rota**

| Parâmetro | Descrição |
|---|---|
| `match_id` | Id do match. |

**Parâmetros de consulta** (todos opcionais)

| Parâmetro | Tipo | Valores aceitos / descrição |
|---|---|---|
| `apos` | inteiro | Devolve só mensagens com id maior que este (polling). Inteiro ≥ 0; outro valor → 400. |

**Resposta de sucesso:** `200` — Mensagens.

**Exemplo**

```bash
curl -X GET "<BASE>/api/matches/1/mensagens/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "id": 1,
    "match_id": 1,
    "remetente_id": 1,
    "conteudo": "Oi, Bruno! O quarto ainda está disponível?",
    "data_envio": "2026-11-18T09:36:15.718191-03:00",
    "lida": false
  },
  {
    "id": 2,
    "match_id": 1,
    "remetente_id": 2,
    "conteudo": "Oi, Ana! Está sim. Quer visitar amanhã?",
    "data_envio": "2026-11-18T09:36:15.803928-03:00",
    "lida": true
  }
]
```

**Só as novas (`?apos=1`)**

```bash
curl -X GET "<BASE>/api/matches/1/mensagens/?apos=1" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "id": 2,
    "match_id": 1,
    "remetente_id": 2,
    "conteudo": "Oi, Ana! Está sim. Quer visitar amanhã?",
    "data_envio": "2026-11-18T09:36:15.803928-03:00",
    "lida": true
  }
]
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | `apos` inválido | `{"detail": "O parâmetro \"apos\" inválido. Informe um número inteiro. Informe o número da última mensagem já recebida."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Não participa do match | `{"detail": "Você não tem acesso a este match."}` |
| `404` | Match inexistente | `{"detail": "Match não encontrado."}` |

---

### `POST /api/matches/{match_id}/mensagens/` — Enviar mensagem

**Quem pode:** Participante do match.  
**Operação (OpenAPI):** `chat_mensagens_enviar`

Envia uma mensagem de texto (1 a 1000 caracteres). Recusa conteúdo vazio, só espaços ou que não seja texto. Se o outro participante estiver com a conta suspensa → 403. Match que deixou de existir → 404.

**Parâmetros de rota**

| Parâmetro | Descrição |
|---|---|
| `match_id` | Id do match. |

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `conteudo` | texto | sim | Texto da mensagem (1 a 1000 caracteres; não pode ser só espaços). |

**Resposta de sucesso:** `201` — Mensagem criada.

**Exemplo**

```bash
curl -X POST "<BASE>/api/matches/1/mensagens/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"conteudo": "Oi, Bruno! O quarto ainda está disponível?"}'
```

```json
HTTP 201
{
  "id": 1,
  "match_id": 1,
  "remetente_id": 1,
  "conteudo": "Oi, Bruno! O quarto ainda está disponível?",
  "data_envio": "2026-11-18T09:36:15.718191-03:00",
  "lida": false
}
```

**Resposta da outra pessoa**

```bash
curl -X POST "<BASE>/api/matches/1/mensagens/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"conteudo": "Oi, Ana! Está sim. Quer visitar amanhã?"}'
```

```json
HTTP 201
{
  "id": 2,
  "match_id": 1,
  "remetente_id": 2,
  "conteudo": "Oi, Ana! Está sim. Quer visitar amanhã?",
  "data_envio": "2026-11-18T09:36:15.803928-03:00",
  "lida": false
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Conteúdo vazio ou só espaços | `{"detail": "O conteúdo da mensagem não pode ser vazio."}` |
| `400` | Mais de 1000 caracteres | `{"detail": "O conteúdo da mensagem não pode ter mais de 1000 caracteres."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Não participa do match | `{"detail": "Você não tem acesso a este match."}` |
| `404` | Match inexistente | `{"detail": "Match não encontrado."}` |

---

## Moderação

### `POST /api/moderacao/denuncias/` — Denunciar um usuário

**Quem pode:** Usuário comum (`buscando_vaga` ou `oferecendo_vaga`); o administrador recebe 403.  
**Operação (OpenAPI):** `moderacao_denunciar`

Cria uma denúncia `pendente`. `denunciado` é o id do **usuário** (campo `usuario_id` dos perfis). Não vale denunciar a si mesmo, nem denunciar de novo a mesma pessoa enquanto sua denúncia anterior estiver `pendente` (400).

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `denunciado` | inteiro | sim | Id do USUÁRIO denunciado (não do perfil). |
| `motivo` | texto (opções) | sim | Valores: `spam`, `ofensivo`, `falso`, `outro`. |
| `descricao` | texto | não | Detalhes (até 500 caracteres). |

**Resposta de sucesso:** `201` — Denúncia criada.

**Exemplo**

```bash
curl -X POST "<BASE>/api/moderacao/denuncias/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"denunciado": 4, "motivo": "spam", "descricao": "Anúncio repetido várias vezes."}'
```

```json
HTTP 201
{
  "id": 1,
  "denunciado": 4,
  "motivo": "spam",
  "status": "pendente",
  "criada_em": "2026-11-18T12:36:16.697460Z"
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Id e motivo inválidos | `{"detail": "O campo \"denunciado\" inválido. Informe um número inteiro."}` |
| `400` | Usuário inexistente | `{"detail": "Usuário denunciado não encontrado."}` |
| `400` | Autodenúncia | `{"detail": "Você não pode denunciar a si mesmo."}` |
| `400` | Já existe denúncia pendente sua contra este usuário | `{"detail": "Você já tem uma denúncia pendente contra este usuário. Aguarde a análise da equipe."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |

---

### `GET /api/admin/moderacao/denuncias/` — Listar denúncias

**Quem pode:** Somente administrador.  
**Operação (OpenAPI):** `moderacao_denuncias_listar`

Denúncias da mais recente para a mais antiga. Valores inválidos nos filtros → 400.

**Parâmetros de consulta** (todos opcionais)

| Parâmetro | Tipo | Valores aceitos / descrição |
|---|---|---|
| `status` | texto | Valores: `pendente`, `resolvida`, `descartada`. Situação. |
| `denunciado` | inteiro | Id do usuário denunciado. |
| `motivo` | texto | Valores: `spam`, `ofensivo`, `falso`, `outro`. Motivo. |
| `data_inicio` | data (`AAAA-MM-DD`) | Criadas a partir desta data (inclusive). Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |
| `data_fim` | data (`AAAA-MM-DD`) | Criadas até esta data (inclusive). Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |

**Resposta de sucesso:** `200` — Denúncias.

**Exemplo**

```bash
curl -X GET "<BASE>/api/admin/moderacao/denuncias/?status=pendente" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "id": 1,
    "denunciante": {
      "id": 2,
      "email": "ana.souza@exemplo.com"
    },
    "denunciado": {
      "id": 4,
      "email": "carla.dias@exemplo.com"
    },
    "motivo": "spam",
    "motivo_display": "Spam",
    "descricao": "Anúncio repetido várias vezes.",
    "status": "pendente",
    "resolvida_por": null,
    "resolucao": "",
    "criada_em": "2026-11-18T12:36:16.697460Z",
    "atualizada_em": "2026-11-18T12:36:16.697481Z"
  }
]
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Filtro inválido | `{"detail": "Status inválido. Use: pendente, resolvida, descartada."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Usuário comum | `{"detail": "Você não tem permissão para executar essa ação."}` |

---

### `PATCH /api/admin/moderacao/denuncias/{denuncia_id}/` — Resolver ou descartar uma denúncia

**Quem pode:** Somente administrador.  
**Operação (OpenAPI):** `moderacao_denuncia_resolver`

Só denúncias `pendente` podem ser decididas. `resolucao` é opcional (até 500 caracteres). Para suspender o usuário, use a rota de suspensão.

**Parâmetros de rota**

| Parâmetro | Descrição |
|---|---|
| `denuncia_id` | Id da denúncia. |

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `status` | texto (opções) | sim | Valores: `resolvida`, `descartada`. |
| `resolucao` | texto | não | Observação (até 500 caracteres). |

**Resposta de sucesso:** `200` — Denúncia decidida.

**Exemplo**

```bash
curl -X PATCH "<BASE>/api/admin/moderacao/denuncias/1/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status": "resolvida", "resolucao": "Anúncio duplicado; conta suspensa."}'
```

```json
HTTP 200
{
  "id": 1,
  "status": "resolvida",
  "resolucao": "Anúncio duplicado; conta suspensa.",
  "resolvida_por": "e2e-admin@teste.com"
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Denúncia já decidida | `{"detail": "Apenas denúncias pendentes podem ser resolvidas."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Usuário comum | `{"detail": "Você não tem permissão para executar essa ação."}` |
| `404` | Denúncia inexistente | `{"detail": "Denúncia não encontrada."}` |

---

### `POST /api/admin/moderacao/usuarios/{usuario_id}/suspender/` — Suspender uma conta

**Quem pode:** Somente administrador.  
**Operação (OpenAPI):** `moderacao_usuario_suspender`

Desativa a conta (`is_active=false`). O usuário não consegue entrar, some da Descoberta, dos matches e do chat, e não recebe curtidas nem mensagens. Não é possível suspender um administrador.

**Parâmetros de rota**

| Parâmetro | Descrição |
|---|---|
| `usuario_id` | Id do **usuário** (não do perfil). |

**Corpo de entrada** (JSON)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `motivo` | texto | não | Motivo (até 500 caracteres). |

**Resposta de sucesso:** `200` — Conta suspensa.

**Exemplo**

```bash
curl -X POST "<BASE>/api/admin/moderacao/usuarios/4/suspender/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"motivo": "Anúncios duplicados (denúncia procedente)."}'
```

```json
HTTP 200
{
  "id": 4,
  "email": "carla.dias@exemplo.com",
  "ativo": false
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Já estava suspensa | `{"detail": "Este usuário já está suspenso."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Usuário comum | `{"detail": "Você não tem permissão para executar essa ação."}` |
| `404` | Usuário inexistente | `{"detail": "Usuário não encontrado."}` |

---

### `POST /api/admin/moderacao/usuarios/{usuario_id}/reativar/` — Reativar uma conta

**Quem pode:** Somente administrador.  
**Operação (OpenAPI):** `moderacao_usuario_reativar`

Reativa a conta suspensa (`is_active=true`).

**Parâmetros de rota**

| Parâmetro | Descrição |
|---|---|
| `usuario_id` | Id do **usuário** (não do perfil). |

**Resposta de sucesso:** `200` — Conta reativada.

**Exemplo**

```bash
curl -X POST "<BASE>/api/admin/moderacao/usuarios/4/reativar/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
{
  "id": 4,
  "email": "carla.dias@exemplo.com",
  "ativo": true
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Já estava ativa | `{"detail": "Este usuário já está ativo."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Usuário comum | `{"detail": "Você não tem permissão para executar essa ação."}` |
| `404` | Usuário inexistente | `{"detail": "Usuário não encontrado."}` |

---

## Painel administrativo

### `GET /api/admin/dashboard/` — Dashboard

**Quem pode:** Somente administrador.  
**Operação (OpenAPI):** `painel_dashboard`

KPIs, séries diárias (matches, curtidas e mensagens), top regiões e distribuição de score. Período padrão: últimos 30 dias (aplicado às séries; os KPIs de curtidas e matches são acumulados). `taxa_match` = curtidas positivas que fazem parte de um match ÷ curtidas positivas × 100, sempre entre 0 e 100; as duas contagens usam o mesmo conjunto de curtidas (filtro de região/tipo aplicado ao perfil de origem da curtida).

**Parâmetros de consulta** (todos opcionais)

| Parâmetro | Tipo | Valores aceitos / descrição |
|---|---|---|
| `data_inicio` | data (`AAAA-MM-DD`) | Início do período. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |
| `data_fim` | data (`AAAA-MM-DD`) | Fim do período. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |
| `regiao` | texto | Filtra pelos perfis desta região. |
| `tipo` | texto | Valores: `buscando_vaga`, `oferecendo_vaga`, `administrador`. Filtra pelo tipo de usuário. |

**Resposta de sucesso:** `200` — Indicadores.

**Exemplo**

```bash
curl -X GET "<BASE>/api/admin/dashboard/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
{
  "kpis": {
    "usuarios_total": 6,
    "usuarios_por_tipo": {
      "oferecendo_vaga": 2,
      "buscando_vaga": 3,
      "administrador": 1
    },
    "usuarios_suspensos": 0,
    "perfis_total": 3,
    "curtidas_total": 2,
    "recusas_total": 1,
    "matches_total": 1,
    "taxa_match": 100.0,
    "mensagens_total": 2,
    "conversas_ativas": 1,
    "score_medio": 0.9295,
    "denuncias_pendentes": 0
  },
  "series": {
    "matches_por_dia": [
      {
        "data": "2026-10-20",
        "total": 0
      },
      {
        "data": "2026-10-21",
        "total": 0
      },
      {
        "data": "2026-10-22",
        "total": 0
      }
    ],
    "curtidas_por_dia": [
      {
        "data": "2026-10-20",
        "total": 0
      },
      {
        "data": "2026-10-21",
        "total": 0
      },
      {
        "data": "2026-10-22",
        "total": 0
      }
    ],
    "mensagens_por_dia": [
      {
        "data": "2026-10-20",
        "total": 0
      },
      {
        "data": "2026-10-21",
        "total": 0
      },
      {
        "data": "2026-10-22",
        "total": 0
      }
    ]
  },
  "top_regioes": [
    {
      "regiao": "Boa Viagem",
      "perfis": 2,
      "matches": 1,
      "score_medio": 0.9295
    },
    {
      "regiao": "Casa Forte",
      "perfis": 1,
      "matches": 0,
      "score_medio": null
    }
  ],
  "distribuicao_score": [
    {
      "faixa": "0-20",
      "total": 0
    },
    {
      "faixa": "20-40",
      "total": 0
    },
    {
      "faixa": "40-60",
      "total": 0
    }
  ],
  "filtros_aplicados": {}
}
```

**Com filtros**

```bash
curl -X GET "<BASE>/api/admin/dashboard/?regiao=Boa%20Viagem&tipo=oferecendo_vaga" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
{
  "kpis": {
    "usuarios_total": 6,
    "usuarios_por_tipo": {
      "oferecendo_vaga": 2
    },
    "usuarios_suspensos": 0,
    "perfis_total": 1,
    "curtidas_total": 1,
    "recusas_total": 0,
    "matches_total": 1,
    "taxa_match": 100.0,
    "mensagens_total": 2,
    "conversas_ativas": 1,
    "score_medio": 0.9295,
    "denuncias_pendentes": 0
  },
  "series": {
    "matches_por_dia": [
      {
        "data": "2026-10-20",
        "total": 0
      },
      {
        "data": "2026-10-21",
        "total": 0
      },
      {
        "data": "2026-10-22",
        "total": 0
      }
    ],
    "curtidas_por_dia": [
      {
        "data": "2026-10-20",
        "total": 0
      },
      {
        "data": "2026-10-21",
        "total": 0
      },
      {
        "data": "2026-10-22",
        "total": 0
      }
    ],
    "mensagens_por_dia": [
      {
        "data": "2026-10-20",
        "total": 0
      },
      {
        "data": "2026-10-21",
        "total": 0
      },
      {
        "data": "2026-10-22",
        "total": 0
      }
    ]
  },
  "top_regioes": [
    {
      "regiao": "Boa Viagem",
      "perfis": 2,
      "matches": 1,
      "score_medio": 0.9295
    },
    {
      "regiao": "Casa Forte",
      "perfis": 1,
      "matches": 0,
      "score_medio": null
    }
  ],
  "distribuicao_score": [
    {
      "faixa": "0-20",
      "total": 0
    },
    {
      "faixa": "20-40",
      "total": 0
    },
    {
      "faixa": "40-60",
      "total": 0
    }
  ],
  "filtros_aplicados": {
    "regiao": "Boa Viagem",
    "tipo": "oferecendo_vaga"
  }
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Período invertido | `{"detail": "data_inicio não pode ser maior que data_fim."}` |
| `400` | Período maior que 366 dias | `{"detail": "O período não pode passar de 366 dias. Reduza o intervalo entre as datas."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `403` | Usuário comum | `{"detail": "Você não tem permissão para executar essa ação."}` |

---

### `GET /api/admin/relatorios/` — Catálogo de relatórios

**Quem pode:** Somente administrador.  
**Operação (OpenAPI):** `painel_relatorios_catalogo`

Os 5 relatórios disponíveis e os filtros que cada um aceita.

**Resposta de sucesso:** `200` — Relatórios.

**Exemplo**

```bash
curl -X GET "<BASE>/api/admin/relatorios/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "id": "matches",
    "titulo": "Matches",
    "descricao": "Listagem de matches no período com métricas de engajamento.",
    "filtros": [
      "data_inicio",
      "data_fim",
      "regiao"
    ]
  },
  {
    "id": "compatibilidade-regiao",
    "titulo": "Compatibilidade por Região",
    "descricao": "Estatísticas de compatibilidade e matches agrupados por região.",
    "filtros": [
      "regiao",
      "tipo"
    ]
  },
  {
    "id": "atividade",
    "titulo": "Atividade por Dia",
    "descricao": "Curtidas, recusas, matches e mensagens agrupados por dia.",
    "filtros": [
      "data_inicio",
      "data_fim",
      "regiao"
    ]
  }
]
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |

---

### `GET /api/admin/relatorios/{rel_id}/` — Gerar um relatório (JSON ou CSV)

**Quem pode:** Somente administrador.  
**Operação (OpenAPI):** `painel_relatorio_detalhe`

Filtros por relatório — `matches` e `atividade`: data_inicio, data_fim, regiao, tipo; `compatibilidade-regiao`: regiao, tipo; `usuarios`: data_inicio, data_fim, tipo; `denuncias`: data_inicio, data_fim. Com `formato=csv` devolve o arquivo (UTF-8 com BOM, separador `;`) e registra o log `RELATORIO_EXPORTADO`.

**Parâmetros de rota**

| Parâmetro | Descrição |
|---|---|
| `rel_id` | Identificador do relatório. Valores: `matches`, `compatibilidade-regiao`, `atividade`, `usuarios`, `denuncias`. |

**Parâmetros de consulta** (todos opcionais)

| Parâmetro | Tipo | Valores aceitos / descrição |
|---|---|---|
| `rel_id` | texto | Valores: `matches`, `compatibilidade-regiao`, `atividade`, `usuarios`, `denuncias`. Identificador do relatório. |
| `formato` | texto | Valores: `json`, `csv`. Formato de saída (padrão `json`). |
| `data_inicio` | data (`AAAA-MM-DD`) | Início do período. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |
| `data_fim` | data (`AAAA-MM-DD`) | Fim do período. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |
| `regiao` | texto | Região do perfil. |
| `tipo` | texto | Valores: `buscando_vaga`, `oferecendo_vaga`, `administrador`. Tipo de usuário. |

**Resposta de sucesso:** `200` — Relatório em JSON (ou CSV com `formato=csv`).

**Exemplo**

```bash
curl -X GET "<BASE>/api/admin/relatorios/matches/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
{
  "titulo": "Matches",
  "colunas": [
    "Data",
    "Perfil A",
    "Perfil B"
  ],
  "linhas": [
    [
      "2026-11-18",
      "Ana Souza",
      "Bruno Lima"
    ]
  ],
  "totais": {
    "matches": 1,
    "mensagens": 2
  },
  "filtros_aplicados": {},
  "gerado_em": "2026-11-18T12:36:23.279442Z"
}
```

**Relatório de usuários em CSV (`formato=csv`)**

```bash
curl -X GET "<BASE>/api/admin/relatorios/usuarios/?formato=csv" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200  (text/csv)
﻿Data de Cadastro;Nome;E-mail;Tipo;Região;Tem Perfil
18/11/2026;e2e-admin@teste.com;e2e-admin@teste.com;Administrador;;Não
18/11/2026;Ana Souza;ana.souza@exemplo.com;Buscando vaga;Boa Viagem;Sim
18/11/2026;Bruno Lima;bruno.lima@exemplo.com;Oferecendo vaga;Boa Viagem;Sim
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Filtro ou formato inválido | `{"detail": "Tipo inválido. Use: buscando_vaga, oferecendo_vaga, administrador."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |
| `404` | Relatório inexistente | `{"detail": "Relatório \"nao-existe\" não encontrado."}` |

---

### `GET /api/admin/usuarios/` — Listar usuários

**Quem pode:** Somente administrador.  
**Operação (OpenAPI):** `painel_usuarios_listar`

Usuários paginados, do mais recente para o mais antigo.

**Parâmetros de consulta** (todos opcionais)

| Parâmetro | Tipo | Valores aceitos / descrição |
|---|---|---|
| `q` | texto | Nome, e-mail ou username. |
| `tipo` | texto | Valores: `buscando_vaga`, `oferecendo_vaga`, `administrador`. Tipo de usuário. |
| `regiao` | texto | Região do perfil. |
| `ativo` | texto | Valores: `true`, `false`. `true` = contas ativas; `false` = suspensas. |
| `data_inicio` | data (`AAAA-MM-DD`) | Cadastro a partir desta data. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |
| `data_fim` | data (`AAAA-MM-DD`) | Cadastro até esta data. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |
| `page` | inteiro | Página (padrão 1). Valor inválido volta à página 1; página além do fim devolve `results: []`. |
| `page_size` | inteiro | Itens por página (padrão 20, máximo 100). |

**Resposta de sucesso:** `200` — Página de usuários.

**Exemplo**

```bash
curl -X GET "<BASE>/api/admin/usuarios/?tipo=buscando_vaga&page_size=2" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
{
  "count": 3,
  "page": 1,
  "results": [
    {
      "id": 6,
      "nome": "Eva Martins",
      "email": "eva.martins@exemplo.com",
      "tipo": "buscando_vaga",
      "regiao": null,
      "data_cadastro": "2026-11-18T12:36:07.991384Z",
      "tem_perfil": false,
      "ativo": true
    },
    {
      "id": 5,
      "nome": "Diego Alves",
      "email": "diego.alves@exemplo.com",
      "tipo": "buscando_vaga",
      "regiao": null,
      "data_cadastro": "2026-11-18T12:35:44.720289Z",
      "tem_perfil": false,
      "ativo": true
    }
  ]
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Filtro inválido | `{"detail": "Tipo inválido. Use: buscando_vaga, oferecendo_vaga, administrador."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |

---

### `GET /api/admin/usuarios/exportar/` — Exportar usuários (CSV)

**Quem pode:** Somente administrador.  
**Operação (OpenAPI):** `painel_usuarios_exportar`

Mesmos filtros da listagem (sem paginação). CSV com BOM e separador `;`. Registra o log `RELATORIO_EXPORTADO`.

**Parâmetros de consulta** (todos opcionais)

| Parâmetro | Tipo | Valores aceitos / descrição |
|---|---|---|
| `q` | texto | Nome, e-mail ou username. |
| `tipo` | texto | Valores: `buscando_vaga`, `oferecendo_vaga`, `administrador`. Tipo de usuário. |
| `regiao` | texto | Região do perfil. |
| `ativo` | texto | Valores: `true`, `false`. `true` = ativas; `false` = suspensas. |
| `data_inicio` | data (`AAAA-MM-DD`) | Cadastro a partir desta data. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |
| `data_fim` | data (`AAAA-MM-DD`) | Cadastro até esta data. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |

**Resposta de sucesso:** `200` — Arquivo CSV de usuários. (`text/csv`, UTF-8 com BOM, separador `;`).

**Exemplo**

```bash
curl -X GET "<BASE>/api/admin/usuarios/exportar/?ativo=true" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200  (text/csv)
﻿ID;Nome;E-mail;Tipo;Região;Data de Cadastro;Tem Perfil
6;Eva Martins;eva.martins@exemplo.com;Buscando vaga;;18/11/2026;Não
5;Diego Alves;diego.alves@exemplo.com;Buscando vaga;;18/11/2026;Não
4;Carla Dias;carla.dias@exemplo.com;Oferecendo vaga;Casa Forte;18/11/2026;Sim
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |

---

## Logs

### `GET /api/admin/logs/` — Listar logs de operações

**Quem pode:** Somente administrador.  
**Operação (OpenAPI):** `logs_listar`

Histórico de operações, do mais recente para o mais antigo. O texto das mensagens e as senhas nunca são gravados; o log de falha de login guarda só o motivo (`credenciais` ou `conta_inativa`).

**Parâmetros de consulta** (todos opcionais)

| Parâmetro | Tipo | Valores aceitos / descrição |
|---|---|---|
| `acao` | texto | Valores: `LOGIN`, `LOGIN_FALHA`, `CADASTRO`, `PERFIL_CRIADO`, `PERFIL_EDITADO`, `PERFIL_EXCLUIDO`, `CURTIDA`, `RECUSA`, `MATCH_CRIADO`, `MENSAGEM_ENVIADA`, `RELATORIO_EXPORTADO`, `DENUNCIA_CRIADA`, `DENUNCIA_RESOLVIDA`, `USUARIO_SUSPENSO`, `USUARIO_REATIVADO`, `SENHA_SOLICITADA`, `SENHA_REDEFINIDA`. Ação registrada. |
| `usuario` | texto | Id, e-mail ou parte do nome do usuário. |
| `entidade` | texto | Tipo de objeto afetado (`usuario`, `perfil`, `match`...). |
| `q` | texto | Busca em e-mail, nome, username ou entidade. |
| `data_inicio` | data (`AAAA-MM-DD`) | A partir desta data. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |
| `data_fim` | data (`AAAA-MM-DD`) | Até esta data. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |
| `page` | inteiro | Página (padrão 1). Valor inválido volta à página 1; página além do fim devolve `results: []`. |
| `page_size` | inteiro | Itens por página (padrão 20, máximo 100). |

**Resposta de sucesso:** `200` — Página de logs.

**Exemplo**

```bash
curl -X GET "<BASE>/api/admin/logs/?acao=MATCH_CRIADO&page_size=2" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
{
  "count": 1,
  "page": 1,
  "results": [
    {
      "id": 26,
      "data_hora": "2026-11-18T12:36:15.187486Z",
      "usuario": {
        "id": 3,
        "nome": "Bruno Lima",
        "email": "bruno.lima@exemplo.com"
      },
      "acao": "MATCH_CRIADO",
      "acao_label": "Match criado",
      "entidade": "match",
      "entidade_id": 1,
      "detalhes": {
        "score": 0.9295,
        "match_id": 1
      },
      "ip": "127.0.0.1"
    }
  ]
}
```

**Filtrado por e-mail do usuário**

```bash
curl -X GET "<BASE>/api/admin/logs/?usuario=ana.souza@exemplo.com&page_size=1" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
{
  "count": 10,
  "page": 1,
  "results": [
    {
      "id": 29,
      "data_hora": "2026-11-18T12:36:16.701747Z",
      "usuario": {
        "id": 2,
        "nome": "Ana Souza",
        "email": "ana.souza@exemplo.com"
      },
      "acao": "DENUNCIA_CRIADA",
      "acao_label": "Denúncia criada",
      "entidade": "denuncia",
      "entidade_id": 1,
      "detalhes": {
        "motivo": "spam",
        "denunciado_id": 4
      },
      "ip": "127.0.0.1"
    }
  ]
}
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Ação inválida | `{"detail": "Ação inválida. Use: LOGIN, LOGIN_FALHA, CADASTRO, PERFIL_CRIADO, PERFIL_EDITADO, PERFIL_EXCLUIDO, CURTIDA, RECUSA, MATCH_CRIADO, MENSAGEM_ENVIADA, RELATORIO_EXPORTADO, DENUNCIA_CRIADA, DENUNCIA_RESOLVIDA, USUARIO_SUSPENSO, USUARIO_REATIVADO, SENHA_SOLICITADA, SENHA_REDEFINIDA."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |

---

### `GET /api/admin/logs/exportar/` — Exportar logs (CSV)

**Quem pode:** Somente administrador.  
**Operação (OpenAPI):** `logs_exportar`

Mesmos filtros da listagem (sem paginação). CSV com BOM e separador `;`. Registra o log `RELATORIO_EXPORTADO`.

**Parâmetros de consulta** (todos opcionais)

| Parâmetro | Tipo | Valores aceitos / descrição |
|---|---|---|
| `acao` | texto | Valores: `LOGIN`, `LOGIN_FALHA`, `CADASTRO`, `PERFIL_CRIADO`, `PERFIL_EDITADO`, `PERFIL_EXCLUIDO`, `CURTIDA`, `RECUSA`, `MATCH_CRIADO`, `MENSAGEM_ENVIADA`, `RELATORIO_EXPORTADO`, `DENUNCIA_CRIADA`, `DENUNCIA_RESOLVIDA`, `USUARIO_SUSPENSO`, `USUARIO_REATIVADO`, `SENHA_SOLICITADA`, `SENHA_REDEFINIDA`. Ação registrada. |
| `usuario` | texto | Id, e-mail ou parte do nome do usuário. |
| `entidade` | texto | Tipo de objeto afetado. |
| `q` | texto | Busca em e-mail, nome, username ou entidade. |
| `data_inicio` | data (`AAAA-MM-DD`) | A partir desta data. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |
| `data_fim` | data (`AAAA-MM-DD`) | Até esta data. Formato `AAAA-MM-DD`. Formato inválido, `data_inicio` maior que `data_fim`, data anterior a 2000-01-01 ou período maior que 366 dias → 400. |

**Resposta de sucesso:** `200` — Arquivo CSV de logs. (`text/csv`, UTF-8 com BOM, separador `;`).

**Exemplo**

```bash
curl -X GET "<BASE>/api/admin/logs/exportar/?acao=LOGIN" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200  (text/csv)
﻿ID;Data/Hora;Usuário ID;Usuário Nome;Usuário E-mail;Ação;Descrição da Ação;Entidade;ID da Entidade;Detalhes;IP
14;18/11/2026 09:36:07;2;Ana Souza;ana.souza@exemplo.com;LOGIN;Login;usuario;2;;127.0.0.1
13;18/11/2026 09:36:05;1;e2e-admin@teste.com;e2e-admin@teste.com;LOGIN;Login;usuario;1;;127.0.0.1
12;18/11/2026 09:36:03;5;Diego Alves;diego.alves@exemplo.com;LOGIN;Login;usuario;5;;127.0.0.1
```

**Erros possíveis**

| Status | Quando | Resposta real |
|---|---|---|
| `400` | Ação inválida | `{"detail": "Ação inválida. Use: LOGIN, LOGIN_FALHA, CADASTRO, PERFIL_CRIADO, PERFIL_EDITADO, PERFIL_EXCLUIDO, CURTIDA, RECUSA, MATCH_CRIADO, MENSAGEM_ENVIADA, RELATORIO_EXPORTADO, DENUNCIA_CRIADA, DENUNCIA_RESOLVIDA, USUARIO_SUSPENSO, USUARIO_REATIVADO, SENHA_SOLICITADA, SENHA_REDEFINIDA."}` |
| `401` | Sem token | `{"detail": "As credenciais de autenticação não foram fornecidas."}` |
| `401` | Token inválido ou expirado | `{"detail": "O token informado não é válido para qualquer tipo de token", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "O token é inválido"}]}` |

---

## Roteiro de uso em sequência

Fluxo completo com as chamadas reais usadas para gerar estes exemplos (Ana procura vaga; Bruno oferece vaga).

### 1. Cadastro

Ana (quem procura vaga) e Bruno (quem oferece) se cadastram. O nome vai em `username`.

```bash
curl -X POST "<BASE>/api/auth/registrar/" \
  -H "Content-Type: application/json" \
  -d '{"username": "Ana Souza", "email": "ana.souza@exemplo.com", "password": "<SENHA>", "tipo": "buscando_vaga"}'
```

```json
HTTP 201
{
  "username": "Ana Souza",
  "email": "ana.souza@exemplo.com",
  "tipo": "buscando_vaga"
}
```

### 2. Login

Guarde o `access` (1 hora) e o `refresh` (7 dias). Nos próximos passos, use `<TOKEN>` da pessoa que faz a chamada.

```bash
curl -X POST "<BASE>/api/auth/login/" \
  -H "Content-Type: application/json" \
  -d '{"email": "Ana.Souza@exemplo.com", "password": "<SENHA>"}'
```

```json
HTTP 200
{
  "refresh": "<REFRESH>",
  "access": "<TOKEN>"
}
```

### 3. Perfil

Cada pessoa cria o próprio perfil. Quem oferece vaga pode incluir o anúncio (veja `perfil_criar_anuncio`).

```bash
curl -X POST "<BASE>/api/perfis/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"nome": "Ana Souza", "idade": 24, "regiao": "Boa Viagem", "bio": "Estudante de Computação, rotina tranquila.", "orcamento_min": 700, "orcamento_max": 1200, "fumante": false, "aceita_pets": true, "tolerancia_bagunca": 2, "nivel_organizacao": 4, "perfil_horario": "flexivel", "nivel_ruido": 2, "nivel_social": 3, "aceita_visitas": "as_vezes", "tipo_imovel": "apartamento", "qtd_moradores": 2}'
```

```json
HTTP 201
{
  "id": 1,
  "usuario": 2,
  "nome": "Ana Souza",
  "idade": 24,
  "regiao": "Boa Viagem",
  "bio": "Estudante de Computação, rotina tranquila.",
  "orcamento_min": "700.00",
  "orcamento_max": "1200.00",
  "fumante": false,
  "aceita_pets": true,
  "tolerancia_bagunca": 2,
  "nivel_organizacao": 4,
  "perfil_horario": "flexivel",
  "nivel_ruido": 2,
  "nivel_social": 3,
  "aceita_visitas": "as_vezes",
  "tipo_imovel": "apartamento",
  "qtd_moradores": 2,
  "titulo_anuncio": "",
  "descricao_imovel": "",
  "fotos_imovel": [],
  "foto_perfil_url": ""
}
```

### 4. Descoberta

Ana vê os perfis do tipo oposto, com o score de compatibilidade.

```bash
curl -X GET "<BASE>/api/descoberta/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "id": 2,
    "nome": "Bruno Lima",
    "idade": 29,
    "regiao": "Boa Viagem",
    "bio": "Dono do apartamento, trabalho em home office.",
    "orcamento_min": "800.00",
    "orcamento_max": "1300.00",
    "fumante": false,
    "aceita_pets": true,
    "tolerancia_bagunca": 2,
    "nivel_organizacao": 4,
    "perfil_horario": "flexivel",
    "nivel_ruido": 2,
    "nivel_social": 3,
    "aceita_visitas": "as_vezes",
    "tipo_imovel": "apartamento",
    "qtd_moradores": 2,
    "titulo_anuncio": "Quarto amplo a 5 minutos da praia",
    "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
    "fotos_imovel": [
      "https://exemplo.com/fotos/quarto.jpg",
      "https://exemplo.com/fotos/sala.jpg"
    ],
    "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg",
    "tipo": "oferecendo_vaga",
    "score": 0.9295,
    "usuario_id": 3
  },
  {
    "id": 3,
    "nome": "Carla Dias",
    "idade": 29,
    "regiao": "Casa Forte",
    "bio": "Dono do apartamento, trabalho em home office.",
    "orcamento_min": "800.00",
    "orcamento_max": "1300.00",
    "fumante": false,
    "aceita_pets": true,
    "tolerancia_bagunca": 2,
    "nivel_organizacao": 4,
    "perfil_horario": "flexivel",
    "nivel_ruido": 2,
    "nivel_social": 3,
    "aceita_visitas": "as_vezes",
    "tipo_imovel": "casa",
    "qtd_moradores": 2,
    "titulo_anuncio": "Casa com quintal",
    "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
    "fotos_imovel": [],
    "foto_perfil_url": "",
    "tipo": "oferecendo_vaga",
    "score": 0.7295,
    "usuario_id": 4
  }
]
```

### 5. Curtida

Ana curte o perfil de Bruno (`perfil_destino` é o id do **perfil**). Ainda não há match.

```bash
curl -X POST "<BASE>/api/curtidas/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"perfil_destino": 2, "tipo": "curtir"}'
```

```json
HTTP 201
{
  "match": false
}
```

### 6. Match

Bruno curte Ana de volta: a resposta já traz `match: true` e os dados do match.

```bash
curl -X POST "<BASE>/api/curtidas/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"perfil_destino": 1, "tipo": "curtir"}'
```

```json
HTTP 201
{
  "match": true,
  "match_data": {
    "id": 1,
    "perfil_a": {
      "id": 1,
      "nome": "Ana Souza",
      "idade": 24,
      "regiao": "Boa Viagem",
      "bio": "Estudante de Computação, rotina tranquila e gosta de cozinhar.",
      "fumante": false,
      "aceita_pets": true,
      "tolerancia_bagunca": 2,
      "nivel_organizacao": 4,
      "orcamento_min": "700.00",
      "orcamento_max": "1250.00",
      "perfil_horario": "flexivel",
      "nivel_ruido": 2,
      "nivel_social": 3,
      "aceita_visitas": "as_vezes",
      "tipo_imovel": "apartamento",
      "qtd_moradores": 2,
      "titulo_anuncio": "",
      "descricao_imovel": "",
      "fotos_imovel": [],
      "foto_perfil_url": "",
      "tipo": "buscando_vaga",
      "usuario_id": 2
    },
    "perfil_b": {
      "id": 2,
      "nome": "Bruno Lima",
      "idade": 29,
      "regiao": "Boa Viagem",
      "bio": "Dono do apartamento, trabalho em home office.",
      "fumante": false,
      "aceita_pets": true,
      "tolerancia_bagunca": 2,
      "nivel_organizacao": 4,
      "orcamento_min": "800.00",
      "orcamento_max": "1300.00",
      "perfil_horario": "flexivel",
      "nivel_ruido": 2,
      "nivel_social": 3,
      "aceita_visitas": "as_vezes",
      "tipo_imovel": "apartamento",
      "qtd_moradores": 2,
      "titulo_anuncio": "Quarto amplo a 5 minutos da praia",
      "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
      "fotos_imovel": [
        "https://exemplo.com/fotos/quarto.jpg",
        "https://exemplo.com/fotos/sala.jpg"
      ],
      "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg",
      "tipo": "oferecendo_vaga",
      "usuario_id": 3
    },
    "score": 0.9295,
    "data_match": "2026-11-18T09:36:15.179370-03:00"
  }
}
```

### 7. Confirmar os matches

Ambos veem o match em `GET /api/matches/`.

```bash
curl -X GET "<BASE>/api/matches/" \
  -H "Authorization: Bearer <TOKEN>"
```

```json
HTTP 200
[
  {
    "id": 1,
    "perfil_a": {
      "id": 1,
      "nome": "Ana Souza",
      "idade": 24,
      "regiao": "Boa Viagem",
      "bio": "Estudante de Computação, rotina tranquila e gosta de cozinhar.",
      "fumante": false,
      "aceita_pets": true,
      "tolerancia_bagunca": 2,
      "nivel_organizacao": 4,
      "orcamento_min": "700.00",
      "orcamento_max": "1250.00",
      "perfil_horario": "flexivel",
      "nivel_ruido": 2,
      "nivel_social": 3,
      "aceita_visitas": "as_vezes",
      "tipo_imovel": "apartamento",
      "qtd_moradores": 2,
      "titulo_anuncio": "",
      "descricao_imovel": "",
      "fotos_imovel": [],
      "foto_perfil_url": "",
      "tipo": "buscando_vaga",
      "usuario_id": 2
    },
    "perfil_b": {
      "id": 2,
      "nome": "Bruno Lima",
      "idade": 29,
      "regiao": "Boa Viagem",
      "bio": "Dono do apartamento, trabalho em home office.",
      "fumante": false,
      "aceita_pets": true,
      "tolerancia_bagunca": 2,
      "nivel_organizacao": 4,
      "orcamento_min": "800.00",
      "orcamento_max": "1300.00",
      "perfil_horario": "flexivel",
      "nivel_ruido": 2,
      "nivel_social": 3,
      "aceita_visitas": "as_vezes",
      "tipo_imovel": "apartamento",
      "qtd_moradores": 2,
      "titulo_anuncio": "Quarto amplo a 5 minutos da praia",
      "descricao_imovel": "Apartamento mobiliado, 2 quartos, varanda e vaga de garagem.",
      "fotos_imovel": [
        "https://exemplo.com/fotos/quarto.jpg",
        "https://exemplo.com/fotos/sala.jpg"
      ],
      "foto_perfil_url": "https://exemplo.com/fotos/bruno.jpg",
      "tipo": "oferecendo_vaga",
      "usuario_id": 3
    },
    "score": 0.9295,
    "data_match": "2026-11-18T09:36:15.179370-03:00"
  }
]
```

### 8. Mensagem

Ana envia a primeira mensagem usando o `id` do match.

```bash
curl -X POST "<BASE>/api/matches/1/mensagens/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"conteudo": "Oi, Bruno! O quarto ainda está disponível?"}'
```

```json
HTTP 201
{
  "id": 1,
  "match_id": 1,
  "remetente_id": 1,
  "conteudo": "Oi, Bruno! O quarto ainda está disponível?",
  "data_envio": "2026-11-18T09:36:15.718191-03:00",
  "lida": false
}
```

### 9. Resposta e leitura

Bruno responde; depois `GET /api/matches/{id}/mensagens/` devolve a conversa e marca as mensagens do outro como lidas.

```bash
curl -X POST "<BASE>/api/matches/1/mensagens/" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"conteudo": "Oi, Ana! Está sim. Quer visitar amanhã?"}'
```

```json
HTTP 201
{
  "id": 2,
  "match_id": 1,
  "remetente_id": 2,
  "conteudo": "Oi, Ana! Está sim. Quer visitar amanhã?",
  "data_envio": "2026-11-18T09:36:15.803928-03:00",
  "lida": false
}
```


## Como regenerar esta documentação

```bash
# 1. banco descartável (NUNCA o de desenvolvimento) e API de teste em http://127.0.0.1:8001 com o administrador criado
# 2. chamadas reais -> respostas capturadas
ADMIN_EMAIL=... ADMIN_SENHA=... python scripts/gerar_exemplos_api.py exemplos.json http://127.0.0.1:8001
# 3. módulo de exemplos usado pelo schema, schema OpenAPI e este arquivo
python scripts/gerar_docs_api.py modulo exemplos.json
python manage.py spectacular --validate --fail-on-warn --file ../docs/openapi.yaml
python scripts/gerar_docs_api.py markdown
```
