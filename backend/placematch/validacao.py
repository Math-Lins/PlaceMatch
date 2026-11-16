"""Helpers de validação de entrada compartilhados (sem dependência de DRF)."""

LIMITE_ID = 2 ** 63 - 1  # maior inteiro aceito pelo banco (bigint)


def inteiro(valor, rotulo, minimo=1):
    """Converte `valor` em int dentro de [minimo, LIMITE_ID]. Levanta ValueError em português."""
    if isinstance(valor, bool) or valor is None:
        raise ValueError(f'{rotulo} inválido. Informe um número inteiro.')
    if isinstance(valor, int):
        n = valor
    elif isinstance(valor, str) and valor.strip().isascii() and valor.strip().isdigit():
        n = int(valor.strip())
    else:
        raise ValueError(f'{rotulo} inválido. Informe um número inteiro.')
    if n < minimo or n > LIMITE_ID:
        raise ValueError(f'{rotulo} inválido. Informe um número inteiro válido.')
    return n


def texto(valor, rotulo, maximo=None, obrigatorio=False):
    """Garante que `valor` é texto (str) e respeita `maximo`. Retorna o texto (sem trim)."""
    if valor is None:
        valor = ''
    if not isinstance(valor, str):
        raise ValueError(f'{rotulo} deve ser um texto.')
    if obrigatorio and not valor.strip():
        raise ValueError(f'{rotulo} não pode ficar em branco.')
    if maximo is not None and len(valor) > maximo:
        raise ValueError(
            f'{rotulo} deve ter no máximo {maximo} caracteres (enviados: {len(valor)}).'
        )
    return valor


def escolha(valor, validos, rotulo, feminino=False):
    if valor not in validos:
        adjetivo = 'inválida' if feminino else 'inválido'
        raise ValueError(f'{rotulo} {adjetivo}. Use: {", ".join(validos)}.')
    return valor
