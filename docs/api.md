# API REST — PlaceMatch

Referência de todos os endpoints. Base local: `http://localhost:8000`. Formato: JSON (exceto as exportações CSV).

## Convenções

**Autenticação.** JWT no cabeçalho `Authorization: Bearer <access>`. O access dura 1 hora; o refresh, 7 dias, e é **rotacionado** a cada renovação (a resposta traz um novo `refresh`). Todo endpoint exige login, exceto `registrar`, `login` e `login/refresh`.

**Perfis de acesso.** `buscando_vaga` e `oferecendo_vaga` ("usuário comum") e `administrador`. Nas tabelas, **Quem pode**:

- *Qualquer logado* = os três tipos.
- *Usuário comum* = só `buscando_vaga` e `oferecendo_vaga` (o administrador recebe **403** com "O administrador não participa deste recurso.").
- *Administrador* = só `administrador` (usuário comum recebe **403**).

**Erros.** Sempre em português. Dois formatos:

- Erro de campo (400): `{"campo": ["mensagem"]}` — ex.: `{"email": ["Informe o e-mail."]}`.
- Erro geral: `{"detail": "mensagem"}`.

| Status | Quando |
|---|---|
| 400 | Dado inválido (campo ausente, formato, limite, corpo que não é um objeto JSON, filtro inválido) |
| 401 | Sem token, token inválido/expirado, usuário suspenso |
| 403 | Sem permissão para o recurso |
| 404 | Recurso inexistente (ou, na curtida, perfil de conta suspensa) |

Nenhuma entrada inválida gera erro 500. IDs fora do intervalo do banco respondem 404/400.

**Paginação** (logs e usuários do painel): `?page=` (padrão 1) e `?page_size=` (padrão 20, máximo 100). Valores inválidos voltam ao padrão; uma página além do fim devolve `results: []`. Resposta: `{"count": N, "page": P, "results": [...]}`.

**Datas** nos filtros: `AAAA-MM-DD`. Formato inválido ou `data_inicio` maior que `data_fim` → 400 (`"Formato de data_inicio inválido. Use AAAA-MM-DD."` / `"data_inicio não pode ser maior que data_fim."`).

**CSV.** UTF-8 com BOM, separador `;`, `Content-Disposition: attachment; filename="<nome>-AAAAMMDD.csv"`.

---

## Autenticação e usuário

| Método | Rota | Quem pode | Função |
|---|---|---|---|
| POST | `/api/auth/registrar/` | Público | Cadastra um usuário comum |
| POST | `/api/auth/login/` | Público | Login por e-mail; devolve os tokens |
| POST | `/api/auth/login/refresh/` | Público | Renova o access (e rotaciona o refresh) |
| GET | `/api/auth/me/` | Qualquer logado | Dados do usuário logado |

### `POST /api/auth/registrar/`

| Campo | Regra |
|---|---|
| `username` | Obrigatório. É o **nome** da pessoa (2 a 150 caracteres; aceita espaços e acentos; espaços repetidos são normalizados). Gravado em `first_name`; o `username` interno é gerado a partir do e-mail |
| `email` | Obrigatório, formato válido, único **sem diferenciar maiúsculas** (gravado em minúsculas) |
| `password` | Obrigatório, mínimo 8 caracteres, validadores do Django (não só números, não comum, não parecida com os dados) |
| `tipo` | Obrigatório: `buscando_vaga` ou `oferecendo_vaga` (`administrador` é recusado) |

**201:** `{"username": "Maria José", "email": "maria@x.com", "tipo": "buscando_vaga"}`.
**400** (exemplos): `{"email": ["Este e-mail já está cadastrado."]}`, `{"username": ["O nome deve ter pelo menos 2 caracteres."]}`, `{"password": ["A senha deve ter no mínimo 8 caracteres."]}`, `{"tipo": ["Tipo de conta inválido. Use \"buscando_vaga\" ou \"oferecendo_vaga\"."]}`.

