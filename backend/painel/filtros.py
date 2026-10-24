from datetime import date

from django.utils.timezone import make_aware
from django.utils import timezone
from rest_framework.response import Response
from rest_framework import status


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
        except (ValueError, AttributeError):
            return None, None, Response(
                {'detail': 'Formato de data_inicio inválido. Use AAAA-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if data_fim_str:
        try:
            d = date.fromisoformat(data_fim_str)
            data_fim_dt = make_aware(
                timezone.datetime(d.year, d.month, d.day, 23, 59, 59)
            )
        except (ValueError, AttributeError):
            return None, None, Response(
                {'detail': 'Formato de data_fim inválido. Use AAAA-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if data_inicio_dt and data_fim_dt and data_inicio_dt > data_fim_dt:
        return None, None, Response(
            {'detail': 'data_inicio não pode ser maior que data_fim.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return data_inicio_dt, data_fim_dt, None
