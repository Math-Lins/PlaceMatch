"""Gera docs/api.md a partir de placematch/api_docs.py (anotações) e placematch/exemplos_api.py (respostas reais).

Uso:  python scripts/gerar_docs_api.py markdown
"""
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'placematch.test_settings')

import django  # noqa: E402

django.setup()

from django.conf import settings  # noqa: E402
from drf_spectacular.types import OpenApiTypes  # noqa: E402
from rest_framework import serializers  # noqa: E402

from placematch.api_docs import OPERACOES, erros_da_operacao  # noqa: E402
from placematch.exemplos_api import EXEMPLOS  # noqa: E402

SAIDA = os.path.join(os.path.dirname(RAIZ), 'docs', 'api.md')
GRUPOS = ['Autenticação', 'Perfis', 'Descoberta e Matches', 'Chat', 'Moderação', 'Painel administrativo', 'Afinidade por IA (ThoLuk)',
          'Processamento em lote', 'Logs']

TIPOS = {
    OpenApiTypes.INT: 'inteiro', OpenApiTypes.STR: 'texto', OpenApiTypes.DECIMAL: 'decimal',
    OpenApiTypes.FLOAT: 'número', OpenApiTypes.DATE: 'data (`AAAA-MM-DD`)',
}
PARAM_ROTA = {
    'id': 'Id do **perfil**.', 'match_id': 'Id do match.', 'denuncia_id': 'Id da denúncia.',
    'usuario_id': 'Id do **usuário** (não do perfil).', 'rel_id': 'Identificador do relatório.',
}
# Regras dos campos dos serializers de modelo (que não trazem help_text)
REGRAS = {
    'username': 'Nome da pessoa: 2 a 150 caracteres, aceita espaços e acentos (gravado em `first_name`).',
    'email': 'Formato de e-mail; único, sem diferenciar maiúsculas (gravado em minúsculas).',
    'password': 'Mínimo 8 caracteres; não pode ser só números nem uma senha comum.',
    'tipo': 'Tipo de conta.',
    'nome': '2 a 150 caracteres.', 'idade': '18 a 100.', 'regiao': '2 a 200 caracteres.', 'bio': 'Até 500 caracteres.',
    'orcamento_min': 'Maior que 0, até 99999999.99; não pode passar de `orcamento_max`.', 'orcamento_max': 'Maior ou igual a `orcamento_min`.',
    'fumante': 'Padrão `false`.', 'aceita_pets': 'Padrão `false`.',
    'tolerancia_bagunca': '1 a 5 (padrão 3).', 'nivel_organizacao': '1 a 5 (padrão 3).', 'nivel_ruido': '1 a 5 (padrão 3).', 'nivel_social': '1 a 5 (padrão 3).',
    'perfil_horario': '`madrugador`, `noturno` ou `flexivel` (padrão).', 'aceita_visitas': '`raramente`, `as_vezes` (padrão) ou `frequentemente`.',
    'tipo_imovel': '`apartamento`, `casa`, `republica` ou `indiferente` (padrão).', 'qtd_moradores': '1 a 4 (padrão 2).',
    'titulo_anuncio': 'Até 120 caracteres (anúncio).', 'descricao_imovel': 'Até 1000 caracteres (anúncio).',
    'fotos_imovel': 'Lista de até 5 URLs `http://` ou `https://` (até 500 caracteres cada).', 'foto_perfil_url': 'URL `http://` ou `https://` (até 500 caracteres).',
}


def js(v, indent=2):
    return json.dumps(v, ensure_ascii=False, indent=indent)


def tipo_do_campo(f):
    for cls, nome in ((serializers.BooleanField, 'booleano'), (serializers.IntegerField, 'inteiro'), (serializers.DecimalField, 'decimal'),
                      (serializers.FloatField, 'número'), (serializers.ListField, 'lista'), (serializers.JSONField, 'lista/objeto'),
                      (serializers.DateTimeField, 'data e hora'), (serializers.DateField, 'data'), (serializers.ChoiceField, 'texto (opções)'),
                      (serializers.BaseSerializer, 'objeto')):
        if isinstance(f, cls):
            return nome
    return 'texto'


