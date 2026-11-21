"""
Execução do cálculo em matriz (matriz.py) em vários núcleos — sem Django, sem banco e sem modelo de IA.

Modos:
  sequencial — todos os blocos no processo atual, um depois do outro (linha de base);
  threads    — ThreadPoolExecutor: os workers dividem a MESMA memória; o NumPy solta o GIL durante as
               operações em arrays grandes, então mais de um núcleo trabalha ao mesmo tempo, mas o código
               Python entre elas (montar cada bloco, o loop) volta a disputar o GIL;
  processos  — ProcessPoolExecutor (spawn): cada worker é um interpretador separado (sem GIL compartilhado).
               Os arrays dos dois grupos são copiados UMA vez para memória compartilhada
               (multiprocessing.shared_memory) e o initializer de cada worker recebe só os nomes e formatos e
               monta os arrays sobre ela, sem cópia. Cada tarefa é só um grupo de blocos (i0, i1, j0, j1);
               o worker escreve os scores direto na matriz de saída, também compartilhada (nenhum resultado
               volta pelo pipe; cada bloco pertence a um worker só, então não há escrita concorrente).
               Por que não mandar os arrays nos argumentos do initializer: no Windows o pai escreve esses
               argumentos no pipe de cada filho e fica bloqueado até o filho lê-los (depois de importar o
               NumPy, ~1,5 s), então os workers subiam um depois do outro (medido: 2 workers levavam 4,8 s
               só para começar).

A divisão em blocos (matriz.blocos) depende só do tamanho dos dados; os workers só escolhem QUEM calcula
cada bloco. Por isso o resultado é idêntico com qualquer modo e qualquer número de workers.

Em todos os modos, o BLAS (produto de matrizes dos embeddings) usa 1 thread por worker (threadpoolctl):
sem isso, 4 workers × 4 threads do OpenBLAS disputariam 4 núcleos lógicos, e o "sequencial" já usaria
vários núcleos escondido, deixando a comparação desonesta.

Se o pool falhar (não consegue criar processos, falta de memória, worker morto), o cálculo é refeito no
modo sequencial e o aviso vai para o log (logger matches.processamento).
"""

from __future__ import annotations

import contextlib
import logging
import multiprocessing
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from dataclasses import dataclass, field

import numpy as np

from .matriz import Grupo, blocos, calcular_bloco

logger = logging.getLogger('matches.processamento')

MODOS = ('sequencial', 'threads', 'processos')
MAX_WORKERS = 16


# ── Memória (pico do processo, sem dependências) ──────────────────────────────

_MEDIDOR: list = []  # (função, estrutura) do Windows, criados uma vez por processo


def _medidor_windows():
    if not _MEDIDOR:
        import ctypes
        from ctypes import wintypes

        class _Contadores(ctypes.Structure):
            _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD),
                        ('PeakWorkingSetSize', ctypes.c_size_t), ('WorkingSetSize', ctypes.c_size_t),
                        ('QuotaPeakPagedPoolUsage', ctypes.c_size_t), ('QuotaPagedPoolUsage', ctypes.c_size_t),
                        ('QuotaPeakNonPagedPoolUsage', ctypes.c_size_t), ('QuotaNonPagedPoolUsage', ctypes.c_size_t),
                        ('PagefileUsage', ctypes.c_size_t), ('PeakPagefileUsage', ctypes.c_size_t)]

        kernel32, psapi = ctypes.WinDLL('kernel32'), ctypes.WinDLL('psapi')
        kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(_Contadores), wintypes.DWORD]
        contadores = _Contadores()
        contadores.cb = ctypes.sizeof(contadores)
        processo = kernel32.GetCurrentProcess()

        def medir():
            if psapi.GetProcessMemoryInfo(processo, ctypes.byref(contadores), contadores.cb):
                return contadores.PeakWorkingSetSize
            return None

        _MEDIDOR.append(medir)
    return _MEDIDOR[0]


