from pathlib import Path
from datetime import timedelta
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')

# ─── Segurança ────────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv('SECRET_KEY', 'chave-local-insegura-nao-usar-em-producao')

# Seguro por padrão: sem a variável, DEBUG fica desligado. O desenvolvimento usa DEBUG=True no backend/.env.
DEBUG = os.getenv('DEBUG', 'False') == 'True'

# Em produção (DEBUG=False) a chave DEVE vir da variável de ambiente SECRET_KEY, com pelo
# menos 32 caracteres (também é a chave de assinatura do JWT/HS256). O valor padrão acima
# existe só para desenvolvimento local.
if not DEBUG and len(os.getenv('SECRET_KEY', '')) < 32:
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured(
        'Defina SECRET_KEY no ambiente com pelo menos 32 caracteres quando DEBUG=False.'
    )

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# ─── Apps instalados ──────────────────────────────────────────────────────────

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # terceiros
    'rest_framework',
    'rest_framework_simplejwt',
    'drf_spectacular',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    # projeto
    'usuarios',
    'perfis',
    'matches',
    'chat',
    'logs',
    'painel',
    'moderacao',
]

AUTH_USER_MODEL = 'usuarios.Usuario'

# ─── Middlewares ──────────────────────────────────────────────────────────────

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'placematch.nulos.QueryStringSemNulosMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'placematch.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'placematch.wsgi.application'

# ─── Banco de dados ───────────────────────────────────────────────────────────

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'placematch'),
        'USER': os.getenv('DB_USER', 'placematch_user'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

# ─── Validação de senhas ──────────────────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── Internacionalização ──────────────────────────────────────────────────────

LANGUAGE_CODE = 'pt-br'

TIME_ZONE = 'America/Sao_Paulo'

USE_I18N = True

USE_TZ = True

# ─── Arquivos estáticos ───────────────────────────────────────────────────────

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── Django REST Framework ────────────────────────────────────────────────────

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # Mesmos parsers padrão do DRF, com o JSON recusando o caractere nulo (veja placematch/nulos.py).
    'DEFAULT_PARSER_CLASSES': (
        'placematch.nulos.JSONParserSemNulos',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'placematch.excecoes.tratar_excecao',
}

# ─── Documentação da API (drf-spectacular) ────────────────────────────────────

SPECTACULAR_SETTINGS = {
    'TITLE': 'API do PlaceMatch',
    'DESCRIPTION': (
        'API REST do PlaceMatch: plataforma que conecta pessoas compatíveis para dividir moradia.\n\n'
        '**Autenticação:** faça `POST /api/auth/login/` e envie o `access` no cabeçalho `Authorization: Bearer <access>` '
        '(botão **Authorize**). O access dura 1 hora; renove com `POST /api/auth/login/refresh/`.\n\n'
        '**Erros:** sempre em português — `{"detail": "mensagem"}` ou `{"campo": ["mensagem"]}`.\n\n'
        'Os exemplos são respostas reais da API em um banco de teste (listas longas abreviadas).'
    ),
    'VERSION': '1.0.0-rc2',
    'SERVE_INCLUDE_SCHEMA': False,
    'SCHEMA_PATH_PREFIX': r'/api',
    'TAGS': [
        {'name': 'Autenticação', 'description': 'Cadastro, login por e-mail, renovação do token e usuário logado.'},
        {'name': 'Perfis', 'description': 'Perfil de matching e anúncio do imóvel (um perfil por usuário).'},
        {'name': 'Descoberta e Matches', 'description': 'Perfis compatíveis, curtidas (curtir/recusar) e matches.'},
        {'name': 'Chat', 'description': 'Conversas e mensagens entre as duas pessoas de um match.'},
        {'name': 'Moderação', 'description': 'Denúncias de usuários, análise pelo administrador e suspensão de contas.'},
        {'name': 'Painel administrativo', 'description': 'Dashboard, relatórios, lista de usuários e exportações CSV (somente administrador).'},
        {'name': 'Logs', 'description': 'Histórico de operações do sistema (somente administrador).'},
    ],
    'SERVERS': [{'url': 'http://localhost:8000', 'description': 'Desenvolvimento local'}],
    'SERVE_PERMISSIONS': ['placematch.permissoes.PermissaoDocs'],
    'SERVE_AUTHENTICATION': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'SWAGGER_UI_SETTINGS': {'persistAuthorization': True, 'displayRequestDuration': True, 'docExpansion': 'list'},
    'COMPONENT_SPLIT_REQUEST': True,
}

# ─── JWT ──────────────────────────────────────────────────────────────────────

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    # o refresh antigo deixa de valer ao ser trocado e também no logout (POST /api/auth/logout/)
    'BLACKLIST_AFTER_ROTATION': True,
}

# ─── CORS ─────────────────────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

# ─── Limite de tentativas de login (veja placematch/limites.py) ───────────────

# Formato 'N/min' ou 'N/hour'; vazio ou 'off' desliga.
LOGIN_LIMITE_IP = os.getenv('LOGIN_LIMITE_IP', '5/min')
LOGIN_LIMITE_EMAIL = os.getenv('LOGIN_LIMITE_EMAIL', '10/hour')
# Quantos proxies confiáveis existem na frente da API (0 = ignora o X-Forwarded-For).
PROXIES_CONFIAVEIS = int(os.getenv('PROXIES_CONFIAVEIS', '0') or 0)

# ─── Produção (tudo desligado por padrão; veja "Implantação em produção" no README) ─

def _flag(nome):
    return os.getenv(nome, 'False') == 'True'


SECURE_SSL_REDIRECT = _flag('SECURE_SSL_REDIRECT')
SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '0') or 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = _flag('SECURE_HSTS_INCLUDE_SUBDOMAINS')
SESSION_COOKIE_SECURE = _flag('SESSION_COOKIE_SECURE')
CSRF_COOKIE_SECURE = _flag('CSRF_COOKIE_SECURE')
if _flag('SECURE_PROXY_SSL_HEADER'):
    # o proxy confiável envia X-Forwarded-Proto: https
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# Origens do frontend em produção (separadas por vírgula), além das de desenvolvimento.
CORS_ALLOWED_ORIGINS += [o.strip() for o in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]

# ─── Recuperação de senha (veja usuarios/senha.py e "Recuperação de senha" no README) ──

# O link do e-mail vale por 1 hora (e deixa de valer assim que a senha muda).
PASSWORD_RESET_TIMEOUT = 3600
# Endereço do frontend usado no link do e-mail: {FRONTEND_URL}/?screen=redefinir-senha&uid=...&token=...
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
# Pedidos de link: por e-mail e por IP (mesmo formato do login; vazio ou 'off' desliga).
SENHA_LIMITE_EMAIL = os.getenv('SENHA_LIMITE_EMAIL', '3/15min')
SENHA_LIMITE_IP = os.getenv('SENHA_LIMITE_IP', '10/hour')

# E-mail. Desenvolvimento: sem EMAIL_HOST o e-mail é impresso no console do servidor (onde está o link).
# Produção: defina EMAIL_HOST (e as demais EMAIL_*) para enviar por SMTP. Nunca versione valores reais.
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND') or (
    'django.core.mail.backends.smtp.EmailBackend' if os.getenv('EMAIL_HOST') else 'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = os.getenv('EMAIL_HOST', '')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587') or 587)
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'PlaceMatch <nao-responda@placematch.local>')
if os.getenv('EMAIL_FILE_PATH'):  # só para o backend de arquivo (usado no e2e)
    EMAIL_FILE_PATH = os.getenv('EMAIL_FILE_PATH')
