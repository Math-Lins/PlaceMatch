import os

# Sem .env (CI) o DEBUG padrão é False e exigiria SECRET_KEY de produção já na importação.
os.environ.setdefault('DEBUG', 'True')

from .settings import *  # noqa

# Chave de teste com >= 32 bytes (também usada como chave de assinatura do JWT HS256).
SECRET_KEY = 'chave-somente-para-testes-0123456789-abcdef'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# Limite de login desligado nos testes comuns (os testes de limite ligam com override_settings).
LOGIN_LIMITE_IP = None
LOGIN_LIMITE_EMAIL = None
