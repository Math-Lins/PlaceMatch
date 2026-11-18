"""Rejeita o caractere nulo (U+0000) vindo do cliente.

O PostgreSQL não aceita NUL em texto (nem em JSON): sem esta barreira, um texto com `\\u0000`
(corpo JSON) ou `%00` (query string) chegava ao banco e a API respondia 500. Aqui a resposta é 400,
em português, antes de qualquer consulta.
"""
from urllib.parse import unquote_plus

from django.http import JsonResponse
from rest_framework.exceptions import ParseError
from rest_framework.parsers import JSONParser

MENSAGEM_NULO = 'O texto enviado contém um caractere inválido (caractere nulo). Remova-o e tente novamente.'


def contem_nulo(valor):
    """True se `valor` (texto, lista ou dicionário, em qualquer nível) tem o caractere nulo."""
    if isinstance(valor, str):
        return '\x00' in valor
    if isinstance(valor, dict):
        return any(contem_nulo(k) or contem_nulo(v) for k, v in valor.items())
    if isinstance(valor, (list, tuple)):
        return any(contem_nulo(v) for v in valor)
    return False


class JSONParserSemNulos(JSONParser):
    """Mesmo parser JSON do DRF, mas recusa (400) corpo com caractere nulo em qualquer campo."""

    def parse(self, stream, media_type=None, parser_context=None):
        dados = super().parse(stream, media_type, parser_context)
        if contem_nulo(dados):
            raise ParseError(MENSAGEM_NULO)
        return dados


class QueryStringSemNulosMiddleware:
    """Responde 400 quando a query string (`?q=%00`) traz o caractere nulo."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if '\x00' in unquote_plus(request.META.get('QUERY_STRING', '')):
            return JsonResponse({'detail': MENSAGEM_NULO}, status=400)
        return self.get_response(request)