### `POST /api/auth/login/`

Corpo: `{"email": "...", "password": "..."}` (e-mail sem diferenciar maiúsculas).

- **200:** `{"access": "...", "refresh": "..."}`.
- **400:** campo vazio, ausente ou que não é texto, ou corpo que não é objeto: `{"email": ["Informe o e-mail."], "password": ["Informe a senha."]}`.
- **401:** `{"detail": "E-mail ou senha incorretos."}` ou `{"detail": "Conta suspensa. Procure o suporte."}` (só quando a conta existe, a senha confere e `is_active=false`).

### `POST /api/auth/login/refresh/`

Corpo: `{"refresh": "..."}`. **200:** `{"access": "...", "refresh": "..."}` (novo refresh). **400:** campo ausente. **401:** refresh inválido/expirado/de usuário suspenso.

### `GET /api/auth/me/`

**200:** `{"id": 1, "username": "Maria José", "nome": "Maria José", "email": "maria@x.com", "tipo": "buscando_vaga"}` — `username` e `nome` trazem o nome de exibição (o nome informado no cadastro; para contas sem nome, o `username` interno).

---

## Perfis

| Método | Rota | Quem pode | Função |
|---|---|---|---|
| GET | `/api/perfis/` | Qualquer logado | Lista o **próprio** perfil (administrador: todos) |
| POST | `/api/perfis/` | Usuário comum | Cria o perfil do usuário logado |
| GET | `/api/perfis/{id}/` | Qualquer logado, com restrição | Consulta um perfil |
| PUT / PATCH | `/api/perfis/{id}/` | Dono do perfil | Atualiza (completo / parcial) |
| DELETE | `/api/perfis/{id}/` | Dono do perfil | Exclui o perfil (204) |

Regras de acesso do `GET /{id}/`: o próprio perfil, perfis do **tipo oposto** (os da Descoberta), perfis de quem tem **match** com você, ou qualquer um se for administrador; senão 403 ("Você não tem permissão para acessar este perfil."). Editar/excluir perfil alheio → 403. Administrador criando perfil → 403. Segundo perfil do mesmo usuário → 400 `{"detail": "Você já possui um perfil."}`.

**Campos** (corpo e resposta; a resposta traz também `id` e `usuario`, somente leitura):

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `nome` | texto | sim | 2 a 150 caracteres |
| `idade` | inteiro | sim | 18 a 100 |
| `regiao` | texto | sim | 2 a 200 caracteres |
| `bio` | texto | não | até 500 caracteres |
| `orcamento_min`, `orcamento_max` | decimal | sim | maiores que 0, até 99.999.999,99; mínimo ≤ máximo |
| `fumante`, `aceita_pets` | booleano | não (padrão `false`) | — |
| `tolerancia_bagunca`, `nivel_organizacao`, `nivel_ruido`, `nivel_social` | inteiro | não (padrão 3) | 1 a 5 |
| `perfil_horario` | escolha | não (`flexivel`) | `madrugador`, `noturno`, `flexivel` |
| `aceita_visitas` | escolha | não (`as_vezes`) | `raramente`, `as_vezes`, `frequentemente` |
| `tipo_imovel` | escolha | não (`indiferente`) | `apartamento`, `casa`, `republica`, `indiferente` |
| `qtd_moradores` | inteiro | não (2) | 1 a 4 |
| `titulo_anuncio` | texto | não | até 120 caracteres |
| `descricao_imovel` | texto | não | até 1000 caracteres |
| `fotos_imovel` | lista de URLs | não (`[]`) | até 5 itens; cada URL `http://` ou `https://`, até 500 caracteres |
| `foto_perfil_url` | URL | não | `http://` ou `https://`, até 500 caracteres |

Ao salvar um perfil, as compatibilidades com os perfis do tipo oposto são recalculadas automaticamente.

---

## Descoberta, curtidas e matches

