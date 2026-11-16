# Módulo Chat — PlaceMatch

## Modelo de Dados

### `Mensagem`

| Campo        | Tipo            | Descrição                                      |
|--------------|-----------------|------------------------------------------------|
| `id`         | BigAutoField PK | Identificador único                            |
| `match`      | FK → Match      | Match ao qual a mensagem pertence (CASCADE)    |
| `remetente`  | FK → Perfil     | Perfil que enviou a mensagem (CASCADE)         |
| `conteudo`   | TextField       | Texto da mensagem (máx. 1000 chars)            |
| `data_envio` | DateTimeField   | Criado automaticamente (`auto_now_add=True`)   |
| `lida`       | BooleanField    | `False` por padrão; marcado ao listar msgs     |

**Índice:** `(match, data_envio)` (`chat_mensag_match_i_36edce_idx`) para listagem eficiente por match.
**Restrições no banco:** `conteudo` com 1 a 1000 caracteres (`mensagem_conteudo_min_1_ck` e `mensagem_conteudo_max_1000_ck`).
**Ordenação padrão:** `data_envio ASC, id ASC`.

---

## Endpoints

Todos os endpoints exigem `Authorization: Bearer <access_token>`.

### `GET /api/conversas/`

Lista todas as conversas (matches) do usuário autenticado, ordenadas pela mensagem mais recente.

**Resposta 200:**

```json
[
  {
    "match_id": 42,
    "outro_perfil": {
      "id": 7,
      "nome": "João Vitor",
      "idade": 28,
      "regiao": "Pinheiros",
      "tipo": "oferecendo_vaga",
      "titulo_anuncio": "Quarto mobiliado em Pinheiros",
      "descricao_imovel": "Apartamento de 2 quartos próximo ao metrô...",
      "fotos_imovel": ["https://images.unsplash.com/photo-1522708323590?w=800"],
      "foto_perfil_url": "https://i.pravatar.cc/150?img=12",
      "tipo_imovel": "apartamento",
      "qtd_moradores": 2,
      "orcamento_min": "1000.00",
      "orcamento_max": "1800.00",
      "aceita_pets": false,
      "fumante": false
    },
    "score": 0.91,
    "ultima_mensagem": {
      "conteudo": "Podemos marcar uma visita?",
      "data_envio": "2026-10-17T19:30:00Z",
      "remetente_id": 5
    },
    "nao_lidas": 1
  }
]
```

`ultima_mensagem` é `null` quando ainda não há mensagens. `nao_lidas` conta apenas mensagens do **outro** participante ainda não lidas.

---

### `GET /api/matches/<match_id>/mensagens/`

Lista as mensagens do match. Marca automaticamente como `lida=True` as mensagens do outro participante.

**Query param opcional:** `?apos=<id>` — retorna apenas mensagens com `id > apos` (polling incremental). Deve ser um inteiro maior ou igual a 0; qualquer outro valor responde `400` com a mensagem `O parâmetro "apos" inválido. Informe um número inteiro. Informe o número da última mensagem já recebida.`

**Exemplo de requisição:**

```
GET /api/matches/42/mensagens/?apos=18
Authorization: Bearer eyJ...
```

**Resposta 200:**

```json
[
  {
    "id": 19,
    "match_id": 42,
    "remetente_id": 7,
    "conteudo": "Que tal quinta de manhã?",
    "data_envio": "2026-10-17T20:00:00Z",
    "lida": false
  }
]
```

**Erros:**
- `400` — `apos` inválido; usuário sem perfil criado
- `401` — sem token ou token expirado
- `403` — autenticado, mas não é participante do match; ou administrador
- `404` — match não existe

---

### `POST /api/matches/<match_id>/mensagens/`

Envia uma mensagem no match.

**Exemplo de requisição:**

```json
POST /api/matches/42/mensagens/
Authorization: Bearer eyJ...

{ "conteudo": "Oi! Ainda tem o quarto disponível?" }
```

**Resposta 201:**

```json
{
  "id": 20,
  "match_id": 42,
  "remetente_id": 5,
  "conteudo": "Oi! Ainda tem o quarto disponível?",
  "data_envio": "2026-10-17T20:05:00Z",
  "lida": false
}
```

**Erros e validações:**

| Condição                          | Status | Mensagem                                              |
|-----------------------------------|--------|-------------------------------------------------------|
| Sem token                         | 401    | —                                                     |
| Não participante                  | 403    | "Você não tem acesso a este match."                   |
| Match inexistente                 | 404    | "Match não encontrado."                               |
| `conteudo` vazio ou só espaços    | 400    | "O conteúdo da mensagem não pode ser vazio."          |
| `conteudo` com mais de 1000 chars | 400    | "O conteúdo da mensagem não pode ter mais de 1000 caracteres." |
| `conteudo` que não é texto (objeto, lista, número) | 400 | "O conteúdo da mensagem deve ser um texto."      |
| Corpo da requisição que não é um objeto JSON | 400 | "O corpo da requisição deve ser um objeto JSON." |
| O outro participante está com a conta suspensa | 403 | "Não é possível enviar mensagens: a conta do outro participante está suspensa." |
| Administrador                     | 403    | "O administrador não participa deste recurso."        |

---

## Regra de Acesso

Apenas os dois perfis que compõem o match (`perfil_a` e `perfil_b`) podem ler e escrever mensagens naquele match. Qualquer outro perfil autenticado recebe `403`. Se o match não existir, `404`.

A verificação é feita pelo helper `_verificar_participacao()` na view, que:
1. Recusa o administrador (`403`)
2. Busca o match pelo `match_id` (`404` se não existir; IDs fora do intervalo do banco também dão `404`)
3. Obtém o perfil do usuário autenticado (`400` se ainda não criou perfil)
4. Compara com `perfil_a_id` e `perfil_b_id` (`403` se não participa)

**Contas suspensas.** Conversas com uma conta suspensa não aparecem em `GET /api/conversas/` nem em `GET /api/matches/`, e o envio de mensagens nesse match é bloqueado (`403`).

---

## Fluxo Perfil → Descoberta → Match → Chat

```
1. Usuário cria perfil  →  POST /api/perfis/
2. Vê candidatos        →  GET  /api/descoberta/       (tipo oposto, com score)
3. Curte um perfil      →  POST /api/curtidas/         (tipo: "curtir")
4. Curtida mútua        →  resposta inclui match: true + match_data: { id, score, … }
5. Conversa criada      →  GET  /api/conversas/        (aparece para os dois)
6. Envia mensagem       →  POST /api/matches/<id>/mensagens/
7. Outro responde       →  POST /api/matches/<id>/mensagens/  (autenticado como o outro)
8. Polling incremental  →  GET  /api/matches/<id>/mensagens/?apos=<last_id>
9. Leitura automática   →  GET  /api/matches/<id>/mensagens/  marca como lida=True
10. Badge de não lidas  →  GET  /api/conversas/        campo nao_lidas
```

### Polling no Frontend

O `ChatScreen` usa `setInterval` de 4 segundos com `?apos=<last_id>` para buscar apenas mensagens novas. O polling não busca nada enquanto a aba do navegador está oculta (`document.hidden`) e é limpo no unmount do componente. O botão voltar do chat e o menu (⋮ → "Ver perfil" / "Denunciar") têm nome acessível (`Voltar`, `Mais opções`).

---

## Dados de Teste

Para popular o banco com mensagens realistas entre os matches seed:

```bash
python manage.py seed_perfis
python manage.py seed_matches
python manage.py seed_mensagens
```

Rodar duas vezes é seguro — `seed_mensagens` pula matches que já têm mensagens.
