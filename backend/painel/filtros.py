from datetime import date

from django.utils.timezone import make_aware
from django.utils import timezone
from rest_framework.response import Response
from rest_framework import status

from placematch import validacao

TIPOS_USUARIO = ('buscando_vaga', 'oferecendo_vaga', 'administrador')


def resposta_400(mensagem):
    return Response({'detail': mensagem}, status=status.HTTP_400_BAD_REQUEST)


def corpo_invalido(request):
    """Retorna Response 400 se o corpo JSON não for um objeto (ex.: lista)."""
    if not hasattr(request.data, 'get'):
        return resposta_400('O corpo da requisição deve ser um objeto JSON.')
    return None


PAGINA_MAXIMA = 1_000_000_000  # evita OFFSET maior que o bigint do banco (resultaria em erro 500)


def ler_paginacao(params, tamanho_padrao=20, tamanho_maximo=100):
    """Lê `page` e `page_size` da query string. Valores inválidos viram o padrão; nunca levanta."""
    try:
        page = min(PAGINA_MAXIMA, max(1, int(params.get('page', 1))))
    except (ValueError, TypeError):
        page = 1
    try:
        page_size = min(tamanho_maximo, max(1, int(params.get('page_size', tamanho_padrao))))
    except (ValueError, TypeError):
        page_size = tamanho_padrao
    return page, page_size


def validar_escolha_param(valor, validos, rotulo, feminino=False):
    """Valida `valor` (None/'' = não informado) contra `validos`. Retorna Response ou None."""
    if valor in (None, ''):
        return None
    try:
        validacao.escolha(valor, list(validos), rotulo, feminino)
    except ValueError as e:
        return resposta_400(str(e))
    return None


def validar_bool_param(valor, rotulo):
    if valor is None:
        return None
    if valor.lower() not in ('true', 'false'):
        return resposta_400(f'Valor inválido para {rotulo}. Use true ou false.')
    return None


DATA_MINIMA = date(2000, 1, 1)
PERIODO_MAXIMO_DIAS = 366


def validar_amplitude(inicio, fim):
    """Response 400 se o período (datas já interpretadas) passar de 366 dias; senão None."""
    if inicio and fim and (fim.date() - inicio.date()).days + 1 > PERIODO_MAXIMO_DIAS:
        return resposta_400(f'O período não pode passar de {PERIODO_MAXIMO_DIAS} dias. Reduza o intervalo entre as datas.')
    return None


def validar_e_parsear_datas(params):
    """
    Valida e converte data_inicio / data_fim da query string.
    Retorna (data_inicio_dt, data_fim_dt, erro_response).
    erro_response é None em caso de sucesso.
    - Formato inválido → 400
    - data_inicio > data_fim → 400
    """
    data_inicio_str = params.get('data_inicio')
    data_fim_str = params.get('data_fim')

    data_inicio_dt = None
    data_fim_dt = None

    if data_inicio_str:
        try:
            d = date.fromisoformat(data_inicio_str)
            data_inicio_dt = make_aware(
                timezone.datetime(d.year, d.month, d.day, 0, 0, 0)
            )
        except (ValueError, AttributeError, OverflowError):
            return None, None, Response(
                {'detail': 'Formato de data_inicio inválido. Use AAAA-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if data_fim_str:
        try:
            d = date.fromisoformat(data_fim_str)
            # fim do dia inteiro, com microssegundos (senão sobra o último segundo de fora)
            data_fim_dt = make_aware(
                timezone.datetime(d.year, d.month, d.day, 23, 59, 59, 999999)
            )
        except (ValueError, AttributeError, OverflowError):
            return None, None, Response(
                {'detail': 'Formato de data_fim inválido. Use AAAA-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if data_inicio_dt and data_fim_dt and data_inicio_dt > data_fim_dt:
        return None, None, Response(
            {'detail': 'data_inicio não pode ser maior que data_fim.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    for rotulo, dt in (('data_inicio', data_inicio_dt), ('data_fim', data_fim_dt)):
        if dt and dt.date() < DATA_MINIMA:
            return None, None, resposta_400(f'{rotulo} não pode ser anterior a 01/01/2000.')
    erro = validar_amplitude(data_inicio_dt, data_fim_dt)
    if erro:
        return None, None, erro

    return data_inicio_dt, data_fim_dt, None