| Método | Rota | Quem pode | Função |
|---|---|---|---|
| GET | `/api/descoberta/` | Usuário comum | Perfis do tipo oposto, com score, busca e filtros |
| POST | `/api/curtidas/` | Usuário comum | Curtir ou recusar um perfil |
| GET | `/api/matches/` | Qualquer logado | Matches do usuário logado, por score decrescente |

### `GET /api/descoberta/`

Exige perfil criado (senão 400: "Você precisa criar um perfil antes de acessar a descoberta."). Não lista: o próprio perfil, perfis já avaliados, perfis já em match e contas suspensas.

| Parâmetro | Descrição |
|---|---|
| `q` | Texto: nome, região ou título do anúncio |
| `regiao` | Região exata; repetível (`?regiao=A&regiao=B`) |
| `tipo_imovel` | `apartamento`, `casa`, `republica`, `indiferente` |
| `aceita_pets`, `fumante` | `true` ou `false` |
| `orcamento_min`, `orcamento_max` | Número entre 0 e 99.999.999,99 (NaN, infinito e negativos → 400). Filtra por **interseção** de faixas |
| `score_min` | 0 a 100 (%) |
| `ordenar` | `score` (padrão), `orcamento_asc`, `orcamento_desc` |

**200:** lista de `{id, nome, idade, regiao, bio, orcamento_min, orcamento_max, fumante, aceita_pets, tolerancia_bagunca, nivel_organizacao, perfil_horario, nivel_ruido, nivel_social, aceita_visitas, tipo_imovel, qtd_moradores, titulo_anuncio, descricao_imovel, fotos_imovel, foto_perfil_url, tipo, score, usuario_id}` (`score` de 0 a 1).
**400:** filtro inválido (`{"detail": "Valor inválido para aceita_pets. Use true ou false."}`, `"score_min deve ser um número entre 0 e 100."`, `"ordenar inválido. Use: score, orcamento_asc, orcamento_desc."`).

### `POST /api/curtidas/`

Corpo: `{"perfil_destino": <id do perfil>, "tipo": "curtir" | "recusar"}`.

**201:** `{"match": false}` ou `{"match": true, "match_data": {id, perfil_a, perfil_b, score, data_match}}` (match quando o outro já tinha curtido).
**400:** campos ausentes/inválidos (`{"perfil_destino": ["O identificador \"999\" não existe."]}`), curtir o próprio perfil, perfil do mesmo tipo ("Você só pode avaliar perfis do tipo oposto."), avaliar duas vezes ("Você já avaliou este perfil."), usuário sem perfil.
**404:** perfil de conta suspensa — `{"detail": "Perfil não encontrado."}`.
**403:** administrador.

### `GET /api/matches/`

**200:** lista de `{id, perfil_a, perfil_b, score, data_match}`, em que cada perfil traz os campos públicos (os mesmos da Descoberta, sem `score`). Sem perfil → `[]`. Não lista matches com contas suspensas.

---

## Chat

| Método | Rota | Quem pode | Função |
|---|---|---|---|
| GET | `/api/conversas/` | Usuário comum | Conversas (matches) com última mensagem e não lidas |
| GET | `/api/matches/{match_id}/mensagens/` | Participante do match | Mensagens do match (marca as do outro como lidas) |
| POST | `/api/matches/{match_id}/mensagens/` | Participante do match | Envia mensagem |

**`GET /api/conversas/`** — parâmetros: `q` (nome ou título do anúncio do outro perfil, sem diferenciar maiúsculas), `nao_lidas=true` (só conversas com mensagens não lidas). **200:** lista de `{match_id, outro_perfil: {id, usuario_id, nome, idade, regiao, tipo, titulo_anuncio, descricao_imovel, fotos_imovel, foto_perfil_url, tipo_imovel, qtd_moradores, orcamento_min, orcamento_max, aceita_pets, fumante}, score, ultima_mensagem: {conteudo, data_envio, remetente_id} | null, nao_lidas}`, ordenada pela atividade mais recente. Não inclui contas suspensas.

