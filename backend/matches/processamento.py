"""
Recálculo COMPLETO das compatibilidades (comando recalcular_compatibilidades), em paralelo.

1. carregar  — 2 consultas: os atributos de todos os perfis buscando/oferecendo e os embeddings válidos,
               convertidos UMA vez em arrays NumPy (matriz.Grupo);
2. calcular  — matriz buscando × oferecendo em blocos, no modo escolhido (algoritmo/paralelo.py). Os workers
               só fazem conta: não acessam o banco nem carregam o modelo de IA;
3. gravar    — o processo principal junta os blocos e grava tudo com bulk_create (upsert) em UMA transação.

O uso normal (salvar perfil → signal → servicos.recalcular_lote; Descoberta) não passa por aqui.
"""

from __future__ import annotations

import logging
import os
import time

import numpy as np
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from perfis.models import Perfil

from .algoritmo import paralelo
from .algoritmo.afinidade import ia_ligada
from .algoritmo.matriz import ESCALA, Grupo, montar_grupo
from .models import Compatibilidade

logger = logging.getLogger('matches.processamento')

MODOS_COMANDO = ('auto',) + paralelo.MODOS
# Modo 'auto' (medido com benchmark_paralelismo, docs/algoritmo-compatibilidade.md, seção 12): threads a partir
# deste número de pares; abaixo dele o cálculo leva menos de ~0,5 s e o paralelismo não muda nada. Threads e
# não processos porque, no Windows, subir cada worker de processo custa ~3 s: os processos perderam do
# sequencial até 5.000 perfis (6,25 milhões de pares) e não ganharam de forma consistente acima disso,
# enquanto as threads não têm esse custo fixo.
LIMIAR_PARES_PARALELO = 1_000_000
MODO_AUTO_PARALELO = 'threads'

CAMPOS = ('id', 'usuario__tipo', 'orcamento_min', 'orcamento_max', 'regiao', 'perfil_horario', 'nivel_ruido',
          'fumante', 'aceita_pets', 'aceita_visitas', 'tolerancia_bagunca', 'nivel_organizacao', 'nivel_social',
          'tipo_imovel', 'qtd_moradores', 'idade')


def workers_padrao() -> int:
    """PROCESSAMENTO_WORKERS (settings); se ausente ou inválido, min(4, núcleos)."""
    padrao = max(1, min(4, os.cpu_count() or 1))
    valor = getattr(settings, 'PROCESSAMENTO_WORKERS', None)
    try:
        valor = int(valor)
    except (TypeError, ValueError):
        return padrao
    return valor if 1 <= valor <= paralelo.MAX_WORKERS else padrao


def carregar() -> tuple[Grupo, Grupo, bool]:
    """(buscando, oferecendo, com_ia): todos os perfis e embeddings em arrays, com 2 consultas."""
    from ia.models import EmbeddingPerfil
    from ia.servico import nome_modelo

    linhas = list(Perfil.objects.filter(usuario__tipo__in=('buscando_vaga', 'oferecendo_vaga'))
                  .order_by('id').values(*CAMPOS))
    com_ia = ia_ligada()
    if com_ia:
        vetores = {pid: np.frombuffer(bytes(v), dtype='<f4')
                   for pid, v in EmbeddingPerfil.objects.filter(modelo=nome_modelo()).values_list('perfil_id', 'vetor')}
        for p in linhas:
            p['vetor'] = vetores.get(p['id'])
    regioes: dict[str, int] = {}
    A = montar_grupo([p for p in linhas if p['usuario__tipo'] == 'buscando_vaga'], regioes)
    B = montar_grupo([p for p in linhas if p['usuario__tipo'] == 'oferecendo_vaga'], regioes)
    return A, B, com_ia


def escolher_modo(modo: str, pares: int) -> str:
    if modo != 'auto':
        return modo
    return MODO_AUTO_PARALELO if pares >= LIMIAR_PARES_PARALELO else 'sequencial'


def objetos(A: Grupo, B: Grupo, res: paralelo.Resultado, agora=None) -> list[Compatibilidade]:
    """Uma Compatibilidade por par (perfil_a = menor id), com score = k / 10000 (= round(score, 4))."""
    agora = agora or timezone.now()
    ids_b = B.ids.tolist()
    saida = []
    for id_a, linha in zip(A.ids.tolist(), res.matriz.tolist()):
        for id_b, k in zip(ids_b, linha):
            pa, pb = (id_a, id_b) if id_a < id_b else (id_b, id_a)
            saida.append(Compatibilidade(perfil_a_id=pa, perfil_b_id=pb, score=k / ESCALA, atualizado_em=agora))
    return saida


def gravar(lista: list[Compatibilidade]) -> None:
    with transaction.atomic():
        Compatibilidade.objects.bulk_create(
            lista, update_conflicts=True, unique_fields=['perfil_a', 'perfil_b'],
            update_fields=['score', 'atualizado_em'], batch_size=1000,
        )


def recalcular_todas(modo: str = 'auto', workers: int | None = None) -> dict:
    """Carrega, calcula (no modo pedido) e grava. Devolve os tempos de cada fase e o que foi usado."""
    workers = workers_padrao() if workers is None else workers
    if modo not in MODOS_COMANDO:
        raise ValueError(f'Modo inválido: {modo!r}. Use um destes: {", ".join(MODOS_COMANDO)}.')
    paralelo.validar('sequencial', workers)  # só valida o número de workers

    t0 = time.perf_counter()
    A, B, com_ia = carregar()
    t1 = time.perf_counter()
    pares = len(A) * len(B)
    efetivo = escolher_modo(modo, pares)
    res = paralelo.calcular_todos(A, B, efetivo, workers, com_ia=com_ia)
    t2 = time.perf_counter()
    lista = objetos(A, B, res)
    if lista:
        gravar(lista)
    t3 = time.perf_counter()
    return {
        'buscando': len(A), 'oferecendo': len(B), 'pares': pares, 'com_ia': com_ia,
        'modo_pedido': modo, 'modo': res.modo, 'workers': res.workers, 'aviso': res.aviso,
        'tempo_carregar_s': t1 - t0, 'tempo_calcular_s': t2 - t1, 'tempo_gravar_s': t3 - t2, 'tempo_total_s': t3 - t0,
        'memoria_workers_mb': res.memoria_workers_mb, 'memoria_principal_mb': paralelo.pico_memoria_mb(),
    }