def pico_memoria_mb() -> float | None:
    """Pico de memória residente do processo atual, em MB (Windows: PeakWorkingSetSize; Linux: ru_maxrss)."""
    try:
        if sys.platform == 'win32':
            pico = _medidor_windows()()
            return round(pico / 2**20, 1) if pico is not None else None
        import resource
        pico = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return round(pico / (2**20 if sys.platform == 'darwin' else 2**10), 1)
    except Exception:  # noqa: BLE001 — informação opcional; nunca interrompe o cálculo
        return None


def memoria_livre_mb() -> float | None:
    """Memória física disponível na máquina, em MB (None se não der para saber)."""
    try:
        if sys.platform == 'win32':
            import ctypes

            class _Status(ctypes.Structure):
                _fields_ = [('dwLength', ctypes.c_ulong), ('dwMemoryLoad', ctypes.c_ulong),
                            ('ullTotalPhys', ctypes.c_ulonglong), ('ullAvailPhys', ctypes.c_ulonglong),
                            ('ullTotalPageFile', ctypes.c_ulonglong), ('ullAvailPageFile', ctypes.c_ulonglong),
                            ('ullTotalVirtual', ctypes.c_ulonglong), ('ullAvailVirtual', ctypes.c_ulonglong),
                            ('ullAvailExtendedVirtual', ctypes.c_ulonglong)]

            st = _Status()
            st.dwLength = ctypes.sizeof(st)
            if ctypes.WinDLL('kernel32').GlobalMemoryStatusEx(ctypes.byref(st)):
                return round(st.ullAvailPhys / 2**20, 1)
            return None
        with open('/proc/meminfo', encoding='ascii') as f:
            for linha in f:
                if linha.startswith('MemAvailable:'):
                    return round(int(linha.split()[1]) / 1024, 1)
        return None
    except Exception:  # noqa: BLE001 — informação opcional
        return None


