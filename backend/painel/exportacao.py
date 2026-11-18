import csv
import io
from datetime import date, datetime
from decimal import Decimal

from django.http import HttpResponse
from django.utils import timezone


_INICIO_DE_FORMULA = ('=', '+', '-', '@', '\t', '\r')


def celula_br(valor):
    """
    Converte um valor para o formato brasileiro usado nos CSVs:
    datas dd/mm/aaaa, data e hora dd/mm/aaaa hh:mm:ss (fuso local),
    decimais com vírgula e booleanos Sim/Não. Textos que começam com = + - @ ganham um apóstrofo
    na frente (proteção contra injeção de fórmula). Demais valores ficam como estão.
    """
    if valor is None:
        return ''
    if isinstance(valor, bool):
        return 'Sim' if valor else 'Não'
    if isinstance(valor, datetime):
        if timezone.is_aware(valor):
            valor = timezone.localtime(valor)
        return valor.strftime('%d/%m/%Y %H:%M:%S')
    if isinstance(valor, date):
        return valor.strftime('%d/%m/%Y')
    if isinstance(valor, (float, Decimal)):
        return f'{float(valor):.2f}'.replace('.', ',')
    if isinstance(valor, str) and valor[:1] in _INICIO_DE_FORMULA:
        # Injeção de fórmula: o Excel/LibreOffice executa células que começam com = + - @ (ou TAB/CR).
        # O apóstrofo faz a planilha tratar o conteúdo como texto.
        return "'" + valor
    return valor


def gerar_csv_response(cabecalho, linhas, prefixo_arquivo):
    """
    Gera HttpResponse CSV utf-8-sig, separador ';', cabeçalho em português
    e valores no formato brasileiro (ver celula_br).
    Nome do arquivo: <prefixo_arquivo>-AAAAMMDD.csv
    """
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(cabecalho)
    for linha in linhas:
        writer.writerow([celula_br(v) for v in linha])

    hoje = timezone.localdate().strftime('%Y%m%d')
    response = HttpResponse(
        '﻿' + output.getvalue(),
        content_type='text/csv; charset=utf-8-sig',
    )
    response['Content-Disposition'] = (
        f'attachment; filename="{prefixo_arquivo}-{hoje}.csv"'
    )
    return response