**`GET .../mensagens/`** — `?apos=<id>` devolve só mensagens com id maior (inteiro ≥ 0; inválido → 400). **200:** lista de `{id, match_id, remetente_id, conteudo, data_envio, lida}` em ordem cronológica.

**`POST .../mensagens/`** — corpo `{"conteudo": "texto"}`. **201:** a mensagem criada.
**400:** `conteudo` vazio/só espaços ("O conteúdo da mensagem não pode ser vazio."), com mais de 1000 caracteres, ou que não é texto ("O conteúdo da mensagem deve ser um texto."); corpo que não é objeto; usuário sem perfil.
**403:** não participante ("Você não tem acesso a este match."), administrador, ou **o outro participante está suspenso** ("Não é possível enviar mensagens: a conta do outro participante está suspensa.").
**404:** match inexistente.

---

## Moderação

| Método | Rota | Quem pode | Função |
|---|---|---|---|
| POST | `/api/moderacao/denuncias/` | Usuário comum | Denunciar um usuário |
| GET | `/api/admin/moderacao/denuncias/` | Administrador | Listar denúncias |
| PATCH | `/api/admin/moderacao/denuncias/{id}/` | Administrador | Resolver ou descartar uma denúncia |
| POST | `/api/admin/moderacao/usuarios/{id}/suspender/` | Administrador | Suspender a conta |
| POST | `/api/admin/moderacao/usuarios/{id}/reativar/` | Administrador | Reativar a conta |

**`POST /api/moderacao/denuncias/`** — corpo `{"denunciado": <id do USUÁRIO>, "motivo": "spam|ofensivo|falso|outro", "descricao": "até 500 caracteres"}` (`descricao` opcional). **201:** `{id, denunciado, motivo, status: "pendente", criada_em}`.
**400:** `denunciado` ausente/inválido ("O campo \"denunciado\" é obrigatório." / "O campo \"denunciado\" inválido. Informe um número inteiro."), usuário inexistente, denunciar a si mesmo, motivo inválido, descrição acima de 500 ou que não é texto, administrador denunciando.

**`GET /api/admin/moderacao/denuncias/`** — filtros `status` (`pendente|resolvida|descartada`), `denunciado` (id do usuário), `motivo`, `data_inicio` e `data_fim` (`AAAA-MM-DD`, sobre a data de criação da denúncia, ambas inclusivas). Valor inválido, formato de data inválido ou período invertido → 400. **200:** lista de `{id, denunciante: {id, email}, denunciado: {id, email}, motivo, motivo_display, descricao, status, resolvida_por, resolucao, criada_em, atualizada_em}`.

**`PATCH .../denuncias/{id}/`** — corpo `{"status": "resolvida" | "descartada", "resolucao": "até 500 caracteres"}`. **200:** `{id, status, resolucao, resolvida_por}`. **400:** status inválido, denúncia que não está pendente, `resolucao` longa ou que não é texto. **404:** inexistente.

**`POST .../usuarios/{id}/suspender/`** — corpo opcional `{"motivo": "até 500 caracteres"}`. Desativa a conta (`is_active=false`). **200:** `{id, email, ativo: false}`. **400:** já suspenso; tentar suspender administrador; `motivo` longo. **404:** usuário inexistente. **`.../reativar/`** → **200:** `{id, email, ativo: true}`; **400** se já ativo.

---

## Painel administrativo (somente administrador)

| Método | Rota | Função |
|---|---|---|
| GET | `/api/admin/dashboard/` | KPIs, séries diárias, top regiões, distribuição de score |
| GET | `/api/admin/relatorios/` | Catálogo de relatórios |
| GET | `/api/admin/relatorios/{id}/` | Dados de um relatório (JSON ou CSV) |
| GET | `/api/admin/usuarios/` | Lista de usuários (paginada) |
| GET | `/api/admin/usuarios/exportar/` | Usuários em CSV |
| GET | `/api/admin/logs/` | Histórico de operações (paginado) |
| GET | `/api/admin/logs/exportar/` | Logs em CSV |