def tabela_corpo(ser):
    """Tabela dos campos de entrada de um serializer."""
    ser = ser() if isinstance(ser, type) else ser
    linhas = ['| Campo | Tipo | Obrigatório | Regras |', '|---|---|---|---|']
    for nome, f in ser.get_fields().items():
        if f.read_only:
            continue
        regra = f.help_text or REGRAS.get(nome, '')
        if isinstance(f, serializers.ChoiceField) and not regra.endswith('.'):
            regra = (regra + ' ' if regra else '') + 'Valores: ' + ', '.join(f'`{c}`' for c in f.choices) + '.'
        elif isinstance(f, serializers.ChoiceField):
            regra += ' Valores: ' + ', '.join(f'`{c}`' for c in f.choices) + '.'
        linhas.append(f"| `{nome}` | {tipo_do_campo(f)} | {'sim' if f.required else 'não'} | {regra} |")
    return linhas


def tabela_parametros(params):
    linhas = ['| Parâmetro | Tipo | Valores aceitos / descrição |', '|---|---|---|']
    for p in params:
        tipo = TIPOS.get(p.type, 'texto')
        desc = (p.description or '')
        if p.enum:
            desc = ('Valores: ' + ', '.join(f'`{v}`' for v in p.enum) + '. ' + desc).strip()
        linhas.append(f'| `{p.name}` | {tipo} | {desc} |')
    return linhas


def curl(id_):
    e = EXEMPLOS[id_]
    partes = [f'curl -X {e["metodo"]} "<BASE>{e["rota"]}"']
    if e['papel'] != 'publico' and id_ not in ('me_sem_token',):
        partes.append('-H "Authorization: Bearer <TOKEN>"')
    if e['corpo'] is not None:
        partes.append('-H "Content-Type: application/json"')
        partes.append("-d '" + json.dumps(e['corpo'], ensure_ascii=False) + "'")
    return ' \\\n  '.join(partes)


def resposta(id_):
    e = EXEMPLOS[id_]
    r = e['resposta']
    if e['status'] == 204 or r is None:
        return f'HTTP {e["status"]}\n(sem corpo)'
    if isinstance(r, str):
        return f'HTTP {e["status"]}  ({e["content_type"]})\n{r}'
    return f'HTTP {e["status"]}\n' + js(r)


def bloco_exemplo(id_, rotulo=None):
    e = EXEMPLOS[id_]
    titulo = f'**{rotulo}**' if rotulo else '**Exemplo**'
    nota = f' — {e["nota"]}' if e['nota'] else ''
    return [f'{titulo}{nota}', '', '```bash', curl(id_), '```', '', '```json', resposta(id_), '```', '']


def secao_endpoint(chave):
    o = OPERACOES[chave]
    L = [f'### `{o["metodo"]} {o["rota"]}` — {o["resumo"]}', '']
    L.append(f'**Quem pode:** {o["quem"]}.  ')
    L.append(f'**Operação (OpenAPI):** `{chave}`')
    L += ['', o['descricao'], '']
    rota_params = re.findall(r'\{(\w+)\}', o['rota'])
    if rota_params:
        L += ['**Parâmetros de rota**', '', '| Parâmetro | Descrição |', '|---|---|']
        for p in rota_params:
            extra = ''
            if p == 'rel_id':
                extra = ' Valores: ' + ', '.join(f'`{r}`' for r in ('matches', 'compatibilidade-regiao', 'atividade', 'usuarios', 'denuncias')) + '.'
            L.append(f'| `{p}` | {PARAM_ROTA.get(p, "")}{extra} |')
        L.append('')
    if o.get('params'):
        L += ['**Parâmetros de consulta** (todos opcionais)', ''] + tabela_parametros(o['params']) + ['']
    if o.get('request') is not None:
        L += ['**Corpo de entrada** (JSON)', ''] + tabela_corpo(o['request']) + ['']
    # sucesso
    if 'ok' in o:
        st, _, id_ok, desc, extras = o['ok']
        L += [f'**Resposta de sucesso:** `{st}` — {desc}', '']
        L += bloco_exemplo(id_ok)
        for id_x, rot in extras:
            L += bloco_exemplo(id_x, rot)
        if 'csv' in o:
            L += bloco_exemplo(o['csv'][0], o['csv'][1] + ' (`formato=csv`)')
    else:
        id_csv, desc = o['csv_ok']
        L += [f'**Resposta de sucesso:** `200` — {desc} (`text/csv`, UTF-8 com BOM, separador `;`).', '']
        L += bloco_exemplo(id_csv)
    # erros
    erros = erros_da_operacao(chave)
    if erros:
        L += ['**Erros possíveis**', '', '| Status | Quando | Resposta real |', '|---|---|---|']
        for st, itens in erros.items():
            for id_, rotulo in itens:
                corpo = json.dumps(EXEMPLOS[id_]['resposta'], ensure_ascii=False)
                L.append(f'| `{st}` | {rotulo} | `{corpo}` |'.replace('|`', '| `'))
        L.append('')
    L.append('---')
    L.append('')
    return L


