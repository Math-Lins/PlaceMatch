"""Recuperação de senha por e-mail.

- Token: `default_token_generator` do Django (HMAC da senha atual + último login + data). Vale por
  `PASSWORD_RESET_TIMEOUT` (1 hora) e **deixa de valer quando a senha muda** (inclusive pelo próprio uso).
- O `uid` é o id do usuário em base64 (URL segura).
- Só contas **ativas** recebem o link e só elas podem redefinir. Conta suspensa: nenhum e-mail é enviado e um
  link antigo é recusado como inválido (a suspensão não pode ser contornada por esta rota). O administrador
  (conta ativa) pode recuperar a senha como qualquer usuário: a posse da caixa de e-mail é a prova de identidade.
- Redefinir encerra TODAS as sessões abertas (refresh tokens vão para a lista de bloqueio).
"""
import logging
import sys

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.utils.encoding import force_bytes, force_str
from django.utils.html import escape
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import Usuario

logger = logging.getLogger(__name__)

MENSAGEM_SOLICITACAO = 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.'
MENSAGEM_LINK_INVALIDO = 'Link inválido ou expirado. Peça um novo link.'
MENSAGEM_REDEFINIDA = 'Senha redefinida. Entre com a nova senha.'
ASSUNTO = 'PlaceMatch: redefinição de senha'


def codificar_uid(usuario):
    return urlsafe_base64_encode(force_bytes(usuario.pk))


def usuario_ativo_pelo_uid(uid):
    """Usuário ATIVO cujo uid (base64) é `uid`; None se o uid for inválido, inexistente ou de conta suspensa."""
    try:
        pk = int(force_str(urlsafe_base64_decode(uid)))
        return Usuario.objects.filter(pk=pk, is_active=True).first()
    except (TypeError, ValueError, OverflowError, UnicodeDecodeError):
        return None


def token_valido(usuario, token):
    return bool(usuario) and isinstance(token, str) and default_token_generator.check_token(usuario, token)


def montar_link(usuario):
    base = settings.FRONTEND_URL.rstrip('/')
    return f'{base}/?screen=redefinir-senha&uid={codificar_uid(usuario)}&token={default_token_generator.make_token(usuario)}'


def _validade_em_texto():
    minutos = max(1, int(settings.PASSWORD_RESET_TIMEOUT) // 60)
    if minutos % 60 == 0:
        horas = minutos // 60
        return '1 hora' if horas == 1 else f'{horas} horas'
    return f'{minutos} minutos'


def enviar_link_de_redefinicao(usuario):
    """Envia o e-mail (texto + HTML). Falha de envio é registrada no logger e NÃO levanta: a resposta da API
    é sempre a mesma, para não revelar nada."""
    link = montar_link(usuario)
    nome = usuario.nome_exibicao or 'olá'
    validade = _validade_em_texto()
    texto = (
        f'Olá, {nome}!\n\n'
        'Recebemos um pedido para redefinir a senha da sua conta no PlaceMatch.\n\n'
        f'Para criar uma nova senha, abra o link abaixo. Ele vale por {validade} e só pode ser usado uma vez:\n'
        f'{link}\n\n'
        'Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.\n\n'
        'Equipe PlaceMatch\n'
    )
    html = (
        f'<p>Olá, {escape(nome)}!</p>'
        '<p>Recebemos um pedido para redefinir a senha da sua conta no PlaceMatch.</p>'
        f'<p>Para criar uma nova senha, clique no botão abaixo. O link vale por <strong>{escape(validade)}</strong> '
        'e só pode ser usado uma vez.</p>'
        f'<p><a href="{escape(link)}" style="display:inline-block;padding:12px 20px;background:#C4512E;color:#ffffff;'
        'border-radius:10px;text-decoration:none;font-weight:bold">Redefinir minha senha</a></p>'
        f'<p>Se o botão não abrir, copie este endereço no navegador:<br>{escape(link)}</p>'
        '<p>Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.</p>'
        '<p>Equipe PlaceMatch</p>'
    )
    try:
        mensagem = EmailMultiAlternatives(ASSUNTO, texto, settings.DEFAULT_FROM_EMAIL, [usuario.email])
        mensagem.attach_alternative(html, 'text/html')
        mensagem.send()
        if settings.EMAIL_BACKEND.endswith('console.EmailBackend'):
            # Desenvolvimento: o e-mail impresso no console sai com a codificação do MIME (=3D, quebras de linha).
            # Esta linha mostra o link inteiro, pronto para copiar. Não vai para os logs de auditoria.
            sys.stderr.write(f'\n[DESENVOLVIMENTO] Link de redefinição de senha para {usuario.email}:\n{link}\n\n')
        return True
    except Exception:  # noqa: BLE001 — SMTP fora do ar etc.; nunca vira 500 nem revela nada
        logger.exception('Falha ao enviar o e-mail de redefinição de senha (usuario_id=%s)', usuario.pk)
        return False


def encerrar_sessoes(usuario):
    """Coloca na lista de bloqueio todos os refresh tokens ainda não bloqueados. Retorna quantos foram."""
    pendentes = list(OutstandingToken.objects.filter(user=usuario, blacklistedtoken__isnull=True))
    BlacklistedToken.objects.bulk_create([BlacklistedToken(token=t) for t in pendentes], ignore_conflicts=True)
    return len(pendentes)