**`GET /api/admin/dashboard/`** — filtros: `data_inicio`, `data_fim` (padrão: últimos 30 dias), `regiao`, `tipo` (`buscando_vaga`, `oferecendo_vaga`, `administrador`). **200:**

```json
{
  "kpis": {"usuarios_total": 0, "usuarios_por_tipo": {}, "usuarios_suspensos": 0, "perfis_total": 0,
           "curtidas_total": 0, "recusas_total": 0, "matches_total": 0, "taxa_match": 0.0,
           "mensagens_total": 0, "conversas_ativas": 0, "score_medio": 0.0, "denuncias_pendentes": 0},
  "series": {"matches_por_dia": [{"data": "2026-11-01", "total": 0}], "curtidas_por_dia": [], "mensagens_por_dia": []},
  "top_regioes": [{"regiao": "Recife", "perfis": 0, "matches": 0, "score_medio": 0.0}],
  "distribuicao_score": [{"faixa": "0-20", "total": 0}],
  "filtros_aplicados": {"data_inicio": null, "data_fim": null, "regiao": null, "tipo": null}
}
```

**Relatórios** (`{id}`): `matches`, `compatibilidade-regiao`, `atividade`, `usuarios`, `denuncias`. Filtros aceitos: `matches` e `atividade` → `data_inicio`, `data_fim`, `regiao`, `tipo`; `compatibilidade-regiao` → `regiao`, `tipo`; `usuarios` → `data_inicio`, `data_fim`, `tipo`; `denuncias` → `data_inicio`, `data_fim`. Comum a todos: `formato=json` (padrão) ou `csv`; `tipo` inválido ou `formato` inválido → 400; relatório inexistente → 404 (`Relatório "x" não encontrado.`). **200 (json):** `{titulo, colunas, linhas, totais, filtros_aplicados, gerado_em}`. O catálogo (`GET /api/admin/relatorios/`) devolve `[{id, titulo, descricao, filtros}]`.

**`GET /api/admin/usuarios/`** — filtros: `q` (nome, e-mail ou username), `tipo`, `regiao`, `ativo` (`true|false`), `data_inicio`, `data_fim` (data de cadastro), `page`, `page_size`. `tipo`/`ativo` inválidos → 400. **200:** `{count, page, results: [{id, nome, email, tipo, regiao, data_cadastro, tem_perfil, ativo}]}`. A exportação aceita os mesmos filtros (sem paginação); colunas: ID, Nome, E-mail, Tipo, Região, Data de Cadastro, Tem Perfil. Registra o log `RELATORIO_EXPORTADO`.

**`GET /api/admin/logs/`** — filtros: `acao` (uma das ações abaixo, senão 400), `usuario` (**ID, e-mail ou parte do nome**), `entidade`, `data_inicio`, `data_fim`, `q` (e-mail, nome, username ou entidade), `page`, `page_size`. **200:** `{count, page, results: [{id, data_hora, usuario: {id, nome, email} | null, acao, acao_label, entidade, entidade_id, detalhes, ip}]}`. A exportação (`/exportar/`) aceita os mesmos filtros.

Ações registradas: `LOGIN`, `LOGIN_FALHA`, `CADASTRO`, `PERFIL_CRIADO`, `PERFIL_EDITADO`, `PERFIL_EXCLUIDO`, `CURTIDA`, `RECUSA`, `MATCH_CRIADO`, `MENSAGEM_ENVIADA`, `RELATORIO_EXPORTADO`, `DENUNCIA_CRIADA`, `DENUNCIA_RESOLVIDA`, `USUARIO_SUSPENSO`, `USUARIO_REATIVADO`. O texto das mensagens e as senhas nunca são gravados; o log de falha de login guarda apenas o motivo (`credenciais` ou `conta_inativa`).
