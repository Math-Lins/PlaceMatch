import ipaddress
import logging

logger = logging.getLogger(__name__)


def _ip_valido(valor):
    try:
        ipaddress.ip_address((valor or '').strip())
    except ValueError:
        return None
    return valor.strip()


def _extrair_ip(request):
    """IP do cliente. Cabeçalho X-Forwarded-For inválido é ignorado (senão a gravação do log falharia)."""
    if request is None:
        return None
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        ip = _ip_valido(xff.split(',')[0])
        if ip:
            return ip
    return _ip_valido(request.META.get('REMOTE_ADDR'))


def registrar(acao, usuario=None, entidade='', entidade_id=None, detalhes=None, request=None):
    """
    Registra uma operação no log. Nunca levanta exceção — falhas são
    registradas apenas no logger do Python para não quebrar a operação principal.
    """
    from .models import LogOperacao
    try:
        LogOperacao.objects.create(
            acao=acao,
            usuario=usuario,
            entidade=entidade or '',
            entidade_id=entidade_id,
            detalhes=detalhes or {},
            ip=_extrair_ip(request),
        )
    except Exception:
        logger.exception('Erro ao gravar log (acao=%s, usuario=%s)', acao, usuario)
