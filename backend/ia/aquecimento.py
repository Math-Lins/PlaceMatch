"""
Aquecimento do modelo de IA quando o SERVIDOR da API sobe (runserver ou gunicorn).

IaConfig.ready() chama iniciar_se_servidor(): se o processo é o servidor, IA_HABILITADA e IA_AQUECIMENTO
estão ligados, uma thread daemon carrega o modelo (e as frases dos temas) em segundo plano. A subida não
espera, e o status da IA mostra "carregando" → "disponível" (ou "indisponível").

Nunca roda em testes, migrate, shell ou qualquer outro comando do manage.py (só runserver), nem no processo
"vigia" do autoreload do runserver (só no processo que atende as requisições, RUN_MAIN=true).
"""

from __future__ import annotations

import logging
import os
import sys
import threading

from django.conf import settings

logger = logging.getLogger('ia.servico')

_thread: threading.Thread | None = None


def eh_servidor(argv: list[str] | None = None, ambiente: dict | None = None) -> bool:
    """O processo atual é o servidor da API (e não um teste, migrate ou outro comando)?"""
    argv = sys.argv if argv is None else argv
    ambiente = os.environ if ambiente is None else ambiente
    programa = os.path.basename(argv[0]).lower() if argv else ''
    if 'gunicorn' in programa or 'gunicorn' in ambiente.get('SERVER_SOFTWARE', '').lower():
        return True
    if len(argv) > 1 and argv[1] == 'runserver':
        # Com autoreload, o runserver tem um processo vigia e um filho (RUN_MAIN=true) que atende.
        return ambiente.get('RUN_MAIN') == 'true' or '--noreload' in argv
    return False


def deve_aquecer(argv: list[str] | None = None, ambiente: dict | None = None) -> bool:
    if not getattr(settings, 'IA_HABILITADA', True) or not getattr(settings, 'IA_AQUECIMENTO', True):
        return False
    if getattr(settings, 'IA_EMBEDDER', 'fastembed') == 'falso':  # testes
        return False
    return eh_servidor(argv, ambiente)


def iniciar_se_servidor(argv: list[str] | None = None, ambiente: dict | None = None) -> threading.Thread | None:
    """Inicia a thread de aquecimento (uma vez por processo). Devolve a thread, ou None se não for o caso."""
    global _thread
    if not deve_aquecer(argv, ambiente):
        return None
    if _thread is not None and _thread.is_alive():
        return _thread
    from . import servico

    _thread = threading.Thread(target=servico.aquecer, name='ia-aquecimento', daemon=True)
    _thread.start()
    logger.info('Aquecimento do modelo de IA iniciado em segundo plano.')
    return _thread


def _depois_do_fork() -> None:
    """
    Processo filho de um fork (ex.: gunicorn --preload, em que o ready() rodou no processo mestre): zera o
    estado do serviço (travas e modelo não sobrevivem ao fork) e, no servidor, aquece o modelo do filho.
    """
    global _thread
    _thread = None
    servico = sys.modules.get('ia.servico')
    if servico is not None:
        servico._depois_do_fork()
    if eh_servidor() and deve_aquecer():
        iniciar_se_servidor()


if hasattr(os, 'register_at_fork'):  # só POSIX
    os.register_at_fork(after_in_child=_depois_do_fork)
