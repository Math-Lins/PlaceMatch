import csv
import io
from datetime import date

from django.http import HttpResponse


def gerar_csv_response(cabecalho, linhas, prefixo_arquivo):
    """
    Gera HttpResponse CSV utf-8-sig, separador ';', cabeçalho em português.
    Nome do arquivo: <prefixo_arquivo>-AAAAMMDD.csv
    """
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(cabecalho)
    for linha in linhas:
        writer.writerow(linha)

    hoje = date.today().strftime('%Y%m%d')
    response = HttpResponse(
        '\ufeff' + output.getvalue(),
        content_type='text/csv; charset=utf-8-sig',
    )
    response['Content-Disposition'] = (
        f'attachment; filename="{prefixo_arquivo}-{hoje}.csv"'
    )
    return response