def roteiro():
    passos = [
        ('1. Cadastro', 'registrar_ok', 'Ana (quem procura vaga) e Bruno (quem oferece) se cadastram. O nome vai em `username`.'),
        ('2. Login', 'login_ok', 'Guarde o `access` (1 hora) e o `refresh` (7 dias). Nos próximos passos, use `<TOKEN>` da pessoa que faz a chamada.'),
        ('3. Perfil', 'perfil_criar', 'Cada pessoa cria o próprio perfil. Quem oferece vaga pode incluir o anúncio (veja `perfil_criar_anuncio`).'),
        ('4. Descoberta', 'descoberta_ok', 'Ana vê os perfis do tipo oposto, com o score de compatibilidade.'),
        ('5. Curtida', 'curtida_ok', 'Ana curte o perfil de Bruno (`perfil_destino` é o id do **perfil**). Ainda não há match.'),
        ('6. Match', 'curtida_match', 'Bruno curte Ana de volta: a resposta já traz `match: true` e os dados do match.'),
        ('7. Confirmar os matches', 'matches_ok', 'Ambos veem o match em `GET /api/matches/`.'),
        ('8. Mensagem', 'mensagem_enviar', 'Ana envia a primeira mensagem usando o `id` do match.'),
        ('9. Resposta e leitura', 'mensagem_responder', 'Bruno responde; depois `GET /api/matches/{id}/mensagens/` devolve a conversa e marca as mensagens do outro como lidas.'),
    ]
    L = ['## Roteiro de uso em sequência', '',
         'Fluxo completo com as chamadas reais usadas para gerar estes exemplos (Ana procura vaga; Bruno oferece vaga).', '']
    for titulo, id_, texto in passos:
        L += [f'### {titulo}', '', texto, '']
        L += bloco_exemplo(id_)[2:]
    return L


