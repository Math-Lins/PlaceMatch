from django.contrib.auth.password_validation import validate_password as django_validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers

from .models import Usuario, gerar_username

_TRADUCOES_SENHA = {
    'This password is too short. It must contain at least 8 characters.':
        'A senha é muito curta. Deve ter no mínimo 8 caracteres.',
    'This password is too common.':
        'Esta senha é muito comum. Escolha uma senha mais segura.',
    'This password is entirely numeric.':
        'A senha não pode ser formada apenas por números.',
    'The password is too similar to the username.':
        'A senha é parecida demais com o nome de usuário.',
    'The password is too similar to the email address.':
        'A senha é parecida demais com o e-mail.',
    'The password is too similar to the first name.':
        'A senha é parecida demais com o nome.',
    'The password is too similar to the last name.':
        'A senha é parecida demais com o sobrenome.',
}


def validar_senha_nova(senha, usuario=None):
    """Mesmas regras de senha do cadastro (validadores do Django, mensagens em português).
    Levanta serializers.ValidationError com a lista de mensagens."""
    if len(senha) < 8:
        raise serializers.ValidationError('A senha deve ter no mínimo 8 caracteres.')
    try:
        django_validate_password(senha, user=usuario)
    except DjangoValidationError as e:
        raise serializers.ValidationError([_TRADUCOES_SENHA.get(msg, msg) for msg in e.messages])
    return senha


class RegistrarSerializer(serializers.ModelSerializer):
    # Contrato com o front: o nome continua chegando no campo `username`,
    # mas é gravado em `first_name`; o username real é gerado a partir do e-mail.
    username = serializers.CharField(
        source='first_name',
        max_length=150,
        error_messages={
            'required': 'O nome é obrigatório.',
            'blank': 'O nome não pode ficar em branco.',
            'null': 'O nome não pode ficar em branco.',
            'max_length': 'O nome deve ter no máximo 150 caracteres.',
        },
    )
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        error_messages={
            'required': 'A senha é obrigatória.',
            'blank': 'A senha não pode ficar em branco.',
            'null': 'A senha não pode ficar em branco.',
            'min_length': 'A senha deve ter no mínimo 8 caracteres.',
        },
    )
    # Declara explicitamente para remover o UniqueValidator gerado
    # automaticamente pelo ModelSerializer — a unicidade é checada
    # no validate_email com mensagem em português.
    email = serializers.EmailField(
        error_messages={
            'required': 'O e-mail é obrigatório.',
            'blank': 'O e-mail não pode ficar em branco.',
            'null': 'O e-mail não pode ficar em branco.',
            'invalid': 'Informe um e-mail válido.',
        },
    )
    # Apenas usuários comuns podem se auto-cadastrar; administrador só via
    # manage.py criar_admin.
    tipo = serializers.ChoiceField(
        choices=['buscando_vaga', 'oferecendo_vaga'],
        error_messages={
            'required': 'O tipo de conta é obrigatório.',
            'invalid_choice': (
                'Tipo de conta inválido. Use "buscando_vaga" ou "oferecendo_vaga".'
            ),
        },
    )

    class Meta:
        model = Usuario
        fields = ['username', 'email', 'password', 'tipo']

    def validate_username(self, value):
        nome = ' '.join(value.split())
        if len(nome) < 2:
            raise serializers.ValidationError('O nome deve ter pelo menos 2 caracteres.')
        return nome

    def validate_email(self, value):
        value = value.strip().lower()
        if Usuario.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Este e-mail já está cadastrado.')
        return value

    def validate_password(self, value):
        return validar_senha_nova(value)

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return Usuario.objects.create_user(
                    username=gerar_username(validated_data['email']),
                    **validated_data,
                )
        except IntegrityError:
            raise serializers.ValidationError({'email': ['Este e-mail já está cadastrado.']})


class UsuarioSerializer(serializers.ModelSerializer):
    # `username` continua existindo no contrato, mas devolve o nome do usuário.
    username = serializers.SerializerMethodField()
    nome = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'nome', 'email', 'tipo']

    def get_username(self, obj) -> str:
        return obj.nome_exibicao

    def get_nome(self, obj) -> str:
        return obj.nome_exibicao
