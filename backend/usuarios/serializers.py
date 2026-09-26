from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password as django_validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Usuario

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


class RegistrarSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    # Declara explicitamente para remover o UniqueValidator gerado
    # automaticamente pelo ModelSerializer — a unicidade é checada
    # no validate_email com mensagem em português.
    email = serializers.EmailField()

    class Meta:
        model = Usuario
        fields = ['username', 'email', 'password', 'tipo']

    def validate_email(self, value):
        if Usuario.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Este e-mail já está cadastrado.')
        return value

    def validate_password(self, value):
        try:
            django_validate_password(value)
        except DjangoValidationError as e:
            msgs = [_TRADUCOES_SENHA.get(msg, msg) for msg in e.messages]
            raise serializers.ValidationError(msgs)
        return value

    def create(self, validated_data):
        return Usuario.objects.create_user(**validated_data)


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id', 'username', 'email', 'tipo']