def gerar():
    L = []
    L += ['# API REST — PlaceMatch', '',
          '> Documento **gerado** por `backend/scripts/gerar_docs_api.py markdown` a partir das anotações do código '
          '(`backend/placematch/api_docs.py`) e de respostas **reais** da API. Não edite à mão: regenere (veja o final).', '',
          '## Visão geral', '',
          f'API REST em JSON (Django REST Framework), versão **{settings.SPECTACULAR_SETTINGS["VERSION"]}**, '
          f'com {len(OPERACOES)} operações em {len({o["rota"] for o in OPERACOES.values()})} rotas, organizadas em {len(GRUPOS)} grupos: '
          f'{", ".join(GRUPOS[:-1])} e {GRUPOS[-1]}.', '',
          '| Recurso | Onde |', '|---|---|',
          '| Documentação interativa (Swagger UI, com botão **Authorize**) | `<BASE>/api/docs/` |',
          '| Schema OpenAPI 3 | `<BASE>/api/schema/` e [`docs/openapi.yaml`](./openapi.yaml) |',
          '| Esta referência | `docs/api.md` |', '',
          '**Acesso à documentação interativa:** com `DEBUG=True` (desenvolvimento) as páginas `/api/docs/` e `/api/schema/` são abertas; '
          'com `DEBUG=False` (produção) só um **administrador** logado as vê (sessão do Django em `/admin/` ou token JWT de administrador).', '',
          '## URL base', '',
          'Em desenvolvimento: `http://localhost:8000` (nos exemplos, `<BASE>`). Todas as rotas da API começam com `/api/`.', '',
          '## Autenticação', '',
          '1. **Obter o token:** `POST /api/auth/login/` com `email` e `password` devolve `access` e `refresh` (JWT).',
          '2. **Enviar o token:** em toda chamada autenticada, cabeçalho `Authorization: Bearer <TOKEN>` (nos exemplos, `<TOKEN>` é o `access`).',
          '3. **Validade:** o `access` dura **1 hora**; o `refresh`, **7 dias**.',
          '4. **Renovar:** `POST /api/auth/login/refresh/` com o `refresh` devolve um novo `access` **e um novo `refresh`** (rotação): guarde o novo.',
          '5. **Token ausente, inválido ou expirado** → `401`. Conta suspensa não consegue entrar (`401`, "Conta suspensa. Procure o suporte.") e seus tokens deixam de valer.', '',
          'Somente `registrar`, `login` e `login/refresh` são públicos. O frontend guarda os tokens em `sessionStorage` (uma sessão por aba) e renova o `access` sozinho ao receber `401`.', '',
          '**Perfis de acesso** (campo `tipo` do usuário): `buscando_vaga` e `oferecendo_vaga` ("usuário comum") e `administrador`. '
          'O administrador só é criado por `python manage.py criar_admin` e **não participa** de Descoberta, curtidas, chat nem criação de perfil (recebe `403`).', '',
          '## Convenções', '',
          '- **Formato:** JSON (`Content-Type: application/json`); as exportações devolvem CSV (UTF-8 com BOM, separador `;`).',
          '- **Datas e horas:** filtros em `AAAA-MM-DD`; respostas em ISO 8601 com fuso (ex.: `2026-11-16T14:03:21.123456-03:00` ou `...Z`). Período inválido ou invertido → `400`.',
          '- **Números:** valores monetários (`orcamento_*`) são decimais; nas respostas de perfil vêm como texto (`"800.00"`). O `score` de compatibilidade vai de `0` a `1`.',
          '- **Ids:** `perfil_destino` (curtidas) e `{id}` de `/api/perfis/{id}/` são ids de **perfil**; `denunciado` e `{usuario_id}` (moderação) são ids de **usuário** (veja `usuario_id` e `usuario` nas respostas).',
          '- **Paginação** (usuários e logs do painel): `?page=` (padrão 1) e `?page_size=` (padrão 20, máximo 100). Resposta: `{"count", "page", "results"}`. Valor inválido volta ao padrão; página além do fim devolve `results: []`.',
          '- **Erros:** sempre em português. Dois formatos: `{"detail": "mensagem"}` (regra de negócio, permissão, filtro) e `{"campo": ["mensagem", ...]}` (validação por campo).',
          '- **Listas longas** nos exemplos abaixo foram abreviadas (3 itens); tokens e senhas aparecem como `<TOKEN>`, `<REFRESH>` e `<SENHA>`.', '',
          '## Códigos de resposta', '',
          '| Código | Significado | Quando |', '|---|---|---|',
          '| `200` OK | Sucesso | Consultas e atualizações |',
          '| `201` Created | Recurso criado | Cadastro, perfil, curtida, mensagem, denúncia |',
          '| `204` No Content | Sucesso sem corpo | Exclusão de perfil |',
          '| `400` Bad Request | Dados inválidos | Campo ausente/inválido, filtro inválido, regra de negócio, texto com caractere nulo (U+0000, no corpo JSON ou na query string) |',
          '| `401` Unauthorized | Não autenticado | Sem token, token inválido/expirado, credenciais erradas, conta suspensa |',
          '| `403` Forbidden | Sem permissão | Administrador em recurso de usuário, usuário comum em `/api/admin/`, perfil/match de outra pessoa |',
          '| `404` Not Found | Não encontrado | Perfil, match, denúncia, usuário ou relatório inexistente; perfil de conta suspensa na consulta e na curtida |',
          '| `500` | Erro interno | Não esperado: nenhuma entrada inválida deve gerar `500` |', '']

    L += ['## Índice de endpoints', '', '| Grupo | Método | Rota | Quem pode | Função |', '|---|---|---|---|---|']
    for g in GRUPOS:
        for chave, o in OPERACOES.items():
            if o['tag'] == g:
                L.append(f'| {g} | `{o["metodo"]}` | `{o["rota"]}` | {o["quem"].split(";")[0]} | {o["resumo"]} |')
    L.append('')
    for g in GRUPOS:
        L += [f'## {g}', '']
        for chave, o in OPERACOES.items():
            if o['tag'] == g:
                L += secao_endpoint(chave)
    L += roteiro()
    L += ['', '## Como regenerar esta documentação', '',
          '```bash',
          '# 1. banco descartável (NUNCA o de desenvolvimento) e API de teste em http://127.0.0.1:8001 com o administrador criado',
          '# 2. chamadas reais -> respostas capturadas',
          'ADMIN_EMAIL=... ADMIN_SENHA=... python scripts/gerar_exemplos_api.py exemplos.json http://127.0.0.1:8001',
          '# 3. módulo de exemplos usado pelo schema, schema OpenAPI e este arquivo',
          'python scripts/gerar_docs_api.py modulo exemplos.json',
          'python manage.py spectacular --validate --fail-on-warn --file ../docs/openapi.yaml',
          'python scripts/gerar_docs_api.py markdown',
          '```', '']
    open(SAIDA, 'w', encoding='utf-8', newline='\n').write('\n'.join(L))
    print(f'{len(OPERACOES)} operações documentadas em {SAIDA}')


if __name__ == '__main__':
    gerar()