def memoria_total_mb() -> float | None:
    try:
        if sys.platform == 'win32':
            import ctypes
            kb = ctypes.c_ulonglong()
            if ctypes.WinDLL('kernel32').GetPhysicallyInstalledSystemMemory(ctypes.byref(kb)):
                return round(kb.value / 1024, 1)
            return None
        return round(os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES') / 2**20, 1)
    except Exception:  # noqa: BLE001
        return None


@contextlib.contextmanager
def _blas_uma_thread():
    try:
        from threadpoolctl import threadpool_limits
    except ImportError:  # pragma: no cover — dependência do requirements.txt
        yield
        return
    with threadpool_limits(limits=1):
        yield


# ── Worker de processo ─────────────────────────────────────────────────────────

_DADOS: dict = {}
_ALINHAMENTO = 64


def compartilhar(grupo: Grupo):
    """Copia os arrays do grupo (e os vetores em float64) para UM bloco de memória compartilhada."""
    from multiprocessing import shared_memory

    arrays = {c: getattr(grupo, c) for c in grupo.__dataclass_fields__ if c != 'vetores'}
    arrays['_vetores64'] = grupo.vetores64()
    layout, deslocamento = {}, 0
    for nome, a in arrays.items():
        layout[nome] = (deslocamento, a.shape, a.dtype.str)
        deslocamento += -(-a.nbytes // _ALINHAMENTO) * _ALINHAMENTO
    shm = shared_memory.SharedMemory(create=True, size=max(deslocamento, 1))
    for nome, a in arrays.items():
        inicio, forma, tipo = layout[nome]
        np.ndarray(forma, dtype=tipo, buffer=shm.buf, offset=inicio)[...] = a
    return shm, (shm.name, layout)


def anexar(descritor):
    """(SharedMemory, Grupo) montado sobre a memória compartilhada, sem cópia (usado no worker)."""
    nome, layout = descritor
    shm = _abrir(nome)
    arrays = {c: np.ndarray(forma, dtype=tipo, buffer=shm.buf, offset=inicio)
              for c, (inicio, forma, tipo) in layout.items()}
    v64 = arrays.pop('_vetores64')
    grupo = Grupo(**arrays, vetores=np.empty((v64.shape[0], 0), dtype=np.float32))  # float32 não é usado aqui
    grupo.__dict__['_vetores64'] = v64
    return shm, grupo


def _abrir(nome: str):
    from multiprocessing import shared_memory
    try:
        return shared_memory.SharedMemory(name=nome, track=False)  # Python 3.13+: o pai é quem libera
    except TypeError:  # pragma: no cover — Python < 3.13
        return shared_memory.SharedMemory(name=nome)


def _iniciar_worker(desc_a, desc_b, desc_saida, pesos: dict | None, com_ia: bool) -> None:
    """
    initializer do ProcessPoolExecutor: anexa os arrays de entrada e a matriz de saída (memória compartilhada)
    e limita o BLAS a 1 thread.
    """
    try:
        from threadpoolctl import threadpool_limits
        threadpool_limits(limits=1)
    except ImportError:  # pragma: no cover
        pass
    shm_a, A = anexar(desc_a)
    shm_b, B = anexar(desc_b)
    nome, forma = desc_saida
    shm_s = _abrir(nome)
    saida = np.ndarray(forma, dtype=np.uint16, buffer=shm_s.buf)
    _DADOS.update(A=A, B=B, saida=saida, pesos=pesos, com_ia=com_ia, _shm=(shm_a, shm_b, shm_s))


def _tarefa_processo(lote: list):
    """Calcula os blocos e escreve direto na matriz de saída compartilhada (cada bloco é de um worker só)."""
    for b in lote:
        _colocar(_DADOS['saida'], b, calcular_bloco(_DADOS['A'], _DADOS['B'], b, _DADOS['pesos'], _DADOS['com_ia']))
    return os.getpid(), pico_memoria_mb()


# ── Execução ───────────────────────────────────────────────────────────────────

@dataclass
class Resultado:
    """Scores × 10000 de todos os pares (matriz uint16 n_a × n_b), mais o que foi medido."""

    matriz: np.ndarray
    modo: str                     # modo efetivamente usado (pode ser 'sequencial' depois de uma falha)
    workers: int
    modo_pedido: str = ''
    aviso: str = ''
    tempo_s: float = 0.0
    memoria_workers_mb: dict = field(default_factory=dict)   # pid → pico (só no modo processos)


def validar(modo: str, workers: int) -> None:
    if modo not in MODOS:
        raise ValueError(f'Modo inválido: {modo!r}. Use um destes: {", ".join(MODOS)}.')
    if not isinstance(workers, int) or isinstance(workers, bool) or not 1 <= workers <= MAX_WORKERS:
        raise ValueError(f'O número de workers deve ser um inteiro entre 1 e {MAX_WORKERS} (recebido: {workers!r}).')


def _contexto():
    """
    forkserver (Linux/Docker): os workers nascem de um processo servidor limpo, que já importou este módulo
    (e o NumPy) uma vez — subir um worker custa milissegundos e nada do Django (conexões ao banco, threads) é
    herdado. spawn (Windows, onde não existe fork): cada worker é um interpretador novo que importa o NumPy de
    novo; medido ~1,5 s para subir um worker vazio e ~2,8 s com NumPy nesta máquina de teste.
    """
    if 'forkserver' in multiprocessing.get_all_start_methods():
        contexto = multiprocessing.get_context('forkserver')
        contexto.set_forkserver_preload([__name__])
        return contexto
    return multiprocessing.get_context('spawn')


# Blocos por tarefa no modo processos: menos idas e voltas entre processos. A divisão dos blocos não muda,
# só o agrupamento para o envio; cada worker escreve os seus blocos direto na matriz de saída compartilhada
# (nada de resultado volta pelo pipe).
BLOCOS_POR_TAREFA = 8


def _colocar(saida: np.ndarray, bloco, K) -> None:
    i0, i1, j0, j1 = bloco
    saida[i0:i1, j0:j1] = K


def _sequencial(A, B, partes, pesos, com_ia, saida):
    with _blas_uma_thread():
        for b in partes:
            _colocar(saida, b, calcular_bloco(A, B, b, pesos, com_ia))


def _threads(A, B, partes, pesos, com_ia, workers, saida):
    A.vetores64(), B.vetores64()  # converte antes, uma vez (as threads compartilham)
    with _blas_uma_thread(), ThreadPoolExecutor(max_workers=workers, thread_name_prefix='recalculo') as pool:
        futuros = [pool.submit(calcular_bloco, A, B, b, pesos, com_ia) for b in partes]
        for b, f in zip(partes, futuros):
            _colocar(saida, b, f.result())


def _processos(A, B, partes, pesos, com_ia, workers, saida, memoria):
    contexto = _contexto()
    lotes = [partes[k:k + BLOCOS_POR_TAREFA] for k in range(0, len(partes), BLOCOS_POR_TAREFA)]
    from multiprocessing import shared_memory

    memorias = []
    try:
        shm_a, desc_a = compartilhar(A)
        memorias.append(shm_a)
        shm_b, desc_b = compartilhar(B)
        memorias.append(shm_b)
        shm_s = shared_memory.SharedMemory(create=True, size=max(saida.nbytes, 1))
        memorias.append(shm_s)
        with ProcessPoolExecutor(max_workers=workers, mp_context=contexto, initializer=_iniciar_worker,
                                 initargs=(desc_a, desc_b, (shm_s.name, saida.shape), pesos, com_ia)) as pool:
            futuros = [pool.submit(_tarefa_processo, lote) for lote in lotes]
            for f in futuros:
                pid, pico = f.result()
                if pico is not None:
                    memoria[pid] = max(pico, memoria.get(pid, 0.0))
        saida[...] = np.ndarray(saida.shape, dtype=np.uint16, buffer=shm_s.buf)
    finally:
        for shm in memorias:
            shm.close()
            shm.unlink()


def calcular_todos(A: Grupo, B: Grupo, modo: str = 'sequencial', workers: int = 1,
                   pesos: dict | None = None, com_ia: bool = True) -> Resultado:
    """Scores de todos os pares A × B. Nunca levanta exceção por falha do pool (cai para sequencial)."""
    validar(modo, workers)
    inicio = time.perf_counter()
    partes = blocos(len(A), len(B))
    tarefas = len(partes) if modo == 'threads' else -(-len(partes) // BLOCOS_POR_TAREFA)
    usados = 1 if modo == 'sequencial' else max(1, min(workers, tarefas or 1))
    res = Resultado(matriz=np.zeros((len(A), len(B)), dtype=np.uint16), modo=modo, workers=usados, modo_pedido=modo)
    if not partes:
        res.tempo_s = time.perf_counter() - inicio
        return res
    try:
        if modo == 'sequencial':
            _sequencial(A, B, partes, pesos, com_ia, res.matriz)
        elif modo == 'threads':
            _threads(A, B, partes, pesos, com_ia, usados, res.matriz)
        else:
            _processos(A, B, partes, pesos, com_ia, usados, res.matriz, res.memoria_workers_mb)
    except Exception as erro:  # noqa: BLE001 — pool quebrado, sem memória, sem permissão: refaz no sequencial
        res.aviso = (f'O modo {modo} com {usados} worker(s) falhou ({type(erro).__name__}: {erro}); '
                     'cálculo refeito no modo sequencial.')
        logger.warning(res.aviso)
        res.modo, res.workers, res.memoria_workers_mb = 'sequencial', 1, {}
        _sequencial(A, B, partes, pesos, com_ia, res.matriz)
    res.tempo_s = time.perf_counter() - inicio
    return res
