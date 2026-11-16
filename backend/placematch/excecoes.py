"""Tratamento de exceções da API: mensagens sempre em português."""
import re

from django.http import Http404
from rest_framework.exceptions import NotFound
from rest_framework.views import exception_handler

_NOMES = {
    'Perfil': 'Perfil',
    'Match': 'Match',
    'Denuncia': 'Denúncia',
    'Usuario': 'Usuário',
    'Mensagem': 'Mensagem',
}


def tratar_excecao(exc, contexto):
    """Troca a mensagem em inglês do Http404 do Django ("No Perfil matches the given query.")."""
    if isinstance(exc, Http404):
        texto = str(exc.args[0]) if exc.args else ''
        achou = re.match(r'No (\w+) matches the given query', texto)
        nome = _NOMES.get(achou.group(1)) if achou else None
        exc = NotFound(f'{nome} não encontrado.' if nome else 'Recurso não encontrado.')
    return exception_handler(exc, contexto)
