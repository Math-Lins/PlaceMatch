"""Gera os artefatos de documentação da API a partir das chamadas reais capturadas.

Passo 1 — módulo de exemplos usado pelo schema OpenAPI (/api/docs/):
    python scripts/gerar_docs_api.py modulo <exemplos_api.json>          # grava placematch/exemplos_api.py

Passo 2 — docs/api.md (usa placematch/api_docs.py + o módulo do passo 1):
    python scripts/gerar_docs_api.py markdown                            # grava ../docs/api.md

As respostas vêm de scripts/gerar_exemplos_api.py (chamadas reais em banco descartável).
Listas longas são abreviadas (3 itens) e CSV mostra só as primeiras linhas; tokens e senhas já vêm mascarados.
"""
import json
import os
import pprint
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODULO = os.path.join(RAIZ, 'placematch', 'exemplos_api.py')
LIMITE_LISTA = 3
LINHAS_CSV = 4


def abreviar(valor):
    if isinstance(valor, dict):
        return {k: abreviar(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [abreviar(v) for v in valor[:LIMITE_LISTA]]
    if isinstance(valor, str) and '\n' in valor:  # CSV
        return '\n'.join(valor.splitlines()[:LINHAS_CSV])
    return valor


def modulo(caminho_json):
    dados = json.load(open(caminho_json, encoding='utf-8'))
    exemplos = {}
    for r in dados['registros']:
        exemplos[r['id']] = {
            'metodo': r['metodo'], 'rota': r['rota'], 'papel': r['papel'], 'nota': r['nota'],
            'corpo': r['corpo'], 'status': r['status'], 'content_type': r['content_type'],
            'resposta': abreviar(r['resposta']),
        }
    cab = ('"""Exemplos REAIS de requisição/resposta da API (GERADO — não edite).\n\n'
           'Gerado por scripts/gerar_docs_api.py a partir de chamadas executadas contra uma API em banco descartável\n'
           '(scripts/gerar_exemplos_api.py). Tokens e senhas aparecem como <TOKEN>, <REFRESH> e <SENHA>;\n'
           'listas longas foram abreviadas.\n"""\n\n')
    corpo = 'EXEMPLOS = ' + pprint.pformat(exemplos, width=110, sort_dicts=False) + '\n'
    open(MODULO, 'w', encoding='utf-8', newline='\n').write(cab + corpo)
    print(f'{len(exemplos)} exemplos em {MODULO}')


if __name__ == '__main__':
    comando = sys.argv[1] if len(sys.argv) > 1 else ''
    if comando == 'modulo':
        modulo(sys.argv[2])
    elif comando == 'markdown':
        from gerar_docs_markdown import gerar  # noqa: E402  (definido na etapa de documentação)
        gerar()
    else:
        sys.exit(__doc__)
