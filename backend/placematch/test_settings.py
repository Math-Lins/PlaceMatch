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
