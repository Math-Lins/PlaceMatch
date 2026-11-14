"""Padroniza em português (sem erros de digitação) as mensagens padrão do DRF/Django.

Chamado em UsuariosConfig.ready(), antes de qualquer serializer ser instanciado.
"""
from django.core import validators
from rest_framework import fields, relations, serializers

_GERAIS = {
    'required': 'Este campo é obrigatório.',
    'null': 'Este campo não pode ser nulo.',
    'blank': 'Este campo não pode ficar em branco.',
    'min_length': 'Certifique-se de que este campo tenha no mínimo {min_length} caracteres.',
    'max_length': 'Certifique-se de que este campo não tenha mais de {max_length} caracteres.',
    'min_value': 'Certifique-se de que este valor seja maior ou igual a {min_value}.',
    'max_value': 'Certifique-se de que este valor seja inferior ou igual a {max_value}.',
    'invalid_choice': '"{input}" não é uma opção válida.',
    'does_not_exist': 'O identificador "{pk_value}" não existe.',
    'incorrect_type': 'Valor inválido. Informe o número do identificador (recebido: {data_type}).',
}


def _classes(base):
    vistas, pilha = set(), [base]
    while pilha:
        c = pilha.pop()
        if c in vistas:
            continue
        vistas.add(c)
        pilha.extend(c.__subclasses__())
    return vistas


def aplicar():
    for base in (fields.Field, relations.RelatedField, serializers.BaseSerializer):
        for cls in _classes(base):
            msgs = cls.__dict__.get('default_error_messages')
            if not msgs:
                continue
            for chave, texto in _GERAIS.items():
                if chave in msgs:
                    msgs[chave] = texto
    validators.MinValueValidator.message = (
        'Certifique-se de que este valor seja maior ou igual a %(limit_value)s.'
    )
    validators.MaxValueValidator.message = (
        'Certifique-se de que este valor seja inferior ou igual a %(limit_value)s.'
    )
